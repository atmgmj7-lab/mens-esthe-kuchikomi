import http from "node:http";
import { WP_ORIGIN_IP, wpOriginHost } from "@/lib/wp/origin";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade"
]);

type OriginRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | ArrayBuffer | Uint8Array | null;
  forwardCookies?: boolean;
  timeoutMs?: number;
};

const DEFAULT_WP_ORIGIN_TIMEOUT_MS = 10_000;

function resolveTimeoutMs(timeoutMs?: number): number {
  const candidate = timeoutMs ?? Number(process.env.WP_ORIGIN_TIMEOUT_MS);
  if (Number.isFinite(candidate) && candidate > 0) {
    return candidate;
  }
  return DEFAULT_WP_ORIGIN_TIMEOUT_MS;
}

async function toBuffer(
  body: BodyInit | ArrayBuffer | Uint8Array
): Promise<Buffer | undefined> {
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  return undefined;
}

export function requestWpOrigin(
  pathWithSearch: string,
  options?: OriginRequestOptions
): Promise<Response> {
  const method = (options?.method || "GET").toUpperCase();
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  const timeoutMs = resolveTimeoutMs(options?.timeoutMs);

  const reqHeaders: Record<string, string> = {
    Host: wpOriginHost
  };

  if (options?.headers) {
    const incoming = new Headers(options.headers);
    for (const [key, value] of incoming.entries()) {
      const lower = key.toLowerCase();
      if (lower === "host") {
        continue;
      }
      if (lower === "cookie" && !options?.forwardCookies) {
        continue;
      }
      reqHeaders[key] = value;
    }
  }

  return new Promise((resolve, reject) => {
    const send = async () => {
      let bodyBuffer: Buffer | undefined;
      if (options?.body != null && method !== "GET" && method !== "HEAD") {
        bodyBuffer = await toBuffer(options.body);
        if (bodyBuffer) {
          reqHeaders["Content-Length"] = String(bodyBuffer.length);
        }
      }

      const req = http.request(
        {
          hostname: WP_ORIGIN_IP,
          port: 80,
          path,
          method,
          headers: reqHeaders
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => {
            const buffer = Buffer.concat(chunks);
            const responseHeaders = new Headers();

            for (const [key, value] of Object.entries(res.headers)) {
              if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
                continue;
              }
              if (Array.isArray(value)) {
                for (const item of value) {
                  responseHeaders.append(key, item);
                }
              } else {
                responseHeaders.set(key, value);
              }
            }

            resolve(
              new Response(buffer, {
                status: res.statusCode || 500,
                statusText: res.statusMessage || "",
                headers: responseHeaders
              })
            );
          });
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`WordPress origin request timed out after ${timeoutMs}ms: ${method} ${path}`));
      });

      req.on("error", reject);
      if (bodyBuffer) {
        req.write(bodyBuffer);
      }
      req.end();
    };

    void send().catch(reject);
  });
}
