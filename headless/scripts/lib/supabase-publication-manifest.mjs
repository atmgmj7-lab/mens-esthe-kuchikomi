function positiveIds(value, name) {
  if (!Array.isArray(value) || value.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error(`${name} must be positive WordPress IDs`);
  }
  return [...new Set(value)].sort((left, right) => left - right);
}

function targetLists(value) {
  if (!value || !["shops", "areas", "pages", "imageRows"].every((key) => Array.isArray(value[key]))) {
    throw new Error("publicTargets must contain shops, areas, pages, and imageRows arrays");
  }
  return Object.freeze({
    shops: Object.freeze([...value.shops]),
    areas: Object.freeze([...value.areas]),
    pages: Object.freeze([...value.pages]),
    imageRows: Object.freeze([...value.imageRows])
  });
}

function sqlList(ids) {
  return ids.length ? ids.join(", ") : "null";
}

function safeLabel(value) {
  if (!/^[a-z0-9-]+$/i.test(value || "")) throw new Error("sourceLabel must contain only letters, numbers, and hyphens");
  return value;
}

export function buildConservativePublicationManifest({
  candidateWpIds,
  reviewRequiredWpIds,
  managedUnlistedWpIds,
  retainedDraftWpIds,
  imageCount,
  publicTargets
}) {
  if (!Number.isSafeInteger(imageCount) || imageCount < 0) throw new Error("imageCount must be a non-negative integer");
  const candidates = positiveIds(candidateWpIds, "candidateWpIds");
  const reviewRequired = positiveIds(reviewRequiredWpIds, "reviewRequiredWpIds");
  const managedUnlisted = positiveIds(managedUnlistedWpIds, "managedUnlistedWpIds");
  const retainedDrafts = positiveIds(retainedDraftWpIds, "retainedDraftWpIds");
  const targets = targetLists(publicTargets);
  if (Object.values(targets).some((entries) => entries.length > 0)) {
    throw new Error("an explicitly approved publication target is required before this conservative manifest can contain public rows");
  }
  return Object.freeze({
    candidateWpIds: Object.freeze(candidates),
    publicTargets: targets,
    exclusions: Object.freeze([
      ...reviewRequired.map((wpPostId) => Object.freeze({ wpPostId, reason: "review-required-wordpress-only" })),
      ...managedUnlisted.map((wpPostId) => Object.freeze({ wpPostId, reason: "managed-unlisted" })),
      ...retainedDrafts.map((wpPostId) => Object.freeze({ wpPostId, reason: "supabase-only-draft" })),
      Object.freeze({ scope: "fixed-pages", reason: "canonical-content-not-approved" }),
      Object.freeze({ scope: "shop-images", reason: "no-image-publication-approval" })
    ]),
    before: Object.freeze({ publicShopCount: 0, publicAreaCount: 0, publicPageCount: 0, publicImageCount: 0, imageCount }),
    after: Object.freeze({ publicShopCount: 0, publicAreaCount: 0, publicPageCount: 0, publicImageCount: 0, imageCount })
  });
}

function renderReadOnlyVerification(manifest, sourceLabel, phase, transactionMode) {
  const candidates = manifest.candidateWpIds;
  const reviewRequired = manifest.exclusions.filter((entry) => entry.reason === "review-required-wordpress-only").map((entry) => entry.wpPostId);
  const managedUnlisted = manifest.exclusions.filter((entry) => entry.reason === "managed-unlisted").map((entry) => entry.wpPostId);
  const retainedDrafts = manifest.exclusions.filter((entry) => entry.reason === "supabase-only-draft").map((entry) => entry.wpPostId);
  return `-- ${phase}: ${sourceLabel}; this manifest has zero approved public targets.
${transactionMode === "script" ? "begin read only;" : ""}

set local statement_timeout = '30s';

do $$
declare
  actual_count integer;
begin
  select count(*) into actual_count
  from app.shops
  where wp_post_id = any(array[${sqlList(candidates)}])
    and publication_status = 'draft';
  if actual_count <> ${candidates.length} then
    raise exception 'publication manifest draft candidate mismatch: expected %, got %', ${candidates.length}, actual_count;
  end if;

  if exists (select 1 from app.shops where wp_post_id = any(array[${sqlList(reviewRequired)}])) then
    raise exception 'review-required WordPress-only rows must remain outside app.shops';
  end if;

  select count(*) into actual_count
  from private.managed_shops managed
  join app.shops shop on shop.wp_post_id = managed.existing_wp_shop_id
  where managed.existing_wp_shop_id = any(array[${sqlList(managedUnlisted)}])
    and managed.publication_state = 'unlisted'
    and shop.publication_status = 'draft';
  if actual_count <> ${managedUnlisted.length} then
    raise exception 'managed-unlisted exclusions changed';
  end if;

  select count(*) into actual_count
  from app.shops
  where wp_post_id = any(array[${sqlList(retainedDrafts)}])
    and publication_status = 'draft';
  if actual_count <> ${retainedDrafts.length} then
    raise exception 'Supabase-only draft exclusions changed';
  end if;

  select count(*) into actual_count from app.shop_images;
  if actual_count <> ${manifest.before.imageCount} then
    raise exception 'image inventory mismatch: expected %, got %', ${manifest.before.imageCount}, actual_count;
  end if;

  -- app.shop_areas is deliberately read only: all existing area memberships,
  -- including zero or multiple memberships, remain outside this zero-target manifest.
  perform count(*) from app.shop_areas;
end
$$;

${transactionMode === "script" ? "commit;" : ""}
`;
}

function transactionMode(value) {
  if (value === undefined || value === "script") return "script";
  if (value === "caller") return "caller";
  throw new Error("transactionMode must be script or caller");
}

export function renderPublicationManifestPreflightSql({ manifest, sourceLabel, transactionMode: mode }) {
  safeLabel(sourceLabel);
  return renderReadOnlyVerification(manifest, sourceLabel, "preflight", transactionMode(mode));
}

export function renderPublicationManifestRestoreSql({ manifest, sourceLabel, transactionMode: mode }) {
  safeLabel(sourceLabel);
  return renderReadOnlyVerification(manifest, sourceLabel, "restore-verification", transactionMode(mode));
}
