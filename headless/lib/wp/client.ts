import { requestWpOrigin, resolveWpOriginTimeoutMs } from "@/lib/wp/origin-request";
import { usesWpOriginIp } from "@/lib/wp/origin";

const DEFAULT_WP_API_BASE = "https://85.131.213.108/wp-json";
const DEFAULT_WP_BASE = "https://mens-esthe-kuchikomi.com";

export { WP_ORIGIN_IP, wpOriginBaseUrl, wpOriginHost } from "@/lib/wp/origin";

function resolveAbsoluteHttpUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate || !/^https?:\/\//i.test(candidate)) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      candidate.includes("?") ||
      candidate.includes("#") ||
      parsed.search ||
      parsed.hash
    ) {
      return fallback;
    }

    const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
    return `${parsed.origin}${pathname}`;
  } catch {
    return fallback;
  }
}

function resolveAbsoluteHttpsUrl(value: string | undefined, fallback: string): string {
  const resolved = resolveAbsoluteHttpUrl(value, fallback);
  return resolved.startsWith("https://") ? resolved : fallback;
}

export const wpApiBase = resolveAbsoluteHttpsUrl(process.env.WP_API_BASE_URL, DEFAULT_WP_API_BASE);
export const wpBase = resolveAbsoluteHttpUrl(process.env.NEXT_PUBLIC_WP_BASE_URL, DEFAULT_WP_BASE);

function toOriginPath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function pickForwardHeaders(init?: HeadersInit): HeadersInit | undefined {
  if (!init) {
    return undefined;
  }

  const incoming = new Headers(init);
  const headers = new Headers();
  const authorization = incoming.get("authorization");
  const contentType = incoming.get("content-type");

  if (authorization) {
    headers.set("Authorization", authorization);
  }
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return headers.entries().next().done ? undefined : headers;
}

async function wpRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${wpApiBase}${path}`;

  if (usesWpOriginIp(wpApiBase)) {
    return requestWpOrigin(toOriginPath(url), {
      method: init?.method,
      headers: pickForwardHeaders(init?.headers),
      body: init?.body ?? null
    });
  }

  const timeoutSignal = AbortSignal.timeout(resolveWpOriginTimeoutMs());
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(url, {
    ...init,
    signal,
    next: { ...(init?.next || {}) }
  });
}

export type WpPagination = {
  total: number;
  totalPages: number;
};

export async function wpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await wpFetchPaginated<T>(path, init);
  return data;
}

export async function wpFetchPaginated<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; pagination: WpPagination }> {
  const url = path.startsWith("http") ? path : `${wpApiBase}${path}`;
  const response = await wpRequest(path, init);

  if (!response.ok) {
    throw new Error(`WordPress fetch failed: ${response.status} ${url}`);
  }

  const data = (await response.json()) as T;
  return {
    data,
    pagination: {
      total: Number(response.headers.get("x-wp-total") || 0),
      totalPages: Number(response.headers.get("x-wp-totalpages") || 1)
    }
  };
}

export function safeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

export function stripHtml(value: unknown): string {
  return safeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function rendered(value: { rendered?: string } | undefined): string {
  return value?.rendered || "";
}

export function absoluteUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${wpBase}${path.startsWith("/") ? path : `/${path}`}`;
}
