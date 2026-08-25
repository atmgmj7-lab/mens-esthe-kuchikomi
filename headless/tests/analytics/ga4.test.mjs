import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const period = await import("../../lib/analytics/period.ts");
const result = await import("../../lib/analytics/result.ts");
const credentials = await import("../../lib/analytics/google-credentials.ts");
const ga4 = await import("../../lib/analytics/ga4.ts");

const tempRoot = await mkdtemp(join(tmpdir(), "eskomi-ga4-test-"));
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const syntheticCredential = {
  type: "service_account",
  project_id: "synthetic-project",
  private_key_id: "synthetic-key-id",
  private_key: keyPair.privateKey.export({ type: "pkcs8", format: "pem" }),
  client_email: "synthetic-service@example.invalid",
  client_id: "1234567890",
  token_uri: GOOGLE_TOKEN_URI,
};

async function writeSyntheticCredential(name = "service-account.json", overrides = {}) {
  const path = join(tempRoot, name);
  await writeFile(path, JSON.stringify({ ...syntheticCredential, ...overrides }), "utf8");
  return path;
}

async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/ga4/${name}.json`, import.meta.url), "utf8"));
}

async function withSyntheticCredential(callback) {
  const originalPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const path = await writeSyntheticCredential("ga4-service-account.json");
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

function reportFixtureKey(body) {
  const dimension = body.dimensions?.[0]?.name;
  const kind = dimension === "sessionDefaultChannelGroup" ? "organic"
    : dimension === "landingPagePlusQueryString" ? (body.dimensionFilter ? "organic-landing" : "landing")
      : dimension === "deviceCategory" ? "device" : "overview";
  return `${kind}-${body.dateRanges[0].endDate === "2026-08-22" ? "current" : "previous"}`;
}

function responseForReport(body, template) {
  if (Array.isArray(template?.rows) && template.rows.length === 0 &&
    template.metricHeaders === undefined && template.dimensionHeaders === undefined) {
    return {
      ...template,
      dimensionHeaders: (body.dimensions ?? []).map((dimension) => ({ name: dimension.name })),
      metricHeaders: body.metrics.map((metric) => ({ name: metric.name })),
    };
  }
  if (template?.zeroMetricValue !== undefined) {
    return {
      dimensionHeaders: (body.dimensions ?? []).map((dimension) => ({ name: dimension.name })),
      metricHeaders: body.metrics.map((metric) => ({ name: metric.name })),
      rows: [{
        dimensionValues: (body.dimensions ?? []).map(() => ({ value: "synthetic" })),
        metricValues: body.metrics.map(() => ({ value: template.zeroMetricValue })),
      }],
    };
  }
  return template;
}

function inlineCredentialJson(overrides = {}) {
  return JSON.stringify({ ...syntheticCredential, ...overrides });
}

after(async () => { await rm(tempRoot, { recursive: true, force: true }); });

test("buildAnalyticsPeriod uses completed Tokyo calendar days", () => {
  const value = period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00"));
  assert.deepEqual(value.requested.current, { startDate: "2026-08-16", endDate: "2026-08-22" });
  assert.deepEqual(value.requested.previous, { startDate: "2026-08-09", endDate: "2026-08-15" });
  assert.deepEqual(value.effective, value.requested);
  assert.notEqual(value.effective, value.requested);
  assert.notEqual(value.effective.current, value.requested.current);
});

test("buildAnalyticsPeriod is stable across UTC/Tokyo rollover and validates days", () => {
  const value = period.buildAnalyticsPeriod(28, new Date("2026-08-22T15:30:00.000Z"));
  assert.equal(value.requested.current.startDate, "2026-07-26");
  assert.equal(value.requested.current.endDate, "2026-08-22");
  assert.equal(value.requested.previous.startDate, "2026-06-28");
  assert.equal(value.requested.previous.endDate, "2026-07-25");
  assert.throws(() => period.buildAnalyticsPeriod(14, new Date()), /7 or 28/);
});

test("analytics result helpers preserve the exact state union", () => {
  const expected = ["ok", "partial", "no_data", "not_configured", "auth_error", "api_error", "invalid_response", "timeout"];
  assert.deepEqual(result.analyticsSourceStates, expected);
  for (const state of expected) assert.equal(result.isAnalyticsSourceState(state), true);
  assert.equal(result.isAnalyticsSourceState("unknown"), false);

  const ok = result.analyticsSuccess({ sessions: 0 }, { collectedAt: "2026-08-23T00:00:00.000Z" });
  assert.equal(ok.state, "ok");
  assert.deepEqual(ok.data, { sessions: 0 });
  const failure = result.analyticsFailure("no_data", { collectedAt: "2026-08-23T00:00:00.000Z" });
  assert.equal(failure.state, "no_data");
  assert.equal(failure.data, null);
});

test("loadGoogleServiceAccount reads only the configured path and redacts failures", async () => {
  const missing = await credentials.loadGoogleServiceAccount({ env: {} });
  assert.equal(missing.state, "not_configured");

  const unreadable = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_APPLICATION_CREDENTIALS: join(tempRoot, "missing.json") },
  });
  assert.equal(unreadable.state, "api_error");
  assert.equal(JSON.stringify(unreadable).includes("missing.json"), false);

  const invalidPath = join(tempRoot, "invalid.json");
  await writeFile(invalidPath, '{"private_key":"not-a-service-account"}', "utf8");
  const invalid = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_APPLICATION_CREDENTIALS: invalidPath },
  });
  assert.equal(invalid.state, "invalid_response");
  assert.equal(JSON.stringify(invalid).includes("not-a-service-account"), false);

  const valid = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_APPLICATION_CREDENTIALS: await writeSyntheticCredential() },
  });
  assert.equal(valid.state, "ok");
  assert.equal(valid.data.clientEmail, "synthetic-service@example.invalid");
  assert.equal(valid.data.tokenUri, GOOGLE_TOKEN_URI);
});

test("loadGoogleServiceAccount accepts valid server-only inline JSON without filesystem access", async () => {
  let fileReads = 0;
  const value = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_SERVICE_ACCOUNT_JSON: inlineCredentialJson() },
    readFileImpl: async () => {
      fileReads += 1;
      throw new Error("filesystem must not be used");
    },
  });

  assert.equal(value.state, "ok");
  assert.equal(value.data.clientEmail, syntheticCredential.client_email);
  assert.equal(value.data.tokenUri, GOOGLE_TOKEN_URI);
  assert.equal(fileReads, 0);
});

test("loadGoogleServiceAccount keeps the existing filesystem fallback when inline JSON is absent", async () => {
  const path = await writeSyntheticCredential("fallback-service-account.json");
  const value = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_APPLICATION_CREDENTIALS: path },
  });

  assert.equal(value.state, "ok");
  assert.equal(value.data.clientEmail, syntheticCredential.client_email);
});

test("filesystem test helper isolates and restores an ambient inline credential", async () => {
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
  try {
    const value = await withSyntheticCredential(() => credentials.loadGoogleServiceAccount());
    assert.equal(value.state, "ok");
    assert.equal(value.data.clientEmail, syntheticCredential.client_email);
    assert.equal(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "{}");
  } finally {
    if (originalInline === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalInline;
  }
});

test("loadGoogleServiceAccount gives valid inline JSON priority over a configured file", async () => {
  let fileReads = 0;
  const value = await credentials.loadGoogleServiceAccount({
    env: {
      GOOGLE_SERVICE_ACCOUNT_JSON: inlineCredentialJson({ client_email: "inline-service@example.invalid" }),
      GOOGLE_APPLICATION_CREDENTIALS: await writeSyntheticCredential("lower-priority.json", {
        client_email: "file-service@example.invalid",
      }),
    },
    readFileImpl: async () => {
      fileReads += 1;
      throw new Error("lower-priority file must not be read");
    },
  });

  assert.equal(value.state, "ok");
  assert.equal(value.data.clientEmail, "inline-service@example.invalid");
  assert.equal(fileReads, 0);
});

test("loadGoogleServiceAccount fails closed for malformed inline JSON without file fallback", async () => {
  let fileReads = 0;
  const value = await credentials.loadGoogleServiceAccount({
    env: {
      GOOGLE_SERVICE_ACCOUNT_JSON: '{"private_key":"inline-secret-marker"',
      GOOGLE_APPLICATION_CREDENTIALS: await writeSyntheticCredential("must-not-mask-inline.json"),
    },
    readFileImpl: async () => {
      fileReads += 1;
      return JSON.stringify(syntheticCredential);
    },
  });

  assert.equal(value.state, "invalid_response");
  assert.equal(value.warnings[0].code, "credential_inline_invalid_json");
  assert.equal(fileReads, 0);
  assert.equal(JSON.stringify(value).includes("inline-secret-marker"), false);
});

test("loadGoogleServiceAccount rejects incomplete and non-service-account inline documents", async () => {
  for (const [name, document] of [
    ["missing required field", { ...syntheticCredential, client_email: undefined }],
    ["wrong credential type", { ...syntheticCredential, type: "authorized_user" }],
  ]) {
    const value = await credentials.loadGoogleServiceAccount({
      env: { GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify(document) },
    });
    assert.equal(value.state, "invalid_response", name);
    assert.equal(value.warnings[0].code, "credential_inline_invalid_shape", name);
  }
});

test("getGoogleAccessToken rejects non-canonical inline OAuth endpoints before fetch", async () => {
  const rejectedTokenUris = [
    "https://attacker.example.invalid/token",
    "http://oauth2.googleapis.com/token",
    "https://user@oauth2.googleapis.com/token",
    "https://oauth2.googleapis.com:8443/token",
    "https://oauth2.googleapis.com/token?target=other",
    "https://oauth2.googleapis.com/token#fragment",
    "https://oauth2.googleapis.com/other",
    "https://oauth2.googleapis.com.example.invalid/token",
  ];

  for (const tokenUri of rejectedTokenUris) {
    let fetchCalls = 0;
    const value = await credentials.getGoogleAccessToken({
      env: { GOOGLE_SERVICE_ACCOUNT_JSON: inlineCredentialJson({ token_uri: tokenUri }) },
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ access_token: "must-not-be-returned" }), { status: 200 });
      },
    });

    assert.equal(value.state, "invalid_response", tokenUri);
    assert.equal(value.warnings[0].code, "credential_inline_invalid_shape", tokenUri);
    assert.equal(fetchCalls, 0, tokenUri);
    assert.equal(JSON.stringify(value).includes(tokenUri), false, tokenUri);
  }
});

test("loadGoogleServiceAccount rejects a malformed inline private key without leaking it", async () => {
  const malformedKey = "inline-private-key-secret-marker";
  let fetchCalls = 0;
  const value = await credentials.getGoogleAccessToken({
    env: { GOOGLE_SERVICE_ACCOUNT_JSON: inlineCredentialJson({ private_key: malformedKey }) },
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ access_token: "must-not-be-returned" }), { status: 200 });
    },
  });

  assert.equal(value.state, "invalid_response");
  assert.equal(value.warnings[0].code, "credential_inline_invalid_private_key");
  assert.equal(fetchCalls, 0);
  assert.equal(JSON.stringify(value).includes(malformedKey), false);
});

test("loadGoogleServiceAccount treats an explicitly empty inline value as invalid configuration", async () => {
  const value = await credentials.loadGoogleServiceAccount({
    env: {
      GOOGLE_SERVICE_ACCOUNT_JSON: "",
      GOOGLE_APPLICATION_CREDENTIALS: await writeSyntheticCredential("must-not-mask-empty-inline.json"),
    },
  });

  assert.equal(value.state, "invalid_response");
  assert.equal(value.warnings[0].code, "credential_inline_empty");
});

test("loadGoogleServiceAccount normalizes escaped newlines in an inline private key", async () => {
  const escapedPrivateKey = String(syntheticCredential.private_key).replaceAll("\n", "\\n");
  const value = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_SERVICE_ACCOUNT_JSON: inlineCredentialJson({ private_key: escapedPrivateKey }) },
  });

  assert.equal(value.state, "ok");
  assert.match(value.data.privateKey, /-----BEGIN PRIVATE KEY-----\n/);
  assert.equal(value.data.privateKey.includes("\\n"), false);
});

test("loadGoogleServiceAccount rejects oversized inline JSON without exposing its contents", async () => {
  const oversizedMarker = "oversized-inline-secret-marker";
  const value = await credentials.loadGoogleServiceAccount({
    env: { GOOGLE_SERVICE_ACCOUNT_JSON: `${inlineCredentialJson()}${oversizedMarker.repeat(1024)}` },
  });

  assert.equal(value.state, "invalid_response");
  assert.equal(value.warnings[0].code, "credential_inline_too_large");
  assert.equal(JSON.stringify(value).includes(oversizedMarker), false);
});

test("getGoogleAccessToken completes the synthetic Vercel inline credential path without secret exposure", async () => {
  let observedRequest;
  const inlineJson = inlineCredentialJson();
  const value = await credentials.getGoogleAccessToken({
    env: { GOOGLE_SERVICE_ACCOUNT_JSON: inlineJson },
    now: () => new Date("2026-08-23T00:00:00.000Z"),
    fetchImpl: async (url, init) => {
      observedRequest = { url, init };
      return new Response(JSON.stringify({ access_token: "synthetic-inline-access-token", expires_in: 3600 }), { status: 200 });
    },
  });

  assert.equal(value.state, "ok");
  assert.equal(value.data.accessToken, "synthetic-inline-access-token");
  assert.equal(observedRequest.url, GOOGLE_TOKEN_URI);
  assert.equal(observedRequest.init.headers.authorization, undefined);
  assert.equal(observedRequest.init.body.includes(String(syntheticCredential.private_key)), false);
  assert.equal(observedRequest.init.body.includes(inlineJson), false);
  assert.match(new URLSearchParams(observedRequest.init.body).get("assertion"), /^[^.]+\.[^.]+\.[^.]+$/);
});

test("getGoogleAccessToken rejects non-canonical OAuth endpoints before fetch", async () => {
  const rejectedTokenUris = [
    "https://attacker.example.invalid/collect",
    "http://oauth2.googleapis.com/token",
    "https://user@oauth2.googleapis.com/token",
    "https://oauth2.googleapis.com:8443/token",
    "https://oauth2.googleapis.com/token?target=other",
    "https://oauth2.googleapis.com/token#fragment",
    "https://oauth2.googleapis.com/other",
    "https://oauth2.googleapis.com.example.invalid/token",
  ];

  for (const [index, tokenUri] of rejectedTokenUris.entries()) {
    let fetchCalls = 0;
    const value = await credentials.getGoogleAccessToken({
      env: {
        GOOGLE_APPLICATION_CREDENTIALS: await writeSyntheticCredential(
          `rejected-oauth-${index}.json`,
          { token_uri: tokenUri }
        ),
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ access_token: "must-not-be-returned" }), { status: 200 });
      },
    });

    assert.equal(value.state, "invalid_response", tokenUri);
    assert.equal(fetchCalls, 0, tokenUri);
    assert.equal(JSON.stringify(value).includes(tokenUri), false, tokenUri);
  }
});

test("getGoogleAccessToken signs a JWT and maps token endpoint outcomes safely", async () => {
  const credentialPath = await writeSyntheticCredential("oauth.json");
  const baseOptions = {
    env: { GOOGLE_APPLICATION_CREDENTIALS: credentialPath },
    now: () => new Date("2026-08-23T00:00:00.000Z"),
    timeoutMs: 50,
  };
  let observedRequest;
  const ok = await credentials.getGoogleAccessToken({
    ...baseOptions,
    fetchImpl: async (url, init) => {
      observedRequest = { url, init };
      return new Response(JSON.stringify({ access_token: "synthetic-access-token", expires_in: 3600 }), { status: 200 });
    },
  });
  assert.equal(ok.state, "ok");
  assert.equal(ok.data.accessToken, "synthetic-access-token");
  assert.equal(observedRequest.url, GOOGLE_TOKEN_URI);
  assert.equal(observedRequest.init.method, "POST");
  assert.match(observedRequest.init.headers["content-type"], /application\/x-www-form-urlencoded/);
  assert.equal(observedRequest.init.headers.authorization, undefined);
  assert.equal(observedRequest.init.body.includes("PRIVATE KEY"), false);
  const assertion = new URLSearchParams(observedRequest.init.body).get("assertion");
  const [encodedHeader, encodedClaims, encodedSignature] = assertion.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8"));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedClaims}`);
  verifier.end();
  assert.equal(verifier.verify(keyPair.publicKey, Buffer.from(encodedSignature, "base64url")), true);
  assert.equal(claims.scope, credentials.GOOGLE_ANALYTICS_READONLY_SCOPE);
  assert.equal(claims.aud, GOOGLE_TOKEN_URI);
  assert.equal(claims.iat, 1787443200);
  assert.equal(claims.exp, 1787446800);

  const malformed = await credentials.getGoogleAccessToken({
    ...baseOptions,
    fetchImpl: async () => new Response(JSON.stringify({ access_token: 42 }), { status: 200 }),
  });
  assert.equal(malformed.state, "invalid_response");

  for (const [status, state] of [[401, "auth_error"], [403, "auth_error"], [429, "api_error"], [500, "api_error"]]) {
    const value = await credentials.getGoogleAccessToken({
      ...baseOptions,
      fetchImpl: async () => new Response("{}", { status }),
    });
    assert.equal(value.state, state);
    assert.equal(JSON.stringify(value).includes("synthetic-access-token"), false);
  }

  const timeout = await credentials.getGoogleAccessToken({
    ...baseOptions,
    timeoutMs: 1,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  assert.equal(timeout.state, "timeout");
});

test("getGoogleAccessToken validates expiry metadata and classifies response-body failures", async () => {
  const credentialPath = await writeSyntheticCredential("oauth-response.json");
  const baseOptions = {
    env: { GOOGLE_APPLICATION_CREDENTIALS: credentialPath },
    now: () => new Date("2026-08-23T00:00:00.000Z"),
    timeoutMs: 10,
  };
  for (const expires_in of [0, -1, 1.5, 86_401, "3600"]) {
    const value = await credentials.getGoogleAccessToken({
      ...baseOptions,
      fetchImpl: async () => new Response(JSON.stringify({ access_token: "synthetic-access-token", expires_in }), { status: 200 }),
    });
    assert.equal(value.state, "invalid_response");
  }
  for (const expires_in of [1, 86_400]) {
    const value = await credentials.getGoogleAccessToken({
      ...baseOptions,
      fetchImpl: async () => new Response(JSON.stringify({ access_token: "synthetic-access-token", expires_in }), { status: 200 }),
    });
    assert.equal(value.state, "ok");
    assert.equal(value.data.expiresIn, expires_in);
  }
  const bodyTimeout = await credentials.getGoogleAccessToken({
    ...baseOptions,
    timeoutMs: 1,
    fetchImpl: async (_url, init) => ({ ok: true, json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }) }),
  });
  assert.equal(bodyTimeout.state, "timeout");
  const bodyNetwork = await credentials.getGoogleAccessToken({
    ...baseOptions,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error("synthetic transport failure"); } }),
  });
  assert.equal(bodyNetwork.state, "api_error");
  const bodySyntax = await credentials.getGoogleAccessToken({
    ...baseOptions,
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError("synthetic JSON"); } }),
  });
  assert.equal(bodySyntax.state, "invalid_response");
});

test("collectGa4 sends fixed no-store report pairs and preserves successful data", async () => {
  const normal = await fixture("normal");
  const requests = [];
  const value = await withSyntheticCredential(() => ga4.collectGa4({
    period: period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00")),
    propertyId: "property/a",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (String(url) === syntheticCredential.token_uri) {
        return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), { status: 200 });
      }
      const body = JSON.parse(init.body);
      return new Response(JSON.stringify(normal[reportFixtureKey(body)]), { status: 200 });
    },
  }));
  assert.equal(value.state, "ok");
  assert.equal(value.data.overview.current.data.sessions, 100);
  assert.equal(value.data.overview.previous.data.keyEvents, 4);
  assert.equal(value.data.organicSearch.current.data.sessions, 40);
  assert.equal(value.data.landingPages.current.data[0].landingPage, "/");
  assert.equal(value.data.landingPages.current.data[0].engagedSessions, 25);
  assert.equal(value.data.organicLandingPages.current.data[0].sessions, 40);
  assert.equal(value.data.devices.previous.data[0].deviceCategory, "mobile");
  assert.equal(requests.length, 11);
  const reports = requests.slice(1);
  for (const request of reports) {
    assert.equal(request.init.cache, "no-store");
    assert.match(request.init.headers.authorization, /^Bearer /);
    assert.equal(request.init.headers["content-type"], "application/json");
    assert.equal(String(request.url), "https://analyticsdata.googleapis.com/v1beta/properties/property%2Fa:runReport");
  }
  const bodies = reports.map((request) => JSON.parse(request.init.body));
  assert.deepEqual(bodies[0].metrics.map((metric) => metric.name), ["sessions", "activeUsers", "engagedSessions", "engagementRate", "keyEvents"]);
  assert.deepEqual(bodies[2].dimensions.map((dimension) => dimension.name), ["sessionDefaultChannelGroup"]);
  assert.equal(bodies[2].dimensionFilter.filter.stringFilter.value, "Organic Search");
  assert.deepEqual(bodies[4].dimensions.map((dimension) => dimension.name), ["landingPagePlusQueryString"]);
  assert.deepEqual(bodies[6].dimensions.map((dimension) => dimension.name), ["landingPagePlusQueryString"]);
  assert.equal(bodies[6].dimensionFilter.filter.stringFilter.value, "Organic Search");
  assert.deepEqual(bodies[8].dimensions.map((dimension) => dimension.name), ["deviceCategory"]);
  assert.equal(bodies[4].limit, "50");
  assert.deepEqual(bodies[4].orderBys, [
    { metric: { metricName: "sessions" }, desc: true },
    { dimension: { dimensionName: "landingPagePlusQueryString" }, desc: false },
  ]);
  assert.equal(bodies[8].limit, "50");
  assert.deepEqual(bodies[8].orderBys, [
    { metric: { metricName: "sessions" }, desc: true },
    { dimension: { dimensionName: "deviceCategory" }, desc: false },
  ]);
  assert.deepEqual(bodies.map((body) => body.dateRanges[0]), [
    { startDate: "2026-08-16", endDate: "2026-08-22" },
    { startDate: "2026-08-09", endDate: "2026-08-15" },
    { startDate: "2026-08-16", endDate: "2026-08-22" },
    { startDate: "2026-08-09", endDate: "2026-08-15" },
    { startDate: "2026-08-16", endDate: "2026-08-22" },
    { startDate: "2026-08-09", endDate: "2026-08-15" },
    { startDate: "2026-08-16", endDate: "2026-08-22" },
    { startDate: "2026-08-09", endDate: "2026-08-15" },
    { startDate: "2026-08-16", endDate: "2026-08-22" },
    { startDate: "2026-08-09", endDate: "2026-08-15" },
  ]);
  for (let index = 0; index < bodies.length; index += 2) {
    const current = { ...bodies[index], dateRanges: undefined };
    const previous = { ...bodies[index + 1], dateRanges: undefined };
    assert.deepEqual(current, previous);
  }
});

test("collectGa4 leaves quota headroom with at most four ordered runReport requests", async () => {
  const normal = await fixture("normal");
  let activeRunReports = 0;
  let maxActiveRunReports = 0;
  let runReportCalls = 0;
  const value = await withSyntheticCredential(() => ga4.collectGa4({
    period: period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00")),
    propertyId: "123",
    fetchImpl: async (url, init) => {
      if (String(url) === syntheticCredential.token_uri) {
        return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), { status: 200 });
      }
      runReportCalls += 1;
      activeRunReports += 1;
      maxActiveRunReports = Math.max(maxActiveRunReports, activeRunReports);
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify(normal[reportFixtureKey(body)]), { status: 200 });
      } finally {
        activeRunReports -= 1;
      }
    },
  }));

  assert.equal(runReportCalls, 10);
  assert.ok(maxActiveRunReports <= 4, `max concurrent runReport was ${maxActiveRunReports}`);
  assert.equal(value.state, "ok");
  assert.equal(value.data.overview.current.data.sessions, 100);
  assert.equal(value.data.overview.previous.data.sessions, 90);
  assert.equal(value.data.organicSearch.current.data.sessions, 40);
  assert.equal(value.data.organicSearch.previous.data.sessions, 35);
  assert.equal(value.data.landingPages.current.data[0].landingPage, "/");
  assert.equal(value.data.organicLandingPages.previous.data[0].sessions, 35);
  assert.equal(value.data.devices.current.data[0].deviceCategory, "desktop");
});

test("collectGa4 rejects out-of-range metrics and preserves allowed boundaries", async () => {
  const basePeriod = period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00"));
  const invalidCases = [
    { report: "overview", metric: "sessions", value: "-1", result: "overview" },
    { report: "overview", metric: "activeUsers", value: "-1", result: "overview" },
    { report: "overview", metric: "engagedSessions", value: "-1", result: "overview" },
    { report: "overview", metric: "keyEvents", value: "-1", result: "overview" },
    { report: "organic", metric: "sessions", value: "-1", result: "organicSearch" },
    { report: "landing", metric: "sessions", value: "-1", result: "landingPages" },
    { report: "device", metric: "sessions", value: "-1", result: "devices" },
    { report: "overview", metric: "engagementRate", value: "-0.1", result: "overview" },
    { report: "overview", metric: "engagementRate", value: "1.1", result: "overview" },
  ];

  const collect = (metricCase) => withSyntheticCredential(() => ga4.collectGa4({
    period: basePeriod,
    propertyId: "123",
    fetchImpl: async (url, init) => {
      if (String(url) === syntheticCredential.token_uri) {
        return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), { status: 200 });
      }
      const body = JSON.parse(init.body);
      const report = reportFixtureKey(body).split("-")[0];
      const isCurrent = body.dateRanges[0].endDate === "2026-08-22";
      return new Response(JSON.stringify({
        dimensionHeaders: (body.dimensions ?? []).map(({ name }) => ({ name })),
        metricHeaders: body.metrics.map(({ name }) => ({ name })),
        rows: [{
          dimensionValues: (body.dimensions ?? []).map(({ name }) => ({
            value: name === "sessionDefaultChannelGroup" ? "Organic Search" : "synthetic",
          })),
          metricValues: body.metrics.map(({ name }) => ({
            value: metricCase && isCurrent && report === metricCase.report && name === metricCase.metric
              ? metricCase.value
              : "0",
          })),
        }],
      }), { status: 200 });
    },
  }));

  for (const metricCase of invalidCases) {
    const value = await collect(metricCase);
    assert.equal(value.state, "partial", JSON.stringify(metricCase));
    assert.equal(value.data[metricCase.result].current.state, "invalid_response", JSON.stringify(metricCase));
  }

  const allZero = await collect(null);
  assert.equal(allZero.state, "ok");
  assert.equal(allZero.data.overview.current.data.engagementRate, 0);

  const upperBoundary = await collect({ report: "overview", metric: "engagementRate", value: "1" });
  assert.equal(upperBoundary.state, "ok");
  assert.equal(upperBoundary.data.overview.current.data.engagementRate, 1);
});

test("collectGa4 treats structurally valid omitted GA4 rows as no_data and rejects inconsistent responses", async () => {
  const basePeriod = period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00"));
  const collect = (responseForKey) => withSyntheticCredential(() => ga4.collectGa4({
    period: basePeriod,
    propertyId: "123",
    fetchImpl: async (url, init) => {
      if (String(url) === syntheticCredential.token_uri) {
        return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), { status: 200 });
      }
      const body = JSON.parse(init.body);
      const valid = responseForReport(body, { zeroMetricValue: "0" });
      return new Response(JSON.stringify(responseForKey(reportFixtureKey(body), valid)), { status: 200 });
    },
  }));

  for (const emptyResponse of [
    (valid) => ({ ...valid, rows: undefined }),
    (valid) => ({ ...valid, rows: undefined, rowCount: 0 }),
    (valid) => ({ ...valid, rows: [], rowCount: 0 }),
  ]) {
    const value = await collect((_key, valid) => emptyResponse(valid));
    assert.equal(value.state, "no_data");
    assert.equal(value.data, null);
  }

  const inconsistentCount = await collect((key, valid) => key === "overview-current"
    ? { ...valid, rows: undefined, rowCount: 1 }
    : valid);
  assert.equal(inconsistentCount.state, "partial");
  assert.equal(inconsistentCount.data.overview.current.state, "invalid_response");

  const inconsistentRows = await collect((key, valid) => key === "overview-current"
    ? { ...valid, rowCount: 0 }
    : valid);
  assert.equal(inconsistentRows.state, "partial");
  assert.equal(inconsistentRows.data.overview.current.state, "invalid_response");

  const singleRowCountMismatch = await collect((key, valid) => key === "overview-current"
    ? { ...valid, rowCount: 2 }
    : valid);
  assert.equal(singleRowCountMismatch.state, "partial");
  assert.equal(singleRowCountMismatch.data.overview.current.state, "invalid_response");

  const limitedRowCountMismatch = await collect((key, valid) => key === "landing-current"
    ? { ...valid, rowCount: 2 }
    : valid);
  assert.equal(limitedRowCountMismatch.state, "partial");
  assert.equal(limitedRowCountMismatch.data.landingPages.current.state, "invalid_response");

  const limitedPage = await collect((key, valid) => key === "landing-current"
    ? {
      ...valid,
      rowCount: 50,
      rows: Array.from({ length: 50 }, (_, index) => ({
        ...valid.rows[0], dimensionValues: [{ value: `/landing-${index}` }],
      })),
    }
    : valid);
  assert.equal(limitedPage.state, "ok");
  assert.equal(limitedPage.data.landingPages.current.data.length, 50);

  for (const invalidRows of [{}, "not-an-array", null]) {
    const value = await collect((key, valid) => key === "overview-current" ? { ...valid, rows: invalidRows } : valid);
    assert.equal(value.state, "partial");
    assert.equal(value.data.overview.current.state, "invalid_response");
  }

  const missingHeaders = await collect((key, valid) => key === "overview-current"
    ? { rows: undefined, dimensionHeaders: valid.dimensionHeaders }
    : valid);
  assert.equal(missingHeaders.state, "partial");
  assert.equal(missingHeaders.data.overview.current.state, "invalid_response");

  const organicNoData = await collect((key, valid) => ["organic-previous", "organic-landing-previous"].includes(key)
    ? { ...valid, rows: undefined, rowCount: 0 }
    : valid);
  assert.equal(organicNoData.state, "partial");
  assert.equal(organicNoData.data.organicSearch.previous.state, "no_data");
  assert.equal(organicNoData.data.organicLandingPages.previous.state, "no_data");
  assert.equal(organicNoData.data.overview.current.state, "ok");
});

test("collectGa4 distinguishes actual zero, no rows, malformed rows, HTTP states, timeout, and partial", async () => {
  const actualZero = await fixture("actual-zero");
  const noRows = await fixture("no-rows");
  const missingMetric = await fixture("missing-metric");
  const nonNumeric = await fixture("non-numeric-metric");
  const malformed = await fixture("malformed-response");
  const duplicateHeader = await fixture("duplicate-metric-header");
  const mismatchedValueCount = await fixture("mismatched-value-count");
  const malformedRow = await fixture("malformed-row");
  const unexpectedScalarRows = await fixture("unexpected-scalar-row-count");
  const duplicateDimension = await fixture("duplicate-dimension");
  const bodyTimeoutFixture = await fixture("body-timeout");
  const bodyNetworkFixture = await fixture("body-network");
  const bodySyntaxFixture = await fixture("body-syntax");
  const httpFixtures = await Promise.all(["http-401", "http-403", "http-429", "http-5xx"].map(fixture));
  const timeoutFixture = await fixture("timeout");
  const credentialNotConfigured = await fixture("credential-not-configured");
  const basePeriod = period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00"));
  const collect = (responses) => withSyntheticCredential(() => ga4.collectGa4({
    period: basePeriod,
    propertyId: "123",
    timeoutMs: 5,
    fetchImpl: async (url, init) => {
      if (String(url) === syntheticCredential.token_uri) return new Response(JSON.stringify({ access_token: "synthetic-access-token" }), { status: 200 });
      const next = responses.shift() ?? actualZero;
      if (next === "timeout") return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      if (typeof next === "number") return new Response("{}", { status: next });
      if (next?.bodyError === "timeout") return { ok: true, json: () => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }) };
      if (next?.bodyError === "network") return { ok: true, json: async () => { throw new Error("synthetic transport failure"); } };
      if (next?.bodyError === "syntax") return { ok: true, json: async () => { throw new SyntaxError("synthetic JSON"); } };
      return new Response(JSON.stringify(responseForReport(JSON.parse(init.body), next)), { status: 200 });
    },
  }));

  const zero = await collect(Array(10).fill(actualZero));
  assert.equal(zero.state, "ok");
  assert.equal(zero.data.overview.current.data.sessions, 0);

  const none = await collect(Array(10).fill(noRows));
  assert.equal(none.state, "no_data");
  assert.equal(none.data, null);

  const mixedNoData = await collect([noRows, ...Array(9).fill(actualZero)]);
  assert.equal(mixedNoData.state, "partial");
  assert.equal(mixedNoData.data.overview.current.state, "no_data");

  for (const invalid of [missingMetric, duplicateHeader, mismatchedValueCount, malformedRow, unexpectedScalarRows, nonNumeric, malformed]) {
    const value = await collect([invalid, ...Array(9).fill(actualZero)]);
    assert.equal(value.state, "partial");
    assert.equal(value.data.overview.current.state, "invalid_response");
  }
  const duplicateDimensionResponses = Array(10).fill(actualZero);
  duplicateDimensionResponses[4] = duplicateDimension;
  const duplicateDimensions = await collect(duplicateDimensionResponses);
  assert.equal(duplicateDimensions.state, "partial");
  assert.equal(duplicateDimensions.data.landingPages.current.state, "invalid_response");
  for (const [http, state] of httpFixtures.map((http) => [http, http.status < 429 ? "auth_error" : "api_error"])) {
    const value = await collect([http.status, ...Array(9).fill(actualZero)]);
    assert.equal(value.state, "partial");
    assert.equal(value.data.overview.current.state, state);
  }
  const timedOut = await collect([timeoutFixture.state, ...Array(9).fill(actualZero)]);
  assert.equal(timedOut.state, "partial");
  assert.equal(timedOut.data.overview.current.state, "timeout");

  for (const [fixtureBody, state] of [[bodyTimeoutFixture, "timeout"], [bodyNetworkFixture, "api_error"], [bodySyntaxFixture, "invalid_response"]]) {
    const value = await collect([fixtureBody, ...Array(9).fill(actualZero)]);
    assert.equal(value.state, "partial");
    assert.equal(value.data.overview.current.state, state);
  }

  const allAuth = await collect(Array(10).fill(httpFixtures[0].status));
  assert.equal(allAuth.state, "auth_error");
  assert.equal(allAuth.data, null);
  for (const responses of [
    [401, 500, "timeout", missingMetric, 500, 500, 500, 500, 500, 500],
    [500, missingMetric, 401, "timeout", 500, 500, 500, 500, 500, 500],
  ]) {
    const mixedFailures = await collect(responses);
    assert.equal(mixedFailures.state, "timeout");
    assert.equal(mixedFailures.data, null);
  }

  const originalPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const originalInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  try {
    const unconfigured = await ga4.collectGa4({ period: basePeriod, propertyId: "123" });
    assert.equal(unconfigured.state, credentialNotConfigured.state);
  } finally {
    if (originalPath === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = originalPath;
    if (originalInline === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalInline;
  }
});

test("collectGa4 rejects missing and blank property IDs before credential or network work", async () => {
  const basePeriod = period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00"));
  const original = process.env.GA4_PROPERTY_ID;
  delete process.env.GA4_PROPERTY_ID;
  try {
    for (const propertyId of [undefined, "", "   "]) {
      let fetchCalls = 0;
      const value = await ga4.collectGa4({
        period: basePeriod,
        ...(propertyId === undefined ? {} : { propertyId }),
        fetchImpl: async () => { fetchCalls += 1; throw new Error("must not fetch"); },
      });
      assert.equal(value.state, "not_configured");
      assert.equal(fetchCalls, 0);
    }
  } finally {
    if (original !== undefined) process.env.GA4_PROPERTY_ID = original;
  }
});

test("collectGa4 propagates fixture-backed OAuth-wide authentication failure before report work", async () => {
  const http401 = await fixture("http-401");
  let fetchCalls = 0;
  const value = await withSyntheticCredential(() => ga4.collectGa4({
    period: period.buildAnalyticsPeriod(7, new Date("2026-08-23T00:30:00+09:00")),
    propertyId: "123",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response("{}", { status: http401.status });
    },
  }));
  assert.equal(value.state, "auth_error");
  assert.equal(value.data, null);
  assert.equal(fetchCalls, 1);
});
