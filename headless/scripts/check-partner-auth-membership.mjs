import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const authPath = join(root, "lib/partner/partner-auth.ts");
const serverPath = join(root, "lib/partner/partner-auth-server.ts");
const partnerPagePath = join(root, "app/partner/page.tsx");
const requestLinkPath = join(root, "app/api/partner/auth/request-link/route.ts");
const completeLinkPath = join(root, "app/api/partner/auth/complete-link/route.ts");
const callbackPagePath = join(root, "app/partner/auth/callback/page.tsx");
function loadModule(source, filename) {
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (specifier === "server-only") return {};
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
    URL,
    Response,
  });
  return module.exports;
}

const auth = existsSync(authPath) ? loadModule(readFileSync(authPath, "utf8"), authPath) : {};
const server = existsSync(serverPath) ? loadModule(readFileSync(serverPath, "utf8"), serverPath) : {};

assert.equal(
  typeof auth.authorizePartnerAccess,
  "function",
  "partner access must be authorized from a verified session and server-side membership",
);

async function authorize(input, dependencies) {
  return auth.authorizePartnerAccess(input, dependencies);
}

async function assertAuthorization(input, dependencies, expected, message) {
  assert.deepEqual(JSON.parse(JSON.stringify(await authorize(input, dependencies))), expected, message);
}

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const membershipA = {
  workspaceId: workspaceA,
  shopId: 101,
  shopSlug: "shop-a",
  role: "owner",
};

const validDependencies = {
  async getUser(accessToken) {
    return accessToken === "valid-a" ? { id: userA, email: "a@example.invalid" } : null;
  },
  async getActiveMembership(authUserId) {
    return authUserId === userA ? membershipA : null;
  },
};

await assertAuthorization(
  { accessToken: null, requestedWorkspaceId: null, requestedShopId: null }, validDependencies,
  { status: "unauthenticated" },
  "anonymous visitors must not receive partner access",
);

await assertAuthorization(
  { accessToken: "expired", requestedWorkspaceId: null, requestedShopId: null }, validDependencies,
  { status: "unauthenticated" },
  "invalid or expired sessions must be rejected",
);

await assertAuthorization(
  { accessToken: "valid-a", requestedWorkspaceId: null, requestedShopId: null }, {
    ...validDependencies,
    async getActiveMembership() { return null; },
  },
  { status: "forbidden" },
  "authenticated users without membership must be rejected",
);

await assertAuthorization(
  { accessToken: "valid-a", requestedWorkspaceId: workspaceA, requestedShopId: 101 }, validDependencies,
  { status: "allowed", access: membershipA },
  "a partner may access only its own active workspace and shop",
);

await assertAuthorization(
  { accessToken: "valid-a", requestedWorkspaceId: workspaceB, requestedShopId: 101 }, validDependencies,
  { status: "forbidden" },
  "changing a workspace ID must not cross the membership boundary",
);

await assertAuthorization(
  { accessToken: "valid-a", requestedWorkspaceId: workspaceA, requestedShopId: 202 }, validDependencies,
  { status: "forbidden" },
  "changing a shop ID must not cross the membership boundary",
);

await assertAuthorization(
  { accessToken: "valid-a", requestedWorkspaceId: userB, requestedShopId: null }, validDependencies,
  { status: "forbidden" },
  "an arbitrary UUID must never be treated as a partner workspace",
);

assert.equal(
  typeof server.createPartnerAuthDependencies,
  "function",
  "Supabase Auth verification and private membership lookup must stay server-side",
);
assert.equal(
  server.createPartnerAuthDependencies({}, async () => new Response()),
  null,
  "missing auth or service configuration must fail closed",
);

const serverRequests = [];
const serverDependencies = server.createPartnerAuthDependencies({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_AUTH_PUBLISHABLE_KEY: "publishable-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-fixture",
}, async (url, options) => {
  serverRequests.push({ url, options });
  if (url.endsWith("/auth/v1/user")) {
    return Response.json({ id: userA, email: "a@example.invalid" });
  }
  return Response.json([{
    workspace_id: workspaceA,
    wp_shop_id: 101,
    shop_slug: "shop-a",
    role: "owner",
  }]);
});
assert.ok(serverDependencies, "complete server configuration must create server-only dependencies");
assert.deepEqual(JSON.parse(JSON.stringify(await serverDependencies.getUser("session-token"))), {
  id: userA,
  email: "a@example.invalid",
});
assert.deepEqual(JSON.parse(JSON.stringify(await serverDependencies.getActiveMembership(userA))), membershipA);
assert.equal(serverRequests.length, 2);
assert.equal(serverRequests[0].url, "https://project.supabase.co/auth/v1/user");
assert.equal(serverRequests[0].options.headers.Authorization, "Bearer session-token");
assert.equal(serverRequests[0].options.headers.apikey, "publishable-fixture");
assert.notEqual(serverRequests[0].options.headers.Authorization, "Bearer service-role-fixture");
assert.equal(serverRequests[1].url, "https://project.supabase.co/rest/v1/rpc/get_partner_auth_membership");
assert.equal(serverRequests[1].options.headers.apikey, "service-role-fixture");
assert.equal(serverRequests[1].options.headers.Authorization, undefined);

const partnerPageSource = existsSync(partnerPagePath) ? readFileSync(partnerPagePath, "utf8") : "";
assert.match(partnerPageSource, /await connection\(\)/, "the private partner gate must opt out of prerendering through the Cache Components-compatible API");
assert.match(partnerPageSource, /export const instant\s*=\s*false/, "the private partner gate must use the existing blocking-route contract");
assert.doesNotMatch(partnerPageSource, /export const dynamic\s*=/, "Cache Components routes must not use incompatible dynamic segment config");

const requestLinkSource = existsSync(requestLinkPath) ? readFileSync(requestLinkPath, "utf8") : "";
const completeLinkSource = existsSync(completeLinkPath) ? readFileSync(completeLinkPath, "utf8") : "";
const callbackPageSource = existsSync(callbackPagePath) ? readFileSync(callbackPagePath, "utf8") : "";
const localContractPath = join(root, "..", "supabase/tests/verify_partner_auth_membership.sql");
const localContractSource = existsSync(localContractPath) ? readFileSync(localContractPath, "utf8") : "";
assert.match(requestLinkSource, /randomBytes/, "starting a magic link must issue unpredictable browser-bound login state");
assert.match(requestLinkSource, /PARTNER_LOGIN_STATE_COOKIE/, "starting a magic link must store browser-bound login state in an HttpOnly cookie");
assert.match(requestLinkSource, /searchParams\.set\("state"/, "the Supabase redirect URL must carry the browser-bound login state");
assert.match(completeLinkSource, /secretsMatch/, "magic link completion must compare state without a timing oracle");
assert.match(completeLinkSource, /PARTNER_LOGIN_STATE_COOKIE/, "magic link completion must require the initiating browser state cookie");
assert.match(completeLinkSource, /authorizePartnerSession/, "magic link completion must validate the returned access token server-side");
assert.ok(
  completeLinkSource.indexOf("!secretsMatch(expectedState, state)") < completeLinkSource.indexOf("const authorization = await authorizePartnerSession"),
  "magic link completion must reject mismatched state before accepting a Supabase session",
);
assert.match(callbackPageSource, /window\.location\.hash/, "the default Supabase magic-link fragment must be consumed only in the callback browser page");
assert.match(callbackPageSource, /history\.replaceState/, "the callback must remove token and state from the visible URL before continuing");
assert.match(callbackPageSource, /complete-link/, "the callback must pass the ephemeral fragment token only to the same-origin completion endpoint");
assert.match(callbackPageSource, /useRef/, "the callback must make completion one-shot even when React replays an effect");
assert.match(callbackPageSource, /if \(started\.current\) return/, "a replayed callback effect must not replace a valid completion with invalid-link");
assert.match(
  localContractSource,
  /revoked membership must not resolve an active partner access path/i,
  "the local authorization contract must prove that revoked memberships cannot resolve Partner access",
);

console.log("partner auth membership contract: PASS");
