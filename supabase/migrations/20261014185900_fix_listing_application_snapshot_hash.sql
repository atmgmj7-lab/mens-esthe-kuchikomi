create or replace function private.snapshot_listing_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_applications%rowtype; v_public jsonb; v_private jsonb;
begin
  select * into v from private.listing_applications where id=p_application_id;
  if not found then raise exception 'application unavailable' using errcode='23514'; end if;
  v_public := jsonb_build_object('shop_name',v.shop_name,'area',v.area,'website_url',v.website_url,'introduction',v.introduction,'banner_asset_id',v.banner_asset_id);
  v_private := jsonb_build_object('contact_name',v.contact_name,'contact_email',v.contact_email,'contact_role',v.contact_role,'edit_preference',v.edit_preference,'kind',v.kind,'existing_wp_shop_id',v.existing_wp_shop_id,'existing_shop_slug',v.existing_shop_slug);
  insert into private.listing_application_revisions(application_id,revision,public_payload,private_payload,payload_hash)
  values(v.id,v.revision,v_public,v_private,encode(extensions.digest(convert_to(jsonb_build_object('public',v_public,'private',v_private)::text,'utf8'),'sha256'),'hex'))
  on conflict(application_id,revision) do nothing;
end;
$$;
revoke all on function private.snapshot_listing_application(uuid) from public, anon, authenticated;
grant execute on function private.snapshot_listing_application(uuid) to service_role;
