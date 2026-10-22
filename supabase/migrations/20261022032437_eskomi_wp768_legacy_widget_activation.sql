-- Activate only the reviewed WP768 legacy workspace.  Keep the existing app
-- directory record authoritative: the legacy managed projection is bound
-- while unlisted, then published through its reviewed legacy workflow so the
-- canonical sync function never rewrites app.shops or app.shop_areas.
do $$
declare
  v_workspace_id constant uuid := '39a6aa44-deef-4667-8a04-1ccf23696b43';
  v_app_shop_id constant uuid := '626dc77d-bcd3-495d-9ee3-3590e52253ac';
  v_wp_shop_id constant bigint := 768;
  v_actor constant text := 'migration:wp768-legacy-widget-activation';
  v_workspace private.partner_workspaces%rowtype;
  v_shop app.shops%rowtype;
  v_managed_id uuid;
  v_owner_id uuid;
  v_owner_count integer;
  v_widget_handle uuid;
  v_area_slug text;
  v_area_name text;
  v_before text;
  v_after text;
  v_candidate record;
  v_published_reviews_before bigint;
begin
  select * into v_workspace from private.partner_workspaces where id=v_workspace_id for update;
  select * into v_shop from app.shops where id=v_app_shop_id for update;
  if v_workspace.id is null or v_shop.id is null then
    raise exception 'WP768 activation target is missing' using errcode='P0002';
  end if;
  if v_shop.wp_post_id<>v_wp_shop_id
    or v_shop.slug<>v_workspace.shop_slug
    or v_shop.canonical_path<>('/shops/'||v_workspace.shop_slug||'/')
    or v_workspace.canonical_url<>('https://mens-esthe-kuchikomi.com'||v_shop.canonical_path)
    or v_shop.publication_status<>'published'
    or v_workspace.state<>'free_official_partner' then
    raise exception 'WP768 activation identity or public-state guard failed' using errcode='23514';
  end if;

  -- A fully completed operation is a safe no-op if this migration is replayed
  -- outside migration history.  Any partial state remains a hard failure.
  if v_workspace.app_shop_id is not null or v_workspace.wp_shop_id is null then
    select id into v_managed_id from private.managed_shops
    where existing_wp_shop_id=v_wp_shop_id and app_shop_id=v_app_shop_id and publication_state='published';
    select public_handle into v_widget_handle from private.review_widget_settings_v11
    where workspace_id=v_workspace_id and shop_id=v_app_shop_id and state='active';
    if v_workspace.app_shop_id=v_app_shop_id and v_workspace.wp_shop_id is null and v_managed_id is not null and v_widget_handle is not null
      and exists(select 1 from private.managed_shop_publications where managed_shop_id=v_managed_id and approved_revision=1)
      and exists(select 1 from private.partner_workspace_legacy_aliases_v11 where workspace_id=v_workspace_id and legacy_wp_shop_id=v_wp_shop_id and legacy_shop_slug=v_shop.slug) then
      return;
    end if;
    raise exception 'WP768 activation found a partial or conflicting prior state' using errcode='23514';
  end if;
  if v_workspace.wp_shop_id<>v_wp_shop_id
    or exists(select 1 from private.managed_shops where existing_wp_shop_id=v_wp_shop_id or app_shop_id=v_app_shop_id)
    or exists(select 1 from private.partner_workspace_legacy_aliases_v11 where workspace_id=v_workspace_id or legacy_wp_shop_id=v_wp_shop_id)
    or exists(select 1 from private.review_widget_settings_v11 where workspace_id=v_workspace_id or shop_id=v_app_shop_id) then
    raise exception 'WP768 activation requires a clean single-store starting state' using errcode='23514';
  end if;

  -- The existing app identity currently has two non-primary, published area
  -- relations.  Reuse the existing Osaka relation only in the new managed
  -- projection; do not promote, insert, or rewrite any app area relation.
  select a.slug,a.name into v_area_slug,v_area_name
  from app.shop_areas relation join app.areas a on a.id=relation.area_id
  where relation.shop_id=v_app_shop_id and a.slug='osaka' and a.is_published;
  if v_area_slug is null
    or exists(select 1 from app.shop_areas where shop_id=v_app_shop_id and is_primary)
    or (select count(*) from app.shop_areas where shop_id=v_app_shop_id)=0 then
    raise exception 'WP768 existing area relation guard failed' using errcode='23514';
  end if;

  select md5(concat_ws(E'\n',v_shop.name,v_shop.description_html,v_shop.excerpt,coalesce(v_shop.official_url,''),coalesce(v_shop.phone,''),coalesce(v_shop.address_text,''),coalesce(v_shop.booking_url,''),v_shop.publication_status,v_shop.canonical_path,v_shop.updated_at::text,
    (select string_agg(a.slug||':'||relation.is_primary::text||':'||relation.source_system||':'||relation.created_at::text,',' order by a.slug)
       from app.shop_areas relation join app.areas a on a.id=relation.area_id where relation.shop_id=v_app_shop_id)))
  into v_before;
  select count(*) into v_published_reviews_before from app.review_experience_publications
  where shop_id=v_app_shop_id and publication_state='published';

  v_managed_id:=private.import_managed_shop_from_legacy(
    v_wp_shop_id,v_shop.slug,
    jsonb_build_object(
      'shop_name',v_shop.name,'area_slug',v_area_slug,'area_name',v_area_name,
      'official_url',v_shop.official_url,'introduction',v_shop.excerpt,
      'address',v_shop.address_text,'business_hours',null,'phone',v_shop.phone,
      'line_url',null,'booking_url',v_shop.booking_url,'basic_price',null,'price_90',null,
      'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb
    ),v_actor
  );
  if private.bind_legacy_managed_shop_to_app_shop_v11(v_managed_id,v_app_shop_id,v_actor)<>'bound' then
    raise exception 'WP768 exact managed-shop bind failed' using errcode='23514';
  end if;
  if private.publish_managed_shop_revision(v_managed_id,1,v_actor,'approved legacy projection; app directory preserved')<>'ok' then
    raise exception 'WP768 managed publication failed' using errcode='40001';
  end if;
  select * into v_candidate from private.list_legacy_partner_workspace_mapping_candidates_v11()
  where workspace_id=v_workspace_id;
  if v_candidate.mapping_status<>'ready' or v_candidate.managed_shop_id<>v_managed_id or v_candidate.app_shop_id<>v_app_shop_id then
    raise exception 'WP768 legacy workspace candidate is not exact and ready' using errcode='23514';
  end if;
  if private.map_legacy_partner_workspace_to_canonical_v11(v_workspace_id,v_managed_id,v_app_shop_id,v_actor)<>'mapped' then
    raise exception 'WP768 canonical workspace mapping failed' using errcode='40001';
  end if;
  select count(*) into v_owner_count
  from private.partner_memberships
  where workspace_id=v_workspace_id and role='owner' and status='active';
  if v_owner_count<>1 then raise exception 'WP768 must retain exactly one active owner' using errcode='23514'; end if;
  select auth_user_id into v_owner_id from private.partner_memberships
  where workspace_id=v_workspace_id and role='owner' and status='active';
  select public_handle into v_widget_handle from private.get_partner_review_widget_v11(v_workspace_id,v_owner_id);
  if v_widget_handle is null then raise exception 'WP768 widget creation returned no public handle' using errcode='23514'; end if;

  select md5(concat_ws(E'\n',s.name,s.description_html,s.excerpt,coalesce(s.official_url,''),coalesce(s.phone,''),coalesce(s.address_text,''),coalesce(s.booking_url,''),s.publication_status,s.canonical_path,s.updated_at::text,
    (select string_agg(a.slug||':'||relation.is_primary::text||':'||relation.source_system||':'||relation.created_at::text,',' order by a.slug)
       from app.shop_areas relation join app.areas a on a.id=relation.area_id where relation.shop_id=s.id)))
  into v_after from app.shops s where s.id=v_app_shop_id;
  if v_after<>v_before
    or (select count(*) from app.review_experience_publications where shop_id=v_app_shop_id and publication_state='published')<>v_published_reviews_before
    or not exists(select 1 from private.managed_shops where id=v_managed_id and existing_wp_shop_id=v_wp_shop_id and app_shop_id=v_app_shop_id and publication_state='published')
    or not exists(select 1 from private.managed_shop_revisions where managed_shop_id=v_managed_id and revision=1 and state='approved')
    or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v_managed_id and approved_revision=1)
    or not exists(select 1 from private.partner_workspace_legacy_aliases_v11 where workspace_id=v_workspace_id and legacy_wp_shop_id=v_wp_shop_id and legacy_shop_slug=v_shop.slug)
    or exists(select 1 from private.partner_workspaces where id=v_workspace_id and (app_shop_id<>v_app_shop_id or wp_shop_id is not null))
    or not exists(select 1 from private.review_widget_settings_v11 where workspace_id=v_workspace_id and shop_id=v_app_shop_id and public_handle=v_widget_handle and state='active') then
    raise exception 'WP768 activation postcondition failed; transaction must roll back' using errcode='23514';
  end if;
end $$;
