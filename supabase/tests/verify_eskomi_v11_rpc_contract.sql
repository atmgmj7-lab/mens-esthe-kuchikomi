-- Exercises the named PostgREST RPC contract, reply transaction, benefit
-- reapplication, and retired-person context shape against the actual api
-- wrappers rather than private helpers alone.
begin;
do $$
declare v_shop uuid; v_workspace uuid; v_user uuid:=gen_random_uuid(); v_link uuid; v_experience uuid; v_publication uuid; v_reply uuid; v_program uuid; v_revision integer; v_context record; v_asset uuid; v_assignment uuid; v_widget uuid; v_count bigint;
begin
  insert into app.shops(slug,canonical_path,name,publication_status,published_at) values('v11-rpc-contract','/shops/v11-rpc-contract/','V11 RPC contract','published',now()) returning id into v_shop;
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state) values(null,v_shop,'v11-rpc-contract','V11 RPC contract','https://mens-esthe-kuchikomi.com/shops/v11-rpc-contract/','active_partner') returning id into v_workspace;
  insert into private.partner_memberships(workspace_id,auth_user_id,role,status,accepted_at) values(v_workspace,v_user,'owner','active',now());
  insert into private.review_entry_links(shop_id,link_kind,created_by) values(v_shop,'shop_qr','fixture') returning public_handle into v_link;
  perform api.create_review_submission_context(v_link,repeat('1',64),repeat('2',64),null);
  select experience_id into v_experience from api.submit_review_experience_v11(v_link,repeat('1',64),repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64),3::smallint,'contract',null::text,null::smallint,'ciphertext','nonce','test-v1',repeat('7',64));
  select moderation_revision into v_revision from private.review_experiences where id=v_experience;
  perform api.moderate_review_experience_v11(v_experience,'approved','fixture','ok',v_revision);
  select id into v_publication from app.review_experience_publications where experience_id=v_experience;
  select reply_id into v_reply from api.submit_partner_review_reply_v11(v_workspace,v_user,v_publication,0,'確認済みの返信');
  if (select state from private.review_experience_reply_revisions where id=v_reply)<>'pending' then raise exception 'named reply submit did not create pending revision'; end if;
  if api.moderate_partner_review_reply_v11(v_reply,'approved','fixture')<>'approved' then raise exception 'named reply approval failed'; end if;
  select program_id,revision into v_program,v_revision from api.save_partner_benefit_program_v11(v_workspace,v_user,0,'初回特典','other',null,null,'初回条件','店舗','店舗',now(),null,30,false);
  if v_revision<>1 then raise exception 'initial benefit setting failed'; end if;
  select revision into v_revision from api.save_partner_benefit_program_v11(v_workspace,v_user,v_revision,'更新特典','other',null,null,'更新条件','店舗','店舗',now(),null,30,false);
  if v_revision<>2 or (select count(*) from private.benefit_program_versions where program_id=v_program)<>2 then raise exception 'benefit reapplication did not make a new immutable version'; end if;
  perform api.open_review_edit_session(repeat('5',64),repeat('a',64),repeat('b',64));
  if (select revision from api.get_review_editable_v11(repeat('a',64)))<>1 then raise exception 'guest edit receipt did not expose the current review'; end if;
  select revision into v_revision from api.edit_review_experience_v11(repeat('a',64),1,'編集後','編集後の本文',4::smallint,null::smallint);
  if v_revision<>2 or exists(select 1 from app.review_experience_publications where experience_id=v_experience and publication_state='published') then raise exception 'guest edit did not hide the old projection'; end if;
  if (select state from api.create_review_appeal_v11(repeat('a',64),2,'再審査をお願いします'))<>'pending' then raise exception 'guest appeal was not created'; end if;
  select moderation_revision into v_revision from private.review_experiences where id=v_experience;
  perform api.moderate_review_experience_v11(v_experience,'approved','fixture','edited',v_revision);
  select public_handle into v_widget from api.get_partner_review_widget_v11(v_workspace,v_user);
  select review_count into v_count from api.get_public_review_widget_v11(v_widget,3,0) limit 1;
  if v_count<>1 then raise exception 'widget did not return the approved edited review'; end if;
  if api.withdraw_review_experience_v11(repeat('a',64),2)<>'withdrawn' then raise exception 'guest withdrawal failed'; end if;
  select review_count into v_count from api.get_public_review_widget_v11(v_widget,3,0) limit 1;
  if v_count<>0 then raise exception 'widget did not return an explicit zero-review summary after withdrawal'; end if;
  insert into private.therapist_assets(workspace_id,object_key,sha256,content_type,byte_size,width,height) values(v_workspace,'therapists/'||v_workspace||'/'||gen_random_uuid()||'.jpg',repeat('a',64),'image/jpeg',10,10,10) returning id into v_asset;
  select assignment_id into v_assignment from api.create_partner_therapist_assignment(v_workspace,v_user,'退店担当',v_asset,'rights-v1',true);
  insert into private.review_entry_links(shop_id,therapist_assignment_id,link_kind,created_by) values(v_shop,v_assignment,'therapist_link','fixture') returning public_handle into v_link;
  perform api.end_partner_therapist_assignment(v_workspace,v_user,v_assignment,1);
  select * into v_context from api.create_review_submission_context(v_link,repeat('8',64),repeat('9',64),null);
  if v_context.therapist_unavailable is not true or v_context.therapist_display_name is not null then raise exception 'upgrade-compatible context did not expose retired-person fallback'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname='submit_partner_review_reply_v11' and p.proargnames @> array['p_workspace_id','p_auth_user_id','p_publication_id','p_expected_revision','p_body']) then raise exception 'reply RPC parameter names are missing'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname='get_review_benefit_receipt_v11' and p.proargnames @> array['p_experience_id','p_session_secret_hash']) then raise exception 'benefit receipt RPC parameter names are missing'; end if;
end $$;
rollback;
