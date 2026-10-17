-- New immutable rights snapshots and operational controls. This stays inside
-- a rolled-back fixture; the two-connection race itself is exercised by the
-- companion shell script because it must use distinct database sessions.
begin;
do $$
declare v_shop uuid; v_workspace uuid; v_user uuid:=gen_random_uuid(); v_asset uuid; v_assignment uuid; v_revision integer; v_history record;
begin
  insert into app.shops(slug,canonical_path,name,publication_status,published_at) values('v11-ops-fixture','/shops/v11-ops-fixture/','V11 ops fixture','published',now()) returning id into v_shop;
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state) values(null,v_shop,'v11-ops-fixture','V11 ops fixture','https://mens-esthe-kuchikomi.com/shops/v11-ops-fixture/','active_partner') returning id into v_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at) values(v_workspace,v_user,'owner','active',now());
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height) values(v_workspace,'therapists/'||v_workspace||'/'||gen_random_uuid()||'.jpg',repeat('a',64),'image/jpeg',10,10,10) returning id into v_asset;
  select assignment_id,revision into v_assignment,v_revision from api.create_partner_therapist_assignment(v_workspace,v_user,'履歴名',v_asset,'rights-v1',true);
  select * into v_history from private.therapist_assignment_rights_history where assignment_id=v_assignment order by id desc limit 1;
  if v_history.public_display_name<>'履歴名' or v_history.photo_asset_id<>v_asset or v_history.assignment_revision<>1 or v_history.confirmation_actor<>v_user::text then raise exception 'rights history omitted immutable assignment snapshot'; end if;
end $$;
rollback;
