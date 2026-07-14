import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const modulePath = join(root, "scripts/lib/wp-migration-audit.mjs");
assert.ok(existsSync(modulePath), "WordPress migration audit module must exist");

const fixture = JSON.parse(
  readFileSync(join(root, "scripts/fixtures/wp-migration-sample.json"), "utf8")
);
const { auditWordPressMigrationSource, normalizeWordPressApiBase } = await import(
  pathToFileURL(modulePath)
);
assert.equal(
  normalizeWordPressApiBase("https://example.com/wp-json"),
  "https://example.com/wp-json/wp/v2"
);
assert.equal(
  normalizeWordPressApiBase("https://example.com/wp-json/wp/v2/"),
  "https://example.com/wp-json/wp/v2"
);
const report = auditWordPressMigrationSource({
  ...fixture,
  reviewsEndpointStatus: "unavailable"
});

assert.deepEqual(report.totals, { shops: 3, areas: 2 });
assert.equal(report.completeness.titles.present, 3);
assert.equal(report.completeness.content.present, 1);
assert.equal(report.completeness.excerpts.present, 1);
assert.equal(report.completeness.featuredImages.present, 1);
assert.equal(report.completeness.officialUrls.present, 1);
assert.equal(report.completeness.usablePrices.present, 1);
assert.equal(report.completeness.aiSummaries.present, 1);
assert.equal(report.completeness.streetAddresses.present, 1);
assert.equal(report.completeness.sourceUrls.present, 1);
assert.equal(report.completeness.verifiedDates.present, 1);
assert.equal(report.areaDescriptions.present, 1);
assert.equal(report.risks.zeroLikePrimaryPrices, 1);
assert.equal(report.risks.shopsWithoutArea, 1);
assert.equal(report.risks.shopsWithMultipleAreas, 1);
assert.equal(report.risks.addressFieldsNeedingReview, 1);
assert.equal(report.risks.reviewsEndpointStatus, "unavailable");
assert.equal(report.migrationPolicy.zeroPrice, "store-as-null-until-verified");
assert.equal(report.migrationPolicy.unknownReviews, "do-not-import-as-user-review");

console.log("WordPress migration audit checks passed.");
