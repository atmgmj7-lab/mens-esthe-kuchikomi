import "server-only";

import {
  analyticsSuccess,
  type AnalyticsSourceResult,
  type AnalyticsSourceState,
  type AnalyticsWarning,
} from "./result";

const ORIGIN = "https://mens-esthe-kuchikomi.com";
const TARGET_PATHS = [
  "/",
  "/area/sakai/",
  "/area/shinosaka/",
  "/area/nihonbashi/",
  "/area/sakaisujihonmachi/",
  "/area/umeda/",
] as const;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 3;
const MAX_TIMEOUT_MS = 60_000;
const MAX_CONCURRENCY = TARGET_PATHS.length;

export type SiteHealthMetadata = {
  title: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
  indexable: boolean | null;
  indexabilityReason: "indexable" | "noindex" | "http_error" | "redirect" | "metadata_invalid";
};

export type SiteHealthTargetResult = {
  path: string;
  url: string;
  httpStatus: number | null;
  checkedAt: string;
  state: AnalyticsSourceState;
  data: SiteHealthMetadata | null;
  warnings: AnalyticsWarning[];
};

export type SiteHealthData = { targets: SiteHealthTargetResult[] };

export type CollectSiteHealthOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  concurrency?: number;
};

function warning(code: string, state: AnalyticsSourceState): AnalyticsWarning[] {
  return [{ code, message: `state=${state}; code=${code}` }];
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError");
}

function decoded(value: string): string {
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"", vert: "|",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, key: string) => {
    if (key[0] !== "#") return named[key.toLowerCase()] ?? entity;
    const radix = key[1]?.toLowerCase() === "x" ? 16 : 10;
    const numeric = Number.parseInt(key.slice(radix === 16 ? 2 : 1), radix);
    try {
      return Number.isInteger(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity;
    } catch {
      return entity;
    }
  }).replace(/\s+/g, " ").trim();
}

function textContent(value: string): string {
  return decoded(value.replace(/<[^>]*>/g, " "));
}

function withoutExecutableText(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function attributes(tag: string): Map<string, string> {
  const inner = tag.replace(/^<\s*[^\s/>]+\s*/i, "").replace(/\/?>\s*$/, "");
  const result = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of inner.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (value !== undefined) result.set(name, decoded(value));
  }
  return result;
}

function firstElementText(html: string, name: "title" | "h1"): string | null {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i").exec(html);
  if (!match) return null;
  const value = textContent(match[1]);
  return value === "" ? null : value;
}

type MetadataEvidence = {
  title: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
  valid: boolean;
};

function canonicalUrl(html: string): { value: string | null; valid: boolean } {
  const values: string[] = [];
  let valid = true;
  for (const tag of tags(html, "link")) {
    const attrs = attributes(tag);
    const rel = attrs.get("rel")?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes("canonical")) continue;
    const value = attrs.get("href");
    if (!value) {
      valid = false;
      continue;
    }
    try {
      const url = new URL(value);
      if (url.username !== "" || url.password !== "") {
        valid = false;
        continue;
      }
      values.push(url.toString());
      if (url.protocol !== "https:" || url.hostname !== "mens-esthe-kuchikomi.com" || url.port !== "") valid = false;
    } catch {
      valid = false;
    }
  }
  if (values.length !== 1) return { value: null, valid: false };
  return { value: values[0], valid };
}

function robotsValue(html: string): string | null {
  const values: string[] = [];
  for (const tag of tags(html, "meta")) {
    const attrs = attributes(tag);
    if (attrs.get("name")?.toLowerCase() !== "robots") continue;
    const value = attrs.get("content");
    if (value !== undefined && value !== "") values.push(value);
  }
  return values.length === 0 ? null : values.join(", ");
}

function hasHtmlContentType(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.startsWith("text/html") || contentType.startsWith("application/xhtml+xml");
}

function metadataEvidence(response: Response, html: string): MetadataEvidence {
  if (!hasHtmlContentType(response)) {
    return { title: null, h1: null, canonical: null, robots: null, valid: false };
  }
  const safeHtml = withoutExecutableText(html);
  const title = firstElementText(safeHtml, "title");
  const h1 = firstElementText(safeHtml, "h1");
  const canonical = canonicalUrl(safeHtml);
  const robots = robotsValue(safeHtml);
  const isCompleteDocument = /<html\b/i.test(html) && /<\/html\s*>/i.test(html);
  return {
    title,
    h1,
    canonical: canonical.value,
    robots,
    valid: isCompleteDocument && title !== null && h1 !== null && canonical.valid,
  };
}

function metadataFromEvidence(
  evidence: MetadataEvidence,
  indexabilityReason: SiteHealthMetadata["indexabilityReason"]
): SiteHealthMetadata {
  if (indexabilityReason === "metadata_invalid" || indexabilityReason === "http_error" || indexabilityReason === "redirect") {
    return {
      title: evidence.title,
      h1: evidence.h1,
      canonical: evidence.canonical,
      robots: evidence.robots,
      indexable: null,
      indexabilityReason,
    };
  }
  const noindex = evidence.robots?.toLowerCase().split(/[\s,]+/).includes("noindex") ?? false;
  return {
    title: evidence.title,
    h1: evidence.h1,
    canonical: evidence.canonical,
    robots: evidence.robots,
    indexable: !noindex,
    indexabilityReason: noindex ? "noindex" : "indexable",
  };
}

function targetResult(
  path: string,
  checkedAt: string,
  state: AnalyticsSourceState,
  httpStatus: number | null,
  data: SiteHealthMetadata | null,
  code?: string
): SiteHealthTargetResult {
  return {
    path,
    url: `${ORIGIN}${path}`,
    httpStatus,
    checkedAt,
    state,
    data,
    warnings: code ? warning(code, state) : [],
  };
}

async function checkTarget(
  path: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  checkedAt: string
): Promise<SiteHealthTargetResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${ORIGIN}${path}`, {
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      return targetResult(path, checkedAt, "partial", response.status, metadataFromEvidence(
        { title: null, h1: null, canonical: null, robots: null, valid: false },
        "redirect"
      ), `site_health_redirect_http_${response.status}`);
    }
    let html: string;
    try {
      html = await response.text();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return targetResult(path, checkedAt, "timeout", response.status, null, "site_health_timeout");
      }
      return targetResult(path, checkedAt, "api_error", response.status, null, "site_health_body_read_failed");
    }
    const evidence = metadataEvidence(response, html);
    if (!response.ok) {
      return targetResult(path, checkedAt, "api_error", response.status, metadataFromEvidence(evidence, "http_error"), `site_health_http_${response.status}`);
    }
    if (!evidence.valid) {
      return targetResult(path, checkedAt, "invalid_response", response.status, metadataFromEvidence(evidence, "metadata_invalid"), "site_health_metadata_invalid");
    }
    return targetResult(path, checkedAt, "ok", response.status, metadataFromEvidence(evidence, "indexable"), undefined);
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      return targetResult(path, checkedAt, "timeout", null, null, "site_health_timeout");
    }
    return targetResult(path, checkedAt, "api_error", null, null, "site_health_request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

function validTimeout(timeoutMs: number): boolean {
  return Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS;
}

function validConcurrency(concurrency: number): boolean {
  return Number.isInteger(concurrency) && concurrency > 0 && concurrency <= MAX_CONCURRENCY;
}

export async function collectSiteHealth(options: CollectSiteHealthOptions = {}): Promise<AnalyticsSourceResult<SiteHealthData>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  if (!validTimeout(timeoutMs)) throw new RangeError("timeoutMs must be a positive integer no greater than 60000");
  if (!validConcurrency(concurrency)) throw new RangeError(`concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);

  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;
  const results: SiteHealthTargetResult[] = new Array(TARGET_PATHS.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < TARGET_PATHS.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await checkTarget(TARGET_PATHS[index], fetchImpl, timeoutMs, checkedAt);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, TARGET_PATHS.length) }, worker));
  const state = results.every((result) => result.state === "ok") ? "ok" : "partial";
  return analyticsSuccess({ targets: results }, { state, collectedAt: checkedAt });
}
