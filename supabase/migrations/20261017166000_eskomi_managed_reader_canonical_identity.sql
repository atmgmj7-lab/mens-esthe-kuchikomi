-- The public managed-directory reader carries the immutable app.shops UUID so
-- ordering never falls back to a synthetic directory number for new stores.
drop function if exists api.list_published_managed_shops();
create function api.list_published_managed_shops()
returns table(managed_shop_id uuid,app_shop_id uuid,directory_id bigint,existing_wp_shop_id bigint,shop_slug text,canonical_url text,approved_revision integer,shop_name text,area_slug text,area_name text,official_url text,introduction text,address text,business_hours text,phone text,line_url text,booking_url text,basic_price integer,price_90 integer,banner_asset_id uuid,gallery_asset_ids uuid[])
language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.managed_shop_id,managed.app_shop_id,publication.directory_id,publication.existing_wp_shop_id,publication.shop_slug,publication.canonical_url,publication.approved_revision,publication.shop_name,publication.area_slug,publication.area_name,publication.official_url,publication.introduction,publication.address,publication.business_hours,publication.phone,publication.line_url,publication.booking_url,publication.basic_price,publication.price_90,publication.banner_asset_id,publication.gallery_asset_ids
  from private.managed_shop_publications publication
  join private.managed_shops managed on managed.id=publication.managed_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where managed.publication_state='published' and (managed.app_shop_id is null or shop.publication_status='published')
  order by publication.shop_slug
$$;
revoke all on function api.list_published_managed_shops() from public,anon,authenticated;
grant execute on function api.list_published_managed_shops() to service_role;
notify pgrst,'reload schema';
