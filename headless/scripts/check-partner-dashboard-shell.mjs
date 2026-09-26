import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const authPath = join(root, "lib/partner/partner-auth.ts");
const dashboardPath = join(root, "lib/partner/partner-dashboard.ts");
const serverPath = join(root, "lib/partner/partner-auth-server.ts");
const serverSecretPath = join(root, "lib/supabase/server-secret.ts");
const operatorPagePath = join(root, "app/dashboard/partners/page.tsx");
const partnerPagePath = join(root, "app/partner/page.tsx");
const proxyPath = join(root, "proxy.ts");

let serverSecretModule;

function loadModule(source, filename, modules = {}) {
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
      if (specifier === "@/lib/supabase/server-secret") {
        serverSecretModule ??= loadModule(readFileSync(serverSecretPath, "utf8"), serverSecretPath);
        return serverSecretModule;
      }
      if (specifier in modules) return modules[specifier];
      throw new Error(`Unexpected dependency in ${filename}: ${specifier}`);
    },
    URL,
    Response,
  });
  return module.exports;
}

const auth = loadModule(readFileSync(authPath, "utf8"), authPath);
const dashboard = existsSync(dashboardPath)
  ? loadModule(readFileSync(dashboardPath, "utf8"), dashboardPath, { "@/lib/partner/partner-auth": auth })
  : {};
const server = loadModule(readFileSync(serverPath, "utf8"), serverPath);

assert.equal(
  typeof dashboard.resolvePartnerDashboardIdentity,
  "function",
  "03B must resolve the existing workspace identity only after 03A has authorized membership",
);

const operatorPage = readFileSync(operatorPagePath, "utf8");
const partnerPage = readFileSync(partnerPagePath, "utf8");
const proxy = readFileSync(proxyPath, "utf8");
assert.match(operatorPage, /DashboardPartnerWorkspace/, "the operator control center reuses the existing workspace control");
assert.match(operatorPage, /DashboardReviewModeration/, "the operator control center reuses the existing moderation control");
assert.match(operatorPage, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/s, "the operator control center remains noindex");
assert.match(proxy, /["']\/dashboard\/:path\*["']/, "the existing Basic Auth proxy protects operator pages");
assert.match(proxy, /["']\/api\/dashboard\/:path\*["']/, "the existing Basic Auth proxy protects operator APIs");
assert.match(partnerPage, /authorizePartnerReviewGrowthSession/, "the Partner home retains its session-derived access path");
assert.doesNotMatch(partnerPage, /DashboardPartnerWorkspace|DashboardReviewModeration|authorizeDashboardRequest/, "the Partner home must not import or invoke operator controls");

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";
const membershipA = { workspaceId: workspaceA, shopId: 101, shopSlug: "shop-a", role: "owner" };
const ownIdentity = {
  workspaceId: workspaceA,
  shopId: 101,
  shopSlug: "shop-a",
  shopName: "Partner Shop A",
  canonicalUrl: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
  state: "free_official_partner",
};

async function resolve(identity) {
  return dashboard.resolvePartnerDashboardIdentity(membershipA, {
    async getWorkspaceIdentity() { return identity; },
  });
}

assert.deepEqual(
  JSON.parse(JSON.stringify(await resolve(ownIdentity))),
  { status: "allowed", identity: ownIdentity },
  "an authorized Partner may see only the canonical identity and existing status of its own shop",
);

assert.deepEqual(
  JSON.parse(JSON.stringify(await resolve({ ...ownIdentity, workspaceId: workspaceB }))),
  { status: "forbidden" },
  "a workspace record from Partner B must never be rendered for Partner A",
);

assert.deepEqual(
  JSON.parse(JSON.stringify(await resolve({ ...ownIdentity, shopId: 202 }))),
  { status: "forbidden" },
  "a mismatched linked shop must fail closed instead of displaying an identity",
);

assert.deepEqual(
  JSON.parse(JSON.stringify(await resolve({ ...ownIdentity, state: "normal_listing" }))),
  { status: "forbidden" },
  "a workspace state outside the 03A authorized Partner states must fail closed",
);

assert.deepEqual(
  JSON.parse(JSON.stringify(await resolve({ ...ownIdentity, canonicalUrl: "https://example.invalid/shops/shop-a/" }))),
  { status: "forbidden" },
  "a non-canonical shop URL must not be shown as a Partner shop identity",
);

const serverRequests = [];
const serverDependencies = server.createPartnerAuthDependencies({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_AUTH_PUBLISHABLE_KEY: "publishable-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-fixture",
}, async (url, options) => {
  serverRequests.push({ url, options });
  return Response.json([{
    workspace_id: workspaceA,
    wp_shop_id: 101,
    shop_slug: "shop-a",
    shop_name: "Partner Shop A",
    canonical_url: "https://mens-esthe-kuchikomi.com/shops/shop-a/",
    state: "free_official_partner",
  }]);
});
assert.equal(
  typeof serverDependencies?.getWorkspaceIdentity,
  "function",
  `the existing server-only Partner Auth adapter must provide the service-role identity lookup; actual keys: ${Object.keys(serverDependencies ?? {}).join(",")}`,
);
assert.deepEqual(
  JSON.parse(JSON.stringify(await serverDependencies.getWorkspaceIdentity(workspaceA))),
  ownIdentity,
  "the server-only identity adapter must parse the canonical workspace projection",
);
assert.equal(serverRequests[0].url, "https://project.supabase.co/rest/v1/rpc/get_partner_workspace_identity");
assert.equal(serverRequests[0].options.headers.apikey, "service-role-fixture");
assert.equal(serverRequests[0].options.headers.Authorization, undefined);
assert.deepEqual(JSON.parse(serverRequests[0].options.body), { p_workspace_id: workspaceA });

console.log("partner dashboard shell identity contract: PASS");
