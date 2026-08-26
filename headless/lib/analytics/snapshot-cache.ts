import "server-only";

import { randomUUID } from "node:crypto";
import { cacheLife } from "next/cache";

import type { AnalyticsDays } from "./period";
import { collectFreshAnalyticsSnapshot, type AnalyticsSnapshot } from "./snapshot";

export const SNAPSHOT_CACHE_TTL_SECONDS: Readonly<Record<AnalyticsDays, number>> = Object.freeze({
  7: 900,
  28: 1_800,
});

const CACHEABLE_ROOT_STATES = new Set(["ok", "no_data"]);
const CACHEABLE_REPORT_PARTIAL = /(?:_no_rows|_pagination_cap)$/u;
const CACHEABLE_WEB_PARTIAL = /^site_health_redirect_http_3\d\d$/u;
const CACHEABLE_CONTENT_PARTIAL = new Set(["wordpress_content_partial"]);
const FAILURE_CACHE_TTL_MILLISECONDS = 120_000;
const HANDOFF_TTL_MILLISECONDS = 120_000;
const MAX_PENDING_HANDOFFS = 8;

function partialIsCacheable(source: keyof AnalyticsSnapshot["sources"], snapshot: AnalyticsSnapshot): boolean {
  if (source === "ga4" || source === "gsc") {
    const warnings = snapshot.sources[source].warnings;
    return warnings.length > 0 && warnings.every((warning) => CACHEABLE_REPORT_PARTIAL.test(warning.code));
  }
  if (source === "web") {
    const targets = snapshot.siteHealth;
    return Array.isArray(targets) && targets.length > 0 &&
      snapshot.sources.web.warnings.every((warning) => CACHEABLE_WEB_PARTIAL.test(warning.code)) &&
      targets.every((target) => target.state === "ok" || target.state === "partial" &&
        target.warnings.length > 0 && target.warnings.every((warning) => CACHEABLE_WEB_PARTIAL.test(warning.code)));
  }
  const warnings = snapshot.sources.content.warnings;
  return snapshot.contentHealth !== null && warnings.length > 0 &&
    warnings.every((warning) => CACHEABLE_CONTENT_PARTIAL.has(warning.code));
}

export function isAnalyticsSnapshotCacheable(snapshot: AnalyticsSnapshot): boolean {
  return (Object.keys(snapshot.sources) as Array<keyof AnalyticsSnapshot["sources"]>).every((source) => {
    const state = snapshot.sources[source].state;
    return CACHEABLE_ROOT_STATES.has(state) || state === "partial" && partialIsCacheable(source, snapshot);
  });
}

type SnapshotLoader = (days: AnalyticsDays) => Promise<AnalyticsSnapshot>;
const NON_CACHEABLE_ERROR_MESSAGE = "Analytics Snapshot is not cacheable";
const NON_CACHEABLE_DIGEST_PREFIX = "analytics-non-cacheable:";

class NonCacheableSnapshotError extends Error {
  readonly digest: string;

  constructor(days: AnalyticsDays, id: string) {
    super(NON_CACHEABLE_ERROR_MESSAGE);
    this.name = "NonCacheableSnapshotError";
    this.digest = `${NON_CACHEABLE_DIGEST_PREFIX}${days}:${id}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createNonCacheableSnapshotHandoff(options: {
  createId?: () => string;
  schedule?: (callback: () => void, delayMilliseconds: number) => unknown;
  cancel?: (handle: unknown) => void;
} = {}) {
  const createId = options.createId ?? randomUUID;
  const schedule = options.schedule ?? ((callback: () => void, delayMilliseconds: number) => {
    const handle = setTimeout(callback, delayMilliseconds);
    handle.unref();
    return handle;
  });
  const cancel = options.cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const pending = new Map<string, { snapshot: AnalyticsSnapshot; timer: unknown }>();
  return {
    reject(days: AnalyticsDays, snapshot: AnalyticsSnapshot): never {
      const id = createId();
      if (!/^[a-z0-9_-]{1,64}$/iu.test(id)) throw new Error(NON_CACHEABLE_ERROR_MESSAGE);
      const key = `${days}:${id}`;
      if (pending.size >= MAX_PENDING_HANDOFFS) {
        const oldest = pending.entries().next().value as [string, { snapshot: AnalyticsSnapshot; timer: unknown }] | undefined;
        if (oldest) {
          cancel(oldest[1].timer);
          pending.delete(oldest[0]);
        }
      }
      const timer = schedule(() => pending.delete(key), HANDOFF_TTL_MILLISECONDS);
      pending.set(key, { snapshot, timer });
      throw new NonCacheableSnapshotError(days, id);
    },
    recover(error: unknown): AnalyticsSnapshot | null {
      if (!isRecord(error) || typeof error.digest !== "string") return null;
      const match = /^analytics-non-cacheable:(7|28):([a-z0-9_-]{1,64})$/iu.exec(error.digest);
      if (!match) return null;
      const key = `${match[1]}:${match[2]}`;
      const entry = pending.get(key);
      if (!entry) return null;
      cancel(entry.timer);
      pending.delete(key);
      return entry.snapshot;
    },
  };
}

function staleProjection(snapshot: AnalyticsSnapshot, days: AnalyticsDays, now: Date): AnalyticsSnapshot {
  const generatedAt = Date.parse(snapshot.generatedAt);
  const ttlMilliseconds = SNAPSHOT_CACHE_TTL_SECONDS[days] * 1_000;
  if (!Number.isFinite(generatedAt) || now.getTime() - generatedAt < ttlMilliseconds) return snapshot;
  const code = "analytics_snapshot_cache_stale";
  if (snapshot.warnings.some((warning) => warning.code === code)) return snapshot;
  return {
    ...snapshot,
    warnings: [
      ...snapshot.warnings,
      { code, message: `state=partial; code=${code}; reason=past_revalidate_ttl` },
    ].sort((left, right) => left.code.localeCompare(right.code)),
  };
}

export function createAnalyticsSnapshotReader(options: {
  load: SnapshotLoader;
  now?: () => Date;
}): (input: { days: AnalyticsDays }) => Promise<AnalyticsSnapshot> {
  const now = options.now ?? (() => new Date());
  const flights = new Map<AnalyticsDays, Promise<AnalyticsSnapshot>>();
  const failures = new Map<AnalyticsDays, { snapshot: AnalyticsSnapshot; expiresAt: number }>();
  return ({ days }) => {
    const requestTime = now();
    const failure = failures.get(days);
    if (failure && requestTime.getTime() < failure.expiresAt) return Promise.resolve(failure.snapshot);
    if (failure) failures.delete(days);
    const existing = flights.get(days);
    if (existing) return existing;
    const pending = Promise.resolve()
      .then(() => options.load(days))
      .then((snapshot) => {
        const loadedAt = now();
        if (isAnalyticsSnapshotCacheable(snapshot)) failures.delete(days);
        else failures.set(days, { snapshot, expiresAt: loadedAt.getTime() + FAILURE_CACHE_TTL_MILLISECONDS });
        return staleProjection(snapshot, days, loadedAt);
      });
    flights.set(days, pending);
    const cleanup = () => {
      if (flights.get(days) === pending) flights.delete(days);
    };
    pending.then(cleanup, cleanup);
    return pending;
  };
}

const nonCacheableSnapshotHandoff = createNonCacheableSnapshotHandoff();
const recentRemoteFailures = new Map<AnalyticsDays, { snapshot: AnalyticsSnapshot; expiresAt: number }>();

async function loadRemoteAnalyticsSnapshot(days: AnalyticsDays): Promise<AnalyticsSnapshot> {
  "use cache: remote";
  const ttl = SNAPSHOT_CACHE_TTL_SECONDS[days];
  cacheLife({ stale: 0, revalidate: ttl, expire: ttl * 4 });
  const now = Date.now();
  const recentFailure = recentRemoteFailures.get(days);
  if (recentFailure && now < recentFailure.expiresAt) {
    nonCacheableSnapshotHandoff.reject(days, recentFailure.snapshot);
  }
  if (recentFailure) recentRemoteFailures.delete(days);
  const snapshot = await collectFreshAnalyticsSnapshot({ days });
  if (!isAnalyticsSnapshotCacheable(snapshot)) {
    recentRemoteFailures.set(days, { snapshot, expiresAt: Date.now() + FAILURE_CACHE_TTL_MILLISECONDS });
    nonCacheableSnapshotHandoff.reject(days, snapshot);
  }
  recentRemoteFailures.delete(days);
  return snapshot;
}

async function loadProductionSnapshot(days: AnalyticsDays): Promise<AnalyticsSnapshot> {
  try {
    return await loadRemoteAnalyticsSnapshot(days);
  } catch (error) {
    const snapshot = nonCacheableSnapshotHandoff.recover(error);
    if (snapshot) return snapshot;
    throw error;
  }
}

const readProductionSnapshot = createAnalyticsSnapshotReader({ load: loadProductionSnapshot });

export function getAnalyticsSnapshot(options: { days: AnalyticsDays }): Promise<AnalyticsSnapshot> {
  return readProductionSnapshot(options);
}
