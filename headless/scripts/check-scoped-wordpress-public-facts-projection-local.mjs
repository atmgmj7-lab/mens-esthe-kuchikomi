import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(resolve(projectRoot, "supabase/migrations/20261022182857_scoped_wordpress_public_facts_projection.sql"), "utf8");
const sql = `
begin;
${migration}
do $$ begin
  if exists (select 1 from app.shops where wp_post_id in (5070, 99995070)) then
    raise exception 'fixture WordPress identity already exists';
  end if;
end $$;
insert into app.shops (wp_post_id, slug, canonical_path, name, description_html, excerpt, official_url, phone, address_text, access_text, booking_url, legacy_payload, publication_status, published_at)
values
  (5070, 'fixture-allowed-public-facts', '/shops/fixture-allowed-public-facts/', 'Allowed fixture', '', '', 'https://example.test/', '090-0000-0000', '大阪府大阪市', '駅から徒歩1分', 'https://example.test/reserve', '{"shop_hours":"11:00〜翌6:00","shop_booking":"電話","basic_price":16000}', 'published', now()),
  (99995070, 'fixture-not-allowed-public-facts', '/shops/fixture-not-allowed-public-facts/', 'Not allowed fixture', '', '', null, '090-9999-9999', '非公開のfixture住所', '非公開のfixtureアクセス', 'https://example.test/private', '{"shop_hours":"00:00","shop_booking":"non-public","basic_price":99999}', 'published', now());
do $$
declare allowed jsonb; ordinary jsonb;
begin
  select item into allowed
  from jsonb_array_elements(api.get_public_site_directory_v1()->'shops') item
  where (item->>'legacy_wp_shop_id')::bigint = 5070;
  select item into ordinary
  from jsonb_array_elements(api.get_public_site_directory_v1()->'shops') item
  where (item->>'legacy_wp_shop_id')::bigint = 99995070;
  if allowed is null then raise exception 'allowlisted fixture missing from directory'; end if;
  if allowed->'legacy_public_facts' <> jsonb_build_object('shop_tel','090-0000-0000','shop_address','大阪府大阪市','shop_access','駅から徒歩1分','shop_booking_url','https://example.test/reserve','shop_hours','11:00〜翌6:00','shop_booking','電話','basic_price',16000) then
    raise exception 'allowlisted fixture facts were not exact';
  end if;
  if ordinary is null then raise exception 'ordinary fixture missing from directory'; end if;
  if ordinary ? 'legacy_public_facts' then raise exception 'non-allowlisted fixture received facts'; end if;
  if allowed ? 'legacy_payload' or ordinary ? 'legacy_payload' then raise exception 'private metadata leaked'; end if;
end $$;
rollback;
`;

const run = spawnSync("docker", ["exec", "-i", "supabase_db_mens-esthe-kuchikomi", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { encoding: "utf8", input: sql });
assert.equal(run.status, 0, run.stderr || run.stdout);
assert.match(run.stdout, /ROLLBACK/u, "the fixture must roll back all temporary rows and the function replacement");
console.log("Scoped WordPress public-facts local fixture: PASS");
