import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const headlessRoot = new URL("../../", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export%20%7B%7D%3B" };
    }
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) {
      return {
        shortCircuit: true,
        url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
      };
    }
    if (
      context.parentURL?.startsWith(headlessRoot) &&
      !context.parentURL.includes("/node_modules/") &&
      specifier.startsWith(".") &&
      !specifier.endsWith(".ts") &&
      !specifier.endsWith(".mjs")
    ) {
      return { shortCircuit: true, url: new URL(`${specifier}.ts`, context.parentURL).href };
    }
    return nextResolve(specifier, context);
  },
});

const { proxy } = await import("../../proxy.ts");
const { NextRequest } = await import("next/server.js");

const authKeys = [
  "DASHBOARD_BASIC_AUTH_USER",
  "DASHBOARD_BASIC_AUTH_PASSWORD",
  "BASIC_AUTH_USER",
  "BASIC_AUTH_PASSWORD",
  "user",
  "password",
];

function assertNoStore(headers) {
  assert.match(headers.get("cache-control") ?? "", /\bno-store\b/);
  assert.equal(headers.get("x-robots-tag"), "noindex, nofollow");
}

function assertPrivateNoStore(headers) {
  assert.match(headers.get("cache-control") ?? "", /\bprivate\b/);
  assertNoStore(headers);
}

test("production dashboard proxy secures successful continuation without regressing 401 or 503", () => {
  const saved = new Map(authKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of authKeys) delete process.env[key];

    const missingConfiguration = proxy(
      new NextRequest("https://example.test/dashboard/analytics/"),
    );
    assert.equal(missingConfiguration.status, 503);
    assertNoStore(missingConfiguration.headers);

    process.env.DASHBOARD_BASIC_AUTH_USER = "fixture-user";
    process.env.DASHBOARD_BASIC_AUTH_PASSWORD = "fixture-password";

    const unauthorized = proxy(
      new NextRequest("https://example.test/dashboard/analytics/"),
    );
    assert.equal(unauthorized.status, 401);
    assertNoStore(unauthorized.headers);

    const authorization = `Basic ${Buffer.from("fixture-user:fixture-password").toString("base64")}`;
    const authorized = proxy(
      new NextRequest("https://example.test/dashboard/analytics/", {
        headers: { authorization, "x-fixture-forwarded": "yes" },
      }),
    );
    assert.equal(authorized.status, 200);
    assertPrivateNoStore(authorized.headers);
    assert.equal(authorized.headers.get("x-middleware-next"), "1");
    assert.equal(authorized.headers.get("x-middleware-request-x-dashboard-route"), "1");
    assert.equal(authorized.headers.get("x-middleware-request-x-fixture-forwarded"), "yes");

    for (const [source, destination] of [
      [
        "https://example.test/wp-content/themes/swell_child/dashboard?period=7",
        "https://example.test/dashboard?period=7",
      ],
      [
        "https://example.test/wp-content/themes/swell_child/dashboard/analytics/?period=28&view=seo",
        "https://example.test/dashboard/analytics/?period=28&view=seo",
      ],
    ]) {
      const redirect = proxy(new NextRequest(source, { headers: { authorization } }));
      assert.equal(redirect.status, 307);
      assert.equal(redirect.headers.get("location"), destination);
      assertPrivateNoStore(redirect.headers);
    }
  } finally {
    for (const key of authKeys) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
