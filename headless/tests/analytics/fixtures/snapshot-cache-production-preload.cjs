"use strict";

const { readFileSync, writeFileSync } = require("node:fs");

const controlPath = process.env.ANALYTICS_CACHE_E2E_CONTROL_FILE;
const counterPath = process.env.ANALYTICS_CACHE_E2E_COUNTER_FILE;
if (!controlPath || !counterPath) throw new Error("Analytics cache E2E paths are required");

const RealDate = Date;

function control() {
  try { return JSON.parse(readFileSync(controlPath, "utf8")); }
  catch { return {}; }
}

class ControlledDate extends RealDate {
  constructor(...args) {
    super(...(args.length === 0 ? [RealDate.now() + Number(control().clockOffsetMs || 0)] : args));
  }

  static now() {
    return RealDate.now() + Number(control().clockOffsetMs || 0);
  }

  static parse(value) { return RealDate.parse(value); }
  static UTC(...args) { return RealDate.UTC(...args); }
}

globalThis.Date = ControlledDate;

function counters() {
  try { return JSON.parse(readFileSync(counterPath, "utf8")); }
  catch { return { total: 0, oauth: 0, ga4: 0, gsc: 0, web: 0, wordpress: 0 }; }
}

function increment(kind) {
  const value = counters();
  value.total += 1;
  value[kind] += 1;
  writeFileSync(counterPath, JSON.stringify(value));
}

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    status: init.status || 200,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
  });
}

function ga4Response(body) {
  const dimensions = body.dimensions || [];
  const dimensionValues = dimensions.map(({ name }) => ({
    value: name === "sessionDefaultChannelGroup" ? "Organic Search"
      : name === "landingPagePlusQueryString" ? "/"
        : name === "deviceCategory" ? "desktop" : "synthetic",
  }));
  const metricValues = body.metrics.map(({ name }) => ({ value: name === "engagementRate" ? "0.5" : "1" }));
  return {
    dimensionHeaders: dimensions.map(({ name }) => ({ name })),
    metricHeaders: body.metrics.map(({ name }) => ({ name })),
    rowCount: 1,
    rows: [{ dimensionValues, metricValues }],
  };
}

function gscResponse(body) {
  const dimensions = body.dimensions || [];
  const keys = dimensions.map((name) => name === "date" ? body.endDate
    : name === "query" ? "synthetic query"
      : name === "page" ? "https://mens-esthe-kuchikomi.com/"
        : name === "device" ? "DESKTOP"
          : name === "country" ? "jpn" : "synthetic");
  return { rows: [{ ...(keys.length > 0 ? { keys } : {}), clicks: 1, impressions: 10, ctr: 0.1, position: 5 }] };
}

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  if (url === "https://oauth2.googleapis.com/token") {
    increment("oauth");
    return json({ access_token: "synthetic-access-token", expires_in: 3600, token_type: "Bearer" });
  }
  if (url.startsWith("https://analyticsdata.googleapis.com/")) {
    increment("ga4");
    if (control().failGa4) return json({ error: "synthetic" }, { status: 500 });
    return json(ga4Response(JSON.parse(String(init.body))));
  }
  if (url.startsWith("https://www.googleapis.com/webmasters/")) {
    increment("gsc");
    return json(gscResponse(JSON.parse(String(init.body))));
  }
  if (url.startsWith("https://wp.test/wp-json/")) {
    increment("wordpress");
    return json([], { headers: { "x-wp-total": "0", "x-wp-totalpages": "0" } });
  }
  if (url.startsWith("https://mens-esthe-kuchikomi.com/")) {
    increment("web");
    const parsed = new URL(url);
    const canonical = `https://mens-esthe-kuchikomi.com${parsed.pathname}`;
    return new Response(`<!doctype html><html><head><title>Page</title><link rel="canonical" href="${canonical}"></head><body><h1>Heading</h1></body></html>`, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  throw new Error("Unexpected network target in Analytics cache E2E");
};

const cacheEntries = new Map();
const pendingSets = new Map();
const remoteCacheHandler = {
  async get(key) {
    if (pendingSets.has(key)) await pendingSets.get(key);
    const stored = cacheEntries.get(key);
    if (!stored) return undefined;
    const now = RealDate.now();
    if (now > stored.timestamp + stored.expire * 1000) {
      cacheEntries.delete(key);
      return undefined;
    }
    const [value, saved] = stored.value.tee();
    stored.value = saved;
    const current = control();
    return {
      ...stored,
      timestamp: current.forceStale ? now - (stored.revalidate * 1000) - 1_000 : stored.timestamp,
      value,
    };
  },
  async set(key, pendingEntry) {
    let resolvePending;
    const pending = new Promise((resolve) => { resolvePending = resolve; });
    pendingSets.set(key, pending);
    try {
      const entry = await pendingEntry;
      const [consume, saved] = entry.value.tee();
      const reader = consume.getReader();
      while (!(await reader.read()).done) { /* drain before publishing */ }
      cacheEntries.set(key, { ...entry, value: saved });
    } catch {
      // A failed regeneration must leave the previous good entry untouched.
    } finally {
      pendingSets.delete(key);
      resolvePending();
    }
  },
  async refreshTags() {},
  async getExpiration() { return 0; },
  async updateTags() {},
};

globalThis[Symbol.for("@next/cache-handlers")] = { RemoteCache: remoteCacheHandler };
