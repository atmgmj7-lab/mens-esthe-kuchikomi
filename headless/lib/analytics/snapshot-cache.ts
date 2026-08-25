import "server-only";

import { cacheLife } from "next/cache";

import type { AnalyticsDays } from "./period";
import { collectFreshAnalyticsSnapshot, type AnalyticsSnapshot } from "./snapshot";

export const SNAPSHOT_CACHE_TTL_SECONDS: Readonly<Record<AnalyticsDays, number>> = Object.freeze({
  7: 900,
  28: 1_800,
});

const CACHEABLE_ROOT_STATES = new Set(["ok", "no_data"]);
const CACHEABLE_REPORT_PARTIAL = /(?:_no_rows|_pagination_cap)$/u;
const FAILURE_CACHE_TTL_MILLISECONDS = 120_000;

function partialIsCacheable(source: keyof AnalyticsSnapshot["sources"], snapshot: AnalyticsSnapshot): boolean {
  if (source === "ga4" || source === "gsc") {
    const warnings = snapshot.sources[source].warnings;
    return warnings.length > 0 && warnings.every((warning) => CACHEABLE_REPORT_PARTIAL.test(warning.code));
  }
  if (source === "web") {
    return Array.isArray(snapshot.siteHealth) && snapshot.siteHealth.some((target) => target.state === "ok" || target.state === "partial");
  }
  return snapshot.contentHealth !== null;
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

  constructor(days: AnalyticsDays) {
    super(NON_CACHEABLE_ERROR_MESSAGE);
    this.name = "NonCacheableSnapshotError";
    this.digest = `${NON_CACHEABLE_DIGEST_PREFIX}${days}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createNonCacheableSnapshotHandoff() {
  const pending = new Map<AnalyticsDays, AnalyticsSnapshot>();
  return {
    reject(days: AnalyticsDays, snapshot: AnalyticsSnapshot): never {
      pending.set(days, snapshot);
      throw new NonCacheableSnapshotError(days);
    },
    recover(error: unknown): AnalyticsSnapshot | null {
      if (!isRecord(error) || typeof error.digest !== "string") return null;
      const days = error.digest === `${NON_CACHEABLE_DIGEST_PREFIX}7` ? 7
        : error.digest === `${NON_CACHEABLE_DIGEST_PREFIX}28` ? 28
          : null;
      if (days === null) return null;
      const snapshot = pending.get(days) ?? null;
      if (snapshot) pending.delete(days);
      return snapshot;
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

async function loadRemoteAnalyticsSnapshot(days: AnalyticsDays): Promise<AnalyticsSnapshot> {
  "use cache: remote";
  const ttl = SNAPSHOT_CACHE_TTL_SECONDS[days];
  cacheLife({ stale: 0, revalidate: ttl, expire: ttl * 4 });
  const snapshot = await collectFreshAnalyticsSnapshot({ days });
  if (!isAnalyticsSnapshotCacheable(snapshot)) nonCacheableSnapshotHandoff.reject(days, snapshot);
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
