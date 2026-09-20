import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const routePath = resolve(root, "app/api/dashboard/reviews/moderation/route.ts");
const componentPath = resolve(root, "components/dashboard/DashboardReviewModeration.tsx");
assert.ok(existsSync(routePath), "operator Review moderation API must exist");
assert.ok(existsSync(componentPath), "operator Review moderation UI must exist");

const route = read("app/api/dashboard/reviews/moderation/route.ts");
const component = read("components/dashboard/DashboardReviewModeration.tsx");
const page = read("app/dashboard/partners/page.tsx");
const repository = read("lib/supabase/review-native.ts");
const types = read("lib/reviews/repository.ts");
const migration = read("../supabase/migrations/20260920062938_review_native_foundation.sql");

assert.match(route, /authorizeDashboardRequest/);
assert.match(route, /request\.headers\.get\(["']authorization["']\)/);
assert.match(route, /const actorLabel = ["']dashboard_review_operator["']/);
assert.match(route, /export async function GET/);
assert.match(route, /export async function POST/);
assert.match(route, /approved|rejected|spam|published/);
assert.match(route, /x-eskomi-csrf/i);
assert.match(route, /sec-fetch-site/i);
assert.match(route, /application\/json/i);
assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|rest\/v1|private\./);
assert.doesNotMatch(route, /(?:body|rating|ratingTotal):\s*input\./);

assert.match(component, /保留中の口コミ/);
assert.match(component, /詳細を確認/);
assert.match(component, /承認/);
assert.match(component, /却下/);
assert.match(component, /スパム/);
assert.match(component, /公開/);
assert.match(component, /非公開の判断理由/);
assert.match(component, /監査履歴/);
assert.match(page, /DashboardReviewModeration/);
assert.match(page, /listModerationQueue/);
assert.match(page, /export const instant = false/, "private moderation data must not be statically captured");
assert.match(page, /import\s*\{\s*connection\s*\}\s*from\s*["']next\/server["']/);
assert.match(page, /await connection\(\)/, "private moderation reads must cross the request-time boundary");

for (const method of ["listModerationQueue", "getModerationDetail", "listModerationAudit", "publish"]) {
  assert.match(types, new RegExp(method));
  assert.match(repository, new RegExp(method));
}
for (const functionName of [
  "list_review_moderation_queue",
  "get_review_moderation_detail",
  "list_review_moderation_events",
  "publish_review",
]) {
  assert.match(migration, new RegExp(`create or replace function private\\.${functionName}`, "i"));
  assert.match(migration, new RegExp(`create or replace function api\\.${functionName}`, "i"));
  assert.match(migration, new RegExp(`revoke all on function api\\.${functionName}[\\s\\S]*from public, anon, authenticated`, "i"));
  assert.match(migration, new RegExp(`grant execute on function api\\.${functionName}[\\s\\S]*to service_role`, "i"));
}

assert.match(migration, /p_decision = 'approved'[\s\S]*publication_status = 'draft'[\s\S]*is_public = false/i);
assert.match(migration, /create or replace function private\.publish_review[\s\S]*moderation_status <> 'approved'/i);
assert.match(migration, /event_type[^;]+published/i);
assert.doesNotMatch(migration, /p_decision = 'approved'[\s\S]{0,500}publication_status = 'published'/i);

class TestNextResponse extends Response {
  static json(value, init = {}) {
    return new TestNextResponse(JSON.stringify(value), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }
}

function loadTypeScript(path, dependencies) {
  const output = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency in ${path}: ${specifier}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const reviewId = "11111111-1111-4111-8111-111111111111";
const calls = [];
let authorized = true;
const queueReview = { reviewId, body: "immutable", rating: 5 };
const repositoryMock = {
  async listModerationQueue() { calls.push(["list"]); return { status: "ok", data: [queueReview] }; },
  async getModerationDetail(id) { calls.push(["detail", id]); return { status: "ok", data: queueReview }; },
  async listModerationAudit(id) { calls.push(["audit", id]); return { status: "no_data", data: null }; },
  async moderate(input) {
    calls.push(["moderate", input]);
    return { status: "ok", data: { reviewId, moderationStatus: input.decision } };
  },
  async publish(input) {
    calls.push(["publish", input]);
    return { status: "ok", data: { reviewId, publicationStatus: "published" } };
  },
};
const routeModule = loadTypeScript("app/api/dashboard/reviews/moderation/route.ts", {
  "next/server": { NextResponse: TestNextResponse },
  "@/lib/dashboard/content-admin-auth": {
    authorizeDashboardRequest: () => authorized
      ? { ok: true, status: 200, reason: "authorized" }
      : { ok: false, status: 401, reason: "missing-credentials" },
  },
  "@/lib/supabase/review-native": { reviewNativeRepository: repositoryMock },
});
const request = (url, body) => ({
  headers: new Headers({
    authorization: "Basic fixture",
    "content-type": "application/json",
    origin: new URL(url).origin,
    "sec-fetch-site": "same-origin",
    "x-eskomi-csrf": "review-moderation",
  }),
  nextUrl: new URL(url),
  json: async () => body,
});

authorized = false;
let response = await routeModule.GET(request("https://example.test/api/dashboard/reviews/moderation/"));
assert.equal(response.status, 401);
assert.equal(calls.length, 0, "unauthorized request must not reach the repository");

authorized = true;
response = await routeModule.GET(request("https://example.test/api/dashboard/reviews/moderation/"));
assert.equal(response.status, 200);
assert.equal(calls.at(-1)[0], "list");
response = await routeModule.GET(request(`https://example.test/api/dashboard/reviews/moderation/?reviewId=${reviewId}`));
assert.equal(response.status, 200);
assert.deepEqual(calls.slice(-2).map((item) => item[0]).sort(), ["audit", "detail"]);

response = await routeModule.POST(request("https://example.test/api/dashboard/reviews/moderation/", {
  reviewId,
  action: "approved",
  reason: "公開基準を確認",
}));
assert.equal(response.status, 200);
assert.deepEqual(calls.at(-1), ["moderate", {
  reviewId,
  decision: "approved",
  actorLabel: "dashboard_review_operator",
  reason: "公開基準を確認",
}]);

response = await routeModule.POST(request("https://example.test/api/dashboard/reviews/moderation/", {
  reviewId,
  action: "published",
  reason: "明示公開",
}));
assert.equal(response.status, 200);
assert.equal(calls.at(-1)[0], "publish");
assert.equal(calls.at(-1)[1].actorLabel, "dashboard_review_operator");

const beforeCrossSiteAttempt = calls.length;
const crossSiteRequest = request("https://example.test/api/dashboard/reviews/moderation/", {
  reviewId,
  action: "rejected",
  reason: "cross-site attempt",
});
crossSiteRequest.headers.set("sec-fetch-site", "cross-site");
response = await routeModule.POST(crossSiteRequest);
assert.equal(response.status, 403);
assert.equal(calls.length, beforeCrossSiteAttempt, "cross-site mutation must not reach the repository");

const beforeImmutableAttempt = calls.length;
response = await routeModule.POST(request("https://example.test/api/dashboard/reviews/moderation/", {
  reviewId,
  action: "approved",
  reason: "不正更新",
  body: "changed",
}));
assert.equal(response.status, 400);
assert.equal(calls.length, beforeImmutableAttempt, "body mutation input must not reach the repository");

console.log("review native operator moderation source contract passed");
