import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const routePath = resolve(root, "app/api/contact/route.ts");
const source = readFileSync(routePath, "utf8");

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

function loadRoute(dependencies) {
  const output = ts.transpileModule(source, {
    fileName: routePath,
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

const fallback = {
  url: "https://escomi-headless-narikiyos-projects.vercel.app/api/contact/",
  headers: new Headers({
    "content-type": "application/json",
    origin: "https://escomi-headless-narikiyos-projects.vercel.app",
    "x-vercel-protection-bypass": "fixture-bypass",
  }),
};
const dependencies = {
  nodemailer: { __esModule: true, default: { createTransport: () => { throw new Error("must not create SMTP transport"); } } },
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/contact-rate-limit": { checkRateLimit: () => ({ allowed: true, retryAfterSec: 0 }) },
  "@/lib/contact-validation": {
    validateContactPayload: () => ({ ok: true, data: { type: "一般問い合わせ", name: "Fixture", email: "reply@example.test", message: "fixture" } }),
    buildContactEmailText: () => { throw new Error("must not build local email for fallback"); },
  },
  "@/lib/contact-vercel-fallback": { resolveContactVercelFallback: () => fallback },
};
const module = loadRoute(dependencies);

const originalFetch = globalThis.fetch;
const previousNodeEnv = process.env.NODE_ENV;
const previousDryRun = process.env.CONTACT_FORM_DRY_RUN;
try {
  process.env.NODE_ENV = "production";
  delete process.env.CONTACT_FORM_DRY_RUN;
  let forwarded = null;
  globalThis.fetch = async (url, init) => {
    forwarded = { url, init };
    return new Response(JSON.stringify({ ok: true, message: "accepted" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const success = await module.POST({
    headers: new Headers({
      host: "mens-esthe-kuchikomi.com",
      origin: "https://mens-esthe-kuchikomi.com",
      "cf-connecting-ip": "203.0.113.8",
      "x-forwarded-for": "untrusted-client-value",
    }),
    json: async () => ({ type: "fixture" }),
  });
  assert.equal(success.status, 200, "the existing Vercel handler response must be returned without a local SMTP attempt");
  assert.deepEqual(await success.json(), { ok: true, message: "accepted" });
  assert.equal(forwarded?.url, fallback.url);
  assert.equal(forwarded?.init?.method, "POST");
  assert.equal(forwarded?.init?.redirect, "error");
  assert.equal(new Headers(forwarded?.init?.headers).get("x-vercel-protection-bypass"), "fixture-bypass");
  assert.equal(new Headers(forwarded?.init?.headers).get("x-forwarded-for"), "203.0.113.8", "a client-supplied forwarded header must not control Vercel rate limiting");
  assert.deepEqual(JSON.parse(forwarded?.init?.body), { type: "一般問い合わせ", name: "Fixture", email: "reply@example.test", message: "fixture" });

  let untrustedOriginFetches = 0;
  globalThis.fetch = async () => { untrustedOriginFetches += 1; return new Response("unexpected"); };
  const forbidden = await module.POST({
    headers: new Headers({
      host: "mens-esthe-kuchikomi.com",
      origin: "https://attacker.example.test",
      "cf-connecting-ip": "203.0.113.8",
    }),
    json: async () => ({ type: "fixture" }),
  });
  assert.equal(forbidden.status, 403, "cross-origin form submissions must be rejected before Vercel forwarding");
  assert.equal(untrustedOriginFetches, 0);
} finally {
  globalThis.fetch = originalFetch;
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousDryRun === undefined) delete process.env.CONTACT_FORM_DRY_RUN;
  else process.env.CONTACT_FORM_DRY_RUN = previousDryRun;
}

console.log("Vercel contact fallback route contract: PASS");
