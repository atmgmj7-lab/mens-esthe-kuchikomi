import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const operatorPath = join(root, "scripts", "p1-rank-auth-membership-operator.mjs");
const migrationDirectory = join(root, "..", "supabase", "migrations");
const operatorSource = existsSync(operatorPath) ? readFileSync(operatorPath, "utf8") : "";
const migration = existsSync(migrationDirectory)
  ? (await import("node:fs")).readdirSync(migrationDirectory)
    .filter((name) => name.endsWith("_partner_membership_operator.sql"))
    .map((name) => readFileSync(join(migrationDirectory, name), "utf8"))
    .join("\n")
  : "";

assert.match(operatorSource, /export async function runP1RankAuthMembershipOperator/, "the P1 Rank membership operator must be a server-only executable method");
assert.match(migration, /api\.grant_partner_membership/, "membership grant requires a service-role-only API wrapper");

const operator = existsSync(operatorPath)
  ? await import(`./p1-rank-auth-membership-operator.mjs?${Date.now()}`)
  : {};
assert.equal(typeof operator.runP1RankAuthMembershipOperator, "function", "the server-only operator method must be callable by the protected runner");

const workspaceId = "11111111-1111-4111-8111-111111111111";
const authUserId = "22222222-2222-4222-8222-222222222222";
const otherWorkspaceId = "33333333-3333-4333-8333-333333333333";
const baseEnvironment = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-fixture",
  P1_RANK_WORKSPACE_ID: workspaceId,
  P1_RANK_CONTACT_EMAIL: "owner@example.invalid",
  P1_RANK_CONTACT_IDENTITY_CONFIRMED: "true",
  P1_RANK_PARTNER_ROLE: "owner",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function validGrant(result = "created", membershipWorkspaceId = workspaceId, membershipShopId = 768) {
  return [{
    workspace_id: membershipWorkspaceId,
    auth_user_id: authUserId,
    wp_shop_id: membershipShopId,
    role: "owner",
    status: "active",
    result,
  }];
}

function createFetch({ users = [{ id: authUserId, email: "owner@example.invalid" }], grant = validGrant(), grantStatus = 200, createUser = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop/768?_embed=1") {
      return response({ id: 768, slug: "mrs-rank-up", title: { rendered: "Mrs.Rank UP" } });
    }
    if (String(url).startsWith("https://project.supabase.co/auth/v1/admin/users?")) return response({ users });
    if (String(url) === "https://project.supabase.co/auth/v1/admin/users" && options.method === "POST") {
      return createUser ? response({ user: createUser }) : response({ message: "not allowed" }, 400);
    }
    if (String(url) === "https://project.supabase.co/rest/v1/rpc/grant_partner_membership") return response(grant, grantStatus);
    if (String(url) === `https://project.supabase.co/auth/v1/admin/users/${authUserId}` && options.method === "DELETE") return response({});
    return response({ message: "unexpected" }, 404);
  };
  return { fetchImpl, calls };
}

{
  const { fetchImpl, calls } = createFetch();
  const result = await operator.runP1RankAuthMembershipOperator({ environment: baseEnvironment, fetchImpl });
  assert.deepEqual(result, {
    outcome: "created",
    authUser: "22222222…2222",
    workspace: "11111111…1111",
    wpShopId: 768,
    role: "owner",
    membershipStatus: "active",
    authUserCreated: false,
  }, "WP 768, its canonical Workspace, and the intended Auth user must produce only a masked safe readback");
  assert.equal(calls.filter(({ url }) => url.endsWith("/auth/v1/admin/users")).length, 0, "an existing exact Auth identity must not be recreated");
  const grantCall = calls.find(({ url }) => url.endsWith("/rest/v1/rpc/grant_partner_membership"));
  assert.ok(grantCall, "the runner must issue its membership write through the scoped wrapper");
  assert.deepEqual(JSON.parse(String(grantCall.options.body)), {
    p_workspace_id: workspaceId,
    p_auth_user_id: authUserId,
    p_wp_shop_id: 768,
    p_shop_slug: "mrs-rank-up",
    p_canonical_url: "https://mens-esthe-kuchikomi.com/shops/mrs-rank-up/",
    p_role: "owner",
  });
  assert.equal(grantCall.options.headers.apikey, "service-role-fixture", "only the server-side runner may present the service credential to Auth/REST");
  assert.equal(grantCall.options.headers.Authorization, undefined, "a non-JWT secret key must use the API-key header without an invalid Bearer token");
}

{
  const legacyServiceRoleKey = ["eyJfixture", "abc", "def"].join(".");
  const { fetchImpl, calls } = createFetch();
  await operator.runP1RankAuthMembershipOperator({
    environment: { ...baseEnvironment, SUPABASE_SERVICE_ROLE_KEY: legacyServiceRoleKey },
    fetchImpl,
  });
  const grantCall = calls.find(({ url }) => url.endsWith("/rest/v1/rpc/grant_partner_membership"));
  assert.equal(grantCall.options.headers.Authorization, `Bearer ${legacyServiceRoleKey}`, "a legacy service-role JWT retains the existing Bearer compatibility path");
}

{
  const { fetchImpl } = createFetch({ grant: validGrant("already_present") });
  const result = await operator.runP1RankAuthMembershipOperator({ environment: baseEnvironment, fetchImpl });
  assert.equal(result.outcome, "already_present", "an exact repeat must be idempotent");
  assert.equal(result.authUserCreated, false);
}

for (const [label, setup, expectedCode] of [
  ["wrong Workspace", { grant: validGrant("created", otherWorkspaceId) }, "membership-binding-mismatch"],
  ["wrong WP Shop", { grant: validGrant("created", workspaceId, 769) }, "membership-binding-mismatch"],
  ["ambiguous Auth identity", { users: [{ id: authUserId, email: "owner@example.invalid" }, { id: otherWorkspaceId, email: "owner@example.invalid" }] }, "auth-ambiguous"],
  ["conflicting existing membership", { grant: validGrant("conflict", otherWorkspaceId) }, "membership-binding-mismatch"],
]) {
  const { fetchImpl } = createFetch(setup);
  await assert.rejects(
    () => operator.runP1RankAuthMembershipOperator({ environment: baseEnvironment, fetchImpl }),
    (error) => error?.code === expectedCode,
    `${label} must fail closed`,
  );
}

{
  const { fetchImpl, calls } = createFetch({ users: [], createUser: { id: authUserId, email: "owner@example.invalid" } });
  await assert.rejects(
    () => operator.runP1RankAuthMembershipOperator({ environment: baseEnvironment, fetchImpl }),
    (error) => error?.code === "auth-not-found",
    "a missing Auth user must not be created without explicit operator intent",
  );
  assert.equal(calls.filter(({ url }) => url.endsWith("/auth/v1/admin/users")).length, 0);
}

{
  const { fetchImpl, calls } = createFetch({ users: [], createUser: { id: authUserId, email: "owner@example.invalid" } });
  const result = await operator.runP1RankAuthMembershipOperator({
    environment: { ...baseEnvironment, P1_RANK_CREATE_AUTH_USER: "true" },
    fetchImpl,
  });
  assert.equal(result.authUserCreated, true, "an explicit verified operator instruction may create the no-password Auth identity");
  const createCall = calls.find(({ url, options }) => url.endsWith("/auth/v1/admin/users") && options.method === "POST");
  assert.deepEqual(JSON.parse(String(createCall.options.body)), { email: "owner@example.invalid", email_confirm: false });
}

{
  const { fetchImpl, calls } = createFetch({
    users: [],
    createUser: { id: authUserId, email: "owner@example.invalid" },
    grant: { message: "unavailable" },
    grantStatus: 503,
  });
  await assert.rejects(
    () => operator.runP1RankAuthMembershipOperator({
      environment: { ...baseEnvironment, P1_RANK_CREATE_AUTH_USER: "true" },
      fetchImpl,
    }),
    (error) => error?.code === "membership-grant-rolled-back",
    "a newly created unbound Auth user must be safely compensated when the membership write fails",
  );
  assert.ok(
    calls.some(({ url, options }) => url.endsWith(`/auth/v1/admin/users/${authUserId}`) && options.method === "DELETE"),
    "only the Auth identity created in this failed operation may be deleted during compensation",
  );
}

assert.doesNotMatch(operatorSource, /app\/api|NEXT_PUBLIC_|console\.log\([^)]*(?:SERVICE_ROLE|CONTACT_EMAIL)/, "the operator method must not become a browser API or emit credentials/PII");
assert.match(migration, /revoke all on function api\.grant_partner_membership[^;]+from public, anon, authenticated/i);
assert.match(migration, /grant execute on function api\.grant_partner_membership[^;]+to service_role/i);
assert.doesNotMatch(migration, /security definer/i, "the grant wrapper must remain security invoker");

console.log("P1 Rank Auth/Membership operator contract: PASS");
