import { NextResponse } from "next/server";

const PUBLIC_BASE_URL = "https://mens-esthe-kuchikomi.com";
const PUBLIC_BASE_URL_ENCODED = "https%3A%2F%2Fmens-esthe-kuchikomi.com";
const UPSTREAM_URL_REPLACEMENTS = [
  { pattern: /http:\/\/mens-esthe-kuchikomi\.com/gi, replacement: PUBLIC_BASE_URL },
  { pattern: /http:\/\/85\.131\.213\.108/gi, replacement: PUBLIC_BASE_URL },
  { pattern: /http%3A%2F%2Fmens-esthe-kuchikomi\.com/gi, replacement: PUBLIC_BASE_URL_ENCODED },
  { pattern: /http%3A%2F%2F85\.131\.213\.108/gi, replacement: PUBLIC_BASE_URL_ENCODED }
];

const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "set-cookie",
  "location",
  "refresh",
  "content-disposition"
] as const;

function normalizeUpstreamUrl(value: string): string {
  return UPSTREAM_URL_REPLACEMENTS.reduce(
    (current, { pattern, replacement }) => current.replace(pattern, replacement),
    value
  );
}

function shouldRewriteBody(response: Response, method: string): boolean {
  if (method === "HEAD") {
    return false;
  }
  const contentType = response.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("text/html");
}

export async function buildWpAdminProxyResponse(response: Response, method: string) {
  const headers = new Headers();

  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) {
      headers.set(name, name === "location" || name === "refresh" ? normalizeUpstreamUrl(value) : value);
    }
  }

  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("cache-control", "no-cache, no-store, must-revalidate");

  if (!shouldRewriteBody(response, method)) {
    return new NextResponse(method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const html = normalizeUpstreamUrl(await response.text());
  return new NextResponse(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
