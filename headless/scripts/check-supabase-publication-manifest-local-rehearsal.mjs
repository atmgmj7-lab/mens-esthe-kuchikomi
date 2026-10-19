import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { buildProposedPublicationManifestArtifact } from "./prepare-supabase-publication-manifest.mjs";
import {
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} from "./lib/supabase-publication-manifest.mjs";

const artifact = buildProposedPublicationManifestArtifact("20261019-publication-manifest-local-rehearsal");
const callerOptions = { manifest: artifact.manifest, sourceLabel: "20261019-publication-manifest-local-rehearsal", transactionMode: "caller" };
const preflightSql = renderPublicationManifestPreflightSql(callerOptions);
const restoreSql = renderPublicationManifestRestoreSql(callerOptions);
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
${restoreSql}

rollback;
`;

const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: fixture, encoding: "utf8" }
);
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /ROLLBACK/, "manifest rehearsal must roll back its entire local fixture transaction");
console.log("Supabase proposed publication manifest local preflight/restore rehearsal: PASS");
