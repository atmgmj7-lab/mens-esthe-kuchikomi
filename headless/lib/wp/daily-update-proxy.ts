import "server-only";
import { Buffer } from "node:buffer";
import { secretsMatch } from "@/lib/server/secure-secret";

export const DAILY_UPDATE_MAX_BODY_BYTES = 262_144;
export const DAILY_UPDATE_SECRET_HEADER = "x-escomi-daily-update-secret";

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
  "link",
  "x-wp-total",
  "x-wp-totalpages",
] as const;

export type DailyUpdateEnvironment = {
  proxySecret: string;
  wpUser: string;
  wpAppPassword: string;
};

type DailyUpdateRequestLike = {
  body: ReadableStream<Uint8Array> | null;
  headers: Headers;
};

type DailyUpdateRejection = {
  ok: false;
  status: 400 | 401 | 405 | 413 | 503;
  error: string;
};

type DailyUpdateUpstreamRequest = {
  ok: true;
  pathWithSearch: "/wp-json/escomi/v1/update";
  headers: Headers;
  body: Uint8Array;
  payload: unknown;
};

type BoundedJsonResult =
  | { ok: true; body: Uint8Array; payload: unknown }
  | DailyUpdateRejection;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function readDailyUpdateEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): DailyUpdateEnvironment | null {
  const proxySecret = environment.DAILY_UPDATE_PROXY_SECRET;
  const wpUser = environment.WP_DAILY_UPDATE_USER;
  const wpAppPassword = environment.WP_DAILY_UPDATE_APP_PASSWORD;

  if (!hasValue(proxySecret) || !hasValue(wpUser) || !hasValue(wpAppPassword)) {
    return null;
  }

  return { proxySecret, wpUser, wpAppPassword };
}

export function buildDailyUpdateUpstreamHeaders(
  environment: DailyUpdateEnvironment,
): Headers {
  const credentials = Buffer.from(
    `${environment.wpUser}:${environment.wpAppPassword}`,
    "utf8",
  ).toString("base64");
  return new Headers({
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  });
}

export function buildWpProxyResponse(
  response: Response,
  method: "GET" | "HEAD" | "POST",
): Response {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (method === "POST") headers.set("Cache-Control", "no-store");

  return new Response(method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function readBoundedJsonBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedJsonResult> {
  if (!body) {
    return { ok: false, status: 400, error: "JSON body is required" };
  }

  const reader = body.getReader();
  const buffer = new Uint8Array(maxBytes);
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      if (value.byteLength > maxBytes - totalBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Request body is too large" };
      }

      buffer.set(value, totalBytes);
      totalBytes += value.byteLength;
    }
  } catch {
    return { ok: false, status: 400, error: "Request body could not be read" };
  } finally {
    reader.releaseLock();
  }

  const requestBody = buffer.slice(0, totalBytes);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(requestBody);
    return { ok: true, body: requestBody, payload: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON" };
  }
}

export async function buildDailyUpdateRequest({
  request,
  targetPath,
  environment,
}: {
  request: DailyUpdateRequestLike;
  targetPath: string;
  environment?: DailyUpdateEnvironment | null;
}): Promise<DailyUpdateUpstreamRequest | DailyUpdateRejection> {
  if (targetPath !== "escomi/v1/update") {
    return { ok: false, status: 405, error: "POST is not allowed for this path" };
  }

  const resolvedEnvironment =
    environment === undefined ? readDailyUpdateEnvironment() : environment;
  if (!resolvedEnvironment) {
    return { ok: false, status: 503, error: "Daily update bridge is not configured" };
  }

  const callerSecret = request.headers.get(DAILY_UPDATE_SECRET_HEADER);
  if (!callerSecret || !secretsMatch(resolvedEnvironment.proxySecret, callerSecret)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const mediaType = contentType.split(";", 1)[0].trim();
  if (mediaType !== "application/json") {
    return { ok: false, status: 400, error: "Content-Type must be application/json" };
  }

  const parsedBody = await readBoundedJsonBody(request.body, DAILY_UPDATE_MAX_BODY_BYTES);
  if (!parsedBody.ok) return parsedBody;

  return {
    ok: true,
    pathWithSearch: "/wp-json/escomi/v1/update",
    headers: buildDailyUpdateUpstreamHeaders(resolvedEnvironment),
    body: parsedBody.body,
    payload: parsedBody.payload,
  };
}
