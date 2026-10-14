create or replace function private.attach_listing_application_asset(p_application_id uuid, p_object_key text, p_sha256 text, p_content_type text, p_byte_size integer, p_width integer, p_height integer)
returns uuid language plpgsql security definer set search_path = private, pg_temp as $$
declare v_id uuid; begin
  insert into private.listing_application_assets(application_id,object_key,sha256,content_type,byte_size,width,height)
  values(p_application_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) returning id into v_id;
  update private.listing_applications set banner_asset_id=v_id, revision=revision+1, updated_at=now() where id=p_application_id and state='received';
  if not found then raise exception 'application unavailable for asset' using errcode='23514'; end if;
  return v_id;
end; $$;
revoke all on function private.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function private.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer) to service_role;
create or replace function api.attach_listing_application_asset(p_application_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language sql security invoker set search_path=private,pg_temp as $$ select private.attach_listing_application_asset(p_application_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) $$;
revoke all on function api.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function api.attach_listing_application_asset(uuid,text,text,text,integer,integer,integer) to service_role;
