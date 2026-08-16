function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function normalizeRelationIds(value) {
  if (!Array.isArray(value)) throw new Error("Shop is missing canonical area relations");
  const ids = [];
  let invalid = false;
  const seen = new Set();
  for (const raw of value) {
    const id = positiveInteger(raw);
    if (!id) {
      invalid = true;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids: ids.sort((a, b) => a - b), invalid };
}

function buildAreaIndex(areas) {
  const byId = new Map();
  const duplicates = new Set();
  for (const raw of Array.isArray(areas) ? areas : []) {
    const id = positiveInteger(raw?.id);
    const parent = raw?.parent === 0 ? 0 : positiveInteger(raw?.parent);
    if (
      !id
      || parent === null
      || raw?.taxonomy !== "area"
      || typeof raw?.slug !== "string"
      || !raw.slug.trim()
      || typeof raw?.name !== "string"
      || !raw.name.trim()
    ) continue;
    if (byId.has(id)) duplicates.add(id);
    byId.set(id, { id, slug: raw.slug, name: raw.name, parent });
  }
  return { byId, duplicates };
}

function validateCanonicalAreaRows(areas) {
  if (!Array.isArray(areas)) throw new Error("Candidate report requires canonical area rows");
  const ids = new Set();
  for (const area of areas) {
    const id = positiveInteger(area?.id);
    const parent = area?.parent === 0 ? 0 : positiveInteger(area?.parent);
    if (area?.taxonomy !== "area") throw new Error(`Canonical area taxonomy is invalid for term ${area?.id ?? "unknown"}`);
    if (!id || parent === null || typeof area?.slug !== "string" || !area.slug.trim() || typeof area?.name !== "string" || !area.name.trim()) {
      throw new Error(`Canonical area row is incomplete for term ${area?.id ?? "unknown"}`);
    }
    if (ids.has(id)) throw new Error(`Duplicate canonical area ID: ${id}`);
    ids.add(id);
  }
}

function lineageFor(id, index) {
  const ancestors = new Set();
  const visited = new Set();
  let current = id;
  while (current !== 0) {
    if (visited.has(current) || index.duplicates.has(current)) return { valid: false, ancestors };
    visited.add(current);
    const area = index.byId.get(current);
    if (!area) return { valid: false, ancestors };
    current = area.parent;
    if (current !== 0) ancestors.add(current);
  }
  return { valid: true, ancestors };
}

function publicArea(area) {
  return Object.freeze({ id: area.id, slug: area.slug, name: area.name });
}

function currentRelation(id, index) {
  const area = index.byId.get(id);
  return area
    ? Object.freeze({ id: area.id, slug: area.slug, name: area.name, parent: area.parent })
    : Object.freeze({ id, slug: null, name: null, parent: null });
}

function shopName(shop) {
  const rendered = typeof shop?.title?.rendered === "string" ? shop.title.rendered : "";
  return rendered.replace(/<[^>]*>/g, "").trim();
}

export function buildShopPrimaryAreaCandidate(shop, areas) {
  const wpShopId = positiveInteger(shop?.id);
  if (!wpShopId) throw new Error("Shop candidate requires a positive WordPress ID");

  const relations = normalizeRelationIds(shop?.area);
  const index = buildAreaIndex(areas);
  const currentAreaRelations = relations.ids.map((id) => currentRelation(id, index));
  const base = {
    wpShopId,
    shopSlug: typeof shop?.slug === "string" ? shop.slug : "",
    shopName: shopName(shop),
    currentAreaRelations,
  };

  if (relations.invalid) {
    return Object.freeze({ ...base, proposedPrimaryArea: null, classification: "NEEDS_REVIEW", reason: "invalid-area-relation-values" });
  }
  if (relations.ids.length === 0) {
    return Object.freeze({ ...base, proposedPrimaryArea: null, classification: "UNCLASSIFIED", reason: "no-valid-area-relations" });
  }

  const lineages = new Map();
  for (const id of relations.ids) {
    const lineage = lineageFor(id, index);
    if (!lineage.valid) {
      const reason = index.byId.has(id) ? "invalid-area-graph" : "unknown-area-relation";
      return Object.freeze({ ...base, proposedPrimaryArea: null, classification: "NEEDS_REVIEW", reason });
    }
    lineages.set(id, lineage);
  }

  const leaves = relations.ids.filter((candidate) =>
    !relations.ids.some((other) => other !== candidate && lineages.get(other).ancestors.has(candidate))
  );
  if (leaves.length !== 1) {
    return Object.freeze({ ...base, proposedPrimaryArea: null, classification: "NEEDS_REVIEW", reason: "multiple-leaf-area-relations" });
  }

  const leaf = leaves[0];
  const leafLineage = lineages.get(leaf);
  const allAncestors = relations.ids.every((id) => id === leaf || leafLineage.ancestors.has(id));
  if (!allAncestors) {
    return Object.freeze({ ...base, proposedPrimaryArea: null, classification: "NEEDS_REVIEW", reason: "unrelated-area-relations" });
  }

  return Object.freeze({
    ...base,
    proposedPrimaryArea: publicArea(index.byId.get(leaf)),
    classification: "AUTO_SAFE",
    reason: relations.ids.length === 1 ? "single-valid-area-relation" : "unique-leaf-with-ancestors",
  });
}

export function buildShopPrimaryAreaReport({ shops, areas, generatedAt, source }) {
  if (!Array.isArray(shops) || !Array.isArray(areas)) throw new Error("Candidate report requires shop and area arrays");
  validateCanonicalAreaRows(areas);
  const candidates = shops.map((shop) => buildShopPrimaryAreaCandidate(shop, areas)).sort((a, b) => a.wpShopId - b.wpShopId);
  const ids = new Set();
  for (const candidate of candidates) {
    if (ids.has(candidate.wpShopId)) throw new Error(`Duplicate WordPress shop ID: ${candidate.wpShopId}`);
    ids.add(candidate.wpShopId);
  }
  const relationCounts = shops.map((shop) => normalizeRelationIds(shop?.area).ids.length);
  return Object.freeze({
    generatedAt,
    source,
    summary: Object.freeze({
      totalShops: candidates.length,
      autoSafe: candidates.filter((shop) => shop.classification === "AUTO_SAFE").length,
      needsReview: candidates.filter((shop) => shop.classification === "NEEDS_REVIEW").length,
      unclassified: candidates.filter((shop) => shop.classification === "UNCLASSIFIED").length,
      multiArea: relationCounts.filter((count) => count > 1).length,
      noArea: relationCounts.filter((count) => count === 0).length,
    }),
    shops: Object.freeze(candidates),
  });
}
