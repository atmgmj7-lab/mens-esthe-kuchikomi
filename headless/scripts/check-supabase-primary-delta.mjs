import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(headlessRoot, "..");
const packageJson = JSON.parse(readFileSync(join(headlessRoot, "package.json"), "utf8"));

assert.equal(
  packageJson.scripts?.["test:supabase-primary-delta"],
  "node scripts/check-supabase-primary-delta.mjs",
  "state-preserving delta contract must be runnable from package scripts"
);

const { renderStatePreservingDeltaPreflightSql } = await import("./lib/supabase-primary-delta-sql.mjs");
const { buildStatePreservingDeltaArtifact } = await import("./prepare-supabase-primary-delta.mjs");

const sql = renderStatePreservingDeltaPreflightSql({
  expectedShopCount: 382,
  expectedAreaCount: 34,
  expectedImageCount: 241,
  expectedPublishedShopCount: 0,
  expectedPublishedAreaCount: 0,
  expectedPublishedContentCount: 0,
  reviewRequiredWpIds: [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189],
  retainedDraftWpIds: [1255, 1259],
  retainedUnlistedManagedWpIds: [1272],
  imageCutoverSourceSystem: "wordpress-media-url-cutover"
});

assert.match(sql, /^begin read only;/i, "delta preflight must execute in a read-only transaction");
assert.match(sql, /expected 382 app\.shops/i, "delta preflight must pin the current shop count");
assert.match(sql, /expected 34 app\.areas/i, "delta preflight must pin the current area count");
assert.match(sql, /expected 241 Storage image URLs/i, "delta preflight must pin all current Storage image URLs");
assert.match(sql, /wordpress-media-url-cutover/, "delta preflight must reconcile image URLs to the approved cutover batch");
assert.match(sql, /5070, 5074, 5079/, "delta preflight must retain the reviewed WordPress-only exclusion set");
assert.match(sql, /1255, 1259/, "delta preflight must retain the two Supabase-only drafts");
assert.match(sql, /1272/, "delta preflight must preserve the managed unlisted legacy identity");
assert.match(sql, /publication_status = 'draft'/i, "retained app-only records must stay drafts");
assert.match(sql, /publication_state = 'unlisted'/i, "managed overlap must stay unlisted");
assert.match(sql, /set local role anon/i, "preflight must verify browser-role RLS isolation");
assert.match(sql, /anon must not observe nonpublic app\.shops/i, "preflight must fail if anon can observe nonpublic shops");
assert.match(sql, /anon must not observe nonpublic app\.areas/i, "preflight must fail if anon can observe nonpublic areas");
assert.match(sql, /anon must not observe nonpublic app\.shop_images/i, "preflight must fail if anon can observe nonpublic images");
assert.doesNotMatch(sql, /has_table_privilege/i, "RLS visibility—not raw table privileges—is the public-boundary assertion");
assert.match(sql, /commit;/i, "read-only preflight must complete its transaction");
assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|alter|create|drop|grant|revoke)\b/i, "state-preserving preflight must not contain a data, schema, or privilege mutation");

assert.throws(
  () => renderStatePreservingDeltaPreflightSql({
    expectedShopCount: 382,
    expectedAreaCount: 34,
    expectedImageCount: 241,
    expectedPublishedShopCount: 1,
    expectedPublishedAreaCount: 0,
    expectedPublishedContentCount: 0,
    reviewRequiredWpIds: [5070],
    retainedDraftWpIds: [1255],
    retainedUnlistedManagedWpIds: [1272],
    imageCutoverSourceSystem: "wordpress-media-url-cutover"
  }),
  /published shop count must be zero/i,
  "this pre-production delta must reject any implicit publication target"
);

const artifact = buildStatePreservingDeltaArtifact({
  label: "20261019-primary-preflight",
  expectedShopCount: "382",
  expectedAreaCount: "34",
  expectedImageCount: "241",
  expectedPublishedShopCount: "0",
  expectedPublishedAreaCount: "0",
  expectedPublishedContentCount: "0"
});
assert.equal(artifact.label, "20261019-primary-preflight");
assert.match(artifact.sql, /^begin read only;/i, "CLI artifact must remain a read-only preflight");
assert.equal(artifact.metadata.mutatesData, false, "artifact metadata must make the no-write boundary explicit");
assert.equal(artifact.metadata.publicTarget.shops, 0, "artifact must reject implicit publication");
assert.deepEqual(artifact.metadata.reviewRequiredWpIds, [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189]);
assert.equal(
  buildStatePreservingDeltaArtifact({
    label: "20261019-primary-preflight-v2",
    expectedShopCount: "382",
    expectedAreaCount: "34",
    expectedImageCount: "241",
    expectedPublishedShopCount: "0",
    expectedPublishedAreaCount: "0",
    expectedPublishedContentCount: "0"
  }).label,
  "20261019-primary-preflight-v2",
  "regeneration must use a new immutable versioned label instead of overwriting a prior artifact"
);
assert.throws(
  () => buildStatePreservingDeltaArtifact({
    label: "bad label",
    expectedShopCount: "382",
    expectedAreaCount: "34",
    expectedImageCount: "241",
    expectedPublishedShopCount: "0",
    expectedPublishedAreaCount: "0",
    expectedPublishedContentCount: "0"
  }),
  /label/i,
  "artifact labels must be filesystem-safe and explicit"
);

console.log("Supabase state-preserving primary delta contract: PASS");
