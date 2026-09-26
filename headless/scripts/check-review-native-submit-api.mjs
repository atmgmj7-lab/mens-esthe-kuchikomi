import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const route = read("app/api/reviews/submit/route.ts");
const form = read("components/reviews/ReviewSubmitForm.tsx");
const validation = read("lib/review-validation.ts");
const repositoryTypes = read("lib/reviews/repository.ts");
const repository = read("lib/supabase/review-native.ts");
const migration = read("../supabase/migrations/20260920062938_review_native_foundation.sql");

assert.ok(existsSync(resolve(root, "lib/reviews/submission-security.ts")), "submission security boundary must exist");
const security = read("lib/reviews/submission-security.ts");

assert.match(route, /content-type/i);
assert.match(route, /application\/json/i);
assert.match(route, /content-length/i);
assert.match(route, /sec-fetch-site/i);
assert.match(route, /origin/i);
assert.match(route, /host/i);
assert.match(route, /x-eskomi-csrf/i);
assert.match(route, /idempotency-key/i);
assert.match(route, /request\.text\(/, "raw body must be size-bounded before JSON parsing");
assert.doesNotMatch(route, /request\.json\(/);
assert.doesNotMatch(route, /checkReviewRateLimit|review-rate-limit/);
assert.doesNotMatch(route, /submitReviewToWordPress|wp\/review-submit/);
assert.doesNotMatch(route, /WP_REVIEW_SUBMIT_USER|WP_REVIEW_SUBMIT_APP_PASSWORD/);
assert.match(route, /getShopBySlug/);
assert.match(route, /publicationStatus\s*!==\s*["']publish["']/);
assert.match(route, /reviewNativeRepository/);
assert.match(route, /claimRateLimit/);
assert.match(route, /\.submit\(/);

assert.match(form, /Idempotency-Key/);
assert.match(form, /X-ESKOMI-CSRF/);
assert.match(form, /crypto\.randomUUID\(\)/);
assert.doesNotMatch(form, /sourceUrl:/, "source URL must be server-derived");

assert.match(validation, /ALLOWED_REVIEW_PAYLOAD_KEYS/);
assert.match(validation, /campaignToken/);
assert.match(validation, /Array\.isArray\(body\)/);

assert.match(security, /import\s+["']server-only["']/);
assert.match(security, /createHmac/);
assert.match(security, /createHash/);
assert.match(security, /x-vercel-forwarded-for/);
assert.doesNotMatch(security, /NEXT_PUBLIC_/);
assert.doesNotMatch(security, /unknown/, "missing client identity must fail closed");

assert.match(repositoryTypes, /claimRateLimit/);
assert.match(repository, /claim_review_submission_rate_limit/);
assert.match(migration, /create or replace function private\.claim_review_submission_rate_limit/i);
assert.match(migration, /create or replace function api\.claim_review_submission_rate_limit/i);
assert.match(migration, /claimed_idempotency_key_hashes/i);
assert.match(migration, /grant execute on function api\.claim_review_submission_rate_limit/i);
assert.match(migration, /revoke all on function api\.claim_review_submission_rate_limit[^;]+from public, anon, authenticated/i);

assert.match(route, /campaignToken:\s*validation\.data\.campaignToken\s*\?\?/);
assert.doesNotMatch(route, /openPartnerReviewCampaign|recordPartnerReviewCampaignSubmission/);

const nodeRequire = createRequire(import.meta.url);
function loadTypeScript(path, dependencies = {}) {
  const source = read(path);
  const output = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier === "server-only") return {};
    if (specifier in dependencies) return dependencies[specifier];
    if (specifier.startsWith("node:")) return nodeRequire(specifier);
    throw new Error(`Unexpected dependency in ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

const securityModule = loadTypeScript("lib/reviews/submission-security.ts");
const validationModule = loadTypeScript("lib/review-validation.ts", {
  "@/lib/reviews/low-friction-review": {
    REVIEW_TAGS: ["staff_polite", "clean", "booking_smooth", "price_clear", "beginner_friendly", "want_revisit", "wait_concern", "price_unclear", "guidance_unclear"],
  },
});
const claimCalls = [];
const submitCalls = [];
let claimResult = { status: "ok", data: { allowed: true, retryAfterSeconds: 0 } };
let submitResult = {
  status: "ok",
  data: {
    reviewId: "11111111-1111-4111-8111-111111111111",
    created: true,
    shop: { wpShopId: 712 },
  },
};
let wpShop = { id: 712, slug: "fixture-shop", title: "検証店舗", publicationStatus: "publish" };
const repositoryMock = {
  async claimRateLimit(input) { claimCalls.push(input); return claimResult; },
  async submit(input) { submitCalls.push(input); return submitResult; },
};
const routeModule = loadTypeScript("app/api/reviews/submit/route.ts", {
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/reviews/submission-security": securityModule,
  "@/lib/supabase/review-native": { reviewNativeRepository: repositoryMock },
  "@/lib/review-validation": validationModule,
  "@/lib/wp/shops": { getShopBySlug: async () => wpShop },
  "@/lib/seo": { SITE_URL: "https://mens-esthe-kuchikomi.com" },
  "@/lib/supabase/server-secret": {
    resolveSupabaseServerSecret: () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      ? { value: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY }
      : null,
  },
});

const validPayload = {
  shopSlug: "fixture-shop",
  nickname: "投稿者",
  usedPeriod: "今月",
  ratingTotal: 5,
  ratingPrice: 4,
  ratingService: 5,
  ratingCleanliness: 4,
  revisitIntent: "また利用したい",
  reviewBody: "これは30文字以上ある口コミ本文です。Supabase Native投稿の検証に使用します。",
  website: "",
  campaignToken: "22222222-2222-4222-8222-222222222222",
};
const idempotencyKey = "33333333-3333-4333-8333-333333333333";

function request(payload = validPayload, headerOverrides = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers = new Headers({
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    "origin": "https://mens-esthe-kuchikomi.com",
    "host": "mens-esthe-kuchikomi.com",
    "sec-fetch-site": "same-origin",
    "x-eskomi-csrf": "review-submit-v1",
    "idempotency-key": idempotencyKey,
    "x-vercel-forwarded-for": "203.0.113.8",
    ...headerOverrides,
  });
  return { headers, text: async () => body };
}

const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-test-secret";
try {
  let response = await routeModule.POST(request());
  assert.equal(response.status, 200);
  assert.equal(claimCalls.length, 1);
  assert.equal(submitCalls.length, 1);
  assert.deepEqual(submitCalls[0].shop, { wpShopId: 712 });
  assert.equal(submitCalls[0].sourceUrl, "https://mens-esthe-kuchikomi.com/reviews/submit/");
  assert.equal(submitCalls[0].campaignToken, validPayload.campaignToken);
  assert.match(submitCalls[0].idempotencyKeyHash, /^[0-9a-f]{64}$/);
  assert.match(submitCalls[0].abuseKeyHash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(submitCalls[0]).includes("203.0.113.8"), false);
  assert.equal(claimCalls[0].idempotencyKeyHash, submitCalls[0].idempotencyKeyHash);

  const beforeRejected = { claims: claimCalls.length, submits: submitCalls.length };
  for (const [candidate, headers, expectedStatus] of [
    [validPayload, { "content-type": "text/plain" }, 415],
    [validPayload, { origin: "https://attacker.example" }, 403],
    [validPayload, { "sec-fetch-site": "cross-site" }, 403],
    [validPayload, { "x-eskomi-csrf": "wrong" }, 403],
    [validPayload, { "idempotency-key": "not-a-uuid" }, 400],
    [validPayload, { "content-length": "20000" }, 413],
    [{ ...validPayload, unexpected: "field" }, {}, 400],
    [{ ...validPayload, website: "spam" }, {}, 400],
    [{ ...validPayload, ratingTotal: "5" }, {}, 400],
    [{ ...validPayload, website: 0 }, {}, 400],
    [{ ...validPayload, campaignToken: "not-a-uuid" }, {}, 400],
  ]) {
    response = await routeModule.POST(request(candidate, headers));
    assert.equal(response.status, expectedStatus);
  }
  assert.deepEqual(
    { claims: claimCalls.length, submits: submitCalls.length },
    beforeRejected,
    "rejected envelopes must not reach Supabase",
  );

  wpShop = { ...wpShop, publicationStatus: "draft" };
  response = await routeModule.POST(request());
  assert.equal(response.status, 404);
  assert.equal(claimCalls.length, beforeRejected.claims);
  wpShop = { ...wpShop, publicationStatus: "publish" };

  claimResult = { status: "ok", data: { allowed: false, retryAfterSeconds: 321 } };
  response = await routeModule.POST(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "321");
  assert.equal(submitCalls.length, beforeRejected.submits);

  claimResult = { status: "error", error: { code: "request_failed" } };
  response = await routeModule.POST(request());
  assert.equal(response.status, 503);

  claimResult = { status: "ok", data: { allowed: true, retryAfterSeconds: 0 } };
  submitResult = { status: "error", error: { code: "request_failed", raw: "must not escape" } };
  response = await routeModule.POST(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /must not escape/);
} finally {
  if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
}

console.log("review native submission API source contract passed");
