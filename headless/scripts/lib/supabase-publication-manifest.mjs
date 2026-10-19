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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function proposalSha256(manifest) {
  if (manifest?.state !== "proposed" || manifest?.approval?.application !== "blocked") throw new Error("only an unapproved proposed manifest has a proposal hash");
  return createHash("sha256").update(canonicalJson(manifest)).digest("hex");
}

export function buildLocalFixtureApproval({ manifest, proposalId, approvalId }) {
  safeLabel(proposalId); safeLabel(approvalId);
  if (!approvalId.endsWith("-local-fixture")) throw new Error("local fixture approval IDs must end with -local-fixture");
  return Object.freeze({
    state: "approved-local-fixture",
    environment: "local-fixture-only",
    proposalId,
    proposalSha256: proposalSha256(manifest),
    approvalId
  });
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
    ...reviewRequired.map((wpPostId) => Object.freeze({ wpPostId, reason: "wordpress-only-publication-decision-required" })),
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
  const reviewRequired = manifest.exclusions.filter((entry) => entry.reason === "wordpress-only-publication-decision-required").map((entry) => entry.wpPostId);
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

  if exists (select 1 from app.shops where wp_post_id = any(array[${sqlList(reviewRequired)}])) then raise exception 'WordPress-only shops pending a publication decision must remain outside app.shops'; end if;
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
import { createHash } from "node:crypto";


function requireLocalFixtureApproval(manifest, proposalId, approval) {
  safeLabel(proposalId);
  if (!approval || approval.state !== "approved-local-fixture" || approval.environment !== "local-fixture-only") throw new Error("a local-fixture-only approved manifest is required");
  if (approval.proposalId !== proposalId || approval.proposalSha256 !== proposalSha256(manifest)) throw new Error("approved manifest does not exactly match the proposed manifest ID and hash");
  safeLabel(approval.approvalId);
  return approval;
}

function renderFixtureGate(approval) {
  return `
  if current_setting('eskomi.publication_manifest_mode', true) is distinct from 'local-fixture' then
    raise exception 'publication apply is restricted to an explicit local fixture transaction';
  end if;
  if current_setting('eskomi.publication_manifest_approval', true) is distinct from ${quoteSql(approval.approvalId)} then
    raise exception 'local fixture approval ID does not match';
  end if;
  if current_setting('eskomi.publication_manifest_proposal_sha256', true) is distinct from ${quoteSql(approval.proposalSha256)} then
    raise exception 'local fixture proposal hash does not match';
  end if;`;
}

export function renderApprovedFixtureApplySql({ manifest, proposalId, approval, transactionMode: mode }) {
  const approved = requireLocalFixtureApproval(manifest, proposalId, approval);
  const { shops, areas, imageWpMediaIds } = manifest.publicTargets;
  const transaction = transactionMode(mode);
  return `-- ${approved.approvalId}: local-fixture-only application of proposal ${proposalId} (${approved.proposalSha256}).
${transaction === "script" ? "begin;" : ""}
do $$
declare draft_count integer; published_count integer; private_count integer;
begin${renderFixtureGate(approved)}
  select count(*) filter (where publication_status = 'draft'), count(*) filter (where publication_status = 'published')
  into draft_count, published_count from app.shops where wp_post_id = any(array[${sqlList(shops)}]);
  if draft_count + published_count <> ${shops.length} or (draft_count <> 0 and draft_count <> ${shops.length}) then raise exception 'shop targets must be wholly draft or wholly published'; end if;
  select count(*) into private_count from app.shops where wp_post_id = any(array[${sqlList(shops)}]) and publication_status = 'draft';
  update app.shops set publication_status = 'published', published_at = coalesce(published_at, now()) where wp_post_id = any(array[${sqlList(shops)}]) and publication_status = 'draft';
  if private_count <> 0 and not found then raise exception 'fixture shop publication changed unexpectedly'; end if;

  select count(*) filter (where is_published = false), count(*) filter (where is_published = true)
  into draft_count, published_count from app.areas where wp_term_id = any(array[${sqlList(areas)}]);
  if draft_count + published_count <> ${areas.length} or (draft_count <> 0 and draft_count <> ${areas.length}) then raise exception 'area targets must be wholly private or wholly public'; end if;
  update app.areas set is_published = true, published_at = coalesce(published_at, now()) where wp_term_id = any(array[${sqlList(areas)}]) and is_published = false;

  select count(*) filter (where is_public = false), count(*) filter (where is_public = true)
  into draft_count, published_count from app.shop_images where wp_media_id = any(array[${sqlList(imageWpMediaIds)}]);
  if draft_count + published_count <> ${imageWpMediaIds.length} or (draft_count <> 0 and draft_count <> ${imageWpMediaIds.length}) then raise exception 'image targets must be wholly private or wholly public'; end if;
  update app.shop_images set is_public = true, verified_at = coalesce(verified_at, now()) where wp_media_id = any(array[${sqlList(imageWpMediaIds)}]) and is_public = false;
end
$$;
${transaction === "script" ? "commit;" : ""}
`;
}

export function renderApprovedFixtureRestoreSql({ manifest, proposalId, approval, transactionMode: mode }) {
  const approved = requireLocalFixtureApproval(manifest, proposalId, approval);
  const { shops, areas, imageWpMediaIds } = manifest.publicTargets;
  const transaction = transactionMode(mode);
  return `-- ${approved.approvalId}: conditional local-fixture-only restoration of proposal ${proposalId}.
${transaction === "script" ? "begin;" : ""}
do $$
declare target_count integer;
begin${renderFixtureGate(approved)}
  select count(*) into target_count from app.shops where wp_post_id = any(array[${sqlList(shops)}]) and publication_status = 'published';
  if target_count <> ${shops.length} then raise exception 'restore requires every approved fixture shop target to remain published'; end if;
  update app.shops set publication_status = 'draft', published_at = null where wp_post_id = any(array[${sqlList(shops)}]) and publication_status = 'published';
  select count(*) into target_count from app.areas where wp_term_id = any(array[${sqlList(areas)}]) and is_published = true;
  if target_count <> ${areas.length} then raise exception 'restore requires every approved fixture area target to remain public'; end if;
  update app.areas set is_published = false, published_at = null where wp_term_id = any(array[${sqlList(areas)}]) and is_published = true;
  select count(*) into target_count from app.shop_images where wp_media_id = any(array[${sqlList(imageWpMediaIds)}]) and is_public = true;
  if target_count <> ${imageWpMediaIds.length} then raise exception 'restore requires every approved fixture image target to remain public'; end if;
  update app.shop_images set is_public = false, verified_at = null where wp_media_id = any(array[${sqlList(imageWpMediaIds)}]) and is_public = true;
end
$$;
${transaction === "script" ? "commit;" : ""}
`;
}
