import assert from "node:assert/strict";

const { buildProposedPublicationManifestArtifact } = await import("./prepare-supabase-publication-manifest.mjs");

const artifact = buildProposedPublicationManifestArtifact("20261019-publication-manifest");
assert.equal(artifact.manifest.candidateWpIds.length, 379);
assert.equal(artifact.manifest.state, "proposed");
assert.equal(artifact.manifest.publicTargets.shops.length, 379);
assert.equal(artifact.manifest.publicTargets.areas.length, 34);
assert.deepEqual(artifact.manifest.publicTargets.pages, ["/about/", "/advertise/", "/contact/", "/osaka-nihonbashi/", "/sitemap/", "/storelisting/"]);
assert.equal(artifact.manifest.publicTargets.imageWpMediaIds.length, 241);
assert.deepEqual(artifact.manifest.approval, { state: "not-approved", application: "blocked" });
assert.match(artifact.preflightSql, /begin read only/i);
assert.match(artifact.restoreSql, /restore-verification/i);
assert.match(artifact.applySql, /application intentionally disabled/i);
console.log("Supabase proposed publication manifest generator: PASS");
