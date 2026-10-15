-- PostgREST exposes only api. Keep the private banner workflow inaccessible to
-- browser roles while giving the Next.js server its narrow service-role bridge.
create or replace function api.reserve_partner_listing_banner_upload(
  p_workspace_id uuid, p_content_type text
) returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.reserve_partner_listing_banner_upload(p_workspace_id,p_content_type)
$$;

create or replace function api.attach_partner_listing_banner_asset(
  p_workspace_id uuid, p_object_key text, p_sha256 text, p_content_type text,
  p_byte_size integer, p_width integer, p_height integer
) returns uuid language sql security invoker set search_path=private,pg_temp as $$
  select private.attach_partner_listing_banner_asset(
    p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height
  )
$$;

revoke all on function api.reserve_partner_listing_banner_upload(uuid,text) from public,anon,authenticated;
revoke all on function api.attach_partner_listing_banner_asset(uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function api.reserve_partner_listing_banner_upload(uuid,text) to service_role;
grant execute on function api.attach_partner_listing_banner_asset(uuid,text,text,text,integer,integer,integer) to service_role;

notify pgrst, 'reload schema';
