const DEFAULT_WP_API_BASE = "https://mens-esthe-kuchikomi.com/wp-json";
const DEFAULT_WP_BASE = "https://mens-esthe-kuchikomi.com";

export const wpApiBase = process.env.WP_API_BASE_URL || DEFAULT_WP_API_BASE;
export const wpBase = process.env.NEXT_PUBLIC_WP_BASE_URL || DEFAULT_WP_BASE;

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
  const response = await fetch(url, {
    ...init,
    next: { ...(init?.next || {}) }
  });

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
