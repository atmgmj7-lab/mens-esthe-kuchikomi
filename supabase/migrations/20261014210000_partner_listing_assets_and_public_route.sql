-- Local-only Partner banner upload and public stable-listing projection.
-- A private object is always served through an approved-publication check.
alter table private.listing_application_assets add column listing_store_id uuid references private.listing_stores(id) on delete restrict;
alter table private.listing_application_assets alter column application_id drop not null;
alter table private.listing_application_assets drop constraint listing_application_assets_object_key_check;
alter table private.listing_application_assets add constraint listing_application_assets_object_key_check check (
  object_key ~ '^listing-(applications|stores)/[0-9a-f-]+/[0-9a-f-]+\.(png|jpe?g|webp)$'
);
alter table private.listing_application_assets add constraint listing_application_assets_owner_check check (num_nonnulls(application_id, listing_store_id) = 1);
create index listing_application_assets_listing_store_id_idx on private.listing_application_assets(listing_store_id) where listing_store_id is not null;

create table private.partner_listing_banner_uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  listing_store_id uuid not null references private.listing_stores(id) on delete restrict,
  object_id uuid not null default gen_random_uuid(),
  object_key text unique,
  state text not null default 'issued' check (state in ('issued','reserved','consumed')),
  created_at timestamptz not null default now()
);
alter table private.partner_listing_banner_uploads enable row level security;
revoke all on table private.partner_listing_banner_uploads from public, anon, authenticated;
grant select, insert, update on table private.partner_listing_banner_uploads to service_role;

create or replace function private.reserve_partner_listing_banner_upload(p_workspace_id uuid, p_content_type text)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store uuid; v_upload uuid; v_key text; v_extension text;
begin
  v_extension := case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_extension is null then raise exception 'invalid banner content type' using errcode='22023'; end if;
  select id into v_store from private.listing_stores where workspace_id=p_workspace_id for key share;
  if not found then raise exception 'listing workspace unavailable' using errcode='42501'; end if;
  insert into private.partner_listing_banner_uploads(workspace_id,listing_store_id) values(p_workspace_id,v_store) returning id into v_upload;
  update private.partner_listing_banner_uploads set object_key=format('listing-stores/%s/%s.%s',v_store,v_upload,v_extension),state='reserved' where id=v_upload returning object_key into v_key;
  return v_key;
end;
$$;

create or replace function private.attach_partner_listing_banner_asset(
  p_workspace_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer
) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v private.partner_listing_banner_uploads%rowtype; v_asset uuid;
begin
  select * into v from private.partner_listing_banner_uploads where workspace_id=p_workspace_id and object_key=p_object_key for update;
  if not found or v.state <> 'reserved' then raise exception 'partner banner upload rejected' using errcode='42501'; end if;
  insert into private.listing_application_assets(listing_store_id,object_key,sha256,content_type,byte_size,width,height)
  values(v.listing_store_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) returning id into v_asset;
  update private.partner_listing_banner_uploads set state='consumed' where id=v.id;
  return v_asset;
end;
$$;

create or replace function private.save_partner_listing_draft(p_workspace_id uuid,p_expected_revision integer,p_payload jsonb)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_store private.listing_stores%rowtype; v_previous private.listing_store_revisions%rowtype;
declare v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid listing draft' using errcode='22023'; end if;
  select * into v_store from private.listing_stores where workspace_id=p_workspace_id for update;
  if not found then return 'forbidden'; end if;
  if v_store.current_revision <> p_expected_revision then return 'conflict'; end if;
  select * into v_previous from private.listing_store_revisions where listing_store_id=v_store.id and revision=v_store.current_revision;
  if v_previous.state not in ('draft','changes_requested') then return 'conflict'; end if;
  v_name:=nullif(trim(p_payload->>'shop_name'),''); v_area:=nullif(trim(p_payload->>'area'),''); v_url:=nullif(trim(p_payload->>'website_url'),''); v_intro:=nullif(trim(coalesce(p_payload->>'introduction','')),'');
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120 or v_url !~ '^https?://' or char_length(v_intro)>5000 then raise exception 'invalid listing draft' using errcode='22023'; end if;
  begin v_banner:=nullif(p_payload->>'banner_asset_id','')::uuid; exception when invalid_text_representation then raise exception 'invalid banner asset' using errcode='22023'; end;
  if v_banner is not null and not exists (
    select 1 from private.listing_application_assets a left join private.listing_applications app on app.id=a.application_id
    where a.id=v_banner and (a.listing_store_id=v_store.id or app.listing_store_id=v_store.id)
  ) then raise exception 'banner does not belong to listing' using errcode='42501'; end if;
  insert into private.listing_store_revisions(listing_store_id,revision,state,shop_name,area,website_url,introduction,banner_asset_id)
  values(v_store.id,v_store.current_revision+1,'draft',v_name,v_area,v_url,v_intro,v_banner);
  update private.listing_stores set current_revision=current_revision+1,updated_at=now() where id=v_store.id;
  return 'ok';
end;
$$;

create or replace function api.get_public_partner_listing_banner(p_asset_id uuid)
returns table(object_key text,content_type text) language sql security definer set search_path=private,pg_temp as $$
  select a.object_key,a.content_type from private.listing_store_publications p
  join private.listing_application_assets a on a.id=p.banner_asset_id where a.id=p_asset_id limit 1
$$;
revoke all on function private.reserve_partner_listing_banner_upload(uuid,text) from public,anon,authenticated;
revoke all on function private.attach_partner_listing_banner_asset(uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function api.get_public_partner_listing_banner(uuid) from public,anon,authenticated;
grant execute on function private.reserve_partner_listing_banner_upload(uuid,text) to service_role;
grant execute on function private.attach_partner_listing_banner_asset(uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function api.get_public_partner_listing_banner(uuid) to service_role;
