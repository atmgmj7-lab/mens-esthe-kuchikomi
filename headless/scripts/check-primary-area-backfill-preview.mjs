import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrimaryAreaBackfillPreview,
  classifyPrimaryAreaBackfillRecord,
  renderPrimaryAreaBackfillSummary,
  validateVerificationInput,
} from "./lib/primary-area-backfill-preview.mjs";

const canonicalAreas = [
  { id: 17, slug: "sakai", name: "堺東", route: "/area/sakai/" },
  { id: 13, slug: "shinosaka", name: "新大阪", route: "/area/shinosaka/" },
  { id: 7, slug: "nihonbashi", name: "大阪日本橋", route: "/area/nihonbashi/" },
  { id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", route: "/area/sakaisujihonmachi/" },
  { id: 4, slug: "umeda", name: "梅田", route: "/area/umeda/" },
];

function exactRecord(index, overrides = {}) {
  const area = canonicalAreas[index % canonicalAreas.length];
  return {
    wpShopId: 1000 + index,
    shopSlug: `shop-${index}`,
    registeredName: `店舗${index}`,
    currentAreaRelations: [{ id: area.id, slug: area.slug, name: area.name, parent: 2 }],
    verifiedStatus: "VERIFIED_EXACT",
    verifiedPrimaryArea: { ...area },
    evidence: [
      { sourceUrl: `https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop/${1000 + index}`, sourceType: "current-public-wordpress" },
      { sourceUrl: `https://official-${index}.example/access`, sourceType: "registered-official-site" },
    ],
    observedAt: "2026-08-16T00:00:00+09:00",
    ...overrides,
  };
}

function nonExactRecord(index, status) {
  return {
    wpShopId: 2000 + index,
    shopSlug: `other-${index}`,
    registeredName: `対象外${index}`,
    currentAreaRelations: [],
    verifiedStatus: status,
    verifiedPrimaryArea: null,
    evidence: [{ sourceUrl: `https://example.test/${index}`, sourceType: "web-discovery" }],
    observedAt: "2026-08-16T00:00:00+09:00",
  };
}

function verificationFixture() {
  const records = [
    ...Array.from({ length: 44 }, (_, index) => exactRecord(index)),
    nonExactRecord(0, "VERIFIED_NEARBY"),
    ...Array.from({ length: 156 }, (_, index) => nonExactRecord(index + 1, "REVIEW_REQUIRED")),
    ...Array.from({ length: 13 }, (_, index) => nonExactRecord(index + 157, "UNRESOLVED")),
  ];
  return { canonicalAreas, records };
}

function currentShop(record, overrides = {}) {
  return {
    id: record.wpShopId,
    slug: record.shopSlug,
    status: "publish",
    modified_gmt: "2026-08-15T12:00:00",
    title: { rendered: record.registeredName },
    area: record.currentAreaRelations.map((area) => area.id),
    ...overrides,
  };
}

const validInput = verificationFixture();
const validated = validateVerificationInput(validInput);
assert.equal(validated.exactRecords.length, 44);
assert.deepEqual(validated.statusCounts, {
  VERIFIED_EXACT: 44,
  VERIFIED_NEARBY: 1,
  REVIEW_REQUIRED: 156,
  UNRESOLVED: 13,
});

const currentAreas = canonicalAreas.map((area) => ({ ...area, taxonomy: "area" }));
const exact = validInput.records[0];
const ready = classifyPrimaryAreaBackfillRecord({ record: exact, currentShop: currentShop(exact), currentAreas, canonicalAreas });
assert.equal(ready.previewStatus, "READY_PRIMARY_ONLY");
assert.equal(ready.writePlan.metaKey, "shop_primary_area_term_id");
assert.equal(ready.writePlan.value, exact.verifiedPrimaryArea.id);
assert.ok(ready.writePlan.unchanged.includes("existing area relations"));
assert.equal(ready.currentPrimaryStatus, "NOT_VERIFIED_CONTRACT_NOT_PRODUCTION");

const missingRelation = classifyPrimaryAreaBackfillRecord({
  record: exact,
  currentShop: currentShop(exact, { area: [] }),
  currentAreas,
  canonicalAreas,
});
assert.equal(missingRelation.previewStatus, "NEEDS_AREA_RELATION_ADD");
assert.equal(missingRelation.writePlan, null, "relation missing must never be write-ready");

for (const [overrides, expectedReason] of [
  [{ id: 9999 }, "wp-id-mismatch"],
  [{ slug: "changed-slug" }, "slug-mismatch"],
  [{ status: "draft" }, "not-public"],
  [{ title: { rendered: "別の店舗" } }, "identity-mismatch"],
  [{ modified_gmt: "2026-08-16T01:00:00" }, "modified-after-verification"],
]) {
  const result = classifyPrimaryAreaBackfillRecord({ record: exact, currentShop: currentShop(exact, overrides), currentAreas, canonicalAreas });
  assert.equal(result.previewStatus, "STALE_OR_IDENTITY_CONFLICT");
  assert.equal(result.reason, expectedReason);
  assert.equal(result.writePlan, null);
}
const missingCurrent = classifyPrimaryAreaBackfillRecord({ record: exact, currentShop: null, currentAreas, canonicalAreas });
assert.equal(missingCurrent.previewStatus, "STALE_OR_IDENTITY_CONFLICT");
assert.equal(missingCurrent.reason, "current-shop-missing");

const mappingMismatch = classifyPrimaryAreaBackfillRecord({
  record: { ...exact, verifiedPrimaryArea: { ...exact.verifiedPrimaryArea, slug: "wrong" } },
  currentShop: currentShop(exact),
  currentAreas,
  canonicalAreas,
});
assert.equal(mappingMismatch.previewStatus, "EVIDENCE_OR_MAPPING_CONFLICT");
assert.equal(mappingMismatch.writePlan, null);

const inferred = classifyPrimaryAreaBackfillRecord({
  record: { ...exact, verifiedPrimaryArea: null },
  currentShop: currentShop(exact),
  currentAreas,
  canonicalAreas,
});
assert.equal(inferred.previewStatus, "EVIDENCE_OR_MAPPING_CONFLICT");
assert.equal(inferred.targetPrimaryArea, null, "Primary must not be inferred from the only current relation");

const duplicate = verificationFixture();
duplicate.records[1] = { ...duplicate.records[1], wpShopId: duplicate.records[0].wpShopId };
assert.throws(() => validateVerificationInput(duplicate), /duplicate.*wpShopId/i);

const missingEvidence = verificationFixture();
missingEvidence.records[0] = { ...missingEvidence.records[0], evidence: missingEvidence.records[0].evidence.slice(0, 1) };
assert.throws(() => validateVerificationInput(missingEvidence), /official evidence/i);

const unofficialEvidence = verificationFixture();
unofficialEvidence.records[0] = {
  ...unofficialEvidence.records[0],
  evidence: [
    unofficialEvidence.records[0].evidence[0],
    { sourceUrl: "https://portal.example/shop", sourceType: "unofficial-portal" },
  ],
};
assert.throws(() => validateVerificationInput(unofficialEvidence), /official evidence/i, "unofficial source types must not pass the official evidence gate");

const credentialEvidence = verificationFixture();
credentialEvidence.records[0] = {
  ...credentialEvidence.records[0],
  evidence: [
    credentialEvidence.records[0].evidence[0],
    { sourceUrl: "https://user:password@official.example/access", sourceType: "official-site" },
  ],
};
assert.throws(() => validateVerificationInput(credentialEvidence), /official evidence/i, "URLs with userinfo must not enter the artifact");

const emptyRegisteredName = verificationFixture();
emptyRegisteredName.records[0] = { ...emptyRegisteredName.records[0], registeredName: "" };
assert.throws(() => validateVerificationInput(emptyRegisteredName), /registeredName/i);

const emptyIdentity = classifyPrimaryAreaBackfillRecord({
  record: { ...exact, registeredName: "" },
  currentShop: currentShop(exact, { title: { rendered: "" } }),
  currentAreas,
  canonicalAreas,
});
assert.notEqual(emptyIdentity.previewStatus, "READY_PRIMARY_ONLY", "empty identities must not compare as a valid match");

const missingObservedAt = verificationFixture();
missingObservedAt.records[0] = { ...missingObservedAt.records[0], observedAt: "" };
assert.throws(() => validateVerificationInput(missingObservedAt), /observedAt/i);

const currentShops = validated.exactRecords.map((record) => currentShop(record));
const report = buildPrimaryAreaBackfillPreview({
  verification: validInput,
  currentShops,
  currentAreas,
  generatedAt: "2026-08-16T02:00:00.000Z",
  inputSha256: "fixture-sha256",
  source: { mode: "public-read-only", receivedShopCount: 44 },
});
assert.equal(report.records.length, 44, "non-EXACT records must not enter the preview");
assert.equal(report.records.every((record) => record.verifiedStatus === "VERIFIED_EXACT"), true);
assert.equal(report.summary.totalVerifiedExact, 44);
assert.equal(report.summary.byStatus.READY_PRIMARY_ONLY, 44);
assert.equal(report.records.some((record) => record.wpShopId >= 2000), false);
const summaryMarkdown = renderPrimaryAreaBackfillSummary(report);
assert.match(summaryMarkdown, /TOTAL_VERIFIED_EXACT = 44/);
assert.match(summaryMarkdown, /READY_PRIMARY_ONLY \| 44/);
assert.match(summaryMarkdown, /本番書込は実施していない/);

const scriptsRoot = fileURLToPath(new URL("..", import.meta.url));
const generatorPath = join(scriptsRoot, "scripts/prepare-primary-area-backfill-preview.mjs");
assert.ok(existsSync(generatorPath), "read-only preview generator must exist");
const generatorSource = readFileSync(generatorPath, "utf8");
assert.ok(generatorSource.includes('method: "GET"'), "preview generator must explicitly use GET only");
assert.equal(/method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/.test(generatorSource), false, "preview generator must not contain a write method");
assert.equal(/["'](?:Authorization|Cookie)["']\s*:/.test(generatorSource), false, "preview generator must not send credential headers");

const artifactPath = join(scriptsRoot, "..", "docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json");
assert.ok(existsSync(artifactPath), "generated preview artifact must exist");
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
assert.equal(artifact.records.length, 44);
assert.equal(artifact.records.every((record) => record.verifiedStatus === "VERIFIED_EXACT"), true);
assert.equal(Object.values(artifact.summary.byStatus).reduce((sum, count) => sum + count, 0), 44);
assert.equal(Object.values(artifact.summary.byArea).reduce((sum, area) => sum + area.total, 0), 44);
assert.equal(artifact.policy.productionWritePerformed, false);
for (const record of artifact.records) {
  assert.ok(record.evidenceUrl.startsWith("http"));
  assert.ok(record.observedAt);
  assert.equal(record.currentPrimaryStatus, "NOT_VERIFIED_CONTRACT_NOT_PRODUCTION");
  assert.equal(record.currentAreaRelations.some((area) => area.termId === record.targetPrimaryArea.termId), record.previewStatus === "READY_PRIMARY_ONLY");
  assert.equal(record.writePlan !== null, record.previewStatus === "READY_PRIMARY_ONLY");
}
function assertNoSensitiveKeys(value, path = "artifact") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(/authorization|cookie|password|secret|phone|telephone|address|raw.?html/i.test(key), false, `${path}.${key} must not contain sensitive or unnecessary data`);
    assertNoSensitiveKeys(child, `${path}.${key}`);
  }
}
assertNoSensitiveKeys(artifact);

console.log("Primary area backfill preview contract: PASS");
