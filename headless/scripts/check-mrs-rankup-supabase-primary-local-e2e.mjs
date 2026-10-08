import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const headlessRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(headlessRoot, "..");
const supabaseWorkdir = process.env.E2E_SUPABASE_WORKDIR
  ? resolve(process.env.E2E_SUPABASE_WORKDIR)
  : repositoryRoot;
const WP_SHOP_ID = 768;
// WP768's current public REST slug is percent-encoded; keep that canonical
// identity intact in the local fixture instead of substituting a simplified slug.
const SHOP_SLUG = "mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89";

function localEnvironment() {
  const output = execFileSync("supabase", ["status", "-o", "env", "--workdir", supabaseWorkdir], {
    cwd: supabaseWorkdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  const values = new Map(output.split("\n").flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^"|"$/g, "")]] : [];
  }));
  const apiUrl = values.get("API_URL");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  assert.ok(apiUrl && serviceRoleKey, "local Supabase API URL and service key are required");
  const parsed = new URL(apiUrl);
  assert.equal(parsed.protocol, "http:");
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "E2E may target local Supabase only");
  return { apiUrl, serviceRoleKey };
}

const config = readFileSync(resolve(supabaseWorkdir, "supabase/config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];
assert.ok(projectId, "local Supabase project_id is required");
const database = `supabase_db_${projectId}`;
const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
assert.ok(containers.split("\n").includes(database), "local Supabase database must be running");

function sql(input) {
  return execFileSync("docker", [
    "exec", "-i", database, "psql", "-X", "-q", "-A", "-t", "-F", "|",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
  ], { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function facts(basicPrice = "12000") {
  return {
    official_url: "https://fixture.invalid/mrs-rank-up", basic_price: basicPrice,
    shop_hours: "10:00-02:00", shop_address: "大阪市北区 fixture", shop_tel: "06-0000-0768",
    shop_line: "https://line.fixture.invalid/mrs-rank-up", shop_booking: "Web予約", shop_holiday: "不定休",
    price_90: "15000", shop_booking_url: "https://reserve.fixture.invalid/mrs-rank-up",
  };
}

function removeFixture() {
  sql(`
delete from private.partner_shop_fact_audits where wp_shop_id = ${WP_SHOP_ID};
delete from private.partner_shop_fact_snapshots where wp_shop_id = ${WP_SHOP_ID};
delete from private.partner_workspaces where wp_shop_id = ${WP_SHOP_ID};
delete from app.shops where wp_post_id = ${WP_SHOP_ID};
`);
}

const existing = sql(`
select concat_ws('|',
  (select count(*) from app.shops where wp_post_id = ${WP_SHOP_ID}),
  (select count(*) from private.partner_workspaces where wp_shop_id = ${WP_SHOP_ID}),
  (select count(*) from private.partner_shop_fact_snapshots where wp_shop_id = ${WP_SHOP_ID}),
  (select count(*) from private.partner_shop_fact_audits where wp_shop_id = ${WP_SHOP_ID})
);
`);
assert.equal(existing, "0|0|0|0", "local WP768 rows already exist; refuse to alter non-fixture data");

sql(`
insert into app.shops (wp_post_id, slug, canonical_path, name)
values (${WP_SHOP_ID}, '${SHOP_SLUG}', '/shops/${SHOP_SLUG}/', 'Mrs.Rank UP local verification');
insert into private.partner_workspaces (wp_shop_id, shop_slug, shop_name, canonical_url, state)
values (${WP_SHOP_ID}, '${SHOP_SLUG}', 'Mrs.Rank UP local verification', 'https://mens-esthe-kuchikomi.com/shops/${SHOP_SLUG}/', 'free_official_partner');
`);
process.on("exit", () => {
  try { removeFixture(); } catch { /* preserve the original E2E failure */ }
});

const { apiUrl, serviceRoleKey } = localEnvironment();
async function rpc(name, payload) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api",
    },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json().catch(() => null) };
}

try {
  const crossShop = await rpc("import_partner_shop_fact_snapshot", {
    p_wp_shop_id: 769, p_shop_slug: "other-shop", p_facts: facts(), p_actor_label: "isolated-e2e",
  });
  assert.equal(crossShop.response.ok, false, "a different shop must be rejected before any import");

  const imported = await rpc("import_partner_shop_fact_snapshot", {
    p_wp_shop_id: WP_SHOP_ID, p_shop_slug: SHOP_SLUG, p_facts: facts(), p_actor_label: "isolated-e2e",
  });
  assert.equal(imported.response.ok, true, `initial local import must succeed: ${JSON.stringify(imported.body)}`);
  assert.equal(imported.body?.[0]?.state, "imported");
  assert.equal(imported.body?.[0]?.revision, 1);

  const reread = await rpc("get_partner_shop_fact_snapshot", { p_wp_shop_id: WP_SHOP_ID });
  assert.equal(reread.response.ok, true, "saved source snapshot must be readable to service role");
  assert.equal(reread.body?.[0]?.facts?.basic_price, "12000");

  const saved = await rpc("save_partner_shop_fact_snapshot", {
    p_wp_shop_id: WP_SHOP_ID, p_expected_revision: 1, p_updates: { basic_price: "13000" }, p_actor_label: "isolated-e2e",
  });
  assert.equal(saved.response.ok, true, `CAS save must succeed with current revision: ${JSON.stringify(saved.body)}`);
  assert.equal(saved.body?.[0]?.state, "saved");
  assert.equal(saved.body?.[0]?.revision, 2);
  assert.equal(saved.body?.[0]?.facts?.basic_price, "13000");

  const noop = await rpc("save_partner_shop_fact_snapshot", {
    p_wp_shop_id: WP_SHOP_ID, p_expected_revision: 2, p_updates: { basic_price: "13000" }, p_actor_label: "isolated-e2e",
  });
  assert.equal(noop.response.ok, true, "same-value save must be a successful NOOP");
  assert.equal(noop.body?.[0]?.state, "noop");
  assert.equal(noop.body?.[0]?.revision, 2);

  const conflict = await rpc("save_partner_shop_fact_snapshot", {
    p_wp_shop_id: WP_SHOP_ID, p_expected_revision: 1, p_updates: { basic_price: "14000" }, p_actor_label: "isolated-e2e",
  });
  assert.equal(conflict.response.ok, true, "stale save must return a readable conflict");
  assert.equal(conflict.body?.[0]?.state, "conflict");
  assert.equal(conflict.body?.[0]?.revision, 2);

  const empty = await rpc("save_partner_shop_fact_snapshot", {
    p_wp_shop_id: WP_SHOP_ID, p_expected_revision: 2, p_updates: { shop_tel: "" }, p_actor_label: "isolated-e2e",
  });
  assert.equal(empty.response.ok, false, "empty overwrite must be rejected");

  assert.equal(sql(`
select concat_ws('|',
  has_table_privilege('anon', 'private.partner_shop_fact_snapshots', 'select'),
  has_table_privilege('authenticated', 'private.partner_shop_fact_audits', 'select'),
  has_function_privilege('anon', 'api.save_partner_shop_fact_snapshot(bigint,bigint,jsonb,text)', 'execute'),
  has_function_privilege('authenticated', 'api.get_partner_shop_fact_snapshot(bigint)', 'execute'),
  (select count(*) from private.partner_shop_fact_audits where wp_shop_id = ${WP_SHOP_ID})
);
`), "f|f|f|f|2", "private facts must remain private and audit only import/save events");
  console.log("Mrs.Rank UP Supabase-primary local E2E: PASS");
} finally {
  removeFixture();
}
