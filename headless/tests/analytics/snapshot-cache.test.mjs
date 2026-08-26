import assert from "node:assert/strict";
import { test } from "node:test";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const {
  SNAPSHOT_CACHE_TTL_SECONDS,
  createAnalyticsSnapshotReader,
  createNonCacheableSnapshotHandoff,
  isAnalyticsSnapshotCacheable,
} = await import("../../lib/analytics/snapshot-cache.ts");

const collectedAt = "2026-08-26T00:00:00.000Z";

function source(state, warnings = []) {
  return { state, collectedAt, warnings };
}

function siteHealthTarget(state, code = null) {
  const path = state === "ok" ? "/" : `/area/${state}/`;
  return {
    path,
    url: `https://mens-esthe-kuchikomi.com${path}`,
    httpStatus: state === "ok" ? 200 : state === "partial" ? 301 : null,
    checkedAt: collectedAt,
    state,
    data: state === "timeout" || state === "api_error" ? null : {
      title: state === "ok" ? "Page" : null,
      h1: state === "ok" ? "Heading" : null,
      canonical: state === "ok" ? `https://mens-esthe-kuchikomi.com${path}` : null,
      robots: null,
      indexable: state === "ok" ? true : null,
      indexabilityReason: state === "ok" ? "indexable" : state === "partial" ? "redirect" : "metadata_invalid",
    },
    warnings: code ? [{ code, message: `code=${code}` }] : [],
  };
}

function snapshot(overrides = {}) {
  return {
    schemaVersion: "1.0.0",
    timezone: "Asia/Tokyo",
    generatedAt: overrides.generatedAt ?? collectedAt,
    collectedAt: overrides.collectedAt ?? collectedAt,
    sources: {
      ga4: source("ok"),
      gsc: source("ok"),
      web: source("ok"),
      content: source("ok"),
      ...overrides.sources,
    },
    siteHealth: overrides.siteHealth ?? null,
    contentHealth: overrides.contentHealth ?? null,
    warnings: overrides.warnings ?? [],
  };
}

function clock(start = collectedAt) {
  let value = Date.parse(start);
  return {
    now: () => new Date(value),
    advance: (milliseconds) => { value += milliseconds; },
  };
}

function remoteHarness({ now, collect }) {
  const entries = new Map();
  let collectorCalls = 0;
  return {
    collectorCalls: () => collectorCalls,
    load: async (days) => {
      const entry = entries.get(days);
      const ttl = SNAPSHOT_CACHE_TTL_SECONDS[days] * 1_000;
      if (entry && now().getTime() - entry.storedAt < ttl) return entry.snapshot;
      collectorCalls += 1;
      try {
        const next = await collect(days);
        if (isAnalyticsSnapshotCacheable(next)) {
          entries.set(days, { snapshot: next, storedAt: now().getTime() });
          return next;
        }
        return entry?.snapshot ?? next;
      } catch (error) {
        if (entry) return entry.snapshot;
        throw error;
      }
    },
  };
}

test("snapshot cache uses the fixed 7-day and 28-day TTL contract", () => {
  assert.deepEqual(SNAPSHOT_CACHE_TTL_SECONDS, { 7: 900, 28: 1_800 });
});

test("snapshot cache accepts all-ok and legitimate no-data sources", () => {
  assert.equal(isAnalyticsSnapshotCacheable(snapshot()), true);
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { ga4: source("no_data", [{ code: "ga4_no_rows", message: "code=ga4_no_rows" }]) },
  })), true);
});

test("snapshot cache accepts bounded partials but rejects systemic partial evidence", () => {
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { ga4: source("partial", [{ code: "ga4_overview_no_rows", message: "code=ga4_overview_no_rows" }]) },
  })), true);
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { gsc: source("partial", [{ code: "gsc_query_pagination_cap", message: "code=gsc_query_pagination_cap" }]) },
  })), true);
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { web: source("partial", [{ code: "site_health_redirect_http_301", message: "code=site_health_redirect_http_301" }]) },
    siteHealth: [siteHealthTarget("ok"), siteHealthTarget("partial", "site_health_redirect_http_301")],
  })), true);
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { content: source("partial", [{ code: "wordpress_content_partial", message: "code=wordpress_content_partial" }]) },
    contentHealth: { areas: [] },
  })), true);

  for (const code of [
    "ga4_overview_http_401",
    "ga4_overview_http_500",
    "ga4_overview_invalid_shape",
    "ga4_overview_timeout",
  ]) {
    assert.equal(isAnalyticsSnapshotCacheable(snapshot({
      sources: { ga4: source("partial", [{ code, message: `code=${code}` }]) },
    })), false, code);
  }
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { web: source("partial", [{ code: "site_health_timeout", message: "code=site_health_timeout" }]) },
    siteHealth: [siteHealthTarget("timeout", "site_health_timeout"), siteHealthTarget("api_error", "site_health_request_failed")],
  })), false);
  for (const state of ["timeout", "api_error", "invalid_response"]) {
    assert.equal(isAnalyticsSnapshotCacheable(snapshot({
      sources: { web: source("partial", [{ code: `site_health_${state}`, message: `code=site_health_${state}` }]) },
      siteHealth: [siteHealthTarget("ok"), siteHealthTarget(state, `site_health_${state}`)],
    })), false, `mixed web ${state}`);
  }
  assert.equal(isAnalyticsSnapshotCacheable(snapshot({
    sources: { content: source("partial", [{ code: "wordpress_timeout", message: "code=wordpress_timeout" }]) },
    contentHealth: { areas: [] },
  })), false, "systemic content partial");
});

test("snapshot cache rejects every root systemic failure state", () => {
  for (const state of ["not_configured", "auth_error", "api_error", "invalid_response", "timeout"]) {
    assert.equal(isAnalyticsSnapshotCacheable(snapshot({
      sources: { gsc: source(state, [{ code: `gsc_${state}`, message: `code=gsc_${state}` }]) },
    })), false, state);
  }
});

test("a cache-serialized non-cacheable digest recovers the transient aggregate once", () => {
  const aggregate = snapshot();
  const timers = new Map();
  const handoff = createNonCacheableSnapshotHandoff({
    createId: () => "one",
    schedule: (callback) => { timers.set("one", callback); return "one"; },
    cancel: (handle) => { timers.delete(handle); },
  });
  let thrown;
  try {
    handoff.reject(7, aggregate);
  } catch (error) {
    thrown = error;
  }
  assert.equal(Object.hasOwn(thrown, "snapshot"), false);
  const serialized = { name: "Error", message: "masked", digest: thrown.digest };
  assert.equal(serialized.digest, "analytics-non-cacheable:7:one");
  assert.deepEqual(handoff.recover(serialized), aggregate);
  assert.equal(timers.size, 0);
  assert.equal(handoff.recover(serialized), null);
  assert.equal(handoff.recover({ digest: "analytics-non-cacheable:28:unknown" }), null);
});

test("same-period non-cacheable handoffs stay correlated and orphaned values expire", () => {
  const ids = ["first", "second", "orphan"];
  const timers = new Map();
  let nextTimer = 0;
  const handoff = createNonCacheableSnapshotHandoff({
    createId: () => ids.shift(),
    schedule: (callback) => { nextTimer += 1; timers.set(nextTimer, callback); return nextTimer; },
    cancel: (handle) => { timers.delete(handle); },
  });
  const reject = (aggregate) => {
    try { handoff.reject(7, aggregate); }
    catch (error) { return { digest: error.digest }; }
    throw new Error("expected non-cacheable handoff rejection");
  };
  const first = snapshot({ generatedAt: "2026-08-26T00:00:01.000Z" });
  const second = snapshot({ generatedAt: "2026-08-26T00:00:02.000Z" });
  const firstError = reject(first);
  const secondError = reject(second);

  assert.deepEqual(handoff.recover(secondError), second);
  assert.deepEqual(handoff.recover(firstError), first);
  assert.equal(timers.size, 0);

  const orphan = snapshot({ generatedAt: "2026-08-26T00:00:03.000Z" });
  const orphanError = reject(orphan);
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(handoff.recover(orphanError), null);
});

test("two consecutive 7-day reads collect once", async () => {
  const time = clock();
  const remote = remoteHarness({ now: time.now, collect: async () => snapshot() });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  await read({ days: 7 });
  await read({ days: 7 });
  assert.equal(remote.collectorCalls(), 1);
});

test("two consecutive 28-day reads collect once", async () => {
  const time = clock();
  const remote = remoteHarness({ now: time.now, collect: async () => snapshot() });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  await read({ days: 28 });
  await read({ days: 28 });
  assert.equal(remote.collectorCalls(), 1);
});

test("7-day and 28-day reads use separate cache keys", async () => {
  const time = clock();
  const periods = [];
  const remote = remoteHarness({ now: time.now, collect: async (days) => { periods.push(days); return snapshot(); } });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  await read({ days: 7 });
  await read({ days: 28 });
  await read({ days: 7 });
  await read({ days: 28 });
  assert.deepEqual(periods, [7, 28]);
});

test("a read inside its TTL adds no external collection", async () => {
  const time = clock();
  const remote = remoteHarness({ now: time.now, collect: async () => snapshot() });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  await read({ days: 7 });
  time.advance(899_999);
  await read({ days: 7 });
  assert.equal(remote.collectorCalls(), 1);
});

test("a read after period TTL refreshes the snapshot", async () => {
  const time = clock();
  const remote = remoteHarness({
    now: time.now,
    collect: async () => snapshot({ generatedAt: time.now().toISOString() }),
  });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  const first = await read({ days: 7 });
  time.advance(900_000);
  const second = await read({ days: 7 });
  assert.equal(remote.collectorCalls(), 2);
  assert.notEqual(second.generatedAt, first.generatedAt);
});

test("ten concurrent same-period reads share one in-process flight", async () => {
  let loads = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const read = createAnalyticsSnapshotReader({
    load: async () => { loads += 1; await pending; return snapshot(); },
    now: () => new Date(collectedAt),
  });
  const requests = Array.from({ length: 10 }, () => read({ days: 7 }));
  await Promise.resolve();
  assert.equal(loads, 1);
  release();
  await Promise.all(requests);
  assert.equal(loads, 1);
});

test("concurrent different periods keep independent flights", async () => {
  const loads = [];
  const read = createAnalyticsSnapshotReader({
    load: async (days) => { loads.push(days); await Promise.resolve(); return snapshot(); },
    now: () => new Date(collectedAt),
  });
  await Promise.all([read({ days: 7 }), read({ days: 7 }), read({ days: 28 }), read({ days: 28 })]);
  assert.deepEqual(loads.sort((left, right) => left - right), [7, 28]);
});

test("a rejected flight is removed so the next read retries", async () => {
  let attempts = 0;
  const read = createAnalyticsSnapshotReader({
    load: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("synthetic cache rejection");
      return snapshot();
    },
    now: () => new Date(collectedAt),
  });
  await assert.rejects(() => read({ days: 7 }), /synthetic cache rejection/);
  assert.equal((await read({ days: 7 })).schemaVersion, "1.0.0");
  assert.equal(attempts, 2);
});

test("a systemic snapshot uses only the short failure TTL before retrying", async () => {
  const time = clock();
  let loads = 0;
  const failure = snapshot({
    sources: { ga4: source("not_configured", [{ code: "ga4_property_not_configured", message: "code=ga4_property_not_configured" }]) },
  });
  const read = createAnalyticsSnapshotReader({
    load: async () => { loads += 1; return failure; },
    now: time.now,
  });
  await read({ days: 7 });
  time.advance(119_999);
  await read({ days: 7 });
  assert.equal(loads, 1);
  time.advance(1);
  await read({ days: 7 });
  assert.equal(loads, 2);
});

test("a failed refresh keeps the good snapshot and marks stale fallback", async () => {
  const time = clock();
  let fail = false;
  const good = snapshot();
  const remote = remoteHarness({
    now: time.now,
    collect: async () => fail
      ? snapshot({
        sources: { web: source("partial", [{ code: "site_health_timeout", message: "code=site_health_timeout" }]) },
        siteHealth: [siteHealthTarget("ok"), siteHealthTarget("timeout", "site_health_timeout")],
      })
      : good,
  });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  await read({ days: 7 });
  fail = true;
  time.advance(900_000);
  const fallback = await read({ days: 7 });
  assert.equal(remote.collectorCalls(), 2);
  assert.equal(fallback.sources.ga4.state, "ok");
  assert.equal(fallback.sources.web.state, "ok");
  assert.equal(fallback.generatedAt, good.generatedAt);
  assert.deepEqual(fallback.warnings, [{
    code: "analytics_snapshot_cache_stale",
    message: "state=partial; code=analytics_snapshot_cache_stale; reason=past_revalidate_ttl",
  }]);
});

test("a cache hit never rewrites generatedAt or collectedAt", async () => {
  const time = clock();
  const cached = snapshot();
  const remote = remoteHarness({ now: time.now, collect: async () => cached });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });
  const first = await read({ days: 28 });
  time.advance(1_000);
  const second = await read({ days: 28 });
  assert.equal(second.generatedAt, first.generatedAt);
  assert.equal(second.collectedAt, first.collectedAt);
  assert.deepEqual(second, first);
});

test("cold and warm periods plus five dashboard views have deterministic source-call deltas", async () => {
  const time = clock();
  const sourceCalls = { ga4: 0, gsc: 0, web: 0, content: 0 };
  const remote = remoteHarness({
    now: time.now,
    collect: async () => {
      for (const key of Object.keys(sourceCalls)) sourceCalls[key] += 1;
      return snapshot();
    },
  });
  const read = createAnalyticsSnapshotReader({ load: remote.load, now: time.now });

  await read({ days: 7 });
  assert.deepEqual({ collectors: remote.collectorCalls(), ...sourceCalls }, { collectors: 1, ga4: 1, gsc: 1, web: 1, content: 1 });
  await read({ days: 7 });
  assert.deepEqual({ collectors: remote.collectorCalls(), ...sourceCalls }, { collectors: 1, ga4: 1, gsc: 1, web: 1, content: 1 });
  await read({ days: 28 });
  assert.deepEqual({ collectors: remote.collectorCalls(), ...sourceCalls }, { collectors: 2, ga4: 2, gsc: 2, web: 2, content: 2 });
  await read({ days: 28 });
  assert.deepEqual({ collectors: remote.collectorCalls(), ...sourceCalls }, { collectors: 2, ga4: 2, gsc: 2, web: 2, content: 2 });

  await Promise.all(["overview", "seo", "pages", "site-health", "content-health"].map(() => read({ days: 7 })));
  assert.deepEqual({ collectors: remote.collectorCalls(), ...sourceCalls }, { collectors: 2, ga4: 2, gsc: 2, web: 2, content: 2 });
});

test("synthetic latency evidence distinguishes cold, warm, concurrent, and five-view reads", async () => {
  const time = clock();
  const delayMilliseconds = 25;
  const makeReader = () => {
    const remote = remoteHarness({
      now: time.now,
      collect: async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
        return snapshot();
      },
    });
    return { remote, read: createAnalyticsSnapshotReader({ load: remote.load, now: time.now }) };
  };
  const measure = async (call) => {
    const startedAt = performance.now();
    await call();
    return Number((performance.now() - startedAt).toFixed(3));
  };

  const normal = makeReader();
  const cold7Ms = await measure(() => normal.read({ days: 7 }));
  const warm7Ms = await measure(() => normal.read({ days: 7 }));
  const cold28Ms = await measure(() => normal.read({ days: 28 }));
  const warm28Ms = await measure(() => normal.read({ days: 28 }));
  const beforeViews = normal.remote.collectorCalls();
  const fiveViewMs = await measure(() => Promise.all(
    ["overview", "seo", "pages", "site-health", "content-health"].map(() => normal.read({ days: 7 }))
  ));
  const fiveViewCollectorDelta = normal.remote.collectorCalls() - beforeViews;

  const simultaneous = makeReader();
  const concurrentSamePeriodMs = await measure(() => Promise.all(
    Array.from({ length: 10 }, () => simultaneous.read({ days: 7 }))
  ));

  assert.ok(cold7Ms >= delayMilliseconds - 5, { cold7Ms });
  assert.ok(cold28Ms >= delayMilliseconds - 5, { cold28Ms });
  assert.ok(warm7Ms < cold7Ms, { cold7Ms, warm7Ms });
  assert.ok(warm28Ms < cold28Ms, { cold28Ms, warm28Ms });
  assert.equal(fiveViewCollectorDelta, 0);
  assert.equal(simultaneous.remote.collectorCalls(), 1);
  console.log("snapshot_cache_performance", JSON.stringify({
    syntheticDelayMs: delayMilliseconds,
    cold7Ms,
    warm7Ms,
    cold28Ms,
    warm28Ms,
    concurrentSamePeriodMs,
    fiveViewMs,
    fiveViewCollectorDelta,
    concurrentCollectorCalls: simultaneous.remote.collectorCalls(),
  }));
});
