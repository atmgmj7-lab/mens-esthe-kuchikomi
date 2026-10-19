import assert from "node:assert/strict";

const {
  buildConservativePublicationManifest,
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} = await import("./lib/supabase-publication-manifest.mjs");

const manifest = buildConservativePublicationManifest({
  candidateWpIds: [100, 101],
  reviewRequiredWpIds: [5070],
  managedUnlistedWpIds: [1272],
  retainedDraftWpIds: [1255, 1259],
  imageCount: 241,
  publicTargets: { shops: [], areas: [], pages: [], imageRows: [] }
});

assert.deepEqual(manifest.publicTargets, { shops: [], areas: [], pages: [], imageRows: [] });
assert.deepEqual(manifest.exclusions, [
  { wpPostId: 5070, reason: "review-required-wordpress-only" },
  { wpPostId: 1272, reason: "managed-unlisted" },
  { wpPostId: 1255, reason: "supabase-only-draft" },
  { wpPostId: 1259, reason: "supabase-only-draft" },
  { scope: "fixed-pages", reason: "canonical-content-not-approved" },
  { scope: "shop-images", reason: "no-image-publication-approval" }
]);
assert.equal(manifest.before.publicShopCount, 0);
assert.equal(manifest.after.publicShopCount, 0);

const options = { manifest, sourceLabel: "20261019-publication-manifest" };
const preflight = renderPublicationManifestPreflightSql(options);
const restore = renderPublicationManifestRestoreSql(options);
const callerPreflight = renderPublicationManifestPreflightSql({ ...options, transactionMode: "caller" });
assert.match(preflight, /begin read only/i);
assert.match(preflight, /app\.shop_areas/i, "manifest must reconcile the unchanged area relation boundary");
assert.match(preflight, /publication_status = 'draft'/i, "all candidates remain draft without explicit approval");
assert.doesNotMatch(preflight, /exists \(select 1 from app\.areas where is_published\)/i, "the zero-target manifest must not reject unrelated public fixture rows outside its scope");
assert.doesNotMatch(preflight, /\b(?:insert into|update|delete from)\b/i, "preflight must never publish or mutate data");
assert.match(restore, /begin read only/i);
assert.doesNotMatch(restore, /\b(?:insert into|update|delete from)\b/i, "empty manifest restore is a non-destructive verification");
assert.doesNotMatch(callerPreflight, /begin read only/i, "a local outer transaction can invoke the same preflight without committing fixture data");

assert.throws(
  () => buildConservativePublicationManifest({
    candidateWpIds: [100], reviewRequiredWpIds: [], managedUnlistedWpIds: [], retainedDraftWpIds: [], imageCount: 241,
    publicTargets: { shops: [100], areas: [], pages: [], imageRows: [] }
  }),
  /explicitly approved publication target/i,
  "the conservative generator must not turn candidates public implicitly"
);

console.log("Supabase conservative publication manifest contract: PASS");
