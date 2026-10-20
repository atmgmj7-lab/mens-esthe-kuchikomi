import { createHash } from "node:crypto";

const FIXED_ROUTES = Object.freeze([
  "/about/", "/advertise/", "/contact/", "/osaka-nihonbashi/", "/sitemap/", "/storelisting/"
]);

function quoteSql(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function safeLabel(value, name) {
  if (!/^[a-z0-9-]+$/iu.test(value ?? "")) throw new Error(`${name} must contain only letters, numbers, and hyphens`);
  return value;
}
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function exactRoutes(value) {
  const routes = [...new Set(value)].sort();
  if (routes.length !== FIXED_ROUTES.length || routes.some((route, index) => route !== FIXED_ROUTES[index])) {
    throw new Error("six canonical fixed-page inputs are required");
  }
  return routes;
}
function ids(value, name) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !Number.isSafeInteger(item) || item <= 0)) throw new Error(`${name} must be non-empty positive IDs`);
  return [...new Set(value)].sort((left, right) => left - right);
}
function verifyPageSource(page) {
  if (page.source === "wordpress-readonly") {
    if (!Number.isSafeInteger(page.sourceId) || page.sourceId <= 0 || typeof page.sourceModified !== "string") throw new Error(`WordPress page ${page.routeKey} needs source ID and modified time`);
    return;
  }
  if (page.source === "application-fallback" && page.routeKey === "/advertise/" && page.sourceId === null) return;
  throw new Error(`unsupported page source for ${page.routeKey}`);
}
function normalizedPage(page) {
  if (!page || typeof page.routeKey !== "string" || typeof page.title !== "string" || typeof page.bodyHtml !== "string" || typeof page.bodyText !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(page.contentId ?? "")) {
    throw new Error("page input must include a stable UUID, route, title, body HTML, and body text");
  }
  return Object.freeze({
    routeKey: page.routeKey,
    title: page.title,
    bodyHtml: page.bodyHtml,
    bodyText: page.bodyText,
    source: page.source,
    sourceId: page.sourceId ?? null,
    sourceModified: page.sourceModified ?? null,
    bodyOrigin: page.bodyOrigin ?? null,
    contentId: page.contentId
  });
}
function planSha256(plan) {
  if (plan?.state !== "proposed" || plan?.approval?.application !== "blocked") throw new Error("only a blocked proposed plan has a proposal hash");
  return createHash("sha256").update(canonicalJson(plan)).digest("hex");
}
function sqlIdList(values) { return values.join(", "); }
function renderPageValues(pages) {
  return pages.map((page) => `(${quoteSql(page.contentId)}::uuid, ${quoteSql(page.routeKey)}, 'other', 'editorial-comment', ${quoteSql(page.title)}, ${quoteSql(page.bodyHtml)}, ${quoteSql(page.bodyText)}, 'published', now())`).join(",\n    ");
}
function requireLocalFixtureApproval(plan, approval) {
  if (!approval || approval.state !== "approved-local-fixture" || approval.environment !== "local-fixture-only") throw new Error("a local-fixture-only execution approval is required");
  if (approval.proposalSha256 !== planSha256(plan)) throw new Error("execution approval does not match the proposal hash");
  safeLabel(approval.proposalId, "proposalId");
  safeLabel(approval.approvalId, "approvalId");
  return approval;
}
function requireProductionApproval(plan, approval) {
  if (!approval || approval.state !== "approved-production" || approval.environment !== "production-approved-only") throw new Error("a separately approved production execution object is required");
  if (approval.proposalSha256 !== planSha256(plan)) throw new Error("production execution approval does not match the proposal hash");
  safeLabel(approval.proposalId, "proposalId");
  safeLabel(approval.approvalId, "approvalId");
  return approval;
}
function renderFixtureGate(plan, approval) {
  return `
  if current_setting('eskomi.publication_manifest_mode', true) is distinct from 'local-fixture' then
    raise exception 'publication execution is restricted to an explicit local fixture transaction';
  end if;
  if current_setting('eskomi.publication_manifest_approval', true) is distinct from ${quoteSql(approval.approvalId)} then
    raise exception 'publication execution approval ID does not match';
  end if;
  if current_setting('eskomi.publication_manifest_proposal_sha256', true) is distinct from ${quoteSql(approval.proposalSha256)} then
    raise exception 'publication execution proposal hash does not match';
  end if;
  if current_setting('eskomi.fixed_page_media_357_verified', true) is distinct from ${quoteSql(plan.fixedPageMedia.sourceSha256)} then
    raise exception 'fixed-page media 357 must be independently copied and checksum-verified before page publication';
  end if;`;
}
function renderProductionGate(plan, approval) {
  return `
  if current_setting('eskomi.publication_manifest_mode', true) is distinct from 'production-approved' then
    raise exception 'production publication requires an explicit production-approved transaction mode';
  end if;
  if current_setting('eskomi.publication_manifest_approval', true) is distinct from ${quoteSql(approval.approvalId)} then
    raise exception 'production publication approval ID does not match';
  end if;
  if current_setting('eskomi.publication_manifest_proposal_sha256', true) is distinct from ${quoteSql(approval.proposalSha256)} then
    raise exception 'production publication proposal hash does not match';
  end if;
  if current_setting('eskomi.fixed_page_media_357_verified', true) is distinct from ${quoteSql(plan.fixedPageMedia.sourceSha256)} then
    raise exception 'fixed-page media 357 must be independently copied and checksum-verified before page publication';
  end if;`;
}

export function buildPublicationExecutionPlan({ publicationManifest, pageInputs, fixedPageMedia }) {
  if (publicationManifest?.state !== "proposed" || publicationManifest?.approval?.application !== "blocked") throw new Error("execution plan must start from a blocked proposed publication manifest");
  const targets = publicationManifest.publicTargets;
  const routes = exactRoutes(targets?.pages ?? []);
  const pages = (pageInputs ?? []).map(normalizedPage).sort((left, right) => left.routeKey.localeCompare(right.routeKey));
  exactRoutes(pages.map((page) => page.routeKey));
  if (!fixedPageMedia || fixedPageMedia.wpMediaId !== 357 || !/^[a-f0-9]{64}$/iu.test(fixedPageMedia.sourceSha256 ?? "") || !/^https:\/\//u.test(fixedPageMedia.targetUrl ?? "")) {
    throw new Error("fixed page media 357 needs a SHA-256 and HTTPS target URL");
  }
  if (fixedPageMedia.referencedByRoute !== "/osaka-nihonbashi/") throw new Error("fixed-page media 357 must retain its Nihonbashi route reference");
  const shops = ids(targets?.shops, "shop targets");
  const areas = ids(targets?.areas, "area targets");
  const images = ids(targets?.imageWpMediaIds, "shop-image targets");
  return Object.freeze({
    state: "proposed",
    approval: Object.freeze({ state: "not-approved", application: "blocked" }),
    sourceManifest: Object.freeze({
      state: publicationManifest.state,
      publicTargets: Object.freeze({ shops, areas, pages: routes, imageWpMediaIds: images })
    }),
    pages: Object.freeze(pages),
    fixedPageMedia: Object.freeze({ ...fixedPageMedia }),
    summary: `${shops.length} shops, ${areas.length} areas, ${pages.length} pages, ${images.length} shop images, and fixed-page media 357`
  });
}

export function buildLocalFixtureExecutionApproval({ plan, proposalId, approvalId }) {
  safeLabel(proposalId, "proposalId"); safeLabel(approvalId, "approvalId");
  if (!approvalId.endsWith("-local-fixture")) throw new Error("local fixture approval IDs must end with -local-fixture");
  return Object.freeze({ state: "approved-local-fixture", environment: "local-fixture-only", proposalId, approvalId, proposalSha256: planSha256(plan) });
}

export function renderExecutionApplySql({ plan, approval, transactionMode = "script" }) {
  if (transactionMode !== "script" && transactionMode !== "caller") throw new Error("transactionMode must be script or caller");
  const gate = requireLocalFixtureApproval(plan, approval);
  const { shops, areas, imageWpMediaIds } = plan.sourceManifest.publicTargets;
  const routes = plan.pages.map((page) => page.routeKey);
  const pageValues = renderPageValues(plan.pages);
  return `-- Local-fixture-only execution plan. It cannot run without all transaction-local gates.
${transactionMode === "script" ? "begin;" : ""}
do $$
declare actual_count integer; private_count integer; public_count integer;
begin${renderFixtureGate(plan, gate)}
  select count(*) filter (where publication_status = 'draft' and published_at is null), count(*) filter (where publication_status = 'published')
  into private_count, public_count from app.shops where wp_post_id = any(array[${sqlIdList(shops)}]);
  if private_count + public_count <> ${shops.length} or (private_count <> 0 and private_count <> ${shops.length}) then raise exception 'shop execution precondition changed'; end if;
  select count(*) filter (where is_published = false and published_at is null), count(*) filter (where is_published = true)
  into private_count, public_count from app.areas where wp_term_id = any(array[${sqlIdList(areas)}]);
  if private_count + public_count <> ${areas.length} or (private_count <> 0 and private_count <> ${areas.length}) then raise exception 'area execution precondition changed'; end if;
  select count(*) filter (where is_public = false and verified_at is null), count(*) filter (where is_public = true and verified_at is not null)
  into private_count, public_count from app.shop_images where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]);
  if private_count + public_count <> ${imageWpMediaIds.length} or (private_count <> 0 and private_count <> ${imageWpMediaIds.length}) then raise exception 'image execution precondition changed'; end if;
  select count(*) into actual_count from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]);
  if actual_count = 0 then
    insert into app.contents(id, route_key, content_type, source_type, title, body_html, body_text, publication_status, published_at)
    values
      ${pageValues};
  elsif actual_count <> ${routes.length} or exists (select 1 from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status <> 'published') then
    raise exception 'fixed-page execution precondition changed';
  end if;
  update app.shops set publication_status = 'published', published_at = now() where wp_post_id = any(array[${sqlIdList(shops)}]) and publication_status = 'draft';
  update app.areas set is_published = true, published_at = now() where wp_term_id = any(array[${sqlIdList(areas)}]) and is_published = false;
  update app.shop_images set is_public = true, verified_at = now() where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]) and is_public = false;
end
$$;
${transactionMode === "script" ? "commit;" : ""}
`;
}

export function renderExecutionRollbackSql({ plan, approval, transactionMode = "script" }) {
  if (transactionMode !== "script" && transactionMode !== "caller") throw new Error("transactionMode must be script or caller");
  const gate = requireLocalFixtureApproval(plan, approval);
  const { shops, areas, imageWpMediaIds } = plan.sourceManifest.publicTargets;
  const routes = plan.pages.map((page) => page.routeKey);
  return `-- Local-fixture-only conditional rollback. It removes only the six inserted page records.
${transactionMode === "script" ? "begin;" : ""}
do $$
declare actual_count integer;
begin${renderFixtureGate(plan, gate)}
  select count(*) into actual_count from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status = 'published';
  if actual_count <> ${routes.length} then raise exception 'rollback requires all six exact inserted page records'; end if;
  select count(*) into actual_count from app.shops where wp_post_id = any(array[${sqlIdList(shops)}]) and publication_status = 'published';
  if actual_count <> ${shops.length} then raise exception 'rollback requires every shop target to remain published'; end if;
  select count(*) into actual_count from app.areas where wp_term_id = any(array[${sqlIdList(areas)}]) and is_published;
  if actual_count <> ${areas.length} then raise exception 'rollback requires every area target to remain published'; end if;
  select count(*) into actual_count from app.shop_images where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]) and is_public;
  if actual_count <> ${imageWpMediaIds.length} then raise exception 'rollback requires every image target to remain public'; end if;

  delete from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status = 'published';
  update app.shops set publication_status = 'draft', published_at = null where wp_post_id = any(array[${sqlIdList(shops)}]);
  update app.areas set is_published = false, published_at = null where wp_term_id = any(array[${sqlIdList(areas)}]);
  update app.shop_images set is_public = false, verified_at = null where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]);
end
$$;
${transactionMode === "script" ? "commit;" : ""}
`;
}

export function renderProductionExecutionApplySql({ plan, approval, transactionMode = "script" }) {
  if (transactionMode !== "script" && transactionMode !== "caller") throw new Error("transactionMode must be script or caller");
  const approved = requireProductionApproval(plan, approval);
  const { shops, areas, imageWpMediaIds } = plan.sourceManifest.publicTargets;
  const routes = plan.pages.map((page) => page.routeKey);
  const pageValues = renderPageValues(plan.pages);
  return `-- Production-only execution. Generated only from a separately approved execution object; never from the proposed manifest alone.
${transactionMode === "script" ? "begin;" : ""}
set local statement_timeout = '60s';
do $$
declare actual_count integer; private_count integer; public_count integer;
begin${renderProductionGate(plan, approved)}
  select count(*) filter (where publication_status = 'draft' and published_at is null), count(*) filter (where publication_status = 'published') into private_count, public_count from app.shops where wp_post_id = any(array[${sqlIdList(shops)}]);
  if private_count + public_count <> ${shops.length} or (private_count <> 0 and private_count <> ${shops.length}) then raise exception 'shop execution precondition changed'; end if;
  select count(*) filter (where is_published = false and published_at is null), count(*) filter (where is_published = true) into private_count, public_count from app.areas where wp_term_id = any(array[${sqlIdList(areas)}]);
  if private_count + public_count <> ${areas.length} or (private_count <> 0 and private_count <> ${areas.length}) then raise exception 'area execution precondition changed'; end if;
  select count(*) filter (where is_public = false and verified_at is null), count(*) filter (where is_public = true and verified_at is not null) into private_count, public_count from app.shop_images where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]);
  if private_count + public_count <> ${imageWpMediaIds.length} or (private_count <> 0 and private_count <> ${imageWpMediaIds.length}) then raise exception 'image execution precondition changed'; end if;
  select count(*) into actual_count from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]);
  if actual_count = 0 then insert into app.contents(id, route_key, content_type, source_type, title, body_html, body_text, publication_status, published_at) values ${pageValues};
  elsif actual_count <> ${routes.length} or exists (select 1 from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status <> 'published') then raise exception 'fixed-page execution precondition changed'; end if;
  update app.shops set publication_status = 'published', published_at = now() where wp_post_id = any(array[${sqlIdList(shops)}]) and publication_status = 'draft';
  update app.areas set is_published = true, published_at = now() where wp_term_id = any(array[${sqlIdList(areas)}]) and is_published = false;
  update app.shop_images set is_public = true, verified_at = now() where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]) and is_public = false;
end
$$;
${transactionMode === "script" ? "commit;" : ""}
`;
}

export function renderProductionExecutionRollbackSql({ plan, approval, transactionMode = "script" }) {
  if (transactionMode !== "script" && transactionMode !== "caller") throw new Error("transactionMode must be script or caller");
  const approved = requireProductionApproval(plan, approval);
  const { shops, areas, imageWpMediaIds } = plan.sourceManifest.publicTargets;
  const routes = plan.pages.map((page) => page.routeKey);
  return `-- Production-only conditional rollback. It refuses partial or drifted targets.
${transactionMode === "script" ? "begin;" : ""}
set local statement_timeout = '60s';
do $$
declare actual_count integer;
begin${renderProductionGate(plan, approved)}
  select count(*) into actual_count from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status = 'published';
  if actual_count <> ${routes.length} then raise exception 'rollback requires all six exact inserted page records'; end if;
  select count(*) into actual_count from app.shops where wp_post_id = any(array[${sqlIdList(shops)}]) and publication_status = 'published';
  if actual_count <> ${shops.length} then raise exception 'rollback requires every shop target to remain published'; end if;
  select count(*) into actual_count from app.areas where wp_term_id = any(array[${sqlIdList(areas)}]) and is_published;
  if actual_count <> ${areas.length} then raise exception 'rollback requires every area target to remain published'; end if;
  select count(*) into actual_count from app.shop_images where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]) and is_public;
  if actual_count <> ${imageWpMediaIds.length} then raise exception 'rollback requires every image target to remain public'; end if;
  delete from app.contents where route_key = any(array[${routes.map(quoteSql).join(", ")}]) and publication_status = 'published';
  update app.shops set publication_status = 'draft', published_at = null where wp_post_id = any(array[${sqlIdList(shops)}]);
  update app.areas set is_published = false, published_at = null where wp_term_id = any(array[${sqlIdList(areas)}]);
  update app.shop_images set is_public = false, verified_at = null where wp_media_id = any(array[${sqlIdList(imageWpMediaIds)}]);
end
$$;
${transactionMode === "script" ? "commit;" : ""}
`;
}
