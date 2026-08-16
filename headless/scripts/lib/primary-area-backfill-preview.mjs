const EXPECTED_STATUS_COUNTS = Object.freeze({
  VERIFIED_EXACT: 44,
  VERIFIED_NEARBY: 1,
  REVIEW_REQUIRED: 156,
  UNRESOLVED: 13,
});

const EXPECTED_CANONICAL_AREAS = Object.freeze([
  Object.freeze({ id: 17, slug: "sakai", name: "堺東", route: "/area/sakai/" }),
  Object.freeze({ id: 13, slug: "shinosaka", name: "新大阪", route: "/area/shinosaka/" }),
  Object.freeze({ id: 7, slug: "nihonbashi", name: "大阪日本橋", route: "/area/nihonbashi/" }),
  Object.freeze({ id: 46, slug: "sakaisujihonmachi", name: "堺筋本町", route: "/area/sakaisujihonmachi/" }),
  Object.freeze({ id: 4, slug: "umeda", name: "梅田", route: "/area/umeda/" }),
]);

const PREVIEW_STATUSES = Object.freeze([
  "READY_PRIMARY_ONLY",
  "NEEDS_AREA_RELATION_ADD",
  "STALE_OR_IDENTITY_CONFLICT",
  "EVIDENCE_OR_MAPPING_CONFLICT",
]);

const OFFICIAL_EVIDENCE_SOURCE_TYPES = new Set([
  "official-site",
  "registered-official-site",
  "official-location-candidate-page",
  "official-access-page",
  "official-recruit-page",
]);

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validHttpUrl(value) {
  const text = nonEmptyString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    return isHttp && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizedIdentity(value) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function parseObservedAt(value) {
  const text = nonEmptyString(value);
  const timestamp = text ? Date.parse(text) : Number.NaN;
  return Number.isFinite(timestamp) ? { text, timestamp } : null;
}

function parseWpModifiedGmt(value) {
  const text = nonEmptyString(value);
  if (!text) return null;
  const timestamp = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text}Z`);
  return Number.isFinite(timestamp) ? { text, timestamp } : null;
}

function officialEvidenceUrl(record) {
  if (!Array.isArray(record?.evidence)) return null;
  const evidence = record.evidence.find((item) =>
    OFFICIAL_EVIDENCE_SOURCE_TYPES.has(String(item?.sourceType ?? "")) && validHttpUrl(item?.sourceUrl)
  );
  return evidence ? validHttpUrl(evidence.sourceUrl) : null;
}

function canonicalMappingById(canonicalAreas) {
  if (!Array.isArray(canonicalAreas) || canonicalAreas.length !== EXPECTED_CANONICAL_AREAS.length) {
    throw new Error("Priority 5 canonical Area mapping must contain exactly five rows");
  }
  const actual = new Map();
  for (const area of canonicalAreas) {
    const id = positiveInteger(area?.id);
    if (!id || actual.has(id)) throw new Error("Priority 5 canonical Area mapping has an invalid or duplicate term ID");
    actual.set(id, area);
  }
  for (const expected of EXPECTED_CANONICAL_AREAS) {
    const area = actual.get(expected.id);
    if (!area || area.slug !== expected.slug || area.name !== expected.name || area.route !== expected.route) {
      throw new Error(`Priority 5 canonical Area mapping mismatch for term ${expected.id}`);
    }
  }
  return new Map(EXPECTED_CANONICAL_AREAS.map((area) => [area.id, area]));
}

function publicAreaIndex(currentAreas) {
  if (!Array.isArray(currentAreas)) throw new Error("Current WordPress Area rows are required");
  const areas = new Map();
  for (const area of currentAreas) {
    const id = positiveInteger(area?.id);
    const slug = nonEmptyString(area?.slug);
    const label = nonEmptyString(area?.name);
    if (!id || !slug || !label || (area?.taxonomy && area.taxonomy !== "area") || areas.has(id)) {
      throw new Error(`Current WordPress Area row is invalid or duplicated: ${area?.id ?? "unknown"}`);
    }
    areas.set(id, Object.freeze({ termId: id, slug, label }));
  }
  return areas;
}

function targetFromRecord(record, canonicalAreas) {
  const verified = record?.verifiedPrimaryArea;
  const id = positiveInteger(verified?.id);
  if (!id) return null;
  const canonical = canonicalMappingById(canonicalAreas).get(id);
  if (!canonical || verified.slug !== canonical.slug || verified.name !== canonical.name || verified.route !== canonical.route) return null;
  return Object.freeze({ termId: canonical.id, slug: canonical.slug, label: canonical.name });
}

function previewBase(record, targetPrimaryArea, currentRelations, currentShop, evidenceUrl) {
  return {
    wpShopId: record.wpShopId,
    shopSlug: record.shopSlug,
    shopName: record.registeredName,
    verifiedStatus: record.verifiedStatus,
    targetPrimaryArea,
    currentAreaRelations: currentRelations,
    evidenceUrl,
    observedAt: record.observedAt,
    expectedWpModifiedGmt: nonEmptyString(currentShop?.modified_gmt),
    currentPrimaryStatus: "NOT_VERIFIED_CONTRACT_NOT_PRODUCTION",
  };
}

function result(base, previewStatus, reason, writePlan = null) {
  return Object.freeze({ ...base, previewStatus, reason, writePlan });
}

export function validateVerificationInput(verification) {
  if (!verification || !Array.isArray(verification.records)) throw new Error("Verification input must contain records");
  if (verification.records.length !== 214) throw new Error(`Verification record total mismatch: ${verification.records.length} !== 214`);
  canonicalMappingById(verification.canonicalAreas);

  const ids = new Set();
  const counts = Object.fromEntries(Object.keys(EXPECTED_STATUS_COUNTS).map((status) => [status, 0]));
  for (const record of verification.records) {
    const id = positiveInteger(record?.wpShopId);
    if (!id) throw new Error("Verification record has an invalid wpShopId");
    if (ids.has(id)) throw new Error(`Duplicate wpShopId in verification input: ${id}`);
    ids.add(id);
    if (!nonEmptyString(record?.shopSlug)) throw new Error(`Missing shopSlug for shop ${id}`);
    if (!nonEmptyString(record?.registeredName)) throw new Error(`Missing registeredName for shop ${id}`);
    if (!Object.hasOwn(counts, record?.verifiedStatus)) throw new Error(`Unexpected verifiedStatus for shop ${id}`);
    counts[record.verifiedStatus] += 1;
    if (!parseObservedAt(record?.observedAt)) throw new Error(`Missing or invalid observedAt for shop ${id}`);
    if (!Array.isArray(record?.evidence) || !record.evidence.some((item) => validHttpUrl(item?.sourceUrl))) {
      throw new Error(`Missing source URL for shop ${id}`);
    }
    if (record.verifiedStatus === "VERIFIED_EXACT") {
      if (!officialEvidenceUrl(record)) throw new Error(`Missing official evidence for VERIFIED_EXACT shop ${id}`);
      if (!targetFromRecord(record, verification.canonicalAreas)) throw new Error(`Invalid verified Primary Area mapping for shop ${id}`);
    } else if (record.verifiedPrimaryArea !== null) {
      throw new Error(`Non-EXACT shop ${id} must not have a verified Primary Area`);
    }
  }
  for (const [status, expected] of Object.entries(EXPECTED_STATUS_COUNTS)) {
    if (counts[status] !== expected) throw new Error(`Verification ${status} count mismatch: ${counts[status]} !== ${expected}`);
  }
  return Object.freeze({
    statusCounts: Object.freeze({ ...counts }),
    exactRecords: Object.freeze(verification.records.filter((record) => record.verifiedStatus === "VERIFIED_EXACT")),
  });
}

export function classifyPrimaryAreaBackfillRecord({ record, currentShop, currentAreas, canonicalAreas }) {
  const areaIndex = publicAreaIndex(currentAreas);
  const targetPrimaryArea = targetFromRecord(record, canonicalAreas);
  const evidenceUrl = officialEvidenceUrl(record);
  const currentRelationIds = Array.isArray(currentShop?.area) ? currentShop.area : [];
  const currentAreaRelations = currentRelationIds.map((value) => areaIndex.get(positiveInteger(value))).filter(Boolean);
  const base = previewBase(record, targetPrimaryArea, currentAreaRelations, currentShop, evidenceUrl);

  if (
    record?.verifiedStatus !== "VERIFIED_EXACT"
    || !nonEmptyString(record?.shopSlug)
    || !nonEmptyString(record?.registeredName)
    || !targetPrimaryArea
    || !evidenceUrl
    || !parseObservedAt(record?.observedAt)
  ) {
    return result(base, "EVIDENCE_OR_MAPPING_CONFLICT", "verified-evidence-or-mapping-invalid");
  }
  const currentTargetArea = areaIndex.get(targetPrimaryArea.termId);
  if (!currentTargetArea || currentTargetArea.slug !== targetPrimaryArea.slug) {
    return result(base, "EVIDENCE_OR_MAPPING_CONFLICT", "current-area-mapping-mismatch");
  }
  if (!currentShop) return result(base, "STALE_OR_IDENTITY_CONFLICT", "current-shop-missing");
  if (currentShop.id !== record.wpShopId) return result(base, "STALE_OR_IDENTITY_CONFLICT", "wp-id-mismatch");
  if (!nonEmptyString(currentShop.slug)) return result(base, "STALE_OR_IDENTITY_CONFLICT", "current-slug-missing");
  if (currentShop.slug !== record.shopSlug) return result(base, "STALE_OR_IDENTITY_CONFLICT", "slug-mismatch");
  if (currentShop.status !== "publish") return result(base, "STALE_OR_IDENTITY_CONFLICT", "not-public");
  if (!nonEmptyString(currentShop?.title?.rendered)) return result(base, "STALE_OR_IDENTITY_CONFLICT", "current-identity-missing");
  if (normalizedIdentity(currentShop?.title?.rendered) !== normalizedIdentity(record.registeredName)) {
    return result(base, "STALE_OR_IDENTITY_CONFLICT", "identity-mismatch");
  }
  const modified = parseWpModifiedGmt(currentShop.modified_gmt);
  const observed = parseObservedAt(record.observedAt);
  if (!modified) return result(base, "STALE_OR_IDENTITY_CONFLICT", "missing-modified-gmt");
  if (modified.timestamp > observed.timestamp) return result(base, "STALE_OR_IDENTITY_CONFLICT", "modified-after-verification");
  if (!Array.isArray(currentShop.area) || currentShop.area.some((value) => !positiveInteger(value))) {
    return result(base, "EVIDENCE_OR_MAPPING_CONFLICT", "current-area-relations-invalid");
  }
  if (currentAreaRelations.length !== new Set(currentShop.area).size) {
    return result(base, "EVIDENCE_OR_MAPPING_CONFLICT", "current-area-mapping-missing");
  }
  if (!currentShop.area.includes(targetPrimaryArea.termId)) {
    return result(base, "NEEDS_AREA_RELATION_ADD", "target-area-relation-missing");
  }

  return result(base, "READY_PRIMARY_ONLY", "verified-target-is-current-area-relation", Object.freeze({
    operation: "SET_META",
    metaKey: "shop_primary_area_term_id",
    value: targetPrimaryArea.termId,
    precondition: Object.freeze({ expectedWpModifiedGmt: modified.text }),
    unchanged: Object.freeze([
      "title",
      "slug",
      "post status",
      "other meta",
      "existing area relations",
      "canonical",
      "URL",
    ]),
  }));
}

export function buildPrimaryAreaBackfillPreview({ verification, currentShops, currentAreas, generatedAt, inputSha256, source }) {
  const validated = validateVerificationInput(verification);
  if (!Array.isArray(currentShops)) throw new Error("Current WordPress Shop rows are required");
  const currentById = new Map();
  for (const shop of currentShops) {
    const id = positiveInteger(shop?.id);
    if (!id || currentById.has(id)) throw new Error(`Current WordPress Shop ID is invalid or duplicated: ${shop?.id ?? "unknown"}`);
    currentById.set(id, shop);
  }
  const records = validated.exactRecords
    .map((record) => classifyPrimaryAreaBackfillRecord({
      record,
      currentShop: currentById.get(record.wpShopId) ?? null,
      currentAreas,
      canonicalAreas: verification.canonicalAreas,
    }))
    .sort((left, right) => left.wpShopId - right.wpShopId);

  const byStatus = Object.fromEntries(PREVIEW_STATUSES.map((status) => [status, records.filter((record) => record.previewStatus === status).length]));
  const byArea = Object.fromEntries(EXPECTED_CANONICAL_AREAS.map((area) => {
    const areaRecords = records.filter((record) => record.targetPrimaryArea?.termId === area.id);
    const statusCounts = Object.fromEntries(PREVIEW_STATUSES.map((status) => [status, areaRecords.filter((record) => record.previewStatus === status).length]));
    return [area.slug, { termId: area.id, slug: area.slug, label: area.name, total: areaRecords.length, ...statusCounts }];
  }));
  return Object.freeze({
    taskId: "UX-AREA-PRIMARY-BACKFILL-PREVIEW-01",
    generatedAt,
    input: Object.freeze({ sha256: inputSha256, totalRecords: verification.records.length, statusCounts: validated.statusCounts }),
    source,
    policy: Object.freeze({
      metaKey: "shop_primary_area_term_id",
      exactOnly: true,
      existingAreaRelationRequired: true,
      legacyAreaRelationsUnchanged: true,
      currentPrimaryStatus: "NOT_VERIFIED_CONTRACT_NOT_PRODUCTION",
      productionWritePerformed: false,
    }),
    summary: Object.freeze({ totalVerifiedExact: records.length, byStatus: Object.freeze(byStatus), byArea: Object.freeze(byArea) }),
    records: Object.freeze(records),
  });
}

export function renderPrimaryAreaBackfillSummary(report) {
  const statuses = PREVIEW_STATUSES.map((status) => `| ${status} | ${report.summary.byStatus[status]} |`).join("\n");
  const areas = EXPECTED_CANONICAL_AREAS.map((area) => {
    const row = report.summary.byArea[area.slug];
    return `| ${area.name} | ${area.slug} | ${row.total} | ${row.READY_PRIMARY_ONLY} | ${row.NEEDS_AREA_RELATION_ADD} | ${row.STALE_OR_IDENTITY_CONFLICT} | ${row.EVIDENCE_OR_MAPPING_CONFLICT} |`;
  }).join("\n");
  return `# Priority 5 Primary Area Backfill Preview Summary

**Task:** UX-AREA-PRIMARY-BACKFILL-PREVIEW-01
**Generated at:** ${report.generatedAt}
**Input SHA-256:** \`${report.input.sha256}\`

## Input validation

- TOTAL_RECORDS = ${report.input.totalRecords}
- TOTAL_VERIFIED_EXACT = ${report.summary.totalVerifiedExact}
- VERIFIED_NEARBY = ${report.input.statusCounts.VERIFIED_NEARBY}
- REVIEW_REQUIRED = ${report.input.statusCounts.REVIEW_REQUIRED}
- UNRESOLVED = ${report.input.statusCounts.UNRESOLVED}
- WordPress public read rows = ${report.source.receivedShopCount}

## Preview classification

| Status | Count |
|---|---:|
${statuses}

## Area counts

| Area | Slug | Exact | READY | RELATION ADD | STALE/IDENTITY | EVIDENCE/MAPPING |
|---|---|---:|---:|---:|---:|---:|
${areas}

## Safety boundary

- 本番書込は実施していない。
- READY_PRIMARY_ONLYは将来\`shop_primary_area_term_id\`だけを設定するpreviewである。
- 既存Area relation、title、slug、status、他meta、canonical、URLは変更しない。
- 現行Primary値は\`NOT_VERIFIED_CONTRACT_NOT_PRODUCTION\`であり、nullとは推測しない。
- term ID 7はcanonical表示labelが「大阪日本橋」、現WordPress term nameが「日本橋」。ID・slug・routeの対応は一致している。
- この件数からT3-Aを開始できるかという事業判断は行わない。
`;
}
