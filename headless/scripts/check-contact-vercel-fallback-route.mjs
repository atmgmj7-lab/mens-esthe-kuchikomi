import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const routePath = resolve(root, "app/api/contact/route.ts");
const fallbackPath = resolve(root, "lib/contact-vercel-fallback.ts");
const validationPath = resolve(root, "lib/contact-validation.ts");

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

function loadTypeScript(path, dependencies = {}) {
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const fallbackModule = loadTypeScript(fallbackPath);
const validationModule = loadTypeScript(validationPath);
let smtpTransportCreations = 0;
const module = loadTypeScript(routePath, {
  nodemailer: {
    __esModule: true,
    default: {
      createTransport: () => {
        smtpTransportCreations += 1;
        throw new Error("fallback requests must not create an SMTP transport");
      },
    },
  },
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/contact-rate-limit": { checkRateLimit: () => ({ allowed: true, retryAfterSec: 0 }) },
  "@/lib/contact-validation": validationModule,
  // Use the compiled production resolver, not a fixture resolver. This proves
  // that the route reads process.env in the same way as the Worker runtime.
  "@/lib/contact-vercel-fallback": fallbackModule,
});

const approvedOrigin = "https://escomi-headless-narikiyos-projects.vercel.app";
const genericUnavailable = "現在お問い合わせを受け付けできません。時間をおいて再度お試しください。";
const environmentKeys = [
  "NODE_ENV",
  "CONTACT_FORM_DRY_RUN",
  "CONTACT_VERCEL_FALLBACK_ORIGIN",
  "CONTACT_VERCEL_PROTECTION_BYPASS",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "CONTACT_FROM_EMAIL",
  "CONTACT_TO_EMAIL",
];
const previousEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const errorLogs = [];

function request(origin = "https://mens-esthe-kuchikomi.com") {
  return {
    headers: new Headers({
      host: "mens-esthe-kuchikomi.com",
      origin,
      "cf-connecting-ip": "203.0.113.8",
      "x-forwarded-for": "untrusted-client-value",
    }),
    json: async () => ({
      type: "一般問い合わせ",
      name: "Fixture",
      email: "reply@example.test",
      message: "fixture",
      consent: true,
    }),
  };
}

function takeErrorLogs() {
  const logs = errorLogs.splice(0);
  const serialized = JSON.stringify(logs);
  assert.doesNotMatch(serialized, /fixture-bypass|reply@example\.test|fixture network failure|token=/u, "diagnostic logs must not include credentials, payload values, error messages, or location queries");
  return logs;
}

try {
  console.error = (...args) => errorLogs.push(args);
  process.env.NODE_ENV = "production";
  process.env.CONTACT_VERCEL_FALLBACK_ORIGIN = approvedOrigin;
  process.env.CONTACT_VERCEL_PROTECTION_BYPASS = "fixture-bypass";
  delete process.env.CONTACT_FORM_DRY_RUN;

  let forwarded = null;
  globalThis.fetch = async (url, init) => {
    forwarded = { url, init };
    return new Response(JSON.stringify({ ok: true, message: "accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const success = await module.POST(request());
  assert.equal(success.status, 200, "the existing Vercel handler response must be returned without a local SMTP attempt");
  assert.deepEqual(await success.json(), { ok: true, message: "accepted" });
  assert.equal(forwarded?.url, `${approvedOrigin}/api/contact/`);
  assert.equal(forwarded?.init?.method, "POST");
  assert.equal(forwarded?.init?.redirect, "error");
  const forwardedHeaders = new Headers(forwarded?.init?.headers);
  assert.equal(forwardedHeaders.get("x-vercel-protection-bypass"), "fixture-bypass");
  assert.equal(forwardedHeaders.get("origin"), approvedOrigin);
  assert.equal(forwardedHeaders.get("x-forwarded-for"), "203.0.113.8", "a client-supplied forwarded header must not control Vercel rate limiting");
  assert.deepEqual(JSON.parse(forwarded?.init?.body), {
    type: "一般問い合わせ",
    name: "Fixture",
    email: "reply@example.test",
    message: "fixture",
    consent: true,
  });
  assert.equal(smtpTransportCreations, 0, "a configured fallback must take precedence over local SMTP");
  assert.deepEqual(takeErrorLogs(), []);

  globalThis.fetch = async () => new Response("protected HTML", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      Location: "https://vercel.com/login?token=fixture-bypass",
    },
  });
  const nonJson = await module.POST(request());
  assert.equal(nonJson.status, 503, "an HTML redirect or protection response is intentionally not treated as mail success");
  assert.deepEqual(await nonJson.json(), { ok: false, message: genericUnavailable });
  assert.deepEqual(takeErrorLogs(), [["[contact-fallback]", {
    event: "contact_fallback_upstream_non_json",
    upstreamStatus: 200,
    contentType: "text/html",
    location: "vercel.com/login",
  }]]);

  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, message: "upstream maintenance" }), {
    status: 503,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Location: "https://unapproved.example.test/private?token=fixture-bypass",
    },
  });
  const upstream503 = await module.POST(request());
  assert.equal(upstream503.status, 503, "an upstream JSON 503 is preserved rather than collapsed into a fetch failure");
  assert.deepEqual(await upstream503.json(), { ok: false, message: "upstream maintenance" });
  assert.deepEqual(takeErrorLogs(), [["[contact-fallback]", {
    event: "contact_fallback_upstream_json_503",
    upstreamStatus: 503,
    contentType: "application/json",
    location: "unapproved",
  }]]);

  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, message: "upstream contract failure" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const invalidSuccess = await module.POST(request());
  assert.equal(invalidSuccess.status, 502, "a JSON response without ok:true is a distinct upstream contract failure, not a generic 503");
  assert.deepEqual(await invalidSuccess.json(), { ok: false, message: "upstream contract failure" });
  assert.deepEqual(takeErrorLogs(), []);

  globalThis.fetch = async () => {
    throw new TypeError("fixture network failure");
  };
  const fetchFailure = await module.POST(request());
  assert.equal(fetchFailure.status, 503, "a rejected Worker-to-Vercel fetch maps to the generic unavailable response");
  assert.deepEqual(await fetchFailure.json(), { ok: false, message: genericUnavailable });
  assert.deepEqual(takeErrorLogs(), [["[contact-fallback]", {
    event: "contact_fallback_fetch_exception",
    errorName: "TypeError",
  }]]);

  let untrustedOriginFetches = 0;
  globalThis.fetch = async () => {
    untrustedOriginFetches += 1;
    return new Response("unexpected");
  };
  const forbidden = await module.POST(request("https://attacker.example.test"));
  assert.equal(forbidden.status, 403, "cross-origin form submissions must be rejected before Vercel forwarding");
  assert.equal(untrustedOriginFetches, 0);
  assert.deepEqual(takeErrorLogs(), []);

  // This is the only route-level 503 that does not originate in the Vercel
  // fallback: it is reachable only when the actual resolver sees no bindings.
  delete process.env.CONTACT_VERCEL_FALLBACK_ORIGIN;
  delete process.env.CONTACT_VERCEL_PROTECTION_BYPASS;
  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL"]) {
    delete process.env[key];
  }
  let fallbackDisabledFetches = 0;
  globalThis.fetch = async () => {
    fallbackDisabledFetches += 1;
    return new Response("unexpected");
  };
  const missingSmtp = await module.POST(request());
  assert.equal(missingSmtp.status, 503, "the local production SMTP guard is distinct from fallback fetch failures");
  assert.deepEqual(await missingSmtp.json(), { ok: false, message: genericUnavailable });
  assert.equal(fallbackDisabledFetches, 0);
  assert.equal(smtpTransportCreations, 0);
  assert.deepEqual(takeErrorLogs(), [
    ["[contact-fallback]", { event: "contact_fallback_disabled" }],
    ["[contact]", { event: "contact_smtp_not_configured" }],
  ]);
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
  for (const key of environmentKeys) {
    if (previousEnvironment[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnvironment[key];
  }
}

console.log("Vercel contact fallback route contract: PASS");
