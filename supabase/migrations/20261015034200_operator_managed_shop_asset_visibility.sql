-- An approved asset becomes publicly retrievable only while its store itself
-- is published. Unlisting is reversible and must immediately close the proxy.
create or replace function api.get_published_managed_shop_asset(p_asset_id uuid)
returns table(object_key text,content_type text) language sql security invoker set search_path=private,pg_temp as $$
  select a.object_key,a.content_type
  from private.managed_shop_assets a
  join private.managed_shop_publications p on p.managed_shop_id=a.managed_shop_id
  join private.managed_shops s on s.id=a.managed_shop_id
  where a.id=p_asset_id and s.publication_state='published'
    and (p.banner_asset_id=a.id or a.id=any(p.gallery_asset_ids))
  limit 1
$$;

revoke all on function api.get_published_managed_shop_asset(uuid) from public,anon,authenticated;
grant execute on function api.get_published_managed_shop_asset(uuid) to service_role;

notify pgrst, 'reload schema';
