-- The operator needs a minimal, non-public projection for stores created
-- directly in Web management. Those stores have no WordPress identity, so the
-- legacy-only state reader cannot make an archived record restorable.
create or replace function api.list_managed_shop_nonpublic_listing_states()
returns table(
  managed_shop_id uuid,directory_id bigint,existing_wp_shop_id bigint,shop_slug text,
  canonical_url text,approved_revision integer,shop_name text,area_slug text,area_name text,
  official_url text,publication_state text
) language sql security invoker set search_path=private,pg_temp as $$
  select p.managed_shop_id,p.directory_id,p.existing_wp_shop_id,p.shop_slug,
    p.canonical_url,p.approved_revision,p.shop_name,p.area_slug,p.area_name,
    p.official_url,s.publication_state
  from private.managed_shop_publications p
  join private.managed_shops s on s.id=p.managed_shop_id
  where s.publication_state in ('unlisted','deleted')
  order by p.directory_id
$$;

revoke all on function api.list_managed_shop_nonpublic_listing_states() from public,anon,authenticated;
grant execute on function api.list_managed_shop_nonpublic_listing_states() to service_role;

notify pgrst, 'reload schema';
