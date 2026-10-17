-- Full normal Partner flow for a WordPress-independent managed shop.
-- This is deliberately API/RPC driven: it proves the dashboard home, listing
-- submission, operator approval, growth link and widget use one app_shop_id.
begin;

do $$
declare
  v_suffix text:=left(replace(gen_random_uuid()::text,'-',''),16);
  v_slug text; v_payload jsonb; v_managed uuid; v_shop uuid; v_workspace_a uuid;
  v_user_a uuid:=gen_random_uuid();
begin
  if to_regprocedure('api.get_partner_canonical_auth_membership(uuid)') is null
    or to_regprocedure('api.get_partner_canonical_workspace_identity(uuid,uuid)') is null
    or to_regprocedure('api.get_partner_canonical_growth_v11(uuid,uuid)') is null
    or to_regprocedure('api.get_partner_canonical_listing_editor(uuid,uuid)') is null
    or to_regprocedure('api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb)') is null
    or to_regprocedure('api.submit_partner_canonical_listing_change(uuid,uuid,integer)') is null then
    raise exception 'canonical Partner RPC contract is not applied';
  end if;

  v_slug:='canonical-partner-' || v_suffix;
  v_payload:=jsonb_build_object('shop_name','通常店舗 ' || v_suffix,'area_slug','canonical-partner-area-' || left(v_suffix,8),
    'area_name','通常店舗テスト地域','official_url','https://example.test/' || v_suffix,'introduction','初回の掲載情報',
    'address','大阪府テスト市','business_hours','10:00-22:00','phone','000-0000-0000','line_url',null,
    'booking_url','https://example.test/reserve/' || v_suffix,'basic_price',10000,'price_90',14000,
    'banner_asset_id',null,'gallery_asset_ids','[]'::jsonb);
  v_managed:=api.create_and_publish_canonical_managed_shop(v_slug,v_payload,'partner fixture operator');
  select app_shop_id into v_shop from private.managed_shops where id=v_managed;
  select workspace_id into v_workspace_a
  from api.provision_partner_workspace_for_published_managed_shop(v_slug,'operator');
  if v_workspace_a is null
    or not exists(select 1 from private.partner_workspaces where id=v_workspace_a and app_shop_id=v_shop and wp_shop_id is null) then
    raise exception 'canonical dashboard provisioning did not create an app_shop_id workspace';
  end if;
  -- Fixture auth identity is pre-existing only; this test never creates a
  -- persistent Auth user. Advance the provisioned workspace through its
  -- documented operator states before granting that fixture member access.
  perform private.set_partner_workspace_state(v_workspace_a,'shop_confirmed','fixture operator','canonical identity verified','operator');
  perform private.set_partner_workspace_state(v_workspace_a,'free_official_partner','fixture operator','partner approved','operator');
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace_a,v_user_a,'owner','active',now());

end $$;

do $$
declare
  v_workspace uuid; v_user uuid; v_manager uuid:=gen_random_uuid(); v_managed uuid; v_shop uuid; v_listing jsonb; v_result text; v_handle uuid; v_widget uuid; v_manager_handle uuid; v_manager_widget uuid; v_asset uuid; v_key text; v_target_area_slug text; v_original_area_slug text;
begin
  select workspace.id,membership.auth_user_id,managed.id,shop.id into v_workspace,v_user,v_managed,v_shop
  from private.partner_workspaces workspace join private.partner_memberships membership on membership.workspace_id=workspace.id
  join app.shops shop on shop.id=workspace.app_shop_id join private.managed_shops managed on managed.app_shop_id=shop.id
  where managed.shop_slug like 'canonical-partner-%' order by workspace.created_at desc limit 1;
  select api.get_partner_canonical_listing_editor(v_workspace,v_user) into v_listing;
  if v_listing is null or v_listing->>'app_shop_id'<>v_shop::text or (v_listing->'revision'->>'state')<>'approved' then
    raise exception 'canonical Partner listing did not resolve the app_shop_id projection';
  end if;
  v_original_area_slug:=v_listing->'revision'->>'area_slug';
  v_target_area_slug:='canonical-partner-target-' || left(replace(gen_random_uuid()::text,'-',''),8);
  insert into app.areas(slug,name,is_published,published_at) values(v_target_area_slug,'既存の選択先地域',true,now());
  v_key:=api.reserve_partner_canonical_listing_banner_upload(v_workspace,v_user,'image/png');
  v_asset:=api.attach_partner_canonical_listing_banner_asset(v_workspace,v_user,v_key,repeat('c',64),'image/png',512,32,32);
  if v_asset is null or not exists(select 1 from private.managed_shop_assets where id=v_asset and managed_shop_id=v_managed) then
    raise exception 'Partner banner did not attach as a managed asset';
  end if;
  v_result:=api.save_partner_canonical_listing_draft(v_workspace,v_user,1,jsonb_build_object('shop_name','通常店舗 更新','area_slug',v_target_area_slug,'official_url','https://example.test/updated','introduction','店舗側の下書き','banner_asset_id',v_asset));
  if v_result<>'ok' then raise exception 'Partner draft save failed: %',v_result; end if;
  if exists(select 1 from app.shops where id=v_shop and name='通常店舗 更新') then raise exception 'unapproved Partner edit changed public app shop'; end if;
  v_result:=api.submit_partner_canonical_listing_change(v_workspace,v_user,2);
  if v_result<>'ok' then raise exception 'Partner listing submit failed: %',v_result; end if;
  v_result:=api.review_canonical_managed_shop_revision(v_managed,2,'approved','fixture operator','approved');
  if v_result<>'ok' or not exists(select 1 from app.shops where id=v_shop and name='通常店舗 更新' and excerpt='店舗側の下書き') then
    raise exception 'operator approval did not project Partner revision into public app shop';
  end if;
  if not exists(select 1 from app.shop_areas relation join app.areas area on area.id=relation.area_id where relation.shop_id=v_shop and relation.is_primary and area.slug=v_target_area_slug)
    or (select name from app.areas where slug=v_original_area_slug)<>'通常店舗テスト地域' then
    raise exception 'Partner area selection changed a shared area master or failed to move the primary area';
  end if;
  select review_handle,widget_handle into v_handle,v_widget from api.get_partner_canonical_growth_v11(v_workspace,v_user);
  if v_handle is null or v_widget is null then raise exception 'canonical Partner growth did not create reusable review/widget handles'; end if;
  if not exists(select 1 from private.review_entry_links where public_handle=v_handle and shop_id=v_shop)
    or not exists(select 1 from private.review_widget_settings_v11 where public_handle=v_widget and shop_id=v_shop) then
    raise exception 'growth assets are not bound to the canonical app shop';
  end if;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace,v_manager,'manager','active',now());
  select review_handle,widget_handle into v_manager_handle,v_manager_widget from api.get_partner_canonical_growth_v11(v_workspace,v_manager);
  if v_manager_handle<>v_handle or v_manager_widget<>v_widget
    or not exists(select 1 from api.get_partner_review_widget_v11(v_workspace,v_manager) where public_handle=v_widget) then
    raise exception 'active manager could not read the owner-prepared growth handles';
  end if;
  begin
    perform api.create_partner_review_entry_link(v_workspace,v_manager,null,'email');
    raise exception 'manager created a new Partner review link';
  exception when insufficient_privilege then null;
  end;
  v_result:=api.set_canonical_managed_shop_visibility(v_managed,2,'unlisted','fixture stop');
  if v_result<>'ok' then raise exception 'canonical fixture could not stop the shop'; end if;
  begin
    perform api.get_partner_canonical_growth_v11(v_workspace,v_user);
    raise exception 'stopped canonical shop retained Partner growth access';
  exception when insufficient_privilege then null;
  end;
  v_result:=api.set_canonical_managed_shop_visibility(v_managed,2,'published','fixture restart');
  if v_result<>'ok' then raise exception 'canonical fixture could not restore the shop'; end if;
  begin
    perform api.get_partner_canonical_listing_editor(v_workspace,gen_random_uuid());
    raise exception 'unrelated auth user read canonical Partner listing';
  exception when insufficient_privilege then null;
  end;
  update private.partner_memberships set status='revoked',revoked_at=now() where workspace_id=v_workspace and auth_user_id=v_user;
  begin
    perform api.get_partner_canonical_growth_v11(v_workspace,v_user);
    raise exception 'revoked Partner membership retained growth access';
  exception when insufficient_privilege then null;
  end;
end $$;

select 1 / case when not has_function_privilege('anon','api.get_partner_canonical_growth_v11(uuid,uuid)','execute') then 1 else 0 end as anon_cannot_read_partner_growth;
select 1 / case when not has_function_privilege('authenticated','api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb)','execute') then 1 else 0 end as authenticated_cannot_save_partner_listing;

do $$
declare v_workspace uuid; v_user uuid:=gen_random_uuid(); v_wp_shop_id bigint:=900000000 + floor(random()*999999)::bigint; v_membership record; v_identity record;
begin
  insert into private.partner_workspaces(wp_shop_id,shop_slug,shop_name,canonical_url,state)
  values(v_wp_shop_id,'legacy-workspace-fixture','既存WP店舗','https://mens-esthe-kuchikomi.com/shops/legacy-workspace-fixture/','free_official_partner') returning id into v_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace,v_user,'owner','active',now());
  select * into v_membership from api.get_partner_compatible_auth_membership(v_user);
  select * into v_identity from api.get_partner_compatible_workspace_identity(v_workspace,v_user);
  if v_membership.identity_kind<>'legacy' or v_membership.wp_shop_id<>v_wp_shop_id or v_membership.app_shop_id is not null
    or v_identity.identity_kind<>'legacy' or v_identity.wp_shop_id<>v_wp_shop_id then
    raise exception 'unmapped legacy Partner workspace lost its scoped compatibility login';
  end if;
end $$;
rollback;
