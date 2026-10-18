-- Exercises existing production-intended functions against repository schema
-- plus synthetic rows only. It neither reads nor writes an external database.
do $$
declare
  v_workspace uuid;
  v_workspace_725 uuid;
  v_workspace_766 uuid;
  v_managed uuid;
  v_app_shop uuid;
  v_non_target_app_shop uuid;
  v_candidate record;
  v_status text;
begin
  if (select count(*) from app.shops) <> 382 then
    raise exception 'synthetic app.shops count must be 382';
  end if;
  if (select publication_status::text from app.shops where slug='synthetic-pilot-768') <> 'draft' then
    raise exception 'synthetic pilot must begin draft';
  end if;
  if (select count(*) from private.managed_shops) <> 0 then
    raise exception 'synthetic baseline must begin without managed projections';
  end if;
  if (select count(*) from private.partner_workspaces where wp_shop_id in (725,766,768)) <> 3 then
    raise exception 'synthetic baseline must contain three legacy workspaces';
  end if;

  select id into v_workspace from private.partner_workspaces where wp_shop_id=768;
  select id into v_workspace_725 from private.partner_workspaces where wp_shop_id=725;
  select id into v_workspace_766 from private.partner_workspaces where wp_shop_id=766;
  select id into v_app_shop from app.shops where slug='synthetic-pilot-768';
  if v_workspace is null or v_workspace_725 is null or v_workspace_766 is null
    or v_app_shop is null then
    raise exception 'synthetic baseline identity capture failed';
  end if;

  -- The runner's intentional-abnormal-fixture mode sets this local custom
  -- setting.  It changes a non-target workspace after its UUID is captured;
  -- the exact UUID-based guard below must reject it.  The whole DO block
  -- rolls back on that expected failure, leaving no fixture mutation behind.
  if current_setting('eskomi_rehearsal.inject_non_target_mapping', true) = 'on' then
    select id into v_non_target_app_shop
    from app.shops
    where id <> v_app_shop
    order by slug
    limit 1;
    update private.partner_workspaces
    set wp_shop_id=null, app_shop_id=v_non_target_app_shop
    where id=v_workspace_725;
  end if;

  select private.import_managed_shop_from_legacy(
    768,
    'synthetic-pilot-768',
    jsonb_build_object(
      'shop_name','Synthetic pilot 768',
      'area_slug','synthetic-area',
      'area_name','Synthetic area',
      'official_url','https://synthetic.invalid/pilot',
      'introduction','Synthetic rehearsal record',
      'address',null,
      'business_hours',null,
      'phone',null,
      'line_url',null,
      'booking_url',null,
      'basic_price',null,
      'price_90',null,
      'banner_asset_id',null,
      'gallery_asset_ids',jsonb_build_array()
    ),
    'synthetic_rehearsal_operator'
  ) into v_managed;

  select * into v_candidate
  from api.list_legacy_partner_workspace_mapping_candidates_v11()
  where workspace_id=v_workspace;
  if v_candidate.mapping_status <> 'managed_shop_unbound'
    or v_candidate.managed_shop_id <> v_managed then
    raise exception 'legacy managed creation did not remain an unbound exact candidate';
  end if;

  if private.bind_legacy_managed_shop_to_app_shop_v11(v_managed,v_app_shop,'synthetic_rehearsal_operator') <> 'bound' then
    raise exception 'exact legacy bind failed';
  end if;
  select * into v_candidate
  from api.list_legacy_partner_workspace_mapping_candidates_v11()
  where workspace_id=v_workspace;
  if v_candidate.mapping_status <> 'ready' or v_candidate.app_shop_id <> v_app_shop then
    raise exception 'exact legacy candidate was not ready after bind';
  end if;
  if private.map_legacy_partner_workspace_to_canonical_v11(v_workspace,v_managed,v_app_shop,'synthetic_rehearsal_operator') <> 'mapped' then
    raise exception 'exact workspace mapping failed';
  end if;
  if private.submit_managed_shop_revision(v_managed,1,'synthetic_rehearsal_operator') <> 'ok' then
    raise exception 'normal managed submission failed';
  end if;
  if private.review_canonical_managed_shop_revision(v_managed,1,'approved','synthetic_rehearsal_reviewer','synthetic approval') <> 'ok' then
    raise exception 'normal managed review publication failed';
  end if;

  select publication_status::text into v_status from app.shops where id=v_app_shop;
  if v_status <> 'published' then raise exception 'canonical shop did not publish'; end if;
  select publication_state into v_status from private.managed_shops where id=v_managed;
  if v_status <> 'published' then raise exception 'managed projection did not publish'; end if;
  if exists(select 1 from private.partner_workspaces where id=v_workspace and (wp_shop_id is not null or app_shop_id <> v_app_shop)) then
    raise exception 'workspace was not mapped to exactly the selected app shop';
  end if;
  if (select count(*) from private.partner_workspace_legacy_aliases_v11 where legacy_wp_shop_id=768) <> 1 then
    raise exception 'selected workspace did not retain exactly one legacy alias';
  end if;
  if not exists(
    select 1
    from private.partner_workspaces
    where id=v_workspace_725 and wp_shop_id=725 and app_shop_id is null
  ) or not exists(
    select 1
    from private.partner_workspaces
    where id=v_workspace_766 and wp_shop_id=766 and app_shop_id is null
  ) then
    raise exception 'out-of-scope legacy workspaces were modified';
  end if;
  if exists(
    select 1
    from private.partner_workspace_legacy_aliases_v11
    where workspace_id in (v_workspace_725,v_workspace_766)
       or legacy_wp_shop_id in (725,766)
  ) then
    raise exception 'out-of-scope legacy workspaces gained aliases';
  end if;
  if (select count(*) from app.review_publications) <> 0
    or (select count(*) from app.review_experience_publications) <> 0 then
    raise exception 'synthetic rehearsal must not add review data';
  end if;
end $$;
