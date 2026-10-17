-- Disposable execution coverage for workspace-scoped therapist registration,
-- photo rights, durable links, and offline-only request previews.
begin;

do $$
declare
  v_shop_a uuid; v_shop_b uuid; v_workspace_a uuid; v_workspace_b uuid;
  v_asset_a uuid; v_asset_b uuid; v_assignment_a uuid; v_assignment_b uuid;
  v_revision integer; v_handle uuid; v_handle_again uuid; v_subject text; v_body text; v_url text; v_name text; v_auth_user_a uuid:=gen_random_uuid(); v_auth_user_b uuid:=gen_random_uuid(); v_scope uuid;
begin
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('partner-therapist-a','/shops/partner-therapist-a/','Partner therapist A','published',now()) returning id into v_shop_a;
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('partner-therapist-b','/shops/partner-therapist-b/','Partner therapist B','published',now()) returning id into v_shop_b;
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state)
  values(null,v_shop_a,'partner-therapist-a','Partner therapist A','https://mens-esthe-kuchikomi.com/shops/partner-therapist-a/','free_official_partner') returning id into v_workspace_a;
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state)
  values(null,v_shop_b,'partner-therapist-b','Partner therapist B','https://mens-esthe-kuchikomi.com/shops/partner-therapist-b/','free_official_partner') returning id into v_workspace_b;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace_a,v_auth_user_a,'owner','active',now());
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at)
  values(v_workspace_b,v_auth_user_b,'owner','active',now());
  select workspace_id into v_scope from api.get_partner_therapist_workspace_scope(v_auth_user_a);
  if v_scope <> v_workspace_a then raise exception 'therapist workspace scope did not resolve only the active membership'; end if;
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height)
  values(v_workspace_a,'therapists/' || v_workspace_a || '/' || gen_random_uuid() || '.jpg',repeat('a',64),'image/jpeg',1200,120,160) returning id into v_asset_a;
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height)
  values(v_workspace_b,'therapists/' || v_workspace_b || '/' || gen_random_uuid() || '.jpg',repeat('b',64),'image/jpeg',1200,120,160) returning id into v_asset_b;

  select assignment_id,revision into v_assignment_a,v_revision
  from api.create_partner_therapist_assignment(v_workspace_a,v_auth_user_a,'公開名A',v_asset_a,'rights-v1',true);
  if v_revision <> 1 or (select count(*) from private.therapist_assignment_rights where assignment_id=v_assignment_a and workspace_id=v_workspace_a) <> 1 then
    raise exception 'therapist registration did not retain the workspace rights confirmation';
  end if;
  begin
    perform api.create_partner_therapist_assignment(v_workspace_a,v_auth_user_a,'他店写真',v_asset_b,'rights-v1',true);
    raise exception 'other-workspace photo was accepted';
  exception when insufficient_privilege then null;
  end;
  select assignment_id into v_assignment_b
  from api.create_partner_therapist_assignment(v_workspace_b,v_auth_user_b,'公開名B',v_asset_b,'rights-v1',true);
  begin
    perform api.update_partner_therapist_assignment(v_workspace_a,v_auth_user_a,v_assignment_b,1,'改ざん',v_asset_a,'rights-v2',true);
    raise exception 'other-workspace therapist edit was accepted';
  exception when insufficient_privilege then null;
  end;

  select assignment_id,revision into v_assignment_a,v_revision
  from api.update_partner_therapist_assignment(v_workspace_a,v_auth_user_a,v_assignment_a,v_revision,'公開名A更新',v_asset_a,'rights-v2',true);
  if v_revision <> 2 then raise exception 'therapist revision did not advance'; end if;
  select public_handle into v_handle from api.create_partner_review_entry_link(v_workspace_a,v_auth_user_a,v_assignment_a,'line');
  select public_handle into v_handle_again from api.create_partner_review_entry_link(v_workspace_a,v_auth_user_a,v_assignment_a,'line');
  if v_handle <> v_handle_again then raise exception 'permanent therapist link was regenerated'; end if;
  begin
    perform api.create_partner_review_entry_link(v_workspace_a,v_auth_user_a,v_assignment_b,'line');
    raise exception 'other-workspace therapist link was accepted';
  exception when insufficient_privilege then null;
  end;
  select subject,body,review_url,therapist_display_name into v_subject,v_body,v_url,v_name
  from api.preview_partner_review_request(v_workspace_a,v_auth_user_a,v_assignment_a,'email','today');
  if v_subject <> 'ご利用ありがとうございました｜Partner therapist A' or v_body !~ 'https://mens-esthe-kuchikomi.com/r/'
    or v_body ~ '(?i)(mailto:|line\.me)' then raise exception 'email preview did not remain an offline copy-only message'; end if;
  select revision into v_revision from api.end_partner_therapist_assignment(v_workspace_a,v_auth_user_a,v_assignment_a,v_revision);
  if v_revision <> 3 then raise exception 'therapist end did not advance revision'; end if;
  select public_handle into v_handle_again from api.create_partner_review_entry_link(v_workspace_a,v_auth_user_a,v_assignment_a,'line');
  if v_handle_again <> v_handle then raise exception 'ended therapist invalidated the reusable link'; end if;
  select therapist_display_name into v_name from api.preview_partner_review_request(v_workspace_a,v_auth_user_a,v_assignment_a,'line','recent');
  if v_name is not null then raise exception 'retired therapist was silently retained in a new request preview'; end if;
  update private.partner_memberships set status='revoked',revoked_at=now() where workspace_id=v_workspace_a and auth_user_id=v_auth_user_a;
  begin
    perform api.create_partner_review_entry_link(v_workspace_a,v_auth_user_a,null,'email');
    raise exception 'revoked membership mutation was accepted';
  exception when insufficient_privilege then null;
  end;

  if has_function_privilege('anon','api.create_partner_therapist_assignment(uuid,text,uuid,text,boolean)','EXECUTE')
    or has_function_privilege('authenticated','api.preview_partner_review_request(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','api.get_partner_therapist_workspace_scope(uuid)','EXECUTE') then
    raise exception 'browser roles received therapist administration RPC access';
  end if;
end;
$$;

rollback;
