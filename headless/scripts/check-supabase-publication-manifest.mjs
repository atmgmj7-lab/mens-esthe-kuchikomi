import assert from "node:assert/strict";

const {
  buildProposedPublicationManifest,
  buildLocalFixtureApproval,
  proposalSha256,
  renderApprovedFixtureApplySql,
  renderApprovedFixtureRestoreSql,
  renderPublicationManifestApplySql,
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} = await import("./lib/supabase-publication-manifest.mjs");

const manifest = buildProposedPublicationManifest({
  candidateWpIds: [100, 101],
  reviewRequiredWpIds: [5070],
  managedUnlistedWpIds: [1272],
  retainedDraftWpIds: [1255, 1259],
  areaTermIds: [2, 4],
  fixedPageRoutes: ["/contact/", "/about/"],
  imageWpMediaIds: [1150, 1151]
});

assert.equal(manifest.state, "proposed");
assert.deepEqual(manifest.approval, { state: "not-approved", application: "blocked" });
assert.deepEqual(manifest.publicTargets, { shops: [100, 101], areas: [2, 4], pages: ["/about/", "/contact/"], imageWpMediaIds: [1150, 1151] });
assert.deepEqual(manifest.exclusions, [
  { wpPostId: 5070, reason: "wordpress-only-publication-decision-required" },
  { wpPostId: 1272, reason: "managed-unlisted" },
  { wpPostId: 1255, reason: "supabase-only-draft" },
  { wpPostId: 1259, reason: "supabase-only-draft" },
  { wpMediaId: 357, reason: "fixed-page-media-not-shop-image" },
  { scope: "unlisted-and-deleted-managed-shops", reason: "strict-exclusion" }
]);
assert.equal(manifest.before.publicShopCount, 0);
assert.equal(manifest.proposedAfter.publicShopCount, 2);

const options = { manifest, sourceLabel: "20261019-publication-manifest" };
const preflight = renderPublicationManifestPreflightSql(options);
const restore = renderPublicationManifestRestoreSql(options);
const apply = renderPublicationManifestApplySql(options);
const proposalId = "20261019-publication-manifest-v4";
const approval = buildLocalFixtureApproval({ manifest, proposalId, approvalId: "20261019-publication-manifest-v4-local-fixture" });
const fixtureApply = renderApprovedFixtureApplySql({ manifest, proposalId, approval, transactionMode: "caller" });
const fixtureRestore = renderApprovedFixtureRestoreSql({ manifest, proposalId, approval, transactionMode: "caller" });
const callerPreflight = renderPublicationManifestPreflightSql({ ...options, transactionMode: "caller" });
assert.match(preflight, /begin read only/i);
assert.match(preflight, /app\.shop_areas/i, "manifest must reconcile the unchanged area relation boundary");
assert.match(preflight, /publication_status = 'draft'/i, "all candidates remain draft without explicit approval");
assert.match(preflight, /wp_term_id = any/i, "proposal must name the current public area targets");
assert.match(preflight, /wp_media_id = any/i, "proposal must name the current shop-image targets");
assert.doesNotMatch(preflight, /\b(?:insert into|update|delete from)\b/i, "preflight must never publish or mutate data");
assert.match(restore, /begin read only/i);
assert.doesNotMatch(restore, /\b(?:insert into|update|delete from)\b/i, "proposal restore is a non-destructive verification");
assert.doesNotMatch(callerPreflight, /begin read only/i, "a local outer transaction can invoke the same preflight without committing fixture data");

assert.match(apply, /current_setting\('eskomi\.publication_manifest_approval', true\)/i);
assert.match(apply, /application intentionally disabled/i);
assert.doesNotMatch(apply, /\b(?:insert into|update|delete from)\b/i, "proposal apply text must not become an executable mutation");
assert.match(proposalSha256(manifest), /^[a-f0-9]{64}$/);
assert.match(fixtureApply, /local-fixture-only/i);
assert.match(fixtureApply, /current_setting\('eskomi\.publication_manifest_proposal_sha256', true\)/i);
assert.match(fixtureApply, /is distinct from/i, "unset gate settings must fail closed rather than compare as SQL NULL");
assert.match(fixtureApply, /update app\.shops/i);
assert.match(fixtureApply, /update app\.areas/i);
assert.match(fixtureApply, /update app\.shop_images/i);
assert.match(fixtureRestore, /restore requires every approved fixture shop target/i);
assert.throws(() => renderApprovedFixtureApplySql({ manifest, proposalId, approval: { ...approval, proposalSha256: "0".repeat(64) } }), /does not exactly match/i);

console.log("Supabase proposed publication manifest contract: PASS");
