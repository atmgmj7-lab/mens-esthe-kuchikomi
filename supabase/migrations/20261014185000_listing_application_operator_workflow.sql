-- Local-only approval workflow.  Public projection data is deliberately a narrow,
-- contact-free copy; the application and its review trail remain in private schema.
create or replace function private.snapshot_listing_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_applications%rowtype; v_public jsonb; v_private jsonb;
begin
  select * into v from private.listing_applications where id=p_application_id;
  if not found then raise exception 'application unavailable' using errcode='23514'; end if;
  v_public := jsonb_build_object('shop_name',v.shop_name,'area',v.area,'website_url',v.website_url,'introduction',v.introduction,'banner_asset_id',v.banner_asset_id);
  v_private := jsonb_build_object('contact_name',v.contact_name,'contact_email',v.contact_email,'contact_role',v.contact_role,'edit_preference',v.edit_preference,'kind',v.kind,'existing_wp_shop_id',v.existing_wp_shop_id,'existing_shop_slug',v.existing_shop_slug);
  insert into private.listing_application_revisions(application_id,revision,public_payload,private_payload,payload_hash)
  values(v.id,v.revision,v_public,v_private,encode(digest(convert_to(jsonb_build_object('public',v_public,'private',v_private)::text,'utf8'),'sha256'),'hex'))
  on conflict(application_id,revision) do nothing;
end;
$$;

-- Snapshot records for existing local applications make the first operator comparison
-- meaningful without exposing their private payload through a public relation.
do $$ declare r record; begin
  for r in select id from private.listing_applications loop
    perform private.snapshot_listing_application(r.id);
  end loop;
end $$;

create or replace function private.attach_listing_application_asset(
  p_application_id uuid, p_token_hash text, p_object_key text, p_sha256 text,
  p_content_type text, p_byte_size integer, p_width integer, p_height integer
) returns uuid language plpgsql security definer set search_path = private, pg_temp as $$
declare v_asset_id uuid; v_token private.listing_application_upload_tokens%rowtype;
begin
  select * into v_token from private.listing_application_upload_tokens
  where application_id=p_application_id and token_hash=p_token_hash for update;
  if not found or v_token.state <> 'reserved' or v_token.expires_at <= now() or v_token.object_key <> p_object_key then
    raise exception 'upload capability rejected' using errcode='42501';
  end if;
  insert into private.listing_application_assets(application_id,object_key,sha256,content_type,byte_size,width,height)
  values(p_application_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) returning id into v_asset_id;
  update private.listing_applications set banner_asset_id=v_asset_id, revision=revision+1, updated_at=now()
  where id=p_application_id and state in ('received','content_review','changes_requested');
  if not found then raise exception 'application unavailable for asset' using errcode='23514'; end if;
  perform private.snapshot_listing_application(p_application_id);
  update private.listing_application_upload_tokens set state='consumed', consumed_at=now() where id=v_token.id;
  return v_asset_id;
end;
$$;

create or replace function private.update_listing_application(
  p_application_id uuid, p_expected_revision integer, p_payload jsonb
) returns text language plpgsql security definer set search_path = private, pg_temp as $$
declare v private.listing_applications%rowtype;
begin
  select * into v from private.listing_applications where id=p_application_id for update;
  if not found or v.revision <> p_expected_revision then return 'conflict'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid listing update' using errcode='22023'; end if;
  perform private.snapshot_listing_application(v.id);
  update private.listing_applications set
    shop_name = coalesce(nullif(p_payload->>'shop_name',''), shop_name),
    area = coalesce(nullif(p_payload->>'area',''), area),
    website_url = coalesce(nullif(p_payload->>'website_url',''), website_url),
    introduction = nullif(p_payload->>'introduction',''),
    edit_preference = coalesce(nullif(p_payload->>'edit_preference','')::private.listing_edit_preference, edit_preference),
    state = 'content_review', revision = revision + 1, updated_at=now()
  where id=v.id;
  perform private.snapshot_listing_application(v.id);
  return 'ok';
end;
$$;

create or replace function api.update_listing_application(p_application_id uuid, p_expected_revision integer, p_payload jsonb)
returns text language sql security invoker set search_path=private,pg_temp as $$
  select private.update_listing_application(p_application_id,p_expected_revision,p_payload)
$$;

create or replace function api.get_public_listing_projections()
returns table(application_id uuid, shop_name text, area text, website_url text, introduction text, has_banner boolean, published_at timestamptz)
language sql security definer set search_path=private,pg_temp as $$
  select p.application_id,p.shop_name,p.area,p.website_url,p.introduction,(p.banner_asset_id is not null),p.published_at
  from private.listing_public_projections p order by p.published_at desc
$$;

revoke all on function private.snapshot_listing_application(uuid) from public, anon, authenticated;
revoke all on function private.update_listing_application(uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function api.update_listing_application(uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function api.get_public_listing_projections() from public;
grant execute on function private.snapshot_listing_application(uuid) to service_role;
grant execute on function private.update_listing_application(uuid,integer,jsonb) to service_role;
grant execute on function api.update_listing_application(uuid,integer,jsonb) to service_role;
grant execute on function api.get_public_listing_projections() to anon, authenticated, service_role;
