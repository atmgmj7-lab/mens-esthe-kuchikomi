import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const headlessDirectory = resolve(scriptsDirectory, "..");
const repositoryDirectory = resolve(headlessDirectory, "..");
const packetPath = join(repositoryDirectory, "docs/technical/artifacts/2026-10-18-first-pilot-minimum-gate.md");
const reconciliationPath = join(repositoryDirectory, "docs/technical/artifacts/2026-10-18-pilot-migration-gap-reconciliation.md");
const adapterPath = join(headlessDirectory, "lib/reviews/public-adapter.ts");
const widgetPath = join(headlessDirectory, "lib/supabase/eskomi-widget-v11.ts");
const migrationDirectory = join(repositoryDirectory, "supabase/migrations");

const migrations = readdirSync(migrationDirectory)
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(name))
  .sort((left, right) => left.localeCompare(right));
const versions = migrations.map((name) => name.slice(0, 14));

assert.equal(new Set(versions).size, versions.length, "migration timestamps must be unique");
assert.ok(
  versions.every((version, index) => index === 0 || versions[index - 1] < version),
  "sorted migration manifest must be strictly monotonic",
);
assert.ok(
  migrations.includes("20261017164000_eskomi_legacy_workspace_mapping.sql"),
  "pilot packet must be based on the explicit legacy workspace mapping migration",
);
assert.ok(
  migrations.includes("20261018100000_partner_login_email_canonical_audit.sql"),
  "pilot packet must include the current additive v1.1 migration tail",
);

const adapter = readFileSync(adapterPath, "utf8");
assert.match(
  adapter,
  /environment\.ESKOMI_V11_PUBLIC_REVIEW_SOURCE === "supabase"/u,
  "v1.1 source switch must remain opt-in",
);

const widget = readFileSync(widgetPath, "utf8");
assert.match(widget, /get_public_review_widget_v11/u, "v1.1 widget must retain its direct publication reader");
assert.match(
  adapter,
  /if \(v11PublicShopReviews\) \{\n        const global = await eskomiReviewV2Repository\.listGlobalPublications/u,
  "v1.1 source switch must be recognized as a global-reader switch",
);

const packet = readFileSync(packetPath, "utf8");
const reconciliation = readFileSync(reconciliationPath, "utf8");
for (const [label, required] of [
  ["read-only candidate RPC", /api\.list_legacy_partner_workspace_mapping_candidates_v11\(\)/u],
  ["migration ledger", /migration ledger/u],
  ["global v1.1 flag", /ESKOMI_V11_PUBLIC_REVIEW_SOURCE/u],
  ["separate RankUp pilot flag", /RANKUP_NATIVE_REVIEW_READ_SOURCE/u],
  ["T43 boundary", /T43/u],
  ["unknown collection status", /comparison not possible/u],
  ["no production write boundary", /No production database write/u],
  ["no backup handling boundary", /No backup\s+retrieval or upload/u],
  ["no new per-store reader flag", /No per-store public-review flag/u],
  ["manual QR boundary", /camera QR/u],
  ["fixed Mrs.Rank UP target", /\| Pilot legacy WP shop ID \| `768`/u],
  ["widget-only limitation", /not a completed “review visible on the Eskomi store page” launch/u],
  ["complete introduction option", /Complete first-store introduction/u],
]) {
  assert.match(packet, required, `pilot packet is missing required gate: ${label}`);
}

for (const [label, required] of [
  ["production ledger boundary", /`20261015182000`/u],
  ["mapping migration", /20261017164000_eskomi_legacy_workspace_mapping\.sql/u],
  ["current migration tail", /20261018100000_partner_login_email_canonical_audit\.sql/u],
  ["managed projection hard stop", /mapping readiness: current hard stops/u],
  ["no production mutation", /No production query, migration, projection creation, binding, publication, or/u],
]) {
  assert.match(reconciliation, required, `reconciliation is missing required gate: ${label}`);
}

console.log("Eskomi v1.1 first-pilot minimum gate packet: PASS");
