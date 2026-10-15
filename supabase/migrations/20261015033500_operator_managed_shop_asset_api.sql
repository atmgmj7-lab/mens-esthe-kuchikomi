-- Server-only wrappers for the generalized directory's private image flow.
create or replace function api.attach_managed_shop_asset(
  p_managed_shop_id uuid,p_asset_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer,p_actor_label text
) returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.attach_managed_shop_asset(p_managed_shop_id,p_asset_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height,p_actor_label)
$$;

create or replace function api.get_published_managed_shop_asset(p_asset_id uuid)
returns table(object_key text,content_type text) language sql security invoker set search_path=private,pg_temp as $$
  select a.object_key,a.content_type
  from private.managed_shop_assets a
  join private.managed_shop_publications p on p.managed_shop_id=a.managed_shop_id
  where a.id=p_asset_id and (p.banner_asset_id=a.id or a.id=any(p.gallery_asset_ids))
  limit 1
$$;

revoke all on function api.attach_managed_shop_asset(uuid,uuid,text,text,text,integer,integer,integer,text) from public,anon,authenticated;
revoke all on function api.get_published_managed_shop_asset(uuid) from public,anon,authenticated;
grant execute on function api.attach_managed_shop_asset(uuid,uuid,text,text,text,integer,integer,integer,text) to service_role;
grant execute on function api.get_published_managed_shop_asset(uuid) to service_role;

notify pgrst, 'reload schema';
