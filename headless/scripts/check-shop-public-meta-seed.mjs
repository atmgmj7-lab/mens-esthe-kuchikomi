import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(root, "..", "docs", "data", name), "utf8"));
const preview = read("shop-public-meta-seed-preview-2026-07-18.json");
const excluded = read("excluded-shop-draft-preview-2026-07-18.json");

assert.equal(preview.mode, "local-preview-only");
assert.equal(preview.applied, false);
assert.equal(preview.selection.rankingClaim, false);
assert.deepEqual(preview.rankingCandidates, []);
assert.ok(preview.provenanceCandidates.length > 0);
for (const candidate of preview.provenanceCandidates) {
  for (const key of ["field", "sourceUrl", "reviewedAt", "publishedValueHash"]) assert.ok(candidate[key], `candidate must include ${key}`);
  assert.match(candidate.sourceUrl, /^https?:\/\//);
  assert.match(candidate.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(candidate.publishedValueHash, /^[a-f0-9]{64}$/);
}
const mismatchKeys = new Set(preview.blocked.filter((item) => item.status === "blocked-value-mismatch").map((item) => `${item.wpPostId}:${item.field}`));
assert.ok(mismatchKeys.size > 0);
for (const candidate of preview.provenanceCandidates) assert.equal(mismatchKeys.has(`${candidate.wpPostId}:${candidate.field}`), false);
for (const item of preview.blocked) assert.equal("publishedValueHash" in item, false);

assert.deepEqual(excluded.shops.map((shop) => shop.wpPostId), [1259, 1255]);
for (const shop of excluded.shops) {
  assert.equal(shop.currentState.postStatus, "publish");
  assert.equal(shop.requestedAction, "draft");
  assert.equal(shop.applied, false);
  assert.ok(shop.postApplyChecks.route && shop.postApplyChecks.sitemap && shop.postApplyChecks.internalLinks);
}
console.log("shop public meta seed checks passed");
