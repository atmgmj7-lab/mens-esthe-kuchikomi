import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { buildProposedPublicationManifestArtifact } from "./prepare-supabase-publication-manifest.mjs";
import {
  buildLocalFixtureApproval,
  renderApprovedFixtureApplySql,
  renderApprovedFixtureRestoreSql,
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} from "./lib/supabase-publication-manifest.mjs";

const artifact = buildProposedPublicationManifestArtifact("20261019-publication-manifest-local-rehearsal");
const callerOptions = { manifest: artifact.manifest, sourceLabel: "20261019-publication-manifest-local-rehearsal", transactionMode: "caller" };
const preflightSql = renderPublicationManifestPreflightSql(callerOptions);
const restoreSql = renderPublicationManifestRestoreSql(callerOptions);
const proposalId = "20261019-publication-manifest-v4";
const approval = buildLocalFixtureApproval({ manifest: artifact.manifest, proposalId, approvalId: "20261019-publication-manifest-v4-local-fixture" });
const applySql = renderApprovedFixtureApplySql({ manifest: artifact.manifest, proposalId, approval, transactionMode: "caller" });
const approvedRestoreSql = renderApprovedFixtureRestoreSql({ manifest: artifact.manifest, proposalId, approval, transactionMode: "caller" });
const candidateIds = artifact.manifest.candidateWpIds.join(", ");
const areaTermIds = artifact.manifest.publicTargets.areas.join(", ");
const imageWpMediaIds = artifact.manifest.publicTargets.imageWpMediaIds.join(", ");

const fixture = `
begin;

do $$
declare
begin
  insert into app.areas(id, wp_term_id, slug, name, is_published)
  select
    ('96000000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid,
    wp_term_id,
    'manifest-area-' || wp_term_id,
    'manifest area ' || wp_term_id,
    false
  from unnest(array[${areaTermIds}]::bigint[]) with ordinality as source(wp_term_id, ordinality);

  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status)
  select
    ('95000000-0000-4000-8000-' || lpad(ordinality::text, 12, '0'))::uuid,
    wp_post_id,
    'manifest-local-' || wp_post_id,
    '/shops/manifest-local-' || wp_post_id || '/',
    'manifest fixture ' || wp_post_id,
    '', '', 'draft'
  from unnest(array[${candidateIds}]::bigint[]) with ordinality as source(wp_post_id, ordinality);

  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status)
  values
    ('95000000-0000-4000-8000-000000000401', 1272, 'manifest-local-unlisted', '/shops/manifest-local-unlisted/', 'managed unlisted', '', '', 'draft'),
    ('95000000-0000-4000-8000-000000000402', 1255, 'manifest-local-draft-a', '/shops/manifest-local-draft-a/', 'retained draft a', '', '', 'draft'),
    ('95000000-0000-4000-8000-000000000403', 1259, 'manifest-local-draft-b', '/shops/manifest-local-draft-b/', 'retained draft b', '', '', 'draft');

  insert into private.managed_shops(id, existing_wp_shop_id, existing_shop_slug, shop_slug, publication_state)
  values ('95000000-0000-4000-8000-000000000404', 1272, 'manifest-local-unlisted', 'manifest-local-unlisted', 'unlisted');

  insert into app.shop_images(shop_id, wp_media_id, image_url, image_role, sort_order, is_public)
  select '95000000-0000-4000-8000-000000000001'::uuid, wp_media_id,
    'https://fixture.invalid/manifest/' || wp_media_id || '.png', 'gallery', ordinality, false
  from unnest(array[${imageWpMediaIds}]::bigint[]) with ordinality as source(wp_media_id, ordinality);
end
$$;

${preflightSql}
set local eskomi.publication_manifest_mode = 'local-fixture';
set local eskomi.publication_manifest_approval = '${approval.approvalId}';
set local eskomi.publication_manifest_proposal_sha256 = '${approval.proposalSha256}';
${applySql}
${applySql}
do $$
begin
  if (select count(*) from app.shops where wp_post_id = any(array[${candidateIds}]) and publication_status = 'published') <> ${artifact.manifest.publicTargets.shops.length} then raise exception 'fixture apply did not publish every shop'; end if;
  if (select count(*) from app.areas where wp_term_id = any(array[${areaTermIds}]) and is_published) <> ${artifact.manifest.publicTargets.areas.length} then raise exception 'fixture apply did not publish every area'; end if;
  if (select count(*) from app.shop_images where wp_media_id = any(array[${imageWpMediaIds}]) and is_public) <> ${artifact.manifest.publicTargets.imageWpMediaIds.length} then raise exception 'fixture apply did not publish every image'; end if;
end $$;
${approvedRestoreSql}
${restoreSql}

rollback;
`;

const denied = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: `begin;\n${applySql}\nrollback;\n`, encoding: "utf8" }
);
assert.notEqual(denied.status, 0, "an apply without the local-fixture gate must fail closed");
assert.match(`${denied.stdout}\n${denied.stderr}`, /restricted to an explicit local fixture transaction/i);

const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: fixture, encoding: "utf8" }
);
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /ROLLBACK/, "manifest rehearsal must roll back its entire local fixture transaction");
console.log("Supabase local-fixture approved apply, idempotence, conditional restore, and rollback rehearsal: PASS");
