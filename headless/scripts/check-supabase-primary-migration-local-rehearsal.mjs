import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(new URL("../../supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");
const fixture = `
begin;

${migration}

do $$
declare
  visible_area_id uuid := '93000000-0000-4000-8000-000000000001';
  visible_shop_id uuid := '93000000-0000-4000-8000-000000000002';
  unlisted_shop_id uuid := '93000000-0000-4000-8000-000000000003';
  managed_id uuid := '93000000-0000-4000-8000-000000000004';
  payload jsonb;
begin
  insert into app.areas(id, slug, name, is_published, published_at)
  values (visible_area_id, 'delta-local-area', '差分ローカル地域', true, now());
  insert into app.shops(id, wp_post_id, slug, canonical_path, name, description_html, excerpt, publication_status, published_at)
  values
    (visible_shop_id, 930000000001, 'delta-local-visible', '/shops/delta-local-visible/', '差分公開店舗', '<p>公開</p>', '公開', 'published', now()),
    (unlisted_shop_id, 930000000002, 'delta-local-unlisted', '/shops/delta-local-unlisted/', '差分非掲載店舗', '<p>非掲載</p>', '非掲載', 'published', now());
  insert into app.shop_areas(shop_id, area_id, is_primary)
  values (visible_shop_id, visible_area_id, true), (unlisted_shop_id, visible_area_id, true);
  insert into private.managed_shops(id, existing_wp_shop_id, existing_shop_slug, shop_slug, publication_state)
  values (managed_id, 930000000002, 'delta-local-unlisted', 'delta-local-unlisted', 'unlisted');

  set local role anon;
  select api.get_public_site_directory_v1() into payload;
  reset role;

  if not (payload->'shops' @> '[{"slug":"delta-local-visible"}]'::jsonb)
    or payload->'shops' @> '[{"slug":"delta-local-unlisted"}]'::jsonb then
    raise exception 'primary directory did not preserve managed unlisting: %', payload->'shops';
  end if;
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
assert.match(result.stdout, /BEGIN[\s\S]*CREATE FUNCTION[\s\S]*ROLLBACK/, "migration rehearsal must apply and roll back on the preserved local fixture");
console.log("Supabase primary migration local apply/rollback rehearsal: PASS");
