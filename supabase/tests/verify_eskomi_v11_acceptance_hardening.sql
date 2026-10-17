-- Exercises the final API-shaped v1.1 RPC, including atomic encrypted replay,
-- neutral immutable benefit terms, expiry, and stale moderation rejection.
begin;
do $$
declare
  v_shop uuid; v_workspace uuid; v_link uuid; v_experience uuid; v_replayed boolean; v_status text;
  v_code_hash text:=repeat('c',64); v_program uuid; v_revision integer; v_count integer;
begin
  insert into app.shops(slug,canonical_path,name,publication_status,published_at)
  values('v11-hardening-fixture','/shops/v11-hardening-fixture/','V11 hardening fixture','published',now()) returning id into v_shop;
  insert into private.partner_workspaces(wp_shop_id,app_shop_id,shop_slug,shop_name,canonical_url,state)
  values(null,v_shop,'v11-hardening-fixture','V11 hardening fixture','https://mens-esthe-kuchikomi.com/shops/v11-hardening-fixture/','active_partner') returning id into v_workspace;
  insert into private.review_entry_links(shop_id,link_kind,created_by) values(v_shop,'shop_qr','fixture') returning public_handle into v_link;
  insert into private.benefit_programs(workspace_id,shop_id,state,eligibility_rule,benefit_text,operator_approved_at,operator_approved_by,current_version)
  values(v_workspace,v_shop,'approved','accepted_submission','Neutral terms',now(),'fixture',1) returning id into v_program;
  insert into private.benefit_program_versions(program_id,version,title,benefit_kind,amount_yen,terms_text,issuer_label,funding_party_label,valid_from,redeem_valid_days,eligibility_version,approved_at,approved_by)
  values(v_program,1,'Fixture benefit','amount_off',100,'Neutral fixture terms','Fixture','Fixture',now()-interval '1 minute',1,'fixture-v1',now(),'fixture');
  perform api.create_review_submission_context(v_link,repeat('1',64),repeat('2',64));
  select experience_id,replayed,benefit_status into v_experience,v_replayed,v_status from api.submit_review_experience_v11(
    v_link,repeat('1',64),repeat('3',64),repeat('4',64),repeat('5',64),repeat('6',64),1::smallint,''::text,null::text,null::smallint,
    'ciphertext','nonce','test-v1',v_code_hash);
  if v_replayed or v_status<>'issued' or not exists(select 1 from private.operation_secret_replays) then raise exception 'acceptance did not atomically store replay and neutral benefit'; end if;
  select experience_id,replayed,benefit_status into v_experience,v_replayed,v_status from api.submit_review_experience_v11(
    v_link,repeat('1',64),repeat('3',64),repeat('4',64),repeat('7',64),repeat('6',64),1::smallint,''::text,null::text,null::smallint,
    'other-ciphertext','nonce2','test-v1',repeat('d',64));
  if not v_replayed or (select count(*) from private.review_experiences)<>1 then raise exception 'same tab replay was not idempotent'; end if;
  update private.benefit_codes set expires_at=now() where experience_id=v_experience;
  if private.redeem_benefit_code(v_workspace,v_code_hash)<>'expired' then raise exception 'expired immutable benefit redeemed'; end if;
  select moderation_revision into v_revision from private.review_experiences where id=v_experience;
  if private.moderate_review_experience_v11(v_experience,'approved','fixture','ok',v_revision)<>'approved' then raise exception 'approval failed'; end if;
  if private.moderate_review_experience_v11(v_experience,'withdrawn','fixture','withdraw',v_revision+1)<>'withdrawn' then raise exception 'withdrawal failed'; end if;
  begin
    perform private.moderate_review_experience_v11(v_experience,'approved','fixture','stale',v_revision+1);
    raise exception 'stale approval resurrected withdrawn review';
  exception when serialization_failure then null;
  end;
  select count(*) into v_count from api.list_public_review_experience_publications('v11-hardening-fixture',20,0);
  if v_count<>0 then raise exception 'withdrawn publication remained public'; end if;
  if has_function_privilege('anon','api.open_review_edit_session(text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text)','EXECUTE')
    or has_function_privilege('service_role','api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint)','EXECUTE') then raise exception 'unsafe v1.1 API grant remains'; end if;
end $$;
rollback;
