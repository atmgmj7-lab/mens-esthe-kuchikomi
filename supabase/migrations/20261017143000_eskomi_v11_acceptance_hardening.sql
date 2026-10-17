-- The v1.1 browser route passes an already encrypted replay payload into this
-- transaction.  Acceptance, idempotency, the private receipt, optional
-- neutral benefit issuance, and replay recovery therefore commit together.

alter table private.review_experiences
  add column if not exists moderation_revision integer not null default 1 check (moderation_revision > 0);

create or replace function private.submit_review_experience_v11(
  p_entry_handle uuid, p_session_secret_hash text, p_idempotency_hash text, p_request_fingerprint text,
  p_receipt_hash text, p_ip_shop_hash text, p_shop_rating smallint, p_common_comment text,
  p_guest_display_name text, p_therapist_rating smallint,
  p_replay_ciphertext text, p_replay_nonce text, p_replay_key_version text, p_benefit_code_hash text
) returns table (experience_id uuid, replayed boolean, receipt_expires_at timestamptz, benefit_status text)
language plpgsql security definer set search_path=private,app,extensions,pg_temp as $$
declare
  v_session private.guest_operation_sessions%rowtype; v_link private.review_entry_links%rowtype;
  v_existing private.operation_idempotency%rowtype; v_experience uuid; v_revision uuid; v_allowed boolean;
  v_program private.benefit_programs%rowtype; v_version private.benefit_program_versions%rowtype;
  v_benefit_expires timestamptz; v_benefit_status text := 'unavailable'; v_assignment_id uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$'
    or p_request_fingerprint !~ '^[0-9a-f]{64}$' or p_receipt_hash !~ '^[0-9a-f]{64}$'
    or p_ip_shop_hash !~ '^[0-9a-f]{64}$' or p_benefit_code_hash !~ '^[0-9a-f]{64}$'
    or char_length(p_replay_ciphertext) not between 1 and 4096 or char_length(p_replay_nonce) not between 1 and 128
    or char_length(p_replay_key_version) not between 1 and 80
    or char_length(btrim(coalesce(p_guest_display_name,''))) > 30 or char_length(btrim(coalesce(p_common_comment,''))) > 400
    or (p_shop_rating is not null and p_shop_rating not between 1 and 5)
    or (p_therapist_rating is not null and p_therapist_rating not between 1 and 5) then
    raise exception 'invalid review submission' using errcode='22023';
  end if;
  if p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_common_comment,''))='' then
    raise exception 'at least one review answer is required' using errcode='22023';
  end if;
  select * into v_session from private.guest_operation_sessions session
    where session.session_secret_hash=p_session_secret_hash and session.revoked_at is null for update;
  if not found then raise exception 'review session is unavailable' using errcode='P0002'; end if;
  select * into v_existing from private.operation_idempotency operation
    where operation.operation='review_submit' and operation.actor_scope_hash=p_session_secret_hash and operation.key_hash=p_idempotency_hash for update;
  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then raise exception 'idempotency key has a different payload' using errcode='23505'; end if;
    if v_session.replay_expires_at <= now() then raise exception 'review replay has expired' using errcode='P0002'; end if;
    return query select v_existing.result_entity_id,true,receipt.expires_at,
      case when exists(select 1 from private.benefit_codes code where code.experience_id=v_existing.result_entity_id) then 'already_issued' else 'unavailable' end
    from private.review_edit_receipts receipt where receipt.experience_id=v_existing.result_entity_id;
    return;
  end if;
  if v_session.submit_context_expires_at <= now() or (v_session.context_snapshot->>'entryHandle')::uuid <> p_entry_handle then
    raise exception 'review context is unavailable' using errcode='P0002';
  end if;
  select link.* into v_link from private.review_entry_links link
    join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
    left join private.managed_shops managed on managed.app_shop_id=shop.id
    where link.public_handle=p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at>now())
      and (managed.id is null or managed.publication_state='published') for update of link;
  if not found then raise exception 'review target is unavailable' using errcode='P0002'; end if;
  v_assignment_id := nullif(v_session.context_snapshot->>'assignmentId','')::uuid;
  if (v_session.context_snapshot->>'shopId')::uuid <> v_link.shop_id
    or (v_link.therapist_assignment_id is not null and v_link.therapist_assignment_id <> v_assignment_id) then
    raise exception 'review context target changed' using errcode='23505';
  end if;
  select allowed into v_allowed from private.claim_review_entry_rate_limit(p_ip_shop_hash,p_idempotency_hash,5);
  if not v_allowed then raise exception 'review burst limit reached' using errcode='P0001'; end if;
  if p_therapist_rating is not null and v_assignment_id is null then raise exception 'therapist is not selected for this context' using errcode='22023'; end if;
  if v_assignment_id is not null and not exists(select 1 from app.therapist_assignments assignment where assignment.id=v_assignment_id and assignment.shop_id=v_link.shop_id and assignment.lifecycle_state='active' and (assignment.active_until is null or assignment.active_until>now())) then
    raise exception 'therapist assignment is unavailable' using errcode='P0002';
  end if;
  insert into private.review_experiences(shop_id,entry_link_id,guest_display_name,edit_receipt_hash,ip_prefix_hash)
    values(v_link.shop_id,v_link.id,nullif(btrim(coalesce(p_guest_display_name,'')),''),p_receipt_hash,p_ip_shop_hash) returning id into v_experience;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment)
    values(v_experience,1,nullif(btrim(coalesce(p_guest_display_name,'')),''),btrim(coalesce(p_common_comment,''))) returning id into v_revision;
  insert into private.review_assessments(experience_id,target_kind,shop_id,rating,body)
    values(v_experience,'shop',v_link.shop_id,p_shop_rating,btrim(coalesce(p_common_comment,'')));
  if p_therapist_rating is not null then
    insert into private.review_assessments(experience_id,target_kind,shop_id,therapist_assignment_id,rating,body)
      values(v_experience,'therapist',v_link.shop_id,v_assignment_id,p_therapist_rating,'');
  end if;
  insert into private.review_edit_receipts(experience_id,secret_hash) values(v_experience,p_receipt_hash);
  insert into private.operation_idempotency(operation,actor_scope_hash,key_hash,request_fingerprint,result_entity_id)
    values('review_submit',p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,v_experience) returning id into v_existing.id;
  insert into private.operation_secret_replays(operation_id,ciphertext,nonce,key_version,expires_at)
    values(v_existing.id,p_replay_ciphertext,p_replay_nonce,p_replay_key_version,least(v_session.replay_expires_at,now()+interval '24 hours'));
  select * into v_program from private.benefit_programs program
    where program.shop_id=v_link.shop_id and program.state='approved' and program.eligibility_rule='accepted_submission'
      and program.current_version>0 for key share;
  if found then
    select * into v_version from private.benefit_program_versions version
      where version.program_id=v_program.id and version.version=v_program.current_version
        and version.approved_at is not null and version.valid_from<=now()
        and (version.valid_until is null or version.valid_until>now()) for key share;
    if found then
      v_benefit_expires := case when v_version.redeem_valid_days is null then v_version.redeem_deadline
        when v_version.redeem_deadline is null then now()+make_interval(days=>v_version.redeem_valid_days)
        else least(v_version.redeem_deadline,now()+make_interval(days=>v_version.redeem_valid_days)) end;
      if v_benefit_expires is null or v_benefit_expires>now() then
        insert into private.benefit_codes(program_id,experience_id,code_hash,program_version,expires_at,benefit_snapshot)
          values(v_program.id,v_experience,p_benefit_code_hash,v_version.version,v_benefit_expires,to_jsonb(v_version))
          on conflict on constraint benefit_codes_experience_id_key do nothing;
        v_benefit_status:=case when found then 'issued' else 'already_issued' end;
      end if;
    end if;
  end if;
  insert into private.review_outbox(event_type,aggregate_id,payload) values('review_submitted',v_experience,jsonb_build_object('revisionId',v_revision,'formVersion','v1.1'));
  if v_benefit_status='issued' then insert into private.review_outbox(event_type,aggregate_id,payload) values('benefit_issued',v_experience,jsonb_build_object('programId',v_program.id,'version',v_version.version)); end if;
  return query select v_experience,false,now()+interval '30 days',v_benefit_status;
end $$;

create or replace function private.redeem_benefit_code(p_workspace_id uuid,p_code_hash text)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_code private.benefit_codes%rowtype; v_program private.benefit_programs%rowtype;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if;
  select * into v_code from private.benefit_codes code where code.code_hash=p_code_hash for update;
  if not found then return 'invalid'; end if;
  select * into v_program from private.benefit_programs program where program.id=v_code.program_id for key share;
  if v_program.workspace_id<>p_workspace_id then return 'forbidden'; end if;
  if v_code.state<>'issued' then return 'already_used'; end if;
  if v_code.expires_at is not null and v_code.expires_at<=now() then return 'expired'; end if;
  update private.benefit_codes set state='redeemed',redeemed_at=now(),redeemed_by_workspace_id=p_workspace_id where id=v_code.id and state='issued';
  if not found then return 'already_used'; end if;
  insert into private.review_outbox(event_type,aggregate_id,payload) values('benefit_redeemed',v_code.id,jsonb_build_object('programId',v_program.id)); return 'redeemed';
end $$;

create or replace function private.moderate_review_experience_v11(
  p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience private.review_experiences%rowtype; v_revision private.review_experience_revisions%rowtype;
begin
  if p_decision not in ('approved','rejected','withdrawn') or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid moderation decision' using errcode='22023'; end if;
  select * into v_experience from private.review_experiences experience where experience.id=p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode='P0002'; end if;
  if p_expected_revision is not null and p_expected_revision<>v_experience.moderation_revision then raise exception 'review moderation changed' using errcode='40001'; end if;
  if v_experience.state='withdrawn' or v_experience.state='rejected' then return v_experience.state; end if;
  if v_experience.state='approved' and p_decision<>'withdrawn' then return 'approved'; end if;
  select * into v_revision from private.review_experience_revisions revision where revision.experience_id=v_experience.id order by revision.revision desc limit 1 for update;
  update private.review_experiences set state=p_decision,reviewed_at=now(),withdrawn_at=case when p_decision='withdrawn' then now() else null end,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience.id;
  update private.review_experience_revisions set moderation_state=case when p_decision='approved' then 'approved' when p_decision='withdrawn' then 'withdrawn' else 'rejected' end,reviewed_at=now() where id=v_revision.id;
  if p_decision='approved' then
    insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,therapist_assignment_id,publication_state,published_at)
      values(v_experience.id,v_revision.id,v_experience.shop_id,(select therapist_assignment_id from private.review_assessments where experience_id=v_experience.id and target_kind='therapist'),'published',now())
      on conflict(experience_id) do update set active_revision_id=excluded.active_revision_id,publication_state='published',published_at=now(),hidden_at=null,public_version=app.review_experience_publications.public_version+1,updated_at=now();
  elsif p_decision='withdrawn' then update app.review_experience_publications set publication_state='hidden',hidden_at=now(),public_version=public_version+1,updated_at=now() where experience_id=v_experience.id and publication_state<>'hidden'; end if;
  insert into private.review_moderation_decisions(experience_id,decision,actor_label,note) values(v_experience.id,p_decision,btrim(p_actor_label),nullif(btrim(coalesce(p_note,'')),''));
  insert into private.review_outbox(event_type,aggregate_id,payload) values(case when p_decision='approved' then 'review_approved' when p_decision='withdrawn' then 'review_withdrawn' else 'review_rejected' end,v_experience.id,jsonb_build_object('v11',true,'expectedRevision',p_expected_revision));
  return p_decision;
end $$;

create or replace function api.open_review_edit_session(p_receipt_hash text,p_session_secret_hash text,p_context_fingerprint text)
returns table(experience_id uuid,expires_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.open_review_edit_session(p_receipt_hash,p_session_secret_hash,p_context_fingerprint) $$;
create or replace function api.submit_review_experience_v11(
  p_entry_handle uuid,p_session_secret_hash text,p_idempotency_hash text,p_request_fingerprint text,p_receipt_hash text,p_ip_shop_hash text,p_shop_rating smallint,p_common_comment text,p_guest_display_name text,p_therapist_rating smallint,p_replay_ciphertext text,p_replay_nonce text,p_replay_key_version text,p_benefit_code_hash text
) returns table(experience_id uuid,replayed boolean,receipt_expires_at timestamptz,benefit_status text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_review_experience_v11(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating,p_replay_ciphertext,p_replay_nonce,p_replay_key_version,p_benefit_code_hash) $$;
revoke all on function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text),private.moderate_review_experience_v11(uuid,text,text,text,integer),api.open_review_edit_session(text,text,text),api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text) from public,anon,authenticated;
revoke execute on function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint),api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint) from service_role;
grant execute on function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text),private.moderate_review_experience_v11(uuid,text,text,text,integer),api.open_review_edit_session(text,text,text),api.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text) to service_role;
notify pgrst,'reload schema';
