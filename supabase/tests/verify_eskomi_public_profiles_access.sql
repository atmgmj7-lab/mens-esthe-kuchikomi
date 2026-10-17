-- Public therapist visibility and aggregate-only Partner access reporting.
begin;
do $$
declare
  v_suffix text:=left(replace(gen_random_uuid()::text,'-',''),12); v_payload jsonb;
  v_managed_a uuid; v_managed_b uuid; v_shop_a uuid; v_shop_b uuid; v_workspace_a uuid; v_workspace_b uuid;
  v_user_a uuid:=gen_random_uuid(); v_user_b uuid:=gen_random_uuid(); v_manager_a uuid:=gen_random_uuid(); v_revoked_a uuid:=gen_random_uuid(); v_asset uuid; v_assignment uuid;
  v_today date:=(now() at time zone 'Asia/Tokyo')::date; v_boundary_to date:='2026-10-17'; v_boundary_from date:='2026-04-21';
  v_count bigint; v_views bigint; v_clicks bigint; v_has boolean; v_type regtype; v_measurement text;
begin
  v_payload:=jsonb_build_object('shop_name','Public profile fixture '||v_suffix,'area_slug','profile-access-'||v_suffix,'area_name','Profile access fixture','official_url','https://example.test/'||v_suffix,'introduction','fixture','address',null,'business_hours',null,'phone',null,'line_url','https://line.me/'||v_suffix,'booking_url',null,'basic_price',null,'price_90',null,'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb);
  select managed_shop_id,app_shop_id into v_managed_a,v_shop_a from private.create_canonical_managed_shop('profile-access-a-'||v_suffix,v_payload,'fixture');
  select managed_shop_id,app_shop_id into v_managed_b,v_shop_b from private.create_canonical_managed_shop('profile-access-b-'||v_suffix,v_payload||jsonb_build_object('shop_name','Other profile fixture '||v_suffix),'fixture');
  update app.shops set publication_status='published',published_at=now() where id in (v_shop_a,v_shop_b);
  update private.managed_shops set publication_state='published' where id in (v_managed_a,v_managed_b);
  insert into private.partner_workspaces(app_shop_id,shop_slug,shop_name,canonical_url,state)
    select v_shop_a,slug,name,'https://mens-esthe-kuchikomi.com'||canonical_path,'free_official_partner' from app.shops where id=v_shop_a returning id into v_workspace_a;
  insert into private.partner_workspaces(app_shop_id,shop_slug,shop_name,canonical_url,state)
    select v_shop_b,slug,name,'https://mens-esthe-kuchikomi.com'||canonical_path,'free_official_partner' from app.shops where id=v_shop_b returning id into v_workspace_b;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
    values(v_workspace_a,v_user_a,'owner','active',now()),(v_workspace_b,v_user_b,'owner','active',now());
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at,revoked_at)
    values(v_workspace_a,v_manager_a,'manager','active',now(),null),(v_workspace_a,v_revoked_a,'manager','revoked',now(),now());
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height)
    values(v_workspace_a,'therapists/'||v_workspace_a||'/'||gen_random_uuid()||'.jpg',repeat('a',64),'image/jpeg',100,10,10) returning id into v_asset;
  select assignment_id into v_assignment from api.create_partner_therapist_assignment(v_workspace_a,v_user_a,'公開人物',v_asset,'fixture-rights',true);
  if not exists(select 1 from api.list_public_therapists_for_shop_v11((select slug from app.shops where id=v_shop_a),20) where assignment_id=v_assignment)
    or not exists(select 1 from api.get_public_therapist_profile_detail_v11(v_assignment,20))
    or not exists(select 1 from api.get_public_therapist_photo_v11(v_assignment)) then raise exception 'visible therapist was absent from one public route'; end if;
  update app.therapist_assignments set active_from=now()-interval '2 days',active_until=now()-interval '1 second' where id=v_assignment;
  if exists(select 1 from api.list_public_therapists_for_shop_v11((select slug from app.shops where id=v_shop_a),20) where assignment_id=v_assignment)
    or exists(select 1 from api.get_public_therapist_profile_detail_v11(v_assignment,20))
    or exists(select 1 from api.get_public_therapist_photo_v11(v_assignment))
    or exists(select 1 from api.list_public_therapist_sitemap_v11() where assignment_id=v_assignment) then raise exception 'expired therapist leaked from a public route'; end if;

  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
    values(v_shop_a,v_boundary_to-10,'complete',now()),(v_shop_a,v_boundary_to,'complete',now()),(v_shop_a,v_boundary_to-1,'partial',now());
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on,shop_view_count,official_line_click_count,updated_at)
    values(v_shop_a,v_boundary_to-10,0,0,now()),(v_shop_a,v_boundary_to,2,1,now());
  select count(*),min(observed_on),max(observed_on) into v_count,v_boundary_from,v_boundary_to
    from api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-04-21','2026-10-17');
  if v_count<>180 or v_boundary_from<>'2026-04-21'::date or v_boundary_to<>'2026-10-17'::date then raise exception '90-day comparison range was not returned as 180 daily rows'; end if;
  select shop_view_count,official_line_click_count,has_data,pg_typeof(observed_on)::text::regtype into v_views,v_clicks,v_has,v_type
    from api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-10-17','2026-10-17');
  if v_views<>2 or v_clicks<>1 or not v_has or v_type<>'date'::regtype then raise exception 'measured access day did not preserve counts or date type'; end if;
  select has_data into v_has from api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-10-06','2026-10-06');
  if not v_has then raise exception 'observed zero day was rendered as missing'; end if;
  select has_data into v_has from api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-10-05','2026-10-05');
  if v_has then raise exception 'unobserved gap was rendered as zero'; end if;
  select has_data,measurement_state into v_has,v_measurement from api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-10-16','2026-10-16');
  if v_has or v_measurement<>'partial' then raise exception 'partial collection day was rendered as a measured zero'; end if;
  if not exists(select 1 from api.get_partner_shop_access_report_v11(v_workspace_a,v_manager_a,'2026-10-17','2026-10-17')) then raise exception 'active manager could not read access report'; end if;
  begin
    perform api.get_partner_shop_access_report_v11(v_workspace_b,v_user_a,'2026-10-17','2026-10-17');
    raise exception 'other workspace access report was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform api.get_partner_shop_access_report_v11(v_workspace_a,v_revoked_a,'2026-10-17','2026-10-17');
    raise exception 'revoked manager retained access report read';
  exception when insufficient_privilege then null;
  end;
  begin
    perform api.get_partner_shop_access_report_v11(v_workspace_a,v_user_a,'2026-04-20','2026-10-17');
    raise exception 'over-180-day access range was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform api.record_public_shop_access_v11((select slug from app.shops where id=v_shop_a),'shop_view',repeat('b',64),repeat('c',64));
  perform api.record_public_shop_access_v11((select slug from app.shops where id=v_shop_a),'shop_view',repeat('b',64),repeat('c',64));
  if (select shop_view_count from private.partner_shop_access_daily_v11 where shop_id=v_shop_a and observed_on=v_today)<>1 then raise exception 'same anonymous browser event was counted twice'; end if;
  -- Context issuance is separately bounded before an attacker can manufacture
  -- enough event contexts to consume the shop-wide daily ceiling.
  for v_count in 1..8 loop
    perform api.reserve_public_shop_access_context_v11((select slug from app.shops where id=v_shop_a),repeat('e',64),null,false);
  end loop;
  begin
    perform api.reserve_public_shop_access_context_v11((select slug from app.shops where id=v_shop_a),repeat('e',64),null,false);
    raise exception 'context session issuance limit was accepted';
  exception when invalid_parameter_value then null;
  end;
  perform api.reserve_public_shop_access_context_v11((select slug from app.shops where id=v_shop_a),repeat('f',64),repeat('a',64),true);
  if not exists(select 1 from private.partner_shop_access_context_issue_limits_v11 where shop_id=v_shop_a and scope_kind='network' and scope_hash=repeat('a',64)) then
    raise exception 'trusted network scope was not short-lived HMAC-shaped';
  end if;
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on) values(v_shop_b,v_today-2) on conflict(shop_id) do update set first_observed_on=excluded.first_observed_on;
  perform api.finalize_partner_shop_access_collection_day_v11(v_today-1,'complete');
  select has_data,measurement_state into v_has,v_measurement from api.get_partner_shop_access_report_v11(v_workspace_b,v_user_b,v_today-1,v_today-1);
  if not v_has or v_measurement<>'complete' then raise exception 'scheduled complete day did not permit a confirmed zero'; end if;
  perform api.finalize_partner_shop_access_collection_day_v11(v_today-2,'partial');
  select has_data,measurement_state into v_has,v_measurement from api.get_partner_shop_access_report_v11(v_workspace_b,v_user_b,v_today-2,v_today-2);
  if v_has or v_measurement<>'partial' then raise exception 'scheduled partial day did not remain incomparable'; end if;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,access_context_hash,expires_at)
    values(v_shop_a,v_today-3,'shop_view',repeat('d',64),now()-interval '1 second');
  insert into private.partner_shop_access_context_limits_v11(shop_id,observed_on,session_scope_hash,accepted_event_count,expires_at)
    values(v_shop_a,v_today-3,repeat('d',64),1,now()-interval '1 second');
  insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
    values(v_shop_a,v_today-3,'session',repeat('d',64),1,now()-interval '1 second');
  perform private.prune_partner_shop_access_short_lived_v11(now());
  if exists(select 1 from private.partner_shop_access_dedupe_v11 where shop_id=v_shop_a and observed_on=v_today-3)
    or exists(select 1 from private.partner_shop_access_context_limits_v11 where shop_id=v_shop_a and observed_on=v_today-3)
    or exists(select 1 from private.partner_shop_access_context_issue_limits_v11 where shop_id=v_shop_a and observed_on=v_today-3) then raise exception 'expired anonymous access context was retained'; end if;
end $$;
rollback;
