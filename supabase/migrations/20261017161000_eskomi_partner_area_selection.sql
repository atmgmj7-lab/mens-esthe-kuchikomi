-- A Partner may request a move only to an existing published area. It submits
-- the stable slug; it never supplies an area display name that could rewrite
-- a shared app.areas master row used by other shops.
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
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area_slug',revision.area_slug,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'area_options',coalesce((select jsonb_agg(jsonb_build_object('slug',area.slug,'name',area.name) order by area.name,area.slug)
        from app.areas area where area.is_published or area.slug=revision.area_slug),'[]'::jsonb),
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
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area_slug text; v_area_name text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_slug','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area_slug:=btrim(coalesce(p_patch->>'area_slug',v_revision.area_slug));
  select name into v_area_name from app.areas where slug=v_area_slug and (is_published or slug=v_revision.area_slug) for key share;
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or v_area_name is null or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_area_slug,'area_name',v_area_name,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

revoke all on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb) to service_role;

notify pgrst,'reload schema';
