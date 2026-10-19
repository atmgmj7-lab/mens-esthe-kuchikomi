import assert from "node:assert/strict";

const { buildZeroTargetPublicationManifest } = await import("./prepare-supabase-publication-manifest.mjs");

const artifact = buildZeroTargetPublicationManifest("20261019-publication-manifest");
assert.equal(artifact.manifest.candidateWpIds.length, 379);
assert.deepEqual(artifact.manifest.publicTargets, { shops: [], areas: [], pages: [], imageRows: [] });
assert.match(artifact.preflightSql, /begin read only/i);
assert.match(artifact.restoreSql, /restore-verification/i);
console.log("Supabase zero-target publication manifest generator: PASS");
