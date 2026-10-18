-- Operational v1.1 completion.  This is deliberately additive: issued
-- benefits and historical rights confirmations retain the values that were
-- true when they were recorded, and no browser role receives table access.

alter table private.therapist_assignment_rights_history
  add column if not exists public_display_name text,
  add column if not exists photo_asset_id uuid,
  add column if not exists assignment_revision integer,
  add column if not exists confirmation_actor text;

update private.therapist_assignment_rights_history history
set public_display_name = assignment.display_name,
    photo_asset_id = (select asset.id from private.therapist_assets asset where asset.workspace_id=history.workspace_id and asset.object_key=assignment.photo_asset_key),
    assignment_revision = assignment.revision,
    confirmation_actor = coalesce(history.confirmation_actor, 'legacy-unattributed')
from app.therapist_assignments assignment
where assignment.id = history.assignment_id
  and (history.public_display_name is null or history.assignment_revision is null);

alter table private.therapist_assignment_rights_history
  alter column public_display_name set not null,
  alter column assignment_revision set not null,
  alter column confirmation_actor set not null;

create or replace function private.audit_therapist_assignment_rights() returns trigger
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_assignment app.therapist_assignments%rowtype; v_asset uuid; v_actor text;
begin
  select * into v_assignment from app.therapist_assignments where id=new.assignment_id;
  select id into v_asset from private.therapist_assets
    where workspace_id=new.workspace_id and object_key=v_assignment.photo_asset_key;
  v_actor := nullif(current_setting('eskomi.confirmation_actor', true), '');
  insert into private.therapist_assignment_rights_history(
    assignment_id,workspace_id,permission_policy_version,permission_confirmed_at,
    public_display_name,photo_asset_id,assignment_revision,confirmation_actor
  ) values (
    new.assignment_id,new.workspace_id,new.permission_policy_version,new.permission_confirmed_at,
    v_assignment.display_name,v_asset,v_assignment.revision,coalesce(v_actor,'workspace-confirmation')
  );
  return new;
end $$;

-- A service route can show the accepted receipt's immutable terms only after
-- proving it is the same short-lived tab session.  The code itself remains in
-- the encrypted replay payload and is never queried or logged as database data.
create or replace function private.get_review_benefit_receipt_v11(
  p_experience_id uuid, p_session_secret_hash text
) returns table(benefit_status text, expires_at timestamptz, benefit_snapshot jsonb)
language plpgsql security definer set search_path=private,pg_temp as $$
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid benefit receipt request' using errcode='22023'; end if;
  if not exists (
    select 1 from private.operation_idempotency operation
    where operation.operation='review_submit' and operation.actor_scope_hash=p_session_secret_hash
      and operation.result_entity_id=p_experience_id
  ) then raise exception 'benefit receipt is unavailable' using errcode='42501'; end if;
  return query select case code.state when 'redeemed' then 'redeemed' when 'void' then 'void'
    when code.expires_at is not null and code.expires_at<=now() then 'expired' else 'issued' end,
    code.expires_at, code.benefit_snapshot
  from private.benefit_codes code where code.experience_id=p_experience_id;
end $$;

-- Partner review replies are versioned and require an operator approval. They
-- intentionally do not alter the review or its publication state.
create table private.review_experience_reply_revisions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references app.review_experience_publications(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  revision integer not null check (revision > 0),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  state text not null default 'pending' check (state in ('draft','pending','approved','rejected','withdrawn')),
  submitted_at timestamptz not null default now(), reviewed_at timestamptz,
  reviewed_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(publication_id,workspace_id,revision)
);
create index review_experience_reply_revisions_pending_idx on private.review_experience_reply_revisions(state,submitted_at) where state='pending';
alter table private.review_experience_reply_revisions enable row level security;
revoke all on table private.review_experience_reply_revisions from public,anon,authenticated;
grant select,insert,update on table private.review_experience_reply_revisions to service_role;

create or replace function private.assert_partner_v11_membership(p_workspace_id uuid,p_auth_user_id uuid) returns uuid
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role='owner' and workspace.state in ('free_official_partner','active_partner')
    and workspace.app_shop_id is not null for update of membership,workspace;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.submit_partner_review_reply_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text
) returns table(reply_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_revision integer; v_body text; v_id uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  v_body:=btrim(coalesce(p_body,''));
  if p_expected_revision is null or p_expected_revision < 0 or char_length(v_body) not between 1 and 500 then raise exception 'invalid reply request' using errcode='22023'; end if;
  perform 1 from app.review_experience_publications publication where publication.id=p_publication_id and publication.shop_id=v_shop and publication.publication_state='published' for key share;
  if not found then raise exception 'review is unavailable for this workspace' using errcode='42501'; end if;
  select coalesce(max(reply.revision),0) into v_revision from private.review_experience_reply_revisions reply
    where reply.publication_id=p_publication_id and reply.workspace_id=p_workspace_id for update;
  if v_revision<>p_expected_revision then raise exception 'reply changed' using errcode='40001'; end if;
  insert into private.review_experience_reply_revisions(publication_id,workspace_id,revision,body,state)
  values(p_publication_id,p_workspace_id,v_revision+1,v_body,'pending') returning id into v_id;
  insert into private.review_outbox(event_type,aggregate_id,payload)
  values('reply_submitted',v_id,jsonb_build_object('publicationId',p_publication_id,'revision',v_revision+1));
  return query select v_id,v_revision+1,'pending'::text;
end $$;

create or replace function private.moderate_partner_review_reply_v11(
  p_reply_id uuid,p_decision text,p_actor_label text
) returns text language plpgsql security definer set search_path=private,pg_temp as $$
begin
  if p_decision not in ('approved','rejected','withdrawn') or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid reply moderation' using errcode='22023'; end if;
  update private.review_experience_reply_revisions set state=p_decision,reviewed_at=now(),reviewed_by=btrim(p_actor_label),updated_at=now()
  where id=p_reply_id and state='pending';
  if not found then raise exception 'reply is not pending' using errcode='40001'; end if;
  return p_decision;
end $$;

-- Benefit set-up always creates a new immutable version. The approval step is
-- separate, so draft/pending conditions cannot issue codes.
create or replace function private.save_partner_benefit_program_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_title text,p_benefit_kind text,
  p_amount_yen integer,p_rate numeric,p_terms_text text,p_issuer_label text,p_funding_party_label text,
  p_valid_from timestamptz,p_valid_until timestamptz,p_redeem_valid_days integer,p_combinable boolean
) returns table(program_id uuid,revision integer,version integer,state text)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_program private.benefit_programs%rowtype; v_version integer;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  if p_expected_revision is null or p_expected_revision<0 or char_length(btrim(coalesce(p_title,''))) not between 1 and 60
    or p_benefit_kind not in ('amount_off','percent_off','other') or char_length(btrim(coalesce(p_terms_text,''))) not between 1 and 4000
    or char_length(btrim(coalesce(p_issuer_label,''))) not between 1 and 120 or char_length(btrim(coalesce(p_funding_party_label,''))) not between 1 and 120
    or p_valid_from is null or (p_valid_until is not null and p_valid_until<=p_valid_from)
    or (p_redeem_valid_days is not null and p_redeem_valid_days not between 1 and 3650)
    or (p_benefit_kind='amount_off' and (p_amount_yen is null or p_amount_yen<0 or p_rate is not null))
    or (p_benefit_kind='percent_off' and (p_rate is null or p_rate<=0 or p_rate>1 or p_amount_yen is not null))
    or (p_benefit_kind='other' and (p_amount_yen is not null or p_rate is not null)) then raise exception 'invalid benefit program' using errcode='22023'; end if;
  select * into v_program from private.benefit_programs where workspace_id=p_workspace_id and shop_id=v_shop for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'benefit program changed' using errcode='40001'; end if;
    insert into private.benefit_programs(workspace_id,shop_id,state,eligibility_rule,benefit_text,current_version,revision)
    values(p_workspace_id,v_shop,'pending_approval','accepted_submission',btrim(p_terms_text),1,1) returning * into v_program;
  else
    if p_expected_revision<>v_program.revision then raise exception 'benefit program changed' using errcode='40001'; end if;
    update private.benefit_programs set state='pending_approval',benefit_text=btrim(p_terms_text),current_version=current_version+1,revision=revision+1,operator_approved_at=null,operator_approved_by=null,updated_at=now()
    where id=v_program.id returning * into v_program;
  end if;
  v_version:=v_program.current_version;
  insert into private.benefit_program_versions(program_id,version,title,benefit_kind,amount_yen,rate,terms_text,issuer_label,funding_party_label,valid_from,valid_until,redeem_valid_days,combinable,eligibility_version)
  values(v_program.id,v_version,btrim(p_title),p_benefit_kind,p_amount_yen,p_rate,btrim(p_terms_text),btrim(p_issuer_label),btrim(p_funding_party_label),p_valid_from,p_valid_until,p_redeem_valid_days,coalesce(p_combinable,false),'v1.1');
  return query select v_program.id,v_program.revision,v_version,v_program.state;
end $$;

create or replace function private.approve_benefit_program_v11(p_program_id uuid,p_expected_revision integer,p_actor_label text)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_program private.benefit_programs%rowtype;
begin
  if p_expected_revision is null or p_expected_revision<1 or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid benefit approval' using errcode='22023'; end if;
  select * into v_program from private.benefit_programs where id=p_program_id for update;
  if not found or v_program.revision<>p_expected_revision or v_program.state<>'pending_approval' then raise exception 'benefit program changed' using errcode='40001'; end if;
  update private.benefit_program_versions set approved_at=now(),approved_by=btrim(p_actor_label) where program_id=v_program.id and version=v_program.current_version;
  update private.benefit_programs set state='approved',operator_approved_at=now(),operator_approved_by=btrim(p_actor_label),updated_at=now() where id=v_program.id;
  return 'approved';
end $$;

create or replace function private.list_partner_benefit_operations_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(program_id uuid,revision integer,state text,version integer,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,combinable boolean,issued_count bigint,redeemed_count bigint)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  return query select program.id,program.revision,program.state,version.version,version.title,version.benefit_kind,version.amount_yen,version.rate,version.terms_text,version.valid_from,version.valid_until,version.redeem_valid_days,version.combinable,
    count(code.id) filter(where code.state='issued'),count(code.id) filter(where code.state='redeemed')
  from private.benefit_programs program join private.benefit_program_versions version on version.program_id=program.id and version.version=program.current_version
  left join private.benefit_codes code on code.program_id=program.id and code.program_version=version.version
  where program.workspace_id=p_workspace_id and program.shop_id=v_shop
  group by program.id,program.revision,program.state,version.program_id,version.version;
end $$;
create or replace function private.list_partner_replyable_reviews_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(publication_id uuid,body text,published_at timestamptz,reply_revision integer,reply_state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  return query select publication.id,revision.experience_comment,publication.published_at,coalesce(max(reply.revision),0),coalesce((array_agg(reply.state order by reply.revision desc))[1],'draft')
  from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id
  left join private.review_experience_reply_revisions reply on reply.publication_id=publication.id and reply.workspace_id=p_workspace_id
  where publication.shop_id=v_shop and publication.publication_state='published'
  group by publication.id,revision.experience_comment,publication.published_at order by publication.published_at desc;
end $$;
create or replace function private.list_review_moderation_v11()
returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,assessment.rating,experience.submitted_at
 from private.review_experiences experience join private.review_experience_revisions revision on revision.experience_id=experience.id
 left join private.review_assessments assessment on assessment.experience_id=experience.id and assessment.target_kind='shop'
 join app.shops shop on shop.id=experience.shop_id
 where revision.revision=(select max(r.revision) from private.review_experience_revisions r where r.experience_id=experience.id)
 order by experience.submitted_at asc
$$;
create or replace function private.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,title text,terms_text text,valid_from timestamptz,valid_until timestamptz)
language sql security definer set search_path=private,pg_temp as $$
 select program.id,program.revision,program.state,version.title,version.terms_text,version.valid_from,version.valid_until
 from private.benefit_programs program join private.benefit_program_versions version on version.program_id=program.id and version.version=program.current_version
 where program.state='pending_approval' order by version.created_at asc
$$;
create or replace function private.list_operator_review_replies_v11()
returns table(reply_id uuid,shop_name text,body text,submitted_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 select reply.id,shop.name,reply.body,reply.submitted_at from private.review_experience_reply_revisions reply
 join app.review_experience_publications publication on publication.id=reply.publication_id
 join app.shops shop on shop.id=publication.shop_id where reply.state='pending' order by reply.submitted_at asc
$$;

create or replace function api.get_review_benefit_receipt_v11(uuid,text) returns table(benefit_status text,expires_at timestamptz,benefit_snapshot jsonb)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_benefit_receipt_v11($1,$2) $$;
create or replace function api.create_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$
begin perform set_config('eskomi.confirmation_actor',p_auth_user_id::text,true); perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.create_partner_therapist_assignment(p_workspace_id,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.update_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_assignment_id uuid,p_expected_revision integer,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$
begin perform set_config('eskomi.confirmation_actor',p_auth_user_id::text,true); perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.update_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text) returns table(reply_id uuid,revision integer,state text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_partner_review_reply_v11($1,$2,$3,$4,$5) $$;
create or replace function api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean) returns table(program_id uuid,revision integer,version integer,state text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.save_partner_benefit_program_v11($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) $$;
create or replace function api.list_partner_benefit_operations_v11(uuid,uuid) returns table(program_id uuid,revision integer,state text,version integer,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,combinable boolean,issued_count bigint,redeemed_count bigint)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_benefit_operations_v11($1,$2) $$;
create or replace function api.list_partner_replyable_reviews_v11(uuid,uuid) returns table(publication_id uuid,body text,published_at timestamptz,reply_revision integer,reply_state text)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_replyable_reviews_v11($1,$2) $$;
create or replace function api.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_review_moderation_v11() $$;
create or replace function api.list_operator_benefit_programs_v11() returns table(program_id uuid,revision integer,state text,title text,terms_text text,valid_from timestamptz,valid_until timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
create or replace function api.list_operator_review_replies_v11() returns table(reply_id uuid,shop_name text,body text,submitted_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_review_replies_v11() $$;
create or replace function api.moderate_review_experience_v11(uuid,text,text,text,integer) returns text
language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_review_experience_v11($1,$2,$3,$4,$5) $$;
create or replace function api.moderate_partner_review_reply_v11(uuid,text,text) returns text
language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_partner_review_reply_v11($1,$2,$3) $$;
create or replace function api.approve_benefit_program_v11(uuid,integer,text) returns text
language sql security invoker set search_path=private,api,pg_temp as $$ select private.approve_benefit_program_v11($1,$2,$3) $$;
revoke all on function private.get_review_benefit_receipt_v11(uuid,text),private.assert_partner_v11_membership(uuid,uuid),private.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),private.moderate_partner_review_reply_v11(uuid,text,text),private.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),private.approve_benefit_program_v11(uuid,integer,text),private.list_partner_benefit_operations_v11(uuid,uuid),private.list_partner_replyable_reviews_v11(uuid,uuid),private.list_review_moderation_v11(),private.list_operator_benefit_programs_v11(),private.list_operator_review_replies_v11(),api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text) from public,anon,authenticated;
grant execute on function private.get_review_benefit_receipt_v11(uuid,text),private.assert_partner_v11_membership(uuid,uuid),private.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),private.moderate_partner_review_reply_v11(uuid,text,text),private.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),private.approve_benefit_program_v11(uuid,integer,text),private.list_partner_benefit_operations_v11(uuid,uuid),private.list_partner_replyable_reviews_v11(uuid,uuid),private.list_review_moderation_v11(),private.list_operator_benefit_programs_v11(),private.list_operator_review_replies_v11(),api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text) to service_role;
notify pgrst,'reload schema';
