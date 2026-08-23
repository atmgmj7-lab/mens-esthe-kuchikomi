import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const siteHealth = await import("../../lib/analytics/site-health.ts");

const ORIGIN = "https://mens-esthe-kuchikomi.com";
const PATHS = ["/", "/area/sakai/", "/area/shinosaka/", "/area/nihonbashi/", "/area/sakaisujihonmachi/", "/area/umeda/"];
const CHECKED_AT = "2026-08-23T01:02:03.000Z";

async function fixture(name) {
  return readFile(new URL(`./fixtures/site-health/${name}`, import.meta.url), "utf8");
}

function response(body, status = 200, contentType = "text/html; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

function fetchFor(bodies, options = {}) {
  return async (url, init) => {
    const path = new URL(String(url)).pathname;
    const value = bodies.get(path) ?? bodies.get("*");
    if (value instanceof Error) throw value;
    if (typeof options.onRequest === "function") options.onRequest(url, init);
    return value instanceof Response ? value.clone() : value;
  };
}

function options(extra = {}) {
  return { now: () => new Date(CHECKED_AT), timeoutMs: 100, concurrency: 2, ...extra };
}

test("collectSiteHealth uses exactly the fixed targets in order with no-store, manual redirects, and bounded concurrency", async () => {
  const html = await fixture("normal.html");
  const requests = [];
  let active = 0;
  let maximumActive = 0;
  const value = await siteHealth.collectSiteHealth(options({
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return response(html);
    },
  }));

  assert.equal(value.state, "ok");
  assert.deepEqual(requests.map((request) => request.url), PATHS.map((path) => `${ORIGIN}${path}`));
  assert.deepEqual(value.data.targets.map((target) => target.path), PATHS);
  for (const request of requests) {
    assert.equal(request.init.cache, "no-store");
    assert.equal(request.init.redirect, "manual");
  }
  assert.equal(maximumActive <= 2, true);
});

test("collectSiteHealth parses normal metadata, reports checkedAt, and distinguishes indexable from noindex", async () => {
  const normal = await fixture("normal.html");
  const noindex = await fixture("noindex.html");
  const value = await siteHealth.collectSiteHealth(options({
    fetchImpl: fetchFor(new Map([
      ["/", response(normal)],
      ["/area/sakai/", response(noindex)],
      ["*", response(normal)],
    ])),
  }));

  assert.equal(value.state, "ok");
  assert.deepEqual(value.data.targets[0], {
    path: "/",
    url: `${ORIGIN}/`,
    httpStatus: 200,
    checkedAt: CHECKED_AT,
    state: "ok",
    data: {
      title: "エスコミ | 関西メンズエステ",
      h1: "関西の メンズエステ",
      canonical: `${ORIGIN}/`,
      robots: "index, follow",
      indexable: true,
      indexabilityReason: "indexable",
    },
    warnings: [],
  });
  assert.equal(value.data.targets[1].data.indexable, false);
  assert.equal(value.data.targets[1].data.indexabilityReason, "noindex");
});

test("collectSiteHealth gives noindex precedence across every robots meta tag in either order", async () => {
  const normal = await fixture("normal.html");
  const robotsPairs = [
    ["index, follow", "NOINDEX"],
    ["noindex follow", "INDEX, FOLLOW"],
  ];
  for (const values of robotsPairs) {
    const html = normal.replace(
      '<meta name="robots" content="index, follow">',
      `<meta name="robots" content="${values[0]}"><meta CONTENT="${values[1]}" NAME="RoBoTs">`
    );
    const value = await siteHealth.collectSiteHealth(options({ fetchImpl: fetchFor(new Map([["*", response(html)]])) }));
    assert.equal(value.state, "ok");
    assert.equal(value.data.targets[0].data.indexable, false);
    assert.equal(value.data.targets[0].data.indexabilityReason, "noindex");
    assert.match(value.data.targets[0].data.robots, /noindex/i);
  }
});

test("collectSiteHealth decodes entities and accepts mixed tag case and attribute order while ignoring script and style text", async () => {
  const complex = await fixture("complex.html");
  const value = await siteHealth.collectSiteHealth(options({ fetchImpl: fetchFor(new Map([["*", response(complex)]])) }));
  const data = value.data.targets[0].data;

  assert.equal(value.state, "ok");
  assert.deepEqual(data, {
    title: "堺 & 西区 <案内>",
    h1: "堺 & 西区",
    canonical: `${ORIGIN}/area/sakai/`,
    robots: "INDEX, FOLLOW",
    indexable: true,
    indexabilityReason: "indexable",
  });
});

test("collectSiteHealth rejects every duplicate or conflicting canonical declaration regardless of order", async () => {
  const normal = await fixture("normal.html");
  const canonical = '<link rel="canonical" href="https://mens-esthe-kuchikomi.com/">';
  const attacker = '<link rel="canonical" href="https://attacker.example.invalid/">';
  const another = '<link rel="canonical" href="https://mens-esthe-kuchikomi.com/area/sakai/">';
  const relative = '<link rel="canonical" href="/area/sakai/">';
  const userinfo = '<link rel="canonical" href="https://user@mens-esthe-kuchikomi.com/">';
  for (const extra of [attacker, canonical, another, relative, userinfo]) {
    for (const links of [[canonical, extra], [extra, canonical]]) {
      const html = normal.replace(canonical, links.join(""));
      const value = await siteHealth.collectSiteHealth(options({ fetchImpl: fetchFor(new Map([["*", response(html)]])) }));
      assert.equal(value.state, "partial");
      assert.equal(value.data.targets.every((target) => target.state === "invalid_response"), true);
      assert.equal(value.data.targets[0].data.indexabilityReason, "metadata_invalid");
    }
  }
});

test("collectSiteHealth marks missing or unsafe metadata and non-HTML bodies as invalid_response", async () => {
  const normal = await fixture("normal.html");
  const missingTitle = await fixture("missing-title.html");
  const missingH1 = await fixture("missing-h1.html");
  const missingCanonical = await fixture("missing-canonical.html");
  const offOrigin = await fixture("off-origin-canonical.html");
  const nonHtml = await fixture("non-html.txt");
  const responses = [missingTitle, missingH1, missingCanonical, offOrigin, nonHtml, normal];
  const value = await siteHealth.collectSiteHealth(options({
    fetchImpl: async (url) => response(responses[PATHS.indexOf(new URL(String(url)).pathname)], 200, new URL(String(url)).pathname === "/area/sakaisujihonmachi/" ? "text/plain" : "text/html"),
  }));

  assert.equal(value.state, "partial");
  for (const target of value.data.targets.slice(0, 5)) {
    assert.equal(target.state, "invalid_response");
    assert.equal(target.httpStatus, 200);
    assert.equal(target.data.indexabilityReason, "metadata_invalid");
    assert.equal(target.data.indexable, null);
    assert.equal(target.warnings.length, 1);
  }
  assert.equal(value.data.targets[0].data.h1, "Missing title");
  assert.equal(value.data.targets[3].data.canonical, "https://attacker.example.invalid/");
  assert.equal(value.data.targets[5].state, "ok");
});

test("collectSiteHealth rejects malformed HTML before accepting metadata", async () => {
  const malformed = await fixture("malformed.html");
  const value = await siteHealth.collectSiteHealth(options({ fetchImpl: fetchFor(new Map([["*", response(malformed)]])) }));

  assert.equal(value.state, "partial");
  assert.equal(value.data.targets.every((target) => (
    target.state === "invalid_response" &&
    target.data.indexabilityReason === "metadata_invalid" &&
    target.data.indexable === null
  )), true);
});

test("collectSiteHealth preserves HTTP evidence and maps redirects, HTTP errors, timeout, request failure, and body failures", async () => {
  const normal = await fixture("normal.html");
  const missingH1 = await fixture("missing-h1.html");
  const bodyFailure = new Response(normal, { status: 200 });
  Object.defineProperty(bodyFailure, "text", { value: async () => { throw new Error("synthetic body failure"); } });
  const value = await siteHealth.collectSiteHealth(options({
    timeoutMs: 5,
    fetchImpl: async (url, init) => {
      switch (PATHS.indexOf(new URL(String(url)).pathname)) {
        case 0: return response(normal, 302);
        case 1: return response(normal, 404);
        case 2: return response(normal, 429);
        case 3: return response(normal, 500);
        case 4: return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
        default: return response(missingH1);
      }
    },
  }));

  assert.equal(value.state, "partial");
  assert.deepEqual(value.data.targets[0].data, {
    title: null, h1: null, canonical: null, robots: null, indexable: null, indexabilityReason: "redirect",
  });
  for (const index of [1, 2, 3]) {
    assert.equal(value.data.targets[index].state, "api_error");
    assert.equal(value.data.targets[index].data.indexabilityReason, "http_error");
    assert.equal(value.data.targets[index].data.title, "エスコミ | 関西メンズエステ");
    assert.equal(value.data.targets[index].data.indexable, null);
  }
  assert.equal(value.data.targets[4].state, "timeout");
  assert.equal(value.data.targets[4].data, null);
  assert.deepEqual(value.data.targets[5].data, {
    title: "Missing H1",
    h1: null,
    canonical: `${ORIGIN}/`,
    robots: null,
    indexable: null,
    indexabilityReason: "metadata_invalid",
  });
  const bodyReadFailure = await siteHealth.collectSiteHealth(options({ fetchImpl: async () => bodyFailure }));
  assert.equal(bodyReadFailure.data.targets.every((target) => target.state === "api_error" && target.data === null), true);
  const requestFailure = await siteHealth.collectSiteHealth(options({ fetchImpl: async () => { throw new Error("network"); } }));
  assert.equal(requestFailure.state, "partial");
  assert.equal(requestFailure.data.targets.every((target) => target.state === "api_error" && target.httpStatus === null), true);
});

test("collectSiteHealth returns partial for mixed outcomes and ok only when all targets succeed", async () => {
  const normal = await fixture("normal.html");
  const allSuccess = await siteHealth.collectSiteHealth(options({ fetchImpl: fetchFor(new Map([["*", response(normal)]])) }));
  const mixed = await siteHealth.collectSiteHealth(options({
    fetchImpl: fetchFor(new Map([["/", response(normal)], ["/area/sakai/", response("", 503)], ["*", response(normal)]])),
  }));

  assert.equal(allSuccess.state, "ok");
  assert.equal(allSuccess.data.targets.length, 6);
  assert.equal(mixed.state, "partial");
  assert.equal(mixed.data.targets.length, 6);
  assert.equal(mixed.data.targets[1].state, "api_error");
});

test("collectSiteHealth rejects invalid timeout and concurrency before fetching", async () => {
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    let calls = 0;
    await assert.rejects(() => siteHealth.collectSiteHealth(options({ timeoutMs: invalid, fetchImpl: async () => { calls += 1; return response(""); } })), /timeoutMs/);
    assert.equal(calls, 0);
  }
  for (const invalid of [0, -1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY]) {
    let calls = 0;
    await assert.rejects(() => siteHealth.collectSiteHealth(options({ concurrency: invalid, fetchImpl: async () => { calls += 1; return response(""); } })), /concurrency/);
    assert.equal(calls, 0);
  }
});

test("collectSiteHealth ignores caller endpoint fields and never becomes a generalized crawler", async () => {
  const normal = await fixture("normal.html");
  const observed = [];
  const value = await siteHealth.collectSiteHealth({
    ...options(),
    origin: "https://attacker.example.invalid",
    paths: ["/anything"],
    url: "https://attacker.example.invalid/anything",
    fetchImpl: async (url) => {
      observed.push(String(url));
      return response(normal);
    },
  });

  assert.equal(siteHealth.collectSiteHealth.length <= 1, true);
  assert.equal(value.state, "ok");
  assert.deepEqual(observed, PATHS.map((path) => `${ORIGIN}${path}`));
});
