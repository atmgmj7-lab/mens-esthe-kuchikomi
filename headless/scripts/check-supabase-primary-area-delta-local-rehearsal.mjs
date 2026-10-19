import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildSourceGroundedPrimaryAreaPlan,
  renderPrimaryAreaDeltaRollbackSql,
  renderPrimaryAreaDeltaSql
} from "./lib/supabase-primary-area-delta.mjs";

const migrationPath = fileURLToPath(new URL("../../supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");
const batchId = "94000000-0000-4000-8000-000000000001";
const plan = buildSourceGroundedPrimaryAreaPlan({
  sourceShops: [
    { id: 940000000001, status: "publish", area: [940000000011, 940000000012], acf: { shop_primary_area_term_id: 940000000011 }, modified_gmt: "2026-10-19T00:00:00" },
    { id: 940000000002, status: "publish", area: [940000000011], acf: { shop_primary_area_term_id: 940000000011 }, modified_gmt: "2026-10-19T00:00:00" }
  ],
  candidateWpIds: [940000000001],
  reviewRequiredWpIds: [],
  unlistedManagedWpIds: [940000000002]
});
const options = { plan, batchId, sourceLabel: "20261019-primary-area-local-rehearsal", transactionMode: "caller" };
const applySql = renderPrimaryAreaDeltaSql(options);
const rollbackSql = renderPrimaryAreaDeltaRollbackSql(options);

const fixture = `
begin;

${migration}

do $$
declare
  primary_area_id uuid := '94000000-0000-4000-8000-000000000011';
  secondary_area_id uuid := '94000000-0000-4000-8000-000000000012';
  candidate_shop_id uuid := '94000000-0000-4000-8000-000000000021';
  unlisted_shop_id uuid := '94000000-0000-4000-8000-000000000022';
begin
  insert into app.areas(id, wp_term_id, slug, name, is_published)
  values
    (primary_area_id, 940000000011, 'primary-delta-local', '主エリア', false),
    (secondary_area_id, 940000000012, 'secondary-delta-local', '副エリア', false);
  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status)
  values
    (candidate_shop_id, 940000000001, 'primary-delta-local', '/shops/primary-delta-local/', '主エリア検証店舗', '<p>検証</p>', '検証', 'draft'),
    (unlisted_shop_id, 940000000002, 'primary-delta-unlisted', '/shops/primary-delta-unlisted/', '非掲載検証店舗', '<p>非掲載</p>', '非掲載', 'draft');
  insert into app.shop_areas(shop_id, area_id, is_primary)
  values
    (candidate_shop_id, primary_area_id, false),
    (candidate_shop_id, secondary_area_id, false),
    (unlisted_shop_id, primary_area_id, true);
  insert into private.managed_shops(id, existing_wp_shop_id, existing_shop_slug, shop_slug, publication_state)
  values ('94000000-0000-4000-8000-000000000031', 940000000002, 'primary-delta-unlisted', 'primary-delta-unlisted', 'unlisted');
  insert into app.shop_images(shop_id, wp_media_id, image_url, image_role, sort_order, is_public)
  select candidate_shop_id, 940000100000 + series, 'https://fixture.invalid/wordpress-media/' || series || '.png', 'gallery', series, false
  from generate_series(1, 241) as series;
end
$$;

create temporary table primary_area_delta_image_snapshot on commit drop as
select coalesce(jsonb_agg(jsonb_build_object('id', id, 'shop_id', shop_id, 'wp_media_id', wp_media_id, 'image_url', image_url, 'is_public', is_public) order by id), '[]'::jsonb) as payload
from app.shop_images;

${applySql}

do $$
declare
  target_primary_count integer;
  audit_count integer;
begin
  select count(*) into target_primary_count
  from app.shop_areas relation
  join app.shops shop on shop.id = relation.shop_id
  where shop.wp_post_id = 940000000001 and relation.is_primary;
  if target_primary_count <> 1 then raise exception 'first apply did not set exactly one primary relation'; end if;
  select count(*) into audit_count from private.import_records where batch_id = '${batchId}'::uuid and entity_type = 'shop-primary-area';
  if audit_count <> 1 then raise exception 'first apply audit row count mismatch: %', audit_count; end if;
end
$$;

${applySql}

do $$
declare
  target_primary_count integer;
  audit_count integer;
begin
  select count(*) into target_primary_count
  from app.shop_areas relation join app.shops shop on shop.id = relation.shop_id
  where shop.wp_post_id = 940000000001 and relation.is_primary;
  select count(*) into audit_count from private.import_records where batch_id = '${batchId}'::uuid and entity_type = 'shop-primary-area';
  if target_primary_count <> 1 or audit_count <> 1 then raise exception 'repeat apply changed primary or audit cardinality'; end if;
  if (select payload from primary_area_delta_image_snapshot) <> (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'shop_id', shop_id, 'wp_media_id', wp_media_id, 'image_url', image_url, 'is_public', is_public) order by id), '[]'::jsonb) from app.shop_images
  ) then raise exception 'repeat apply changed preserved image UUIDs or URLs'; end if;
end
$$;

${rollbackSql}

do $$
begin
  if exists (
    select 1 from app.shop_areas relation join app.shops shop on shop.id = relation.shop_id
    where shop.wp_post_id = 940000000001 and relation.is_primary
  ) then raise exception 'rollback did not restore no-primary state'; end if;
  if (select payload from primary_area_delta_image_snapshot) <> (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'shop_id', shop_id, 'wp_media_id', wp_media_id, 'image_url', image_url, 'is_public', is_public) order by id), '[]'::jsonb) from app.shop_images
  ) then raise exception 'rollback changed preserved image UUIDs or URLs'; end if;
end
$$;

${applySql}

do $$
declare
  payload jsonb;
begin
  -- This promotion is local fixture setup only. The delta itself is asserted above
  -- to require draft shops and unpublished areas.
  update app.shops set publication_status = 'published', published_at = now() where wp_post_id in (940000000001, 940000000002);
  update app.areas set is_published = true, published_at = now() where wp_term_id = 940000000011;
  set local role anon;
  select api.get_public_site_directory_v1() into payload;
  reset role;
  if not (payload->'shops' @> '[{"slug":"primary-delta-local","canonical_path":"/shops/primary-delta-local/"}]'::jsonb)
    or payload->'shops' @> '[{"slug":"primary-delta-unlisted"}]'::jsonb then
    raise exception 'public RPC listing/detail/sitemap projection mismatch: %', payload->'shops';
  end if;
  if not (payload->'areas' @> '[{"slug":"primary-delta-local"}]'::jsonb) then
    raise exception 'public RPC area listing projection is absent';
  end if;
  -- The canonical path is the sole shop route consumed by list, detail, and sitemap readers.
  if not exists (
    select 1 from jsonb_array_elements(payload->'shops') item
    where item->>'canonical_path' = '/shops/primary-delta-local/'
  ) then raise exception 'public sitemap canonical path is absent'; end if;

  update app.shops set publication_status = 'draft', published_at = null where wp_post_id in (940000000001, 940000000002);
  update app.areas set is_published = false, published_at = null where wp_term_id = 940000000011;
end
$$;

${rollbackSql}

do $$
begin
  if exists (
    select 1 from app.shop_areas relation join app.shops shop on shop.id = relation.shop_id
    where shop.wp_post_id = 940000000001 and relation.is_primary
  ) then raise exception 'final rollback did not restore no-primary state'; end if;
  if (select payload from primary_area_delta_image_snapshot) <> (
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'shop_id', shop_id, 'wp_media_id', wp_media_id, 'image_url', image_url, 'is_public', is_public) order by id), '[]'::jsonb) from app.shop_images
  ) then raise exception 'final rollback changed preserved image UUIDs or URLs'; end if;
end
$$;

rollback;
`;

const result = spawnSync(
  "docker",
  ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: fixture, encoding: "utf8" }
);
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.match(result.stdout, /ROLLBACK/, "local rehearsal must finish by rolling back the whole fixture transaction");
console.log("Supabase primary area delta local apply/reapply/RPC/restore rehearsal: PASS");
