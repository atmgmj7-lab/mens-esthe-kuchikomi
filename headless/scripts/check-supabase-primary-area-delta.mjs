import assert from "node:assert/strict";

const {
  buildSourceGroundedPrimaryAreaPlan,
  renderPrimaryAreaDeltaSql,
  renderPrimaryAreaDeltaRollbackSql
} = await import("./lib/supabase-primary-area-delta.mjs");

const reviewRequiredWpIds = [5070];
const candidates = [100, 101, 102, 103];
const plan = buildSourceGroundedPrimaryAreaPlan({
  sourceShops: [
    { id: 100, status: "publish", area: [4], acf: { shop_primary_area_term_id: 4 }, modified_gmt: "2026-10-19T00:00:00" },
    { id: 101, status: "publish", area: [4], acf: {}, modified_gmt: "2026-10-19T00:00:00" },
    { id: 102, status: "publish", area: [4, 7], acf: {}, modified_gmt: "2026-10-19T00:00:00" },
    { id: 103, status: "publish", area: [], acf: {}, modified_gmt: "2026-10-19T00:00:00" },
    { id: 5070, status: "publish", area: [4], acf: { shop_primary_area_term_id: 4 }, modified_gmt: "2026-10-19T00:00:00" },
    { id: 1272, status: "publish", area: [4], acf: { shop_primary_area_term_id: 4 }, modified_gmt: "2026-10-19T00:00:00" }
  ],
  candidateWpIds: candidates,
  reviewRequiredWpIds,
  unlistedManagedWpIds: [1272]
});

assert.deepEqual(plan.assignments, [{ wpPostId: 100, areaTermId: 4, sourceField: "shop_primary_area_term_id", sourceModifiedGmt: "2026-10-19T00:00:00" }]);
assert.deepEqual(plan.deferred, [
  { wpPostId: 101, reason: "primary-area-field-missing-single-relation" },
  { wpPostId: 102, reason: "primary-area-field-missing-multiple-relations" },
  { wpPostId: 103, reason: "no-area-relation" }
]);
assert.deepEqual(plan.excluded, [
  { wpPostId: 1272, reason: "managed-unlisted" },
  { wpPostId: 5070, reason: "review-required" }
]);

assert.throws(
  () => buildSourceGroundedPrimaryAreaPlan({
    sourceShops: [{ id: 100, status: "publish", area: [4], acf: { shop_primary_area_term_id: 7 }, modified_gmt: "2026-10-19T00:00:00" }],
    candidateWpIds: [100], reviewRequiredWpIds: [], unlistedManagedWpIds: []
  }),
  /not an existing area relation/i,
  "an explicit primary field must never add or infer an area relation"
);

const options = { plan, batchId: "77000000-0000-4000-8000-000000000001", sourceLabel: "20261019-primary-area-source" };
const sql = renderPrimaryAreaDeltaSql(options);
const rollback = renderPrimaryAreaDeltaRollbackSql(options);
assert.match(sql, /update app\.shop_areas/i, "only area-primary flags may change");
assert.match(sql, /shop_primary_area_term_id/i, "source evidence must be persisted in the import record");
assert.match(sql, /sourceModifiedGmt/i, "source revision precondition must be persisted");
assert.match(sql, /publication_status = 'draft'/i, "apply must refuse to alter an already-public shop");
assert.match(sql, /is_published = false/i, "apply must refuse to alter an already-public area");
assert.doesNotMatch(sql, /\b(?:insert into|update|delete from)\s+app\.(?:shops|shop_images|areas)\b/i, "apply must not change shops, images, or area publication state");
assert.match(rollback, /update app\.shop_areas/i, "rollback must restore only the primary flags");
assert.match(rollback, /publication_status = 'draft'/i, "rollback must preserve the non-public boundary");
assert.doesNotMatch(rollback, /\bdelete\b/i, "rollback must not delete records or Storage objects");

console.log("Supabase source-grounded primary-area delta contract: PASS");
