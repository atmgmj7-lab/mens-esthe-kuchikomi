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
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state)
  values(null,v_shop,v_slug,v_payload->>'shop_name','https://mens-esthe-kuchikomi.com/shops/' || v_slug || '/','free_official_partner') returning id into v_workspace_a;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace_a,v_user_a,'owner','active',now());

end $$;

do $$
declare
  v_workspace uuid; v_user uuid; v_managed uuid; v_shop uuid; v_listing jsonb; v_result text; v_handle uuid; v_widget uuid; v_asset uuid; v_key text;
begin
  select workspace.id,membership.auth_user_id,managed.id,shop.id into v_workspace,v_user,v_managed,v_shop
  from private.partner_workspaces workspace join private.partner_memberships membership on membership.workspace_id=workspace.id
  join app.shops shop on shop.id=workspace.app_shop_id join private.managed_shops managed on managed.app_shop_id=shop.id
  where managed.shop_slug like 'canonical-partner-%' order by workspace.created_at desc limit 1;
  select api.get_partner_canonical_listing_editor(v_workspace,v_user) into v_listing;
  if v_listing is null or v_listing->>'app_shop_id'<>v_shop::text or (v_listing->'revision'->>'state')<>'approved' then
    raise exception 'canonical Partner listing did not resolve the app_shop_id projection';
  end if;
  v_key:=api.reserve_partner_canonical_listing_banner_upload(v_workspace,v_user,'image/png');
  v_asset:=api.attach_partner_canonical_listing_banner_asset(v_workspace,v_user,v_key,repeat('c',64),'image/png',512,32,32);
  if v_asset is null or not exists(select 1 from private.managed_shop_assets where id=v_asset and managed_shop_id=v_managed) then
    raise exception 'Partner banner did not attach as a managed asset';
  end if;
  v_result:=api.save_partner_canonical_listing_draft(v_workspace,v_user,1,jsonb_build_object('shop_name','通常店舗 更新','area_name','通常店舗更新地域','official_url','https://example.test/updated','introduction','店舗側の下書き','banner_asset_id',v_asset));
  if v_result<>'ok' then raise exception 'Partner draft save failed: %',v_result; end if;
  if exists(select 1 from app.shops where id=v_shop and name='通常店舗 更新') then raise exception 'unapproved Partner edit changed public app shop'; end if;
  v_result:=api.submit_partner_canonical_listing_change(v_workspace,v_user,2);
  if v_result<>'ok' then raise exception 'Partner listing submit failed: %',v_result; end if;
  v_result:=api.review_canonical_managed_shop_revision(v_managed,2,'approved','fixture operator','approved');
  if v_result<>'ok' or not exists(select 1 from app.shops where id=v_shop and name='通常店舗 更新' and excerpt='店舗側の下書き') then
    raise exception 'operator approval did not project Partner revision into public app shop';
  end if;
  select review_handle,widget_handle into v_handle,v_widget from api.get_partner_canonical_growth_v11(v_workspace,v_user);
  if v_handle is null or v_widget is null then raise exception 'canonical Partner growth did not create reusable review/widget handles'; end if;
  if not exists(select 1 from private.review_entry_links where public_handle=v_handle and shop_id=v_shop)
    or not exists(select 1 from private.review_widget_settings_v11 where public_handle=v_widget and shop_id=v_shop) then
    raise exception 'growth assets are not bound to the canonical app shop';
  end if;
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
rollback;
