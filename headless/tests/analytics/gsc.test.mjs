import assert from "node:assert/strict";
import { after, test } from "node:test";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const period = await import("../../lib/analytics/period.ts");
const credentials = await import("../../lib/analytics/google-credentials.ts");
const gsc = await import("../../lib/analytics/gsc.ts");

const tempRoot = await mkdtemp(join(tmpdir(), "eskomi-gsc-test-"));
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SITE_URL = "sc-domain:mens-esthe-kuchikomi.com";
const GSC_URL = "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Amens-esthe-kuchikomi.com/searchAnalytics/query";
const credential = {
  type: "service_account",
  private_key: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }),
  client_email: "synthetic-gsc@example.invalid",
  token_uri: TOKEN_URL,
};

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/gsc/${name}.json`, import.meta.url), "utf8"));
}

async function withCredential(callback) {
  const originalPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const path = join(tempRoot, "gsc-service-account.json");
  await writeFile(path, JSON.stringify(credential), "utf8");
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  try {
    return await callback();
  } finally {
    if (originalPath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = originalPath;
    if (originalInline === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalInline;
  }
}

function reportRows(body, count = 1) {
  const dimension = body.dimensions?.[0];
  if (!dimension) return [{ clicks: 10, impressions: 100, ctr: 0.1, position: 8.5 }];
  return Array.from({ length: count }, (_, index) => ({
    keys: body.dimensions.length === 2 ? [`${dimension}-${index}`, `https://mens-esthe-kuchikomi.com/${index}/`] : [`${dimension}-${index}`], clicks: index, impressions: index * 2, ctr: 0, position: 0,
  }));
}

function happyFetch({ latest = "2026-08-20", onSearch } = {}) {
  return async (url, init = {}) => {
    if (String(url) === TOKEN_URL) return new Response(JSON.stringify({ access_token: "synthetic-gsc-token" }), { status: 200 });
    assert.equal(String(url), GSC_URL);
    const body = JSON.parse(init.body);
    if (onSearch) return onSearch(body, init);
    if (body.dimensions?.[0] === "date") {
      return new Response(JSON.stringify({ rows: [{ keys: [latest], clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ rows: reportRows(body) }), { status: 200 });
  };
}

function basePeriod(days = 7) {
  return period.buildAnalyticsPeriod(days, new Date("2026-08-23T00:30:00+09:00"));
}

after(async () => { await rm(tempRoot, { recursive: true, force: true }); });

test("filesystem test helper isolates and restores an ambient inline credential", async () => {
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
  try {
    const value = await withCredential(() => credentials.loadGoogleServiceAccount());
    assert.equal(value.state, "ok");
    assert.equal(value.data.clientEmail, credential.client_email);
    assert.equal(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "{}");
  } finally {
    if (originalInline === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalInline;
  }
});

test("collectGsc discovers final data and clamps copied 7-day periods without mutating requested ranges", async () => {
  const latestFinal = await fixture("latest-final");
  const aggregate = await fixture("aggregate");
  const dimensionRows = await fixture("dimension-rows");
  const requests = [];
  const requested = basePeriod();
  const before = structuredClone(requested);
  const value = await withCredential(() => gsc.collectGsc({
    period: requested,
    fetchImpl: happyFetch({ onSearch: (body, init) => {
      requests.push({ body, init });
      const response = body.dimensions?.[0] === "date" ? latestFinal
        : body.dimensions?.length === 2 ? { rows: dimensionRows.rows.map((row) => ({ ...row, keys: [row.keys[0], "https://mens-esthe-kuchikomi.com/"] })) }
          : body.dimensions ? dimensionRows : aggregate;
      return new Response(JSON.stringify(response), { status: 200 });
    } }),
  }));

  assert.equal(value.state, "ok");
  assert.deepEqual(requested, before);
  assert.equal(value.data.latestFinalDate, "2026-08-20");
  assert.deepEqual(value.data.period.requested, before.requested);
  assert.notEqual(value.data.period.requested, value.data.period.effective);
  assert.deepEqual(value.data.period.effective.current, { startDate: "2026-08-14", endDate: "2026-08-20" });
  assert.deepEqual(value.data.period.effective.previous, { startDate: "2026-08-07", endDate: "2026-08-13" });
  assert.equal(value.data.siteAggregate.current.data.clicks, 10);
  assert.deepEqual(value.data.queries.current.data.rows.map((row) => row.keys[0]), ["alpha", "zeta"]);
  assert.equal(value.data.queries.current.data.rowCoverage, "NOT_RETURNED");
  assert.deepEqual(value.data.queryPages.current.data.rows[0].keys, ["alpha", "https://mens-esthe-kuchikomi.com/"]);
  assert.equal(requests.length, 13);
});

test("collectGsc preserves the 28-day current and previous definitions when final data lags", async () => {
  const requested = basePeriod(28);
  const value = await withCredential(() => gsc.collectGsc({ period: requested, fetchImpl: happyFetch() }));
  assert.equal(value.state, "ok");
  assert.deepEqual(requested.requested.current, { startDate: "2026-07-26", endDate: "2026-08-22" });
  assert.deepEqual(value.data.period.effective.current, { startDate: "2026-07-24", endDate: "2026-08-20" });
  assert.deepEqual(value.data.period.effective.previous, { startDate: "2026-06-26", endDate: "2026-07-23" });
});

test("collectGsc sends fixed aggregate and dimension requests with matching current and previous definitions", async () => {
  const requests = [];
  const value = await withCredential(() => gsc.collectGsc({
    period: basePeriod(),
    fetchImpl: happyFetch({ onSearch: (body, init) => {
      requests.push({ body, init });
      const rows = body.dimensions?.[0] === "date"
        ? [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }]
        : reportRows(body);
      return new Response(JSON.stringify({ rows }), { status: 200 });
    } }),
  }));

  assert.equal(value.state, "ok");
  const discovery = requests.find(({ body }) => body.dimensions?.[0] === "date").body;
  assert.deepEqual(discovery.dimensions, ["date"]);
  assert.equal(discovery.type, "web");
  assert.equal(discovery.dataState, "final");
  const reports = requests.filter(({ body }) => body.dimensions?.[0] !== "date");
  assert.equal(reports.length, 12);
  for (const { body, init } of reports) {
    assert.equal(body.type, "web");
    assert.equal(body.dataState, "final");
    assert.equal(init.cache, "no-store");
  }
  const aggregate = reports.filter(({ body }) => body.dimensions === undefined);
  assert.equal(aggregate.length, 2);
  for (const { body } of aggregate) assert.equal(body.aggregationType, "byProperty");
  for (const dimension of ["query", "page", "device", "country"]) {
    const pair = reports.filter(({ body }) => body.dimensions?.[0] === dimension && body.dimensions.length === 1).map(({ body }) => body);
    assert.equal(pair.length, 2);
    assert.equal(pair[0].aggregationType, "auto");
    assert.deepEqual({ ...pair[0], startDate: undefined, endDate: undefined }, { ...pair[1], startDate: undefined, endDate: undefined });
    assert.deepEqual([pair[0].startDate, pair[0].endDate], ["2026-08-14", "2026-08-20"]);
    assert.deepEqual([pair[1].startDate, pair[1].endDate], ["2026-08-07", "2026-08-13"]);
  }
  const queryPages = reports.filter(({ body }) => body.dimensions?.join(",") === "query,page").map(({ body }) => body);
  assert.equal(queryPages.length, 2);
  assert.equal(queryPages[0].aggregationType, "auto");
});

test("collectGsc paginates with exact startRow, stops on a short page, and sorts returned rows", async () => {
  const queryStartRows = [];
  const value = await withCredential(() => gsc.collectGsc({
    period: basePeriod(), pageSize: 2,
    fetchImpl: happyFetch({ onSearch: (body) => {
      if (body.dimensions?.[0] === "date") return new Response(JSON.stringify({ rows: [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
      if (body.dimensions?.[0] !== "query" || body.dimensions.length !== 1) return new Response(JSON.stringify({ rows: reportRows(body) }), { status: 200 });
      queryStartRows.push(body.startRow);
      const rows = body.startRow === 0
        ? [{ keys: ["z"], clicks: 2, impressions: 2, ctr: 1, position: 1 }, { keys: ["b"], clicks: 3, impressions: 3, ctr: 1, position: 1 }]
        : [{ keys: ["a"], clicks: 3, impressions: 3, ctr: 1, position: 1 }];
      return new Response(JSON.stringify({ rows }), { status: 200 });
    } }),
  }));
  assert.equal(value.state, "ok");
  assert.deepEqual(queryStartRows, [0, 0, 2, 2]);
  assert.deepEqual(value.data.queries.current.data.rows.map((row) => row.keys[0]), ["a", "b", "z"]);
});

test("collectGsc orders equal-click dimension keys by their raw strings, not JSON escaping", async () => {
  const value = await withCredential(() => gsc.collectGsc({
    period: basePeriod(),
    fetchImpl: happyFetch({ onSearch: (body) => {
      if (body.dimensions?.[0] === "date") return new Response(JSON.stringify({ rows: [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
      if (body.dimensions?.[0] === "query" && body.dimensions.length === 1) {
        return new Response(JSON.stringify({ rows: [
          { keys: ["#hash"], clicks: 2, impressions: 2, ctr: 1, position: 1 },
          { keys: ["\"phrase\""], clicks: 2, impressions: 2, ctr: 1, position: 1 },
        ] }), { status: 200 });
      }
      return new Response(JSON.stringify({ rows: reportRows(body) }), { status: 200 });
    } }),
  }));
  assert.equal(value.state, "ok");
  assert.deepEqual(value.data.queries.current.data.rows.map((row) => row.keys[0]), ["\"phrase\"", "#hash"]);
});

test("collectGsc marks pagination safety-cap exhaustion partial and rejects duplicate dimension keys across pages", async () => {
  const capped = await withCredential(() => gsc.collectGsc({
    period: basePeriod(), pageSize: 1, maxPages: 1,
    fetchImpl: happyFetch({ onSearch: (body) => {
      const rows = body.dimensions?.[0] === "date" ? [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] : reportRows(body);
      return new Response(JSON.stringify({ rows }), { status: 200 });
    } }),
  }));
  assert.equal(capped.state, "partial");
  assert.equal(capped.data.queries.current.state, "partial");
  assert.equal(capped.data.queries.current.warnings[0].code, "gsc_query_pagination_cap");

  const duplicate = await withCredential(() => gsc.collectGsc({
    period: basePeriod(), pageSize: 1,
    fetchImpl: happyFetch({ onSearch: (body) => {
      if (body.dimensions?.[0] === "date") return new Response(JSON.stringify({ rows: [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
      if (body.dimensions?.[0] === "query") return new Response(JSON.stringify({ rows: [{ keys: ["same"], clicks: 1, impressions: 1, ctr: 1, position: 1 }] }), { status: 200 });
      return new Response(JSON.stringify({ rows: reportRows(body) }), { status: 200 });
    } }),
  }));
  assert.equal(duplicate.state, "partial");
  assert.equal(duplicate.data.queries.current.state, "invalid_response");
});

test("collectGsc preserves actual zero and represents omitted dimension rows without inventing completeness", async () => {
  const value = await withCredential(() => gsc.collectGsc({
    period: basePeriod(),
    fetchImpl: happyFetch({ onSearch: (body) => {
      if (body.dimensions?.[0] === "date") return new Response(JSON.stringify({ rows: [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
      if (body.dimensions?.[0] === "query") return new Response(JSON.stringify({}), { status: 200 });
      return new Response(JSON.stringify({ rows: [{ ...(body.dimensions ? { keys: [body.dimensions[0]] } : {}), clicks: 0, impressions: 0, ctr: 0, position: 0 }] }), { status: 200 });
    } }),
  }));
  assert.equal(value.state, "ok");
  assert.equal(value.data.siteAggregate.current.data.clicks, 0);
  assert.deepEqual(value.data.queries.current.data, { rows: [], rowCoverage: "NOT_RETURNED" });
});

test("collectGsc rejects invalid metrics, malformed keys, malformed dates, rows, and JSON", async () => {
  const badRows = [
    { keys: ["query"], clicks: -1, impressions: 0, ctr: 0, position: 0 },
    { keys: ["query"], clicks: 0, impressions: 0, ctr: 2, position: 0 },
    { keys: ["query"], clicks: 0, impressions: 0, ctr: 0, position: -1 },
    { keys: ["query"], clicks: "0", impressions: 0, ctr: 0, position: 0 },
    { keys: [], clicks: 0, impressions: 0, ctr: 0, position: 0 },
    { keys: ["query"], clicks: 0, impressions: 0, ctr: 0 },
  ];
  for (const row of badRows) {
    const value = await withCredential(() => gsc.collectGsc({
      period: basePeriod(),
      fetchImpl: happyFetch({ onSearch: (body) => {
        const rows = body.dimensions?.[0] === "date" ? [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }]
          : body.dimensions?.[0] === "query" ? [row] : reportRows(body);
        return new Response(JSON.stringify({ rows }), { status: 200 });
      } }),
    }));
    assert.equal(value.state, "partial");
    assert.equal(value.data.queries.current.state, "invalid_response");
  }
  const malformedDate = await withCredential(() => gsc.collectGsc({ period: basePeriod(), fetchImpl: happyFetch({ latest: "2026-02-30" }) }));
  assert.equal(malformedDate.state, "invalid_response");
  const malformedJson = await withCredential(() => gsc.collectGsc({
    period: basePeriod(), fetchImpl: happyFetch({ onSearch: () => ({ ok: true, json: async () => { throw new SyntaxError("synthetic JSON"); } }) }),
  }));
  assert.equal(malformedJson.state, "invalid_response");
});

test("collectGsc rejects dimension keys in a no-dimension site aggregate response", async () => {
  const value = await withCredential(() => gsc.collectGsc({
    period: basePeriod(),
    fetchImpl: happyFetch({ onSearch: (body) => {
      const rows = body.dimensions?.[0] === "date" ? [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }]
        : body.dimensions ? reportRows(body) : [{ keys: ["must-not-have-a-key"], clicks: 1, impressions: 1, ctr: 1, position: 1 }];
      return new Response(JSON.stringify({ rows }), { status: 200 });
    } }),
  }));
  assert.equal(value.state, "partial");
  assert.equal(value.data.siteAggregate.current.state, "invalid_response");
});

test("collectGsc maps status, timeout, request and body-read failures without response content", async () => {
  for (const [status, state] of [[401, "auth_error"], [403, "auth_error"], [429, "api_error"], [500, "api_error"]]) {
    const value = await withCredential(() => gsc.collectGsc({ period: basePeriod(), fetchImpl: happyFetch({ onSearch: () => new Response("private body", { status }) }) }));
    assert.equal(value.state, state);
    assert.equal(JSON.stringify(value).includes("private body"), false);
  }
  const timeout = await withCredential(() => gsc.collectGsc({
    period: basePeriod(), timeoutMs: 1,
    fetchImpl: happyFetch({ onSearch: (_body, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) }),
  }));
  assert.equal(timeout.state, "timeout");
  const requestFailure = await withCredential(() => gsc.collectGsc({ period: basePeriod(), fetchImpl: happyFetch({ onSearch: async () => { throw new Error("synthetic transport failure"); } }) }));
  assert.equal(requestFailure.state, "api_error");
  const bodyFailure = await withCredential(() => gsc.collectGsc({ period: basePeriod(), fetchImpl: happyFetch({ onSearch: () => ({ ok: true, json: async () => { throw new Error("synthetic body failure"); } }) }) }));
  assert.equal(bodyFailure.state, "api_error");
});

test("collectGsc validates the fixed property before credentials and uses only the GSC readonly scope", async () => {
  for (const siteUrl of ["https://mens-esthe-kuchikomi.com", "sc-domain:example.com", "sc-domain:mens-esthe-kuchikomi.com/"]) {
    let calls = 0;
    const value = await gsc.collectGsc({ period: basePeriod(), siteUrl, fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); } });
    assert.equal(value.state, "invalid_response");
    assert.equal(calls, 0);
  }
  let tokenBody;
  await withCredential(() => gsc.collectGsc({
    period: basePeriod(),
    fetchImpl: async (url, init = {}) => {
      if (String(url) === TOKEN_URL) {
        tokenBody = JSON.parse(Buffer.from(new URLSearchParams(init.body).get("assertion").split(".")[1], "base64url").toString("utf8"));
        return new Response(JSON.stringify({ access_token: "synthetic-gsc-token" }), { status: 200 });
      }
      const body = JSON.parse(init.body);
      const rows = body.dimensions?.[0] === "date" ? [{ keys: ["2026-08-20"], clicks: 0, impressions: 0, ctr: 0, position: 0 }] : reportRows(body);
      return new Response(JSON.stringify({ rows }), { status: 200 });
    },
  }));
  assert.equal(tokenBody.scope, credentials.GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE);
  assert.equal(credentials.GOOGLE_ANALYTICS_READONLY_SCOPE, "https://www.googleapis.com/auth/analytics.readonly");
  assert.equal(tokenBody.aud, TOKEN_URL);
});

test("collectGsc returns credential missing before API work", async () => {
  const originalPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    let calls = 0;
    const value = await gsc.collectGsc({ period: basePeriod(), fetchImpl: async () => { calls += 1; throw new Error("must not fetch"); } });
    assert.equal(value.state, "not_configured");
    assert.equal(calls, 0);
  } finally {
    if (originalPath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = originalPath;
    if (originalInline === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalInline;
  }
});
