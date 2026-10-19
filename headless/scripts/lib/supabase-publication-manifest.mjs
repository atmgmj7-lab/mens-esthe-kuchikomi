function positiveIds(value, name) {
  if (!Array.isArray(value) || value.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error(`${name} must be positive IDs`);
  return [...new Set(value)].sort((left, right) => left - right);
}

function routes(value) {
  if (!Array.isArray(value) || value.some((route) => typeof route !== "string" || !/^\/[a-z0-9-]+\/$/.test(route))) throw new Error("fixedPageRoutes must be canonical public routes");
  return [...new Set(value)].sort();
}

function sqlList(ids) { return ids.length ? ids.join(", ") : "null"; }

function quoteSql(value) { return `'${value.replaceAll("'", "''")}'`; }

function safeLabel(value) {
  if (!/^[a-z0-9-]+$/i.test(value || "")) throw new Error("sourceLabel must contain only letters, numbers, and hyphens");
  return value;
}

export function buildProposedPublicationManifest({
  candidateWpIds, reviewRequiredWpIds, managedUnlistedWpIds, retainedDraftWpIds,
  areaTermIds, fixedPageRoutes, imageWpMediaIds
}) {
  const candidates = positiveIds(candidateWpIds, "candidateWpIds");
  const reviewRequired = positiveIds(reviewRequiredWpIds, "reviewRequiredWpIds");
  const managedUnlisted = positiveIds(managedUnlistedWpIds, "managedUnlistedWpIds");
  const retainedDrafts = positiveIds(retainedDraftWpIds, "retainedDraftWpIds");
  const areas = positiveIds(areaTermIds, "areaTermIds");
  const images = positiveIds(imageWpMediaIds, "imageWpMediaIds");
  const pages = routes(fixedPageRoutes);
  const exclusions = [
    ...reviewRequired.map((wpPostId) => Object.freeze({ wpPostId, reason: "review-required-wordpress-only" })),
    ...managedUnlisted.map((wpPostId) => Object.freeze({ wpPostId, reason: "managed-unlisted" })),
    ...retainedDrafts.map((wpPostId) => Object.freeze({ wpPostId, reason: "supabase-only-draft" })),
    Object.freeze({ wpMediaId: 357, reason: "fixed-page-media-not-shop-image" }),
    Object.freeze({ scope: "unlisted-and-deleted-managed-shops", reason: "strict-exclusion" })
  ];
  return Object.freeze({
    state: "proposed",
    approval: Object.freeze({ state: "not-approved", application: "blocked" }),
    candidateWpIds: Object.freeze(candidates),
    publicTargets: Object.freeze({ shops: Object.freeze(candidates), areas: Object.freeze(areas), pages: Object.freeze(pages), imageWpMediaIds: Object.freeze(images) }),
    exclusions: Object.freeze(exclusions),
    before: Object.freeze({ publicShopCount: 0, publicAreaCount: 0, publicPageCount: 0, publicImageCount: 0 }),
    proposedAfter: Object.freeze({ publicShopCount: candidates.length, publicAreaCount: areas.length, publicPageCount: pages.length, publicImageCount: images.length })
  });
}

function renderReadOnlyVerification(manifest, sourceLabel, phase, transactionMode) {
  const { shops, areas, pages, imageWpMediaIds } = manifest.publicTargets;
  const reviewRequired = manifest.exclusions.filter((entry) => entry.reason === "review-required-wordpress-only").map((entry) => entry.wpPostId);
  const managedUnlisted = manifest.exclusions.filter((entry) => entry.reason === "managed-unlisted").map((entry) => entry.wpPostId);
  const retainedDrafts = manifest.exclusions.filter((entry) => entry.reason === "supabase-only-draft").map((entry) => entry.wpPostId);
  return `-- ${phase}: ${sourceLabel}; proposed targets only, not an approval or an apply artifact.
${transactionMode === "script" ? "begin read only;" : ""}

set local statement_timeout = '30s';

do $$
declare actual_count integer;
begin
  select count(*) into actual_count from app.shops
  where wp_post_id = any(array[${sqlList(shops)}]) and publication_status = 'draft';
  if actual_count <> ${shops.length} then raise exception 'publication proposal draft shop mismatch: expected %, got %', ${shops.length}, actual_count; end if;

  select count(*) into actual_count from app.areas
  where wp_term_id = any(array[${sqlList(areas)}]) and is_published = false;
  if actual_count <> ${areas.length} then raise exception 'publication proposal draft area mismatch: expected %, got %', ${areas.length}, actual_count; end if;

  -- The exact route list is intentionally recorded but never selected for
  -- mutation here. Existing local fixtures may contain route records; a future
  -- approved page-content import must reconcile their bodies independently.
  if array_length(array[${pages.map(quoteSql).join(", ")}], 1) <> ${pages.length} then
    raise exception 'fixed-page target list was not rendered intact';
  end if;

  select count(*) into actual_count from app.shop_images
  where wp_media_id = any(array[${sqlList(imageWpMediaIds)}]) and is_public = false;
  if actual_count <> ${imageWpMediaIds.length} then raise exception 'publication proposal image target mismatch: expected %, got %', ${imageWpMediaIds.length}, actual_count; end if;

  if exists (select 1 from app.shops where wp_post_id = any(array[${sqlList(reviewRequired)}])) then raise exception 'review-required WordPress-only rows must remain outside app.shops'; end if;
  select count(*) into actual_count from private.managed_shops managed join app.shops shop on shop.wp_post_id = managed.existing_wp_shop_id
  where managed.existing_wp_shop_id = any(array[${sqlList(managedUnlisted)}]) and managed.publication_state = 'unlisted' and shop.publication_status = 'draft';
  if actual_count <> ${managedUnlisted.length} then raise exception 'managed-unlisted exclusions changed'; end if;
  select count(*) into actual_count from app.shops where wp_post_id = any(array[${sqlList(retainedDrafts)}]) and publication_status = 'draft';
  if actual_count <> ${retainedDrafts.length} then raise exception 'Supabase-only draft exclusions changed'; end if;
  if exists (select 1 from app.shop_images where wp_media_id = 357) then raise exception 'fixed-page media 357 must not appear in shop-image targets'; end if;
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

export function renderPublicationManifestApplySql({ manifest, sourceLabel }) {
  safeLabel(sourceLabel);
  if (manifest.state !== "proposed" || manifest.approval?.application !== "blocked") throw new Error("only an unapproved proposed manifest can render a blocked apply stub");
  return `-- ${sourceLabel}: no mutation is emitted from a proposed manifest.
begin;
do $$
begin
  if current_setting('eskomi.publication_manifest_approval', true) <> ${quoteSql(sourceLabel)} then
    raise exception 'explicit approved manifest token is required before any apply artifact can run';
  end if;
  raise exception 'application intentionally disabled: create a separately reviewed approved manifest and component-specific apply artifact';
end
$$;
rollback;
`;
}
