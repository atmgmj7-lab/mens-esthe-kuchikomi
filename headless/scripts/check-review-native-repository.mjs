import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const typesPath = resolve(root, "lib/reviews/repository.ts");
const implementationPath = resolve(root, "lib/supabase/review-native.ts");
const serverSecretPath = resolve(root, "lib/supabase/server-secret.ts");
let serverSecretModule;

assert.ok(existsSync(typesPath), "server-only Review repository contract must exist");
assert.ok(existsSync(implementationPath), "Supabase Review repository implementation must exist");

const typesSource = readFileSync(typesPath, "utf8");
const implementationSource = readFileSync(implementationPath, "utf8");
assert.match(typesSource, /import\s+["']server-only["']/, "Review types must be server-only");
assert.match(implementationSource, /import\s+["']server-only["']/, "implementation must be server-only");
assert.doesNotMatch(typesSource + implementationSource, /NEXT_PUBLIC_/);
assert.doesNotMatch(implementationSource, /console\.(?:log|error)|response\.text\(/);

function compile(source, filename, dependencies = {}) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    process: { env: {} },
    fetch: async () => { throw new Error("default fetch must not run in repository contract"); },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    require(specifier) {
      if (specifier === "server-only") return {};
      if (specifier === "@/lib/supabase/server-secret") {
        serverSecretModule ??= compile(readFileSync(serverSecretPath, "utf8"), serverSecretPath);
        return serverSecretModule;
      }
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
  });
  return module.exports;
}

const types = compile(typesSource, typesPath);
const implementation = compile(implementationSource, implementationPath, {
  "@/lib/reviews/repository": types,
});
assert.equal(typeof implementation.createSupabaseReviewRepository, "function");

const reviewId = "11111111-1111-4111-8111-111111111111";
const campaignToken = "22222222-2222-4222-8222-222222222222";
const baseRequest = {
  shop: { wpShopId: 712 },
  body: "十分な長さを持つテスト用の口コミ本文です。接客と清潔感について具体的に記載します。",
  rating: 4,
  ratingPrice: 3,
  ratingService: 5,
  ratingCleanliness: 4,
  visitPeriod: "2026年9月",
  revisitIntent: "また利用したい",
  nickname: "テスト利用者",
  email: null,
  sourceUrl: "https://mens-esthe-kuchikomi.com/reviews/submit/",
  idempotencyKeyHash: "a".repeat(64),
  abuseKeyHash: "b".repeat(64),
  abuseWindowStartedAt: "2026-09-20T00:00:00.000Z",
  abuseWindowExpiresAt: "2026-09-20T00:10:00.000Z",
  campaignToken,
};

function response(body, ok = true, status = ok ? 200 : 500) {
  return { ok, status, json: async () => body };
}

const calls = [];
let nextResponse = response([]);
const repository = implementation.createSupabaseReviewRepository({
  baseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-secret-value",
  fetchImpl: async (...args) => {
    calls.push(args);
    return nextResponse;
  },
});

nextResponse = response([{ allowed: true, retry_after_seconds: 0 }]);
const rateClaim = await repository.claimRateLimit({
  idempotencyKeyHash: "a".repeat(64),
  abuseKeyHash: "b".repeat(64),
  windowStartedAt: "2026-09-20T00:00:00.000Z",
  windowExpiresAt: "2026-09-20T00:10:00.000Z",
  limit: 3,
});
assert.deepEqual(JSON.parse(JSON.stringify(rateClaim)), {
  status: "ok",
  data: { allowed: true, retryAfterSeconds: 0 },
});
assert.equal(calls.at(-1)[0], "https://project.supabase.co/rest/v1/rpc/claim_review_submission_rate_limit");

nextResponse = response([{ review_id: reviewId, created: true }]);
assert.deepEqual(
  JSON.parse(JSON.stringify(await repository.submit(baseRequest))),
  { status: "ok", data: { reviewId, created: true, shop: { wpShopId: 712 } } },
);
assert.equal(calls.at(-1)[0], "https://project.supabase.co/rest/v1/rpc/submit_review_with_tags");
const submitInit = calls.at(-1)[1];
assert.equal(submitInit.headers.apikey, "service-secret-value");
assert.equal(submitInit.headers["Content-Profile"], "api");
assert.deepEqual(JSON.parse(submitInit.body), {
  p_wp_shop_id: 712,
  p_body: baseRequest.body,
  p_rating: 4,
  p_nickname: "テスト利用者",
  p_source_url: baseRequest.sourceUrl,
  p_idempotency_key_hash: "a".repeat(64),
  p_abuse_key_hash: "b".repeat(64),
  p_abuse_window_started_at: baseRequest.abuseWindowStartedAt,
  p_abuse_window_expires_at: baseRequest.abuseWindowExpiresAt,
  p_rating_price: 3,
  p_rating_service: 5,
  p_rating_cleanliness: 4,
  p_visit_period: "2026年9月",
  p_revisit_intent: "また利用したい",
  p_email: null,
  p_campaign_token: campaignToken,
  p_tags: [],
});

const moderationQueueRow = {
  review_id: reviewId,
  wp_shop_id: 712,
  shop_slug: "fixture-shop",
  shop_name: "検証店舗",
  body: baseRequest.body,
  submitted_at: "2026-09-20T00:00:00Z",
  rating_total: 4,
  rating_price: 3,
  rating_service: 5,
  rating_cleanliness: 4,
  visit_period: "2026年9月",
  revisit_intent: "また利用したい",
  moderation_status: "pending",
  publication_status: "draft",
  is_public: false,
  nickname: "テスト利用者",
};
nextResponse = response([moderationQueueRow]);
const queue = await repository.listModerationQueue({ limit: 50, offset: 0 });
assert.equal(queue.status, "ok");
assert.equal(queue.data[0].shop.wpShopId, 712);
assert.equal("email" in queue.data[0], false, "queue must omit private contact detail");

nextResponse = response([{
  ...moderationQueueRow,
  reviewed_at: null,
  approved_at: null,
  published_at: null,
  email: "test@example.invalid",
  source_url: "https://mens-esthe-kuchikomi.com/reviews/submit/",
}]);
const detail = await repository.getModerationDetail(reviewId);
assert.equal(detail.status, "ok");
assert.equal(detail.data.email, "test@example.invalid");

nextResponse = response([{
  event_id: 1,
  event_type: "approved",
  from_state: "pending",
  to_state: "approved",
  actor_label: "dashboard_review_operator",
  reason: "公開基準を満たすため",
  created_at: "2026-09-20T01:00:00Z",
}]);
const audit = await repository.listModerationAudit(reviewId);
assert.equal(audit.status, "ok");
assert.equal(audit.data[0].eventType, "approved");

nextResponse = response([{
  review_id: reviewId,
  moderation_status: "approved",
  publication_status: "draft",
  is_public: false,
  reviewed_at: "2026-09-20T01:00:00Z",
  approved_at: "2026-09-20T01:00:00Z",
  published_at: null,
}]);
const moderation = await repository.moderate({
  reviewId,
  decision: "approved",
  actorLabel: "operator:test",
  reason: "公開基準を満たすため",
});
assert.equal(moderation.status, "ok");
assert.equal(moderation.data.reviewId, reviewId);
assert.equal(calls.at(-1)[0].endsWith("/moderate_review"), true);

nextResponse = response([{
  review_id: reviewId,
  moderation_status: "approved",
  publication_status: "published",
  is_public: true,
  reviewed_at: "2026-09-20T01:00:00Z",
  approved_at: "2026-09-20T01:00:00Z",
  published_at: "2026-09-20T02:00:00Z",
}]);
const publication = await repository.publish({
  reviewId,
  actorLabel: "operator:test",
  reason: "明示公開",
});
assert.equal(publication.status, "ok");
assert.equal(publication.data.publicationStatus, "published");
assert.equal(calls.at(-1)[0].endsWith("/publish_review"), true);

nextResponse = response([{
  review_id: reviewId,
  wp_shop_id: 712,
  body: baseRequest.body,
  submitted_at: "2026-09-20T00:00:00Z",
  published_at: "2026-09-20T01:00:00Z",
  rating_total: 4,
  rating_price: 3,
  rating_service: 5,
  rating_cleanliness: 4,
  visit_period: "2026年9月",
  revisit_intent: "また利用したい",
}]);
const published = await repository.listPublished({ shop: { wpShopId: 712 }, limit: 20, offset: 0 });
assert.equal(published.status, "ok");
assert.equal(published.data[0].reviewId, reviewId);
assert.equal(published.data[0].shop.wpShopId, 712);
assert.equal(JSON.parse(calls.at(-1)[1].body).p_wp_shop_ids, null);

nextResponse = response([{
  review_id: reviewId,
  wp_shop_id: 712,
  body: baseRequest.body,
  submitted_at: "2026-09-20T00:00:00Z",
  published_at: "2026-09-20T01:00:00Z",
  rating_total: 4,
  rating_price: 3,
  rating_service: 5,
  rating_cleanliness: 4,
  visit_period: null,
  revisit_intent: null,
}]);
const scopedPublished = await repository.listPublished({
  shop: null,
  wpShopIds: [712],
  limit: 20,
  offset: 0,
});
assert.equal(scopedPublished.status, "ok");
assert.deepEqual(JSON.parse(calls.at(-1)[1].body).p_wp_shop_ids, [712]);
const callsBeforeInvalidScope = calls.length;
assert.equal((await repository.listPublished({
  shop: null,
  wpShopIds: [712, 712],
  limit: 20,
  offset: 0,
})).status, "error");
assert.equal(calls.length, callsBeforeInvalidScope, "invalid Shop scope must fail before transport");

nextResponse = response([{
  public_approved_review_count: 3,
  valid_overall_rating_count: 3,
  average_overall_rating: 4.3,
  valid_price_rating_count: 2,
  average_price_rating: 4,
  valid_service_rating_count: 3,
  average_service_rating: 4.7,
  valid_cleanliness_rating_count: 1,
  average_cleanliness_rating: 5,
  oldest_submitted_at: "2026-09-20T00:00:00Z",
  latest_submitted_at: "2026-09-20T02:00:00Z",
}]);
const metrics = await repository.getPublishedMetrics({ shop: { wpShopId: 712 } });
assert.deepEqual(JSON.parse(JSON.stringify(metrics.data.shop)), { wpShopId: 712 });
assert.equal(metrics.data.reviewCount, 3);
assert.equal(metrics.data.overall.responseCount, 3);
assert.equal(metrics.data.oldestSubmittedAt, "2026-09-20T00:00:00Z");

nextResponse = response(true);
const attribution = await repository.recordCampaignAttribution({
  campaignToken,
  reviewId,
  shop: { wpShopId: 712 },
});
assert.deepEqual(JSON.parse(JSON.stringify(attribution)), {
  status: "ok",
  data: { campaignToken, reviewId, shop: { wpShopId: 712 }, recorded: true },
});

nextResponse = response([]);
assert.equal((await repository.listPublished({ shop: { wpShopId: 712 }, limit: 20, offset: 0 })).status, "no_data");
assert.equal((await repository.getPublishedMetrics({ shop: { wpShopId: 712 } })).status, "no_data");

nextResponse = response([{ review_id: "not-a-uuid", created: true }]);
assert.deepEqual(JSON.parse(JSON.stringify(await repository.submit(baseRequest))), {
  status: "error",
  error: { code: "invalid_response" },
});

nextResponse = response({ message: "raw database detail must never escape", hint: "secret hint" }, false);
const rejected = await repository.submit(baseRequest);
assert.deepEqual(JSON.parse(JSON.stringify(rejected)), {
  status: "error",
  error: { code: "request_failed", httpStatus: 500 },
});
assert.doesNotMatch(JSON.stringify(rejected), /raw database|secret hint|service-secret-value/);

const thrown = implementation.createSupabaseReviewRepository({
  baseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-secret-value",
  fetchImpl: async () => { throw new Error("raw transport secret"); },
});
assert.deepEqual(JSON.parse(JSON.stringify(await thrown.submit(baseRequest))), {
  status: "error",
  error: { code: "request_failed" },
});

const unconfigured = implementation.createSupabaseReviewRepository({
  baseUrl: null,
  serviceRoleKey: null,
  fetchImpl: async () => { throw new Error("must not fetch"); },
});
assert.deepEqual(JSON.parse(JSON.stringify(await unconfigured.submit(baseRequest))), {
  status: "error",
  error: { code: "not_configured" },
});

nextResponse = response(false);
const notRecorded = await repository.recordCampaignAttribution({
  campaignToken,
  reviewId,
  shop: { wpShopId: 712 },
});
assert.equal(notRecorded.status, "ok");
assert.equal(notRecorded.data.recorded, false);

console.log("review native repository contract passed");
