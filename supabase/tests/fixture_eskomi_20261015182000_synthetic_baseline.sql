-- Repository-schema plus synthetic data only. This is not a production dump,
-- backup, snapshot, export, or anonymized copy of production data.
begin;

insert into app.shops(slug,canonical_path,name,publication_status,published_at)
select
  'synthetic-shop-' || value,
  '/shops/synthetic-shop-' || value || '/',
  'Synthetic shop ' || value,
  'published',
  now()
from generate_series(1,381) as value;

insert into app.shops(slug,canonical_path,name,publication_status,published_at)
values ('synthetic-pilot-768','/shops/synthetic-pilot-768/','Synthetic pilot 768','draft',null);

insert into private.partner_workspaces(wp_shop_id,shop_slug,shop_name,canonical_url,state)
values
  (725,'synthetic-legacy-725','Synthetic legacy 725','https://mens-esthe-kuchikomi.com/shops/synthetic-legacy-725/','free_official_partner'),
  (766,'synthetic-legacy-766','Synthetic legacy 766','https://mens-esthe-kuchikomi.com/shops/synthetic-legacy-766/','free_official_partner'),
  (768,'synthetic-pilot-768','Synthetic pilot 768','https://mens-esthe-kuchikomi.com/shops/synthetic-pilot-768/','free_official_partner');

-- No legacy/native review rows and no managed-shop rows are inserted. This
-- deliberately reproduces only the observed zero-review/no-exact-managed-match
-- shape using synthetic values.
commit;
