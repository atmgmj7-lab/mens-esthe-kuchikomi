import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isIP } from "node:net";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const source = readFileSync(join(root, "lib/shop-owner-request-validation.ts"), "utf8");
const shopSlugSource = readFileSync(join(root, "lib/shop-slug.ts"), "utf8");
const compiledShopSlug = ts.transpileModule(shopSlugSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const shopSlugModule = { exports: {} };
vm.runInNewContext(compiledShopSlug, {
  module: shopSlugModule,
  exports: shopSlugModule.exports,
  decodeURIComponent,
  encodeURIComponent
});
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, {
  module,
  exports: module.exports,
  URL,
  require: (specifier) => {
    if (specifier === "@/lib/shop-slug") return shopSlugModule.exports;
    throw new Error(`Unexpected validation dependency: ${specifier}`);
  }
});
const { validateShopOwnerRequestPayload } = module.exports;

const valid = {
  shopId: 123,
  shopSlug: "c-r-e-a-m",
  shopName: "C.r.e.a.m（クリーム）",
  targetUrl: "https://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/",
  sourceUrl: "https://mens-esthe-kuchikomi.com/storelisting/?shop_id=123",
  requesterName: "店舗責任者",
  requesterRole: "owner",
  requesterEmail: "owner@example.jp",
  requestedFields: ["price", "hours", "official-image"],
  changeDetails: "料金と営業時間を更新してください。",
  evidenceUrl: "https://example.jp/price/",
  officialImageUrl: "https://example.jp/images/shop.jpg",
  consentPrivacy: true,
  consentAccuracy: true,
  consentImageRights: true,
  website: ""
};

assert.equal(validateShopOwnerRequestPayload(valid).ok, true);

const encodedShopSlug =
  "c-rest%ef%bc%88%e3%82%b7%e3%83%bc%e3%83%ac%e3%82%b9%e3%83%88%ef%bc%89";
const encodedTargetUrl =
  `https://mens-esthe-kuchikomi.com/shops/${encodedShopSlug}/`;
const encodedValid = validateShopOwnerRequestPayload({
  ...valid,
  shopId: 865,
  shopSlug: encodedShopSlug,
  shopName: "C-REST（シーレスト）",
  targetUrl: encodedTargetUrl
});
assert.equal(
  encodedValid.ok,
  true,
  "canonical lowercase percent-encoded WordPress slug must reach the API"
);
assert.equal(encodedValid.data.shopSlug, encodedShopSlug);
assert.equal(encodedValid.data.targetUrl, encodedTargetUrl);

for (const unsafeEncodedSlug of [
  `c-rest%25ef%25bc%2588`,
  "%e3%81",
  "bad%2fslug",
  "bad%5cslug",
  "%62etty-spa",
  "%E3%82%B7",
  "Ｃ-REST",
  "a".repeat(201)
]) {
  const unsafeResult = validateShopOwnerRequestPayload({
    ...valid,
    shopSlug: unsafeEncodedSlug,
    targetUrl: `https://mens-esthe-kuchikomi.com/shops/${unsafeEncodedSlug}/`
  });
  assert.equal(
    unsafeResult.ok,
    false,
    `reject unsafe or non-canonical slug ${unsafeEncodedSlug.slice(0, 30)}`
  );
}

assert.equal(validateShopOwnerRequestPayload({ ...valid, website: "spam" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, requestedFields: [] }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, shopId: 0 }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, targetUrl: "javascript:alert(1)" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, targetUrl: "https://example.jp/shops/c-r-e-a-m/" }).ok, false);
for (const nonCanonicalTargetUrl of [
  "http://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/",
  "https://mens-esthe-kuchikomi.com:444/shops/c-r-e-a-m/",
  "https://user:pass@mens-esthe-kuchikomi.com/shops/c-r-e-a-m/",
  "https://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/?preview=1",
  "https://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/#details"
]) {
  assert.equal(
    validateShopOwnerRequestPayload({ ...valid, targetUrl: nonCanonicalTargetUrl }).ok,
    false,
    `targetUrl must exactly match the canonical public URL: ${nonCanonicalTargetUrl}`
  );
}
assert.equal(validateShopOwnerRequestPayload({ ...valid, requesterEmail: "invalid" }).ok, false);
assert.equal(validateShopOwnerRequestPayload({ ...valid, consentImageRights: false }).ok, false);

const normalized = validateShopOwnerRequestPayload({
  ...valid,
  shopName: ` ${valid.shopName} `,
  requesterName: ` ${valid.requesterName} `,
  requesterEmail: ` ${valid.requesterEmail} `,
  requestedFields: ["price", "price", "hours"],
  changeDetails: ` ${valid.changeDetails} `,
  evidenceUrl: "",
  officialImageUrl: ""
});
assert.equal(normalized.ok, true);
assert.deepEqual(
  JSON.parse(JSON.stringify(normalized.data.requestedFields)),
  ["price", "hours"]
);
assert.equal(normalized.data.shopName, valid.shopName);
assert.equal(normalized.data.requesterName, valid.requesterName);
assert.equal(normalized.data.requesterEmail, valid.requesterEmail);
assert.equal(normalized.data.changeDetails, valid.changeDetails);
assert.equal("evidenceUrl" in normalized.data, false);
assert.equal("officialImageUrl" in normalized.data, false);

const invalidCases = [
  [null, "payload"],
  [{ ...valid, shopId: 1.5 }, "shopId"],
  [{ ...valid, shopSlug: "INVALID" }, "shopSlug"],
  [{ ...valid, shopName: "" }, "shopName"],
  [{ ...valid, shopName: "x".repeat(121) }, "shopName length"],
  [{ ...valid, targetUrl: "https://mens-esthe-kuchikomi.com/shops/other/" }, "targetUrl path"],
  [{ ...valid, sourceUrl: "javascript:alert(1)" }, "sourceUrl"],
  [{ ...valid, requesterName: "" }, "requesterName"],
  [{ ...valid, requesterRole: "admin" }, "requesterRole"],
  [{ ...valid, requesterEmail: `${"a".repeat(250)}@example.jp` }, "requesterEmail length"],
  [{ ...valid, requestedFields: ["price", "unknown"] }, "requestedFields enum"],
  [{ ...valid, changeDetails: "" }, "changeDetails"],
  [{ ...valid, changeDetails: "x".repeat(5001) }, "changeDetails length"],
  [{ ...valid, evidenceUrl: "javascript:alert(1)" }, "evidenceUrl"],
  [{ ...valid, officialImageUrl: "javascript:alert(1)" }, "officialImageUrl"],
  [{ ...valid, consentPrivacy: false }, "consentPrivacy"],
  [{ ...valid, consentAccuracy: false }, "consentAccuracy"]
];

for (const [payload, label] of invalidCases) {
  const result = validateShopOwnerRequestPayload(payload);
  assert.equal(result.ok, false, label);
  assert.match(result.error, /[぀-ヿ一-鿿]/, `${label} must return a Japanese error`);
}

const rateLimitSource = readFileSync(
  join(root, "lib/shop-owner-request-rate-limit.ts"),
  "utf8"
);
assert.doesNotMatch(rateLimitSource, /new Map|contact-rate-limit/);
assert.match(rateLimitSource, /shop_owner_request_rate_limit/);
assert.match(rateLimitSource, /SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET/);
assert.doesNotMatch(rateLimitSource, /NEXT_PUBLIC_/);

const rateLimitCompiled = ts.transpileModule(rateLimitSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const rateLimitModule = { exports: {} };
const rateProcessMock = { env: {} };
const rateFetchCalls = [];
let rateResponse = { ok: true, json: async () => true };
const awaitImportStubs = {
  crypto: { createHmac },
  net: { isIP }
};
vm.runInNewContext(rateLimitCompiled, {
  module: rateLimitModule,
  exports: rateLimitModule.exports,
  process: rateProcessMock,
  fetch: async (...args) => {
    rateFetchCalls.push(args);
    return rateResponse;
  },
  require: (specifier) => {
    if (specifier === "node:crypto") return awaitImportStubs.crypto;
    if (specifier === "node:net") return awaitImportStubs.net;
    throw new Error(`Unexpected rate-limit dependency: ${specifier}`);
  }
});
const {
  buildShopOwnerRequestRateLimitKey,
  claimShopOwnerRequestRateLimit,
  resolveTrustedShopOwnerClientIp
} = rateLimitModule.exports;

function headerBag(values) {
  const normalizedValues = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  return { get: (name) => normalizedValues[name.toLowerCase()] ?? null };
}

assert.equal(
  resolveTrustedShopOwnerClientIp(headerBag({ "x-vercel-forwarded-for": "203.0.113.4, 10.0.0.1" })),
  "203.0.113.4"
);
assert.equal(
  resolveTrustedShopOwnerClientIp(headerBag({ "x-vercel-forwarded-for": "spoofed", "x-real-ip": "198.51.100.7" })),
  "198.51.100.7"
);
assert.equal(resolveTrustedShopOwnerClientIp(headerBag({ "x-forwarded-for": "not-an-ip" })), null);

const ipKey = buildShopOwnerRequestRateLimitKey({
  shopId: 123,
  requesterEmail: "owner@example.jp",
  clientIp: "203.0.113.4",
  secret: "unit-test-secret"
});
const otherShopKey = buildShopOwnerRequestRateLimitKey({
  shopId: 124,
  requesterEmail: "owner@example.jp",
  clientIp: "203.0.113.4",
  secret: "unit-test-secret"
});
const noIpKeyA = buildShopOwnerRequestRateLimitKey({
  shopId: 123,
  requesterEmail: "owner-a@example.jp",
  clientIp: null,
  secret: "unit-test-secret"
});
const noIpKeyB = buildShopOwnerRequestRateLimitKey({
  shopId: 123,
  requesterEmail: "owner-b@example.jp",
  clientIp: null,
  secret: "unit-test-secret"
});
assert.notEqual(ipKey, otherShopKey, "trusted IP limits must be scoped by shop");
assert.notEqual(noIpKeyA, noIpKeyB, "missing IP must not collapse all visitors into one unknown bucket");
for (const key of [ipKey, otherShopKey, noIpKeyA, noIpKeyB]) {
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes("203.0.113.4"), false, "stored key must not expose the raw IP");
  assert.equal(key.includes("owner"), false, "stored key must not expose the requester email");
}

rateProcessMock.env = {
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_server_only_key",
  SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET: "unit-test-secret"
};
const claimed = await claimShopOwnerRequestRateLimit({
  shopId: 123,
  requesterEmail: "owner@example.jp",
  clientIp: "203.0.113.4"
});
assert.deepEqual(JSON.parse(JSON.stringify(claimed)), { ok: true, allowed: true });
assert.equal(rateFetchCalls.length, 1);
const [rateUrl, rateInit] = rateFetchCalls[0];
assert.equal(rateUrl, "https://project.supabase.co/rest/v1/rpc/claim_shop_owner_request_rate_limit");
assert.equal(rateInit.method, "POST");
assert.equal(rateInit.headers.apikey, "sb_secret_test_server_only_key");
assert.equal("Authorization" in rateInit.headers, false);
assert.equal(rateInit.headers["Content-Profile"], "api");
assert.equal(rateInit.headers["Accept-Profile"], "api");
assert.equal(rateInit.cache, "no-store");
assert.deepEqual(Object.keys(JSON.parse(rateInit.body)), ["p_request_key"]);

rateResponse = { ok: true, json: async () => false };
assert.deepEqual(
  JSON.parse(JSON.stringify(await claimShopOwnerRequestRateLimit({
    shopId: 123,
    requesterEmail: "owner@example.jp",
    clientIp: "203.0.113.4"
  }))),
  { ok: true, allowed: false, retryAfterSec: 600 }
);

const serviceSource = readFileSync(
  join(root, "lib/shop-owner-request-service.ts"),
  "utf8"
);
const serviceCompiled = ts.transpileModule(serviceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const serviceModule = { exports: {} };
vm.runInNewContext(serviceCompiled, {
  module: serviceModule,
  exports: serviceModule.exports,
  require: (specifier) => {
    if (specifier === "@/lib/shop-slug") return shopSlugModule.exports;
    throw new Error(`Unexpected service dependency: ${specifier}`);
  }
});
const { submitCanonicalShopOwnerRequest } = serviceModule.exports;

const canonicalWpShop = { id: 123, slug: "c-r-e-a-m", title: "WordPress正式店舗名" };
let savedCanonicalData = null;
let rateClaimCalls = 0;
const serviceDeps = {
  getShopBySlug: async () => canonicalWpShop,
  claimRateLimit: async () => {
    rateClaimCalls += 1;
    return { ok: true, allowed: true };
  },
  save: async (data) => {
    savedCanonicalData = data;
    return { ok: true };
  }
};
assert.deepEqual(
  JSON.parse(JSON.stringify(await submitCanonicalShopOwnerRequest(
    { ...normalized.data, shopName: "ブラウザ入力名" },
    { clientIp: "203.0.113.4" },
    serviceDeps
  ))),
  { ok: true }
);
assert.equal(savedCanonicalData.shopId, canonicalWpShop.id);
assert.equal(savedCanonicalData.shopSlug, canonicalWpShop.slug);
assert.equal(savedCanonicalData.shopName, canonicalWpShop.title);
assert.equal(savedCanonicalData.targetUrl, "https://mens-esthe-kuchikomi.com/shops/c-r-e-a-m/");
assert.equal(rateClaimCalls, 1);

for (const mismatchedShop of [
  { ...canonicalWpShop, id: 999 },
  { ...canonicalWpShop, slug: "other-shop" },
  null
]) {
  let saveCalled = false;
  const result = await submitCanonicalShopOwnerRequest(
    normalized.data,
    { clientIp: null },
    {
      ...serviceDeps,
      getShopBySlug: async () => mismatchedShop,
      save: async () => {
        saveCalled = true;
        return { ok: true };
      }
    }
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "shop-mismatch");
  assert.equal(saveCalled, false);
}

assert.equal(
  (await submitCanonicalShopOwnerRequest(normalized.data, { clientIp: null }, {
    ...serviceDeps,
    getShopBySlug: async () => { throw new Error("simulated WordPress outage"); }
  })).reason,
  "source-unavailable"
);
assert.equal(
  (await submitCanonicalShopOwnerRequest(normalized.data, { clientIp: null }, {
    ...serviceDeps,
    claimRateLimit: async () => ({ ok: true, allowed: false, retryAfterSec: 600 })
  })).reason,
  "rate-limited"
);
assert.equal(
  (await submitCanonicalShopOwnerRequest(normalized.data, { clientIp: null }, {
    ...serviceDeps,
    claimRateLimit: async () => ({ ok: false, reason: "not-configured" })
  })).reason,
  "rate-limit-unavailable"
);

const route = readFileSync(join(root, "app/api/shop-owner-request/route.ts"), "utf8");
assert.doesNotMatch(route, /contact-rate-limit|checkRateLimit/);
assert.match(route, /validateShopOwnerRequestPayload/);
assert.match(route, /getShopBySlug/);
assert.match(route, /claimShopOwnerRequestRateLimit/);
assert.match(route, /submitCanonicalShopOwnerRequest/);
assert.doesNotMatch(
  route,
  /console\.(info|log|warn|error)\([^;]*(requesterEmail|changeDetails|validation\.data|body)/
);

const persistence = readFileSync(join(root, "lib/supabase/shop-owner-request.ts"), "utf8");
assert.match(persistence, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(persistence, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
assert.match(persistence, /Content-Profile/);
assert.match(persistence, /api/);

const persistenceCompiled = ts.transpileModule(persistence, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const persistenceModule = { exports: {} };
const processMock = { env: {} };
const fetchCalls = [];
let fetchOk = true;
let fetchError = null;
const fetchMock = async (...args) => {
  fetchCalls.push(args);
  if (fetchError) throw fetchError;
  return { ok: fetchOk };
};
vm.runInNewContext(persistenceCompiled, {
  module: persistenceModule,
  exports: persistenceModule.exports,
  process: processMock,
  fetch: fetchMock
});
const { saveShopOwnerRequest } = persistenceModule.exports;

processMock.env.SHOP_OWNER_REQUEST_DRY_RUN = "true";
processMock.env.NODE_ENV = "development";
assert.equal((await saveShopOwnerRequest(normalized.data)).ok, true);
assert.equal(fetchCalls.length, 0);

processMock.env = {};
assert.equal((await saveShopOwnerRequest(normalized.data)).reason, "not-configured");

processMock.env = {
  SHOP_OWNER_REQUEST_DRY_RUN: "true",
  NODE_ENV: "production"
};
assert.equal((await saveShopOwnerRequest(normalized.data)).reason, "not-configured");

processMock.env = {
  SUPABASE_URL: "https://project.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_server_only_key"
};
assert.equal((await saveShopOwnerRequest(normalized.data)).ok, true);
assert.equal(fetchCalls.length, 1);
const [requestUrl, requestInit] = fetchCalls[0];
assert.equal(requestUrl, "https://project.supabase.co/rest/v1/shop_owner_requests");
assert.equal(requestInit.method, "POST");
assert.equal(requestInit.headers.apikey, "sb_secret_test_server_only_key");
assert.equal("Authorization" in requestInit.headers, false);
assert.equal(requestInit.headers["Content-Profile"], "api");
assert.equal(requestInit.cache, "no-store");
const requestBody = JSON.parse(requestInit.body);
assert.equal(requestBody.wp_shop_id, normalized.data.shopId);
assert.equal(requestBody.requester_email, normalized.data.requesterEmail);
assert.equal(requestBody.evidence_url, null);
assert.equal(requestBody.official_image_url, null);

const legacyServiceRoleJwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
processMock.env.SUPABASE_SERVICE_ROLE_KEY = legacyServiceRoleJwt;
assert.equal((await saveShopOwnerRequest(normalized.data)).ok, true);
assert.equal(fetchCalls.length, 2);
const [, legacyRequestInit] = fetchCalls[1];
assert.equal(legacyRequestInit.headers.apikey, legacyServiceRoleJwt);
assert.equal(legacyRequestInit.headers.Authorization, `Bearer ${legacyServiceRoleJwt}`);

fetchOk = false;
assert.equal((await saveShopOwnerRequest(normalized.data)).reason, "request-failed");

fetchOk = true;
fetchError = new Error("simulated network failure");
assert.equal((await saveShopOwnerRequest(normalized.data)).reason, "request-failed");

const envExample = readFileSync(join(root, ".env.example"), "utf8");
assert.match(envExample, /^SUPABASE_URL=$/m);
assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=$/m);
assert.match(envExample, /^SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET=$/m);
assert.match(envExample, /^SHOP_OWNER_REQUEST_DRY_RUN=true$/m);
assert.doesNotMatch(envExample, /^NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=/m);

console.log("shop owner request API check passed");
