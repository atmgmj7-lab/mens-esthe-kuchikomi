-- Canonical Partner home and listing workflow.
--
-- New managed stores never need a WordPress post or attachment identifier.
-- These RPCs resolve the signed-in membership to app.shops first, then keep
-- Partner mutations on the same managed_shop_revisions lifecycle used by the
-- operator dashboard.  They intentionally do not adapt the legacy
-- listing_stores or WordPress campaign tables.

-- Every mutation performs the same live publication check as the canonical
-- Partner home. A stopped shop must not remain operable through a stale
-- therapist/operations tab, while legacy rows without a managed projection
-- keep working until they are explicitly migrated.
create or replace function private.assert_partner_therapist_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  perform 1
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if not found then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
end $$;

create or replace function private.assert_partner_canonical_membership(
  p_workspace_id uuid, p_auth_user_id uuid
) returns uuid
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  select workspace.app_shop_id into v_shop_id
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
    and managed.publication_state='published'
  for update of membership,workspace,managed;
  if v_shop_id is null then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
  return v_shop_id;
end $$;

-- The v1.1 operations, therapist and widget RPCs share a live membership
-- check. They also support existing canonical stores that predate the managed
-- directory projection, so only the new home/listing boundary requires a
-- managed_shops row.
create or replace function private.assert_partner_v11_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id, shop.id, shop.slug, membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published' and managed.publication_state='published'
$$;

create or replace function private.get_partner_canonical_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return query
    select workspace.id,shop.id,shop.slug,shop.name,'https://mens-esthe-kuchikomi.com' || shop.canonical_path,workspace.state::text,membership.role::text
    from private.partner_workspaces workspace
    join private.partner_memberships membership on membership.workspace_id=workspace.id and membership.auth_user_id=p_auth_user_id
    join app.shops shop on shop.id=v_shop
    where workspace.id=p_workspace_id;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select link.public_handle into v_review_handle
  from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  select widget.public_handle into v_widget_handle
  from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

create or replace function private.get_partner_canonical_listing_editor(
  p_workspace_id uuid,p_auth_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return (
    select jsonb_build_object(
      'store_id',managed.id,'app_shop_id',v_shop,'shop_slug',managed.shop_slug,'canonical_url',managed.canonical_url,
      'current_revision',managed.current_revision,
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'latest_review',(select jsonb_build_object('decision',review.decision,'note',review.note)
        from private.managed_shop_reviews review where review.managed_shop_id=managed.id order by review.created_at desc limit 1)
    )
    from private.managed_shops managed
    join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
    where managed.app_shop_id=v_shop
  );
end $$;

create or replace function private.save_partner_canonical_listing_draft(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_name','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area:=btrim(coalesce(p_patch->>'area_name',v_revision.area_name));
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120 or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_revision.area_slug,'area_name',v_area,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.submit_partner_canonical_listing_change(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  if v_managed is null then raise exception 'managed shop is unavailable' using errcode='42501'; end if;
  return private.submit_managed_shop_revision(v_managed,p_expected_revision,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.reserve_partner_canonical_listing_banner_upload(
  p_workspace_id uuid,p_auth_user_id uuid,p_content_type text
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_managed is null or v_extension is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  return 'managed-shops/' || v_managed || '/' || gen_random_uuid() || '.' || v_extension;
end $$;

create or replace function private.attach_partner_canonical_listing_banner_asset(
  p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer
) returns uuid
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_asset uuid; v_state text; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select managed.id,revision.state into v_managed,v_state from private.managed_shops managed
  join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
  where managed.app_shop_id=v_shop for update of managed;
  if v_managed is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  v_asset:=substring(p_object_key from '^managed-shops/[0-9a-f-]+/([0-9a-f-]+)[.](png|jpg|webp)$')::uuid;
  if v_state not in ('draft','changes_requested','approved') or v_extension is null
    or p_object_key<>format('managed-shops/%s/%s.%s',v_managed,v_asset,v_extension)
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 5242880 or p_width not between 1 and 8000 or p_height not between 1 and 8000 then
    raise exception 'listing banner is unavailable' using errcode='42501';
  end if;
  insert into private.managed_shop_assets(id,managed_shop_id,object_key,sha256,content_type,byte_size,width,height)
  values(v_asset,v_managed,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height);
  return v_asset;
end $$;

create or replace function api.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_auth_membership(p_auth_user_id) $$;
create or replace function api.get_partner_canonical_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_workspace_identity(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_growth_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_growth_v11(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_listing_editor(p_workspace_id uuid,p_auth_user_id uuid)
returns jsonb language sql security invoker set search_path=private,api,pg_temp as $$ select private.get_partner_canonical_listing_editor(p_workspace_id,p_auth_user_id) $$;
create or replace function api.save_partner_canonical_listing_draft(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.save_partner_canonical_listing_draft(p_workspace_id,p_auth_user_id,p_expected_revision,p_patch) $$;
create or replace function api.submit_partner_canonical_listing_change(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.submit_partner_canonical_listing_change(p_workspace_id,p_auth_user_id,p_expected_revision) $$;
create or replace function api.reserve_partner_canonical_listing_banner_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.reserve_partner_canonical_listing_banner_upload(p_workspace_id,p_auth_user_id,p_content_type) $$;
create or replace function api.attach_partner_canonical_listing_banner_asset(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language sql security invoker set search_path=private,api,pg_temp as $$ select private.attach_partner_canonical_listing_banner_asset(p_workspace_id,p_auth_user_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) $$;

revoke all on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;

notify pgrst,'reload schema';
