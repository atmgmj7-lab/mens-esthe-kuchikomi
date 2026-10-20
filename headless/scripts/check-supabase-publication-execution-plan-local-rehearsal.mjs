import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { buildProposedPublicationManifestArtifact } from "./prepare-supabase-publication-manifest.mjs";
import {
  buildPublicationExecutionPlan,
  buildLocalFixtureExecutionApproval,
  renderExecutionApplySql,
  renderExecutionRollbackSql
} from "./lib/supabase-publication-execution-plan.mjs";

const artifact = buildProposedPublicationManifestArtifact("20261020-publication-execution-local-rehearsal");
const pageInputs = artifact.manifest.publicTargets.pages.map((route) => ({
  contentId: `98100000-0000-4000-8000-${String(artifact.manifest.publicTargets.pages.indexOf(route) + 1).padStart(12, "0")}`,
  routeKey: route,
  title: `Local fixture ${route}`,
  bodyHtml: route === "/osaka-nihonbashi/" ? '<p><img src="https://fixture.invalid/storage/357.png"></p>' : `<p>${route}</p>`,
  bodyText: route,
  source: route === "/advertise/" ? "application-fallback" : "wordpress-readonly",
  sourceId: route === "/advertise/" ? null : 990000000000 + artifact.manifest.publicTargets.pages.indexOf(route),
  sourceModified: route === "/advertise/" ? null : "2026-10-20T00:00:00Z"
}));
const plan = buildPublicationExecutionPlan({
  publicationManifest: artifact.manifest,
  pageInputs,
  fixedPageMedia: { wpMediaId: 357, sourceSha256: "b".repeat(64), targetUrl: "https://fixture.invalid/storage/357.png", referencedByRoute: "/osaka-nihonbashi/" }
});
const approval = buildLocalFixtureExecutionApproval({ plan, proposalId: "publication-execution-v1", approvalId: "publication-execution-v1-local-fixture" });
const applySql = renderExecutionApplySql({ plan, approval, transactionMode: "caller" });
const rollbackSql = renderExecutionRollbackSql({ plan, approval, transactionMode: "caller" });
const shopIds = plan.sourceManifest.publicTargets.shops.join(", ");
const areaIds = plan.sourceManifest.publicTargets.areas.join(", ");
const imageIds = plan.sourceManifest.publicTargets.imageWpMediaIds.join(", ");

const fixture = `
begin;
do $$
begin
  insert into app.areas(id, wp_term_id, slug, name, is_published)
  select ('97000000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid, wp_term_id, 'execution-area-' || wp_term_id, 'execution area ' || wp_term_id, false
  from unnest(array[${areaIds}]::bigint[]) with ordinality as source(wp_term_id, ordinality);
  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status)
  select ('97100000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid, wp_post_id, 'execution-shop-' || wp_post_id, '/shops/execution-shop-' || wp_post_id || '/', 'execution shop ' || wp_post_id, '', '', 'draft'
  from unnest(array[${shopIds}]::bigint[]) with ordinality as source(wp_post_id, ordinality);
  insert into app.shop_images(shop_id, wp_media_id, image_url, image_role, sort_order, is_public)
  select '97100000-0000-4000-8000-000000000001'::uuid, wp_media_id, 'https://fixture.invalid/shop/' || wp_media_id || '.png', 'gallery', ordinality, false
  from unnest(array[${imageIds}]::bigint[]) with ordinality as source(wp_media_id, ordinality);
end
$$;
set local eskomi.publication_manifest_mode = 'local-fixture';
set local eskomi.publication_manifest_approval = '${approval.approvalId}';
set local eskomi.publication_manifest_proposal_sha256 = '${approval.proposalSha256}';
set local eskomi.fixed_page_media_357_verified = '${plan.fixedPageMedia.sourceSha256}';
${applySql}
${applySql}
do $$
begin
  if (select count(*) from app.shops where wp_post_id = any(array[${shopIds}]) and publication_status = 'published') <> ${plan.sourceManifest.publicTargets.shops.length} then raise exception 'shops not fully published'; end if;
  if (select count(*) from app.areas where wp_term_id = any(array[${areaIds}]) and is_published) <> ${plan.sourceManifest.publicTargets.areas.length} then raise exception 'areas not fully published'; end if;
  if (select count(*) from app.shop_images where wp_media_id = any(array[${imageIds}]) and is_public) <> ${plan.sourceManifest.publicTargets.imageWpMediaIds.length} then raise exception 'images not fully published'; end if;
  if (select count(*) from app.contents where route_key = any(array['/about/','/advertise/','/contact/','/osaka-nihonbashi/','/sitemap/','/storelisting/']) and publication_status = 'published') <> 6 then raise exception 'fixed pages not fully inserted'; end if;
end
$$;
${rollbackSql}
do $$
begin
  if exists (select 1 from app.contents where route_key = any(array['/about/','/advertise/','/contact/','/osaka-nihonbashi/','/sitemap/','/storelisting/'])) then raise exception 'rollback left a fixed page'; end if;
  if (select count(*) from app.shops where wp_post_id = any(array[${shopIds}]) and publication_status = 'draft' and published_at is null) <> ${plan.sourceManifest.publicTargets.shops.length} then raise exception 'rollback did not restore shops'; end if;
  if (select count(*) from app.areas where wp_term_id = any(array[${areaIds}]) and not is_published and published_at is null) <> ${plan.sourceManifest.publicTargets.areas.length} then raise exception 'rollback did not restore areas'; end if;
  if (select count(*) from app.shop_images where wp_media_id = any(array[${imageIds}]) and not is_public) <> ${plan.sourceManifest.publicTargets.imageWpMediaIds.length} then raise exception 'rollback did not restore image flags'; end if;
end
$$;
rollback;
`;

const denied = spawnSync("docker", ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: `begin;\n${applySql}\nrollback;\n`, encoding: "utf8" });
assert.notEqual(denied.status, 0, "a missing local fixture gate must fail closed");
assert.match(`${denied.stdout}\n${denied.stderr}`, /restricted to an explicit local fixture/i);

const result = spawnSync("docker", ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: fixture, encoding: "utf8" });
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /ROLLBACK/, "the integrated execution rehearsal must end by rolling back");
console.log("Supabase publication execution-plan apply/reapply/rollback rehearsal: PASS");
