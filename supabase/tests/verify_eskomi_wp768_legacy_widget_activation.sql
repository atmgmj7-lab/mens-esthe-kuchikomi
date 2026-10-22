-- Exercises the exact legacy-to-canonical ordering used for the one-store
-- WP768 activation.  The fixture begins and ends in this transaction, so it
-- cannot alter the shared local verification database.
begin;

do $$
declare
  v_workspace uuid := '11111111-1111-4111-8111-111111111768';
  v_owner uuid := '22222222-2222-4222-8222-222222222768';
  v_shop uuid := '33333333-3333-4333-8333-333333333768';
  v_managed uuid;
  v_handle uuid;
  v_before text;
  v_after text;
  v_candidate record;
  v_slug text := 'fixture-wp768-legacy-activation';
begin
  if to_regprocedure('private.import_managed_shop_from_legacy(bigint,text,jsonb,text)') is null
    or to_regprocedure('private.bind_legacy_managed_shop_to_app_shop_v11(uuid,uuid,text)') is null
    or to_regprocedure('private.publish_managed_shop_revision(uuid,integer,text,text)') is null
    or to_regprocedure('private.map_legacy_partner_workspace_to_canonical_v11(uuid,uuid,uuid,text)') is null
    or to_regprocedure('private.get_partner_review_widget_v11(uuid,uuid)') is null then
    raise exception 'WP768 activation requires the audited legacy mapping and widget RPCs';
  end if;

  insert into app.areas(id,slug,name,is_published,published_at)
  values
    ('44444444-4444-4444-8444-444444444768','fixture-wp768-osaka','Fixture Osaka',true,now()),
    ('55555555-5555-4555-8555-555555555768','fixture-wp768-shinosaka','Fixture Shin-Osaka',true,now());
  insert into app.shops(id,wp_post_id,slug,canonical_path,name,description_html,excerpt,official_url,phone,address_text,booking_url,publication_status,published_at)
  values(v_shop,990000000000000768,v_slug,'/shops/'||v_slug||'/','Fixture WP768 legacy activation','existing &amp; public body','existing public body','https://fixture.invalid/wp768','06-0000-0768','Fixture address','https://fixture.invalid/book','published',now());
  insert into app.shop_areas(shop_id,area_id,is_primary,source_system)
  values
    (v_shop,'44444444-4444-4444-8444-444444444768',false,'wordpress'),
    (v_shop,'55555555-5555-4555-8555-555555555768',false,'wordpress');
  insert into private.partner_workspaces(id,wp_shop_id,shop_slug,shop_name,canonical_url,state)
  values(v_workspace,990000000000000768,v_slug,'Fixture WP768 legacy activation','https://mens-esthe-kuchikomi.com/shops/'||v_slug||'/','free_official_partner');
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace,v_owner,'owner','active',now());

  select md5(concat_ws(E'\n',s.name,s.description_html,s.excerpt,coalesce(s.official_url,''),coalesce(s.phone,''),coalesce(s.address_text,''),coalesce(s.booking_url,''),s.publication_status,s.canonical_path,
    (select string_agg(a.slug||':'||sa.is_primary::text||':'||sa.source_system,',' order by a.slug) from app.shop_areas sa join app.areas a on a.id=sa.area_id where sa.shop_id=s.id)))
  into v_before from app.shops s where s.id=v_shop;

  -- Binding while still unlisted deliberately avoids canonical sync.  The
  -- legacy publication path then creates the reviewed projection without
  -- writing the established app.shops public record or area membership.
  v_managed := private.import_managed_shop_from_legacy(
    990000000000000768,v_slug,
    jsonb_build_object('shop_name','Fixture WP768 legacy activation','area_slug','fixture-wp768-osaka','area_name','Fixture Osaka','official_url','https://fixture.invalid/wp768','introduction','existing public body','address','Fixture address','business_hours',null,'phone','06-0000-0768','line_url',null,'booking_url','https://fixture.invalid/book','basic_price',null,'price_90',null,'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb),
    'wp768 activation rehearsal'
  );
  if private.bind_legacy_managed_shop_to_app_shop_v11(v_managed,v_shop,'wp768 activation rehearsal') <> 'bound' then
    raise exception 'unlisted exact legacy bind failed';
  end if;
  if private.publish_managed_shop_revision(v_managed,1,'wp768 activation rehearsal','preserve public app projection') <> 'ok' then
    raise exception 'legacy reviewed publication failed';
  end if;
  select * into v_candidate from private.list_legacy_partner_workspace_mapping_candidates_v11() where workspace_id=v_workspace;
  if v_candidate.mapping_status <> 'ready' or v_candidate.managed_shop_id <> v_managed or v_candidate.app_shop_id <> v_shop then
    raise exception 'exact legacy workspace candidate was not ready';
  end if;
  if private.map_legacy_partner_workspace_to_canonical_v11(v_workspace,v_managed,v_shop,'wp768 activation rehearsal') <> 'mapped' then
    raise exception 'legacy workspace mapping failed';
  end if;
  select public_handle into v_handle from private.get_partner_review_widget_v11(v_workspace,v_owner);
  if v_handle is null then raise exception 'owner widget creation returned no handle'; end if;
  perform set_config('eskomi.test_widget_handle',v_handle::text,false);

  select md5(concat_ws(E'\n',s.name,s.description_html,s.excerpt,coalesce(s.official_url,''),coalesce(s.phone,''),coalesce(s.address_text,''),coalesce(s.booking_url,''),s.publication_status,s.canonical_path,
    (select string_agg(a.slug||':'||sa.is_primary::text||':'||sa.source_system,',' order by a.slug) from app.shop_areas sa join app.areas a on a.id=sa.area_id where sa.shop_id=s.id)))
  into v_after from app.shops s where s.id=v_shop;
  if v_after <> v_before then raise exception 'legacy activation changed the public app record or area membership'; end if;
  if not exists(select 1 from private.managed_shops where id=v_managed and app_shop_id=v_shop and publication_state='published')
    or not exists(select 1 from private.managed_shop_publications where managed_shop_id=v_managed and approved_revision=1)
    or not exists(select 1 from private.partner_workspace_legacy_aliases_v11 where workspace_id=v_workspace and legacy_wp_shop_id=990000000000000768)
    or exists(select 1 from private.partner_workspaces where id=v_workspace and (wp_shop_id is not null or app_shop_id<>v_shop))
    or not exists(select 1 from private.review_widget_settings_v11 where workspace_id=v_workspace and shop_id=v_shop and public_handle=v_handle and state='active') then
    raise exception 'WP768 activation records are incomplete';
  end if;
  if exists(select 1 from app.review_experience_publications where shop_id=v_shop and publication_state='published') then
    raise exception 'fixture activation must not create reviews';
  end if;
end $$;

do $$
declare v_rows integer; v_reviews bigint; v_private_select boolean;
begin
  select count(*),coalesce(max(review_count),-1) into v_rows,v_reviews
  from private.get_public_review_widget_v11(current_setting('eskomi.test_widget_handle')::uuid,3,0);
  if v_rows <> 1 or v_reviews <> 0 then raise exception 'active widget must disclose exactly the zero-review public summary'; end if;
  select count(*),coalesce(max(review_count),-1) into v_rows,v_reviews
  from private.get_public_review_widget_v11('00000000-0000-0000-0000-000000000000'::uuid,3,0);
  if v_rows <> 0 or v_reviews <> -1 then raise exception 'unknown widget handle must disclose no data'; end if;
  if has_table_privilege('anon','private.review_widget_settings_v11','select') or has_table_privilege('anon','app.review_experience_publications','select') then
    raise exception 'anon must not read widget or review tables directly';
  end if;
end $$;

select 'WP768 legacy widget activation rollback rehearsal: PASS' as result;
rollback;
