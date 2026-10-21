-- Eskomi v1.1 manual SQL Editor packet: stage 02 of 05
-- Project ref: goeagrxjsjcbbatpotbu
-- This file contains the checked-in source SQL unchanged plus an atomic source-ledger record.
-- Paste the ENTIRE file into Supabase SQL Editor and run it once. Do not run a later stage unless this one returns success.

begin;
select pg_advisory_xact_lock(hashtext('eskomi-v11-source-migrations-20261021'));

do $eskomi_preflight$
declare
  anchor_name text;
  anchor_source_sha256 text;
begin
  select name, encode(extensions.digest(statements[1], 'sha256'), 'hex')
    into anchor_name, anchor_source_sha256
  from supabase_migrations.schema_migrations
  where version = '20261020020548';
  if anchor_name is distinct from 'eskomi_supabase_primary_public_directory'
     or anchor_source_sha256 is distinct from '77520bc6a1e9b5aa5708e7e3848e517f6f6cb3bb7091bbb1380eb20eaaae95d2' then
    raise exception 'required directory migration 20261020020548 version/name/source hash does not match';
  end if;

  if exists (
    select 1
    from (values
      ('20261017120000', 'eskomi_canonical_shop_foundation', '1e2906e7b0169d2897db87912833ef7f777454af7afe423a967c769ebd5cc0a2'),
      ('20261017121000', 'eskomi_review_entry_read_adapter', 'c4e0bd7442577b65117e09c448ed1bcff3351ff1abcc9f94308c6ef88eed9b2a'),
      ('20261017122000', 'eskomi_canonical_integrity_fixes', '3c479d403511644444343dc112c2777ac69d7cbd0444d26b24d891547278b789'),
      ('20261017123000', 'eskomi_benefit_publication_independence', '5ee28968a6d8701c6067bd995462b588013056ff7478fa79b956b11789e8cb71'),
      ('20261017124000', 'eskomi_review_entry_acceptance_safety', 'ecc3ba179e3e2d25bb77b54ef677b2ed431f09a991d0575fec7da16ce68d9703'),
      ('20261017130000', 'eskomi_v11_private_receipts_and_publications', '57bf70a6171e89c4e0e2718663237c2f4f95001f7ea20ca81a7bf20dc8be55ab'),
      ('20261017131000', 'eskomi_v11_submission_vertical_slice', '9a42282aacfdba212fd50086c022283c76065f9befd83e4eb8f9f4f8a39ddf55'),
      ('20261017132000', 'eskomi_v11_fair_burst_risk_flags', '6aa7a13ae72fa1c904aed0494e63091a2ff4123971bd5de236a77c6250b1b827'),
      ('20261017133000', 'eskomi_v11_encrypted_replay_cache', '795952c486636cda61c157c41ff34c58919b68ef8d89ad7a4f46ce4b9c45ca23'),
      ('20261017134000', 'eskomi_v11_postgrest_parameter_names', 'dd00362d57e53cfde805c1565c2c5aae7ef9da71a4dd47edf77bb8d145c2e616'),
      ('20261017135000', 'eskomi_v11_postgrest_read_parameter_names', '5b65ea383de6d1d4a60b72879ed8a55e14a193ea216a79aa49ef1920d50bea3a'),
      ('20261017140000', 'eskomi_review_entry_therapist_selection', '9472caf62834ce7e9bd48053647fe8f0d75371c3b5ddc8301f779008b615888b'),
      ('20261017141000', 'eskomi_review_entry_retired_therapist_fallback', 'f8b6a31418aa1e9bcac770a3ca7941255c4b079fe72f95ba5618e5b5ae1987d3'),
      ('20261017142000', 'eskomi_partner_therapist_tools', 'a35bf7317d999e35959a92f66607e9caba21de709d1456bc506144f6a90a48eb'),
      ('20261017143000', 'eskomi_v11_acceptance_hardening', '33ccc0d8da8f3fdbdea1ce68036c632cad3328a33c47b389b18f19d3d65c5b54'),
      ('20261017144000', 'eskomi_partner_therapist_history_and_membership', 'f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f'),
      ('20261017145000', 'eskomi_partner_photo_membership_guard', 'f41242ef3fe79188e4256e77ae5b9e01676cffe1411423bb399920ab6802f6de'),
      ('20261017146000', 'eskomi_moderation_and_membership_race_fix', '4b51333970488a1837e19d2923cd170c6307fe72d1bcb745e71e9e8f69734a0f'),
      ('20261017147000', 'eskomi_v11_operations_and_receipts', '8cbd3f41016329961871e23d98f974956a85aa7001fd2162694f54f8079b17d0'),
      ('20261017148000', 'eskomi_v11_guest_edits_and_widget', '91877f85d3ebc4756f7f4e18f2a8d4ffa3293a8a291874d4a92dcff155fb6b4e'),
      ('20261017149000', 'eskomi_v11_rpc_contract_and_upgrade_fix', 'ccb5a4ff3282f95676e43d8527ad5aefbedb411ecb298d29c35bc8d98f01fdc6'),
      ('20261017150000', 'eskomi_corrections_and_community', '912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d')
    ) as expected(version, name, source_sha256)
    left join supabase_migrations.schema_migrations as ledger
      on ledger.version = expected.version
    where ledger.version is null
       or ledger.name is distinct from expected.name
       or coalesce(encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex'), '') <> expected.source_sha256
  ) then
    raise exception 'prior source ledger does not match this packet';
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
    where version in ('20261017151000', '20261017152000', '20261017153000', '20261017154000', '20261017155000', '20261017156000', '20261017157000')
  ) then
    raise exception 'stage 02 is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;

-- SOURCE 20261017151000_eskomi_review_target_and_redemption_hardening.sql
-- SHA-256 60481b9c98b5121835ddaa9aeb44ad5ff0fe4f08999310f06cf15b644c20e371
-- Bind every guest edit operation to both its short credential and immutable
-- review id.  A browser-global cookie must never choose the target.
alter function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text) rename to submit_review_experience_v11_pre151;
create function private.submit_review_experience_v11(p_entry_handle uuid,p_session_secret_hash text,p_idempotency_hash text,p_request_fingerprint text,p_receipt_hash text,p_ip_shop_hash text,p_shop_rating smallint,p_common_comment text,p_guest_display_name text,p_therapist_rating smallint,p_replay_ciphertext text,p_replay_nonce text,p_replay_key_version text,p_benefit_code_hash text)
returns table(experience_id uuid,replayed boolean,receipt_expires_at timestamptz,benefit_status text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v record;
begin
 select * into v from private.submit_review_experience_v11_pre151(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating,p_replay_ciphertext,p_replay_nonce,p_replay_key_version,p_benefit_code_hash);
 update private.review_experience_revisions revision set assessment_snapshot=jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating) where revision.experience_id=v.experience_id and revision.revision=1;
 return query select v.experience_id,v.replayed,v.receipt_expires_at,v.benefit_status;
end $$;

create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text,p_experience_id uuid) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
 select (session.context_snapshot->>'experienceId')::uuid into v_experience from private.guest_operation_sessions session
 join private.review_edit_receipts receipt on receipt.experience_id=(session.context_snapshot->>'experienceId')::uuid
 where session.session_secret_hash=p_session_secret_hash and session.revoked_at is null and session.submit_context_expires_at>now() and position('edit_own' in coalesce(session.context_snapshot->>'scope',''))>0 and receipt.revoked_at is null and receipt.expires_at>now() for update of session,receipt;
 if v_experience is null or v_experience<>p_experience_id then raise exception 'review edit target is unavailable' using errcode='42501'; end if; return v_experience;
end $$;
create function private.get_review_editable_v11(p_session_secret_hash text,p_experience_id uuid) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language plpgsql security definer set search_path=private,pg_temp as $$ begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); return query select experience.id,history.revision,history.nickname,history.experience_comment,nullif(history.assessment_snapshot->>'shopRating','')::smallint,nullif(history.assessment_snapshot->>'therapistRating','')::smallint,receipt.expires_at,experience.state from private.review_experiences experience join private.review_experience_revisions history on history.experience_id=experience.id join private.review_edit_receipts receipt on receipt.experience_id=experience.id where experience.id=p_experience_id order by history.revision desc limit 1; end $$;
create function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean;
begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update; if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if; select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has; if p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='' or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if; insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending'); update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id; update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published'; return query select p_experience_id,v_current.revision+1,'pending'::text; end $$;
create function private.withdraw_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$ declare v_revision integer; begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); select history.revision into v_revision from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update; if p_expected_revision<>v_revision then raise exception 'review changed' using errcode='40001'; end if; update private.review_experiences set state='withdrawn',withdrawn_at=now(),moderation_revision=moderation_revision+1 where id=p_experience_id and state<>'withdrawn'; if not found then raise exception 'review changed' using errcode='40001'; end if; update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state<>'hidden'; return 'withdrawn'; end $$;
create function private.create_review_appeal_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language plpgsql security definer set search_path=private,pg_temp as $$ declare v_id uuid; begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); if p_expected_revision<>(select max(history.revision) from private.review_experience_revisions history where history.experience_id=p_experience_id) or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if; insert into private.review_appeals_v11(experience_id,revision,reason) values(p_experience_id,p_expected_revision,btrim(p_reason)) returning id into v_id; return query select v_id,'pending'::text; end $$;
drop function if exists api.get_review_editable_v11(text); drop function if exists api.edit_review_experience_v11(text,integer,text,text,smallint,smallint); drop function if exists api.withdraw_review_experience_v11(text,integer); drop function if exists api.create_review_appeal_v11(text,integer,text);
create function api.get_review_editable_v11(p_session_secret_hash text,p_experience_id uuid) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11(p_session_secret_hash,p_experience_id) $$;
create function api.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11(p_session_secret_hash,p_experience_id,p_expected_revision,p_nickname,p_comment,p_shop_rating,p_therapist_rating) $$;
create function api.withdraw_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11(p_session_secret_hash,p_experience_id,p_expected_revision) $$;
create function api.create_review_appeal_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11(p_session_secret_hash,p_experience_id,p_expected_revision,p_reason) $$;
create or replace function private.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ with setting as (select widget.shop_id from private.review_widget_settings_v11 widget join app.shops shop on shop.id=widget.shop_id and shop.publication_status='published' left join private.managed_shops managed on managed.app_shop_id=shop.id where widget.public_handle=p_handle and widget.state='active' and (managed.id is null or managed.publication_state='published')), reviews as (select publication.id,publication.public_version,publication.published_at,revision.experience_comment, nullif(revision.assessment_snapshot->>'shopRating','')::smallint rating from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved' where publication.shop_id=(select shop_id from setting) and publication.publication_state='published'), summary as (select count(*) count,avg(rating)::numeric average,coalesce(max(public_version),0) version from reviews) select shop.name,shop.canonical_path,summary.count,summary.average,summary.version,now(),reviews.experience_comment,reviews.rating,reviews.published_at,reply.body,reply.reviewed_at from setting join app.shops shop on shop.id=setting.shop_id cross join summary left join reviews on true left join lateral (select r.body,r.reviewed_at from private.review_experience_reply_revisions r where r.publication_id=reviews.id and r.state='approved' order by r.revision desc limit 1) reply on true order by reviews.published_at desc nulls last,reviews.id desc nulls last limit greatest(1,least(p_limit,7)) offset greatest(p_offset,0) $$;
create or replace function private.redeem_benefit_code(p_workspace_id uuid,p_auth_user_id uuid,p_code_hash text) returns text language plpgsql security definer set search_path=private,pg_temp as $$ declare v_code private.benefit_codes%rowtype; begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); if p_code_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if; select * into v_code from private.benefit_codes code where code.code_hash=p_code_hash for update; if not found then return 'invalid'; end if; if not exists(select 1 from private.benefit_programs program where program.id=v_code.program_id and program.workspace_id=p_workspace_id) then return 'forbidden'; end if; if v_code.state<>'issued' then return 'already_used'; end if; if v_code.expires_at is not null and v_code.expires_at<=now() then return 'expired'; end if; update private.benefit_codes set state='redeemed',redeemed_at=now(),redeemed_by_workspace_id=p_workspace_id where id=v_code.id and state='issued'; if not found then return 'already_used'; end if; return 'redeemed'; end $$;
drop function if exists api.redeem_benefit_code(uuid,text); create function api.redeem_benefit_code(p_workspace_id uuid,p_auth_user_id uuid,p_code_hash text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.redeem_benefit_code(p_workspace_id,p_auth_user_id,p_code_hash) $$;
create or replace function private.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,experience.created_at from private.review_experiences experience join app.shops shop on shop.id=experience.shop_id join lateral(select * from private.review_experience_revisions h where h.experience_id=experience.id order by h.revision desc limit 1) revision on true where experience.state='submitted' $$;
revoke all on function api.get_review_editable_v11(text,uuid),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,uuid,integer),api.create_review_appeal_v11(text,uuid,integer,text),api.redeem_benefit_code(uuid,uuid,text) from public,anon,authenticated;
grant execute on function api.get_review_editable_v11(text,uuid),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,uuid,integer),api.create_review_appeal_v11(text,uuid,integer,text),api.redeem_benefit_code(uuid,uuid,text) to service_role; notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017151000', array[$eskomi_packet_02_1$-- Bind every guest edit operation to both its short credential and immutable
-- review id.  A browser-global cookie must never choose the target.
alter function private.submit_review_experience_v11(uuid,text,text,text,text,text,smallint,text,text,smallint,text,text,text,text) rename to submit_review_experience_v11_pre151;
create function private.submit_review_experience_v11(p_entry_handle uuid,p_session_secret_hash text,p_idempotency_hash text,p_request_fingerprint text,p_receipt_hash text,p_ip_shop_hash text,p_shop_rating smallint,p_common_comment text,p_guest_display_name text,p_therapist_rating smallint,p_replay_ciphertext text,p_replay_nonce text,p_replay_key_version text,p_benefit_code_hash text)
returns table(experience_id uuid,replayed boolean,receipt_expires_at timestamptz,benefit_status text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v record;
begin
 select * into v from private.submit_review_experience_v11_pre151(p_entry_handle,p_session_secret_hash,p_idempotency_hash,p_request_fingerprint,p_receipt_hash,p_ip_shop_hash,p_shop_rating,p_common_comment,p_guest_display_name,p_therapist_rating,p_replay_ciphertext,p_replay_nonce,p_replay_key_version,p_benefit_code_hash);
 update private.review_experience_revisions revision set assessment_snapshot=jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating) where revision.experience_id=v.experience_id and revision.revision=1;
 return query select v.experience_id,v.replayed,v.receipt_expires_at,v.benefit_status;
end $$;

create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text,p_experience_id uuid) returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
 select (session.context_snapshot->>'experienceId')::uuid into v_experience from private.guest_operation_sessions session
 join private.review_edit_receipts receipt on receipt.experience_id=(session.context_snapshot->>'experienceId')::uuid
 where session.session_secret_hash=p_session_secret_hash and session.revoked_at is null and session.submit_context_expires_at>now() and position('edit_own' in coalesce(session.context_snapshot->>'scope',''))>0 and receipt.revoked_at is null and receipt.expires_at>now() for update of session,receipt;
 if v_experience is null or v_experience<>p_experience_id then raise exception 'review edit target is unavailable' using errcode='42501'; end if; return v_experience;
end $$;
create function private.get_review_editable_v11(p_session_secret_hash text,p_experience_id uuid) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language plpgsql security definer set search_path=private,pg_temp as $$ begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); return query select experience.id,history.revision,history.nickname,history.experience_comment,nullif(history.assessment_snapshot->>'shopRating','')::smallint,nullif(history.assessment_snapshot->>'therapistRating','')::smallint,receipt.expires_at,experience.state from private.review_experiences experience join private.review_experience_revisions history on history.experience_id=experience.id join private.review_edit_receipts receipt on receipt.experience_id=experience.id where experience.id=p_experience_id order by history.revision desc limit 1; end $$;
create function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean;
begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update; if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if; select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has; if p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='' or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if; insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending'); update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id; update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published'; return query select p_experience_id,v_current.revision+1,'pending'::text; end $$;
create function private.withdraw_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$ declare v_revision integer; begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); select history.revision into v_revision from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update; if p_expected_revision<>v_revision then raise exception 'review changed' using errcode='40001'; end if; update private.review_experiences set state='withdrawn',withdrawn_at=now(),moderation_revision=moderation_revision+1 where id=p_experience_id and state<>'withdrawn'; if not found then raise exception 'review changed' using errcode='40001'; end if; update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state<>'hidden'; return 'withdrawn'; end $$;
create function private.create_review_appeal_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language plpgsql security definer set search_path=private,pg_temp as $$ declare v_id uuid; begin perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id); if p_expected_revision<>(select max(history.revision) from private.review_experience_revisions history where history.experience_id=p_experience_id) or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if; insert into private.review_appeals_v11(experience_id,revision,reason) values(p_experience_id,p_expected_revision,btrim(p_reason)) returning id into v_id; return query select v_id,'pending'::text; end $$;
drop function if exists api.get_review_editable_v11(text); drop function if exists api.edit_review_experience_v11(text,integer,text,text,smallint,smallint); drop function if exists api.withdraw_review_experience_v11(text,integer); drop function if exists api.create_review_appeal_v11(text,integer,text);
create function api.get_review_editable_v11(p_session_secret_hash text,p_experience_id uuid) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11(p_session_secret_hash,p_experience_id) $$;
create function api.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11(p_session_secret_hash,p_experience_id,p_expected_revision,p_nickname,p_comment,p_shop_rating,p_therapist_rating) $$;
create function api.withdraw_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11(p_session_secret_hash,p_experience_id,p_expected_revision) $$;
create function api.create_review_appeal_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11(p_session_secret_hash,p_experience_id,p_expected_revision,p_reason) $$;
create or replace function private.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ with setting as (select widget.shop_id from private.review_widget_settings_v11 widget join app.shops shop on shop.id=widget.shop_id and shop.publication_status='published' left join private.managed_shops managed on managed.app_shop_id=shop.id where widget.public_handle=p_handle and widget.state='active' and (managed.id is null or managed.publication_state='published')), reviews as (select publication.id,publication.public_version,publication.published_at,revision.experience_comment, nullif(revision.assessment_snapshot->>'shopRating','')::smallint rating from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved' where publication.shop_id=(select shop_id from setting) and publication.publication_state='published'), summary as (select count(*) count,avg(rating)::numeric average,coalesce(max(public_version),0) version from reviews) select shop.name,shop.canonical_path,summary.count,summary.average,summary.version,now(),reviews.experience_comment,reviews.rating,reviews.published_at,reply.body,reply.reviewed_at from setting join app.shops shop on shop.id=setting.shop_id cross join summary left join reviews on true left join lateral (select r.body,r.reviewed_at from private.review_experience_reply_revisions r where r.publication_id=reviews.id and r.state='approved' order by r.revision desc limit 1) reply on true order by reviews.published_at desc nulls last,reviews.id desc nulls last limit greatest(1,least(p_limit,7)) offset greatest(p_offset,0) $$;
create or replace function private.redeem_benefit_code(p_workspace_id uuid,p_auth_user_id uuid,p_code_hash text) returns text language plpgsql security definer set search_path=private,pg_temp as $$ declare v_code private.benefit_codes%rowtype; begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); if p_code_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if; select * into v_code from private.benefit_codes code where code.code_hash=p_code_hash for update; if not found then return 'invalid'; end if; if not exists(select 1 from private.benefit_programs program where program.id=v_code.program_id and program.workspace_id=p_workspace_id) then return 'forbidden'; end if; if v_code.state<>'issued' then return 'already_used'; end if; if v_code.expires_at is not null and v_code.expires_at<=now() then return 'expired'; end if; update private.benefit_codes set state='redeemed',redeemed_at=now(),redeemed_by_workspace_id=p_workspace_id where id=v_code.id and state='issued'; if not found then return 'already_used'; end if; return 'redeemed'; end $$;
drop function if exists api.redeem_benefit_code(uuid,text); create function api.redeem_benefit_code(p_workspace_id uuid,p_auth_user_id uuid,p_code_hash text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.redeem_benefit_code(p_workspace_id,p_auth_user_id,p_code_hash) $$;
create or replace function private.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,experience.created_at from private.review_experiences experience join app.shops shop on shop.id=experience.shop_id join lateral(select * from private.review_experience_revisions h where h.experience_id=experience.id order by h.revision desc limit 1) revision on true where experience.state='submitted' $$;
revoke all on function api.get_review_editable_v11(text,uuid),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,uuid,integer),api.create_review_appeal_v11(text,uuid,integer,text),api.redeem_benefit_code(uuid,uuid,text) from public,anon,authenticated;
grant execute on function api.get_review_editable_v11(text,uuid),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,uuid,integer),api.create_review_appeal_v11(text,uuid,integer,text),api.redeem_benefit_code(uuid,uuid,text) to service_role; notify pgrst,'reload schema';
$eskomi_packet_02_1$], 'eskomi_review_target_and_redemption_hardening', null, null, null);

-- SOURCE 20261017152000_eskomi_community_ui_safety_and_review_projection.sql
-- SHA-256 5e14ae52c991dc3c6ecedbae540199c5913d4fca3bd4ecf18a3bf16a2b49624a
-- Complete the reviewed community/correction surface without changing any
-- historic migration.  All browser traffic is mediated by server routes;
-- these RPCs remain service_role-only and keep sensitive receipts private.

alter table private.community_idempotency_v11 add column if not exists payload_hash text;
alter table private.community_idempotency_v11 add constraint community_idempotency_payload_hash_format
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

create table private.community_moderation_events_v11 (
  id bigint generated always as identity primary key,
  entity_kind text not null check (entity_kind in ('correction','community_post')),
  entity_id uuid not null,
  action text not null,
  reason text not null default '' check (char_length(reason) <= 1000),
  operator_actor text not null,
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now()
);
create index community_moderation_events_entity_idx on private.community_moderation_events_v11(entity_kind,entity_id,created_at desc);
alter table private.community_moderation_events_v11 enable row level security;
revoke all on table private.community_moderation_events_v11 from public,anon,authenticated;
grant select,insert on table private.community_moderation_events_v11 to service_role;

create or replace function private.community_target_is_public_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
 select case
   when p_scope_kind='shop' then exists(
     select 1 from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
     where shop.id=p_shop_id and shop.publication_status='published'
       and (managed.id is null or managed.publication_state='published')
   )
   when p_scope_kind='area' then exists(select 1 from app.areas area where area.id=p_area_id and area.is_published)
   else false
 end
$$;

create or replace function private.resolve_public_community_target_v11(p_scope_kind text,p_slug text)
returns table(scope_kind text,target_id uuid,target_name text)
language sql security definer set search_path=private,app,pg_temp as $$
 select 'shop'::text,shop.id,shop.name from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
 where p_scope_kind='shop' and shop.slug=p_slug and shop.publication_status='published'
   and (managed.id is null or managed.publication_state='published')
 union all
 select 'area'::text,area.id,area.name from app.areas area
 where p_scope_kind='area' and area.slug=p_slug and area.is_published
 limit 1
$$;

drop function if exists private.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);
drop function if exists api.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(request_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid correction payload' using errcode='22023'; end if;
 select entity_id,payload_hash into v_id,v_payload from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then
   if v_payload is distinct from p_payload_hash then raise exception 'correction replay payload changed' using errcode='22023'; end if;
   return query select request.id,request.revision,request.state,true from private.store_correction_requests_v11 request where request.id=v_id; return;
 end if;
 if not private.community_target_is_public_v11('shop',p_shop_id,null) then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(post_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_receipt text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid community payload' using errcode='22023'; end if;
 select operation.entity_id,operation.payload_hash,post.receipt_hash into v_id,v_payload,v_receipt from private.community_idempotency_v11 operation join private.community_posts_v11 post on post.id=operation.entity_id where operation.operation='post' and operation.scope_hash=p_scope_hash and operation.key_hash=p_idempotency_hash for update of operation,post;
 if found then
   if v_payload is distinct from p_payload_hash or v_receipt<>p_receipt_hash then raise exception 'community replay credential changed' using errcode='22023'; end if;
   return query select post.id,post.revision,post.moderation_state,true from private.community_posts_v11 post where post.id=v_id; return;
 end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) or not private.community_target_is_public_v11(p_scope_kind,p_shop_id,p_area_id) then raise exception 'community target is unavailable' using errcode='P0002'; end if;
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post
 where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published'
   and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create or replace function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post
 left join app.shops shop on shop.id=post.shop_id
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 left join app.areas area on area.id=post.area_id
 left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published'
   and ((p_shop_id is not null and post.shop_id=p_shop_id and shop.publication_status='published' and (managed.id is null or managed.publication_state='published'))
     or (p_area_id is not null and post.area_id=p_area_id and area.is_published))
 group by post.id order by post.published_at desc limit 30
$$;

create or replace function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end
 where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'correction changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('correction',p_request_id,p_state,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_state;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

drop function if exists private.list_operator_corrections_v11();
drop function if exists private.list_operator_community_posts_v11();
drop function if exists api.list_operator_corrections_v11();
drop function if exists api.list_operator_community_posts_v11();
create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='correction' and event.entity_id=request.id),'[]'::jsonb)
 from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id order by request.created_at asc
$$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by post.created_at asc
$$;

-- The active revision is the only score public readers, widgets, and the
-- moderation queue may show.  Legacy assessment rows are not a score source.
create or replace function api.list_public_review_experience_publications(p_shop_slug text,p_limit integer default 20,p_offset integer default 0)
returns table(public_handle uuid,rating smallint,body text,display_name text,therapist_display_name text,published_at timestamptz)
language sql security invoker set search_path=private,app,pg_temp as $$
 select publication.public_handle,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,revision.experience_comment,revision.nickname,publication.therapist_display_name_snapshot,publication.published_at
 from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 where shop.slug=p_shop_slug and publication.publication_state='published' and (managed.id is null or managed.publication_state='published')
 order by publication.published_at desc limit greatest(1,least(p_limit,20)) offset greatest(p_offset,0)
$$;

create or replace function private.list_review_moderation_v11()
returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,experience.created_at
 from private.review_experiences experience join app.shops shop on shop.id=experience.shop_id join lateral(select * from private.review_experience_revisions history where history.experience_id=experience.id order by history.revision desc limit 1) revision on true
 where experience.state in ('submitted','approved','withdrawn') order by experience.created_at asc
$$;

create or replace function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean; v_state text;
begin
 perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id);
 select experience.state into v_state from private.review_experiences experience where experience.id=p_experience_id for update;
 if v_state not in ('submitted','approved') then raise exception 'review must be appealed, not edited' using errcode='40001'; end if;
 select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update;
 if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
 select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has;
 if (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if;
 insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
 update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id;
 update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published';
 return query select p_experience_id,v_current.revision+1,'pending'::text;
end $$;

create function api.resolve_public_community_target_v11(p_scope_kind text,p_slug text) returns table(scope_kind text,target_id uuid,target_name text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.resolve_public_community_target_v11(p_scope_kind,p_slug) $$;
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(request_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(post_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
-- Retain the previous server-only signatures for already deployed callers.
-- New HTTP routes always use the named, payload-bound overloads above.
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select request_id,revision,state from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex')) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select post_id,revision,state from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex')) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;

revoke all on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017152000', array[$eskomi_packet_02_2$-- Complete the reviewed community/correction surface without changing any
-- historic migration.  All browser traffic is mediated by server routes;
-- these RPCs remain service_role-only and keep sensitive receipts private.

alter table private.community_idempotency_v11 add column if not exists payload_hash text;
alter table private.community_idempotency_v11 add constraint community_idempotency_payload_hash_format
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

create table private.community_moderation_events_v11 (
  id bigint generated always as identity primary key,
  entity_kind text not null check (entity_kind in ('correction','community_post')),
  entity_id uuid not null,
  action text not null,
  reason text not null default '' check (char_length(reason) <= 1000),
  operator_actor text not null,
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now()
);
create index community_moderation_events_entity_idx on private.community_moderation_events_v11(entity_kind,entity_id,created_at desc);
alter table private.community_moderation_events_v11 enable row level security;
revoke all on table private.community_moderation_events_v11 from public,anon,authenticated;
grant select,insert on table private.community_moderation_events_v11 to service_role;

create or replace function private.community_target_is_public_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
 select case
   when p_scope_kind='shop' then exists(
     select 1 from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
     where shop.id=p_shop_id and shop.publication_status='published'
       and (managed.id is null or managed.publication_state='published')
   )
   when p_scope_kind='area' then exists(select 1 from app.areas area where area.id=p_area_id and area.is_published)
   else false
 end
$$;

create or replace function private.resolve_public_community_target_v11(p_scope_kind text,p_slug text)
returns table(scope_kind text,target_id uuid,target_name text)
language sql security definer set search_path=private,app,pg_temp as $$
 select 'shop'::text,shop.id,shop.name from app.shops shop left join private.managed_shops managed on managed.app_shop_id=shop.id
 where p_scope_kind='shop' and shop.slug=p_slug and shop.publication_status='published'
   and (managed.id is null or managed.publication_state='published')
 union all
 select 'area'::text,area.id,area.name from app.areas area
 where p_scope_kind='area' and area.slug=p_slug and area.is_published
 limit 1
$$;

drop function if exists private.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);
drop function if exists api.submit_store_correction_v11(uuid,text,text,text,text,text);
drop function if exists api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text);

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(request_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid correction payload' using errcode='22023'; end if;
 select entity_id,payload_hash into v_id,v_payload from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then
   if v_payload is distinct from p_payload_hash then raise exception 'correction replay payload changed' using errcode='22023'; end if;
   return query select request.id,request.revision,request.state,true from private.store_correction_requests_v11 request where request.id=v_id; return;
 end if;
 if not private.community_target_is_public_v11('shop',p_shop_id,null) then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(post_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_receipt text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid community payload' using errcode='22023'; end if;
 select operation.entity_id,operation.payload_hash,post.receipt_hash into v_id,v_payload,v_receipt from private.community_idempotency_v11 operation join private.community_posts_v11 post on post.id=operation.entity_id where operation.operation='post' and operation.scope_hash=p_scope_hash and operation.key_hash=p_idempotency_hash for update of operation,post;
 if found then
   if v_payload is distinct from p_payload_hash or v_receipt<>p_receipt_hash then raise exception 'community replay credential changed' using errcode='22023'; end if;
   return query select post.id,post.revision,post.moderation_state,true from private.community_posts_v11 post where post.id=v_id; return;
 end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) or not private.community_target_is_public_v11(p_scope_kind,p_shop_id,p_area_id) then raise exception 'community target is unavailable' using errcode='P0002'; end if;
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post
 where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published'
   and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create or replace function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post
 left join app.shops shop on shop.id=post.shop_id
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 left join app.areas area on area.id=post.area_id
 left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published'
   and ((p_shop_id is not null and post.shop_id=p_shop_id and shop.publication_status='published' and (managed.id is null or managed.publication_state='published'))
     or (p_area_id is not null and post.area_id=p_area_id and area.is_published))
 group by post.id order by post.published_at desc limit 30
$$;

create or replace function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end
 where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'correction changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('correction',p_request_id,p_state,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_state;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

drop function if exists private.list_operator_corrections_v11();
drop function if exists private.list_operator_community_posts_v11();
drop function if exists api.list_operator_corrections_v11();
drop function if exists api.list_operator_community_posts_v11();
create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='correction' and event.entity_id=request.id),'[]'::jsonb)
 from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id order by request.created_at asc
$$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by post.created_at asc
$$;

-- The active revision is the only score public readers, widgets, and the
-- moderation queue may show.  Legacy assessment rows are not a score source.
create or replace function api.list_public_review_experience_publications(p_shop_slug text,p_limit integer default 20,p_offset integer default 0)
returns table(public_handle uuid,rating smallint,body text,display_name text,therapist_display_name text,published_at timestamptz)
language sql security invoker set search_path=private,app,pg_temp as $$
 select publication.public_handle,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,revision.experience_comment,revision.nickname,publication.therapist_display_name_snapshot,publication.published_at
 from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
 left join private.managed_shops managed on managed.app_shop_id=shop.id
 where shop.slug=p_shop_slug and publication.publication_state='published' and (managed.id is null or managed.publication_state='published')
 order by publication.published_at desc limit greatest(1,least(p_limit,20)) offset greatest(p_offset,0)
$$;

create or replace function private.list_review_moderation_v11()
returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 select experience.id,experience.moderation_revision,experience.state,shop.name,revision.experience_comment,nullif(revision.assessment_snapshot->>'shopRating','')::smallint,experience.created_at
 from private.review_experiences experience join app.shops shop on shop.id=experience.shop_id join lateral(select * from private.review_experience_revisions history where history.experience_id=experience.id order by history.revision desc limit 1) revision on true
 where experience.state in ('submitted','approved','withdrawn') order by experience.created_at asc
$$;

create or replace function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean; v_state text;
begin
 perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id);
 select experience.state into v_state from private.review_experiences experience where experience.id=p_experience_id for update;
 if v_state not in ('submitted','approved') then raise exception 'review must be appealed, not edited' using errcode='40001'; end if;
 select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update;
 if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
 select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has;
 if (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if;
 insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
 update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id;
 update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published';
 return query select p_experience_id,v_current.revision+1,'pending'::text;
end $$;

create function api.resolve_public_community_target_v11(p_scope_kind text,p_slug text) returns table(scope_kind text,target_id uuid,target_name text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.resolve_public_community_target_v11(p_scope_kind,p_slug) $$;
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(request_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(post_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
-- Retain the previous server-only signatures for already deployed callers.
-- New HTTP routes always use the named, payload-bound overloads above.
create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select request_id,revision,state from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex')) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select post_id,revision,state from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash,encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex')) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;

revoke all on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.community_target_is_public_v11(text,uuid,uuid),private.resolve_public_community_target_v11(text,text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.withdraw_community_post_v11(uuid,text,integer),private.react_to_community_post_v11(uuid,text,text,integer),private.list_public_community_posts_v11(uuid,uuid,text),private.moderate_store_correction_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.list_operator_corrections_v11(),private.list_operator_community_posts_v11(),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.resolve_public_community_target_v11(text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.list_public_review_experience_publications(text,integer,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_02_2$], 'eskomi_community_ui_safety_and_review_projection', null, null, null);

-- SOURCE 20261017153000_eskomi_community_receipts_and_burst_controls.sql
-- SHA-256 91640643717c46b07fbefa4ee89185a839976a8fab1b534dae73c5feb50f3b65
-- Receipt-only withdrawal, operator hiding, and bounded anonymous mutation
-- controls.  This is additive and intentionally does not use IP as a denial
-- key: a shared connection must not reject unrelated visitors.

create table private.community_burst_limits_v11 (
  limit_key text primary key check (limit_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now()
);
alter table private.community_burst_limits_v11 enable row level security;
revoke all on table private.community_burst_limits_v11 from public,anon,authenticated;
grant select,insert,update on table private.community_burst_limits_v11 to service_role;

create function private.assert_community_burst_v11(p_limit_key text,p_max_events integer,p_window interval)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
declare v_row private.community_burst_limits_v11%rowtype;
begin
  if p_limit_key !~ '^[0-9a-f]{64}$' or p_max_events<1 or p_window<=interval '0 seconds' then raise exception 'invalid community burst key' using errcode='22023'; end if;
  select * into v_row from private.community_burst_limits_v11 where limit_key=p_limit_key for update;
  if not found then
    insert into private.community_burst_limits_v11(limit_key,event_count) values(p_limit_key,1);
    return;
  end if;
  if v_row.window_started_at+p_window<=now() then
    update private.community_burst_limits_v11 set window_started_at=now(),event_count=1,updated_at=now() where limit_key=p_limit_key;
  elsif v_row.event_count>=p_max_events then
    raise exception 'community request rate limited' using errcode='54000';
  else
    update private.community_burst_limits_v11 set event_count=event_count+1,updated_at=now() where limit_key=p_limit_key;
  end if;
end $$;

create or replace function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(request_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid correction payload' using errcode='22023'; end if;
 select entity_id,payload_hash into v_id,v_payload from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then
   if v_payload is distinct from p_payload_hash then raise exception 'correction replay payload changed' using errcode='22023'; end if;
   return query select request.id,request.revision,request.state,true from private.store_correction_requests_v11 request where request.id=v_id; return;
 end if;
 if not private.community_target_is_public_v11('shop',p_shop_id,null) then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('correction'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create or replace function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(post_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_receipt text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid community payload' using errcode='22023'; end if;
 select operation.entity_id,operation.payload_hash,post.receipt_hash into v_id,v_payload,v_receipt from private.community_idempotency_v11 operation join private.community_posts_v11 post on post.id=operation.entity_id where operation.operation='post' and operation.scope_hash=p_scope_hash and operation.key_hash=p_idempotency_hash for update of operation,post;
 if found then
   if v_payload is distinct from p_payload_hash or v_receipt<>p_receipt_hash then raise exception 'community replay credential changed' using errcode='22023'; end if;
   return query select post.id,post.revision,post.moderation_state,true from private.community_posts_v11 post where post.id=v_id; return;
 end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) or not private.community_target_is_public_v11(p_scope_kind,p_shop_id,p_area_id) then raise exception 'community target is unavailable' using errcode='P0002'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('post'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('reaction'||p_browser_tag_hash||p_post_id::text,'sha256'),'hex'),20,interval '1 minute');
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.withdraw_community_post_by_receipt_v11(p_receipt_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,pg_temp as $$
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community receipt' using errcode='22023'; end if;
 return query update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.receipt_hash=p_receipt_hash and post.publication_state<>'withdrawn'
  returning post.id,post.revision,post.moderation_state;
 if not found then raise exception 'community receipt is unavailable' using errcode='40001'; end if;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 if p_decision='hidden' then
   update private.community_posts_v11 post set moderation_state='rejected',publication_state='withdrawn',withdrawn_at=now(),operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='approved' and post.publication_state='published' and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 else
   update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 end if;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

create or replace function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean; v_state text;
begin
 perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id);
 select experience.state into v_state from private.review_experiences experience where experience.id=p_experience_id for update;
 if v_state not in ('submitted','approved') then raise exception 'review must be appealed, not edited' using errcode='40001'; end if;
 select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update;
 if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
 select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has;
 if (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if;
 insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
 update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id;
 update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published';
 return query select p_experience_id,v_current.revision+1,'submitted'::text;
end $$;

create function api.withdraw_community_post_by_receipt_v11(p_receipt_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.withdraw_community_post_by_receipt_v11(p_receipt_hash) $$;
revoke all on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017153000', array[$eskomi_packet_02_3$-- Receipt-only withdrawal, operator hiding, and bounded anonymous mutation
-- controls.  This is additive and intentionally does not use IP as a denial
-- key: a shared connection must not reject unrelated visitors.

create table private.community_burst_limits_v11 (
  limit_key text primary key check (limit_key ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  event_count integer not null default 0 check (event_count >= 0),
  updated_at timestamptz not null default now()
);
alter table private.community_burst_limits_v11 enable row level security;
revoke all on table private.community_burst_limits_v11 from public,anon,authenticated;
grant select,insert,update on table private.community_burst_limits_v11 to service_role;

create function private.assert_community_burst_v11(p_limit_key text,p_max_events integer,p_window interval)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
declare v_row private.community_burst_limits_v11%rowtype;
begin
  if p_limit_key !~ '^[0-9a-f]{64}$' or p_max_events<1 or p_window<=interval '0 seconds' then raise exception 'invalid community burst key' using errcode='22023'; end if;
  select * into v_row from private.community_burst_limits_v11 where limit_key=p_limit_key for update;
  if not found then
    insert into private.community_burst_limits_v11(limit_key,event_count) values(p_limit_key,1);
    return;
  end if;
  if v_row.window_started_at+p_window<=now() then
    update private.community_burst_limits_v11 set window_started_at=now(),event_count=1,updated_at=now() where limit_key=p_limit_key;
  elsif v_row.event_count>=p_max_events then
    raise exception 'community request rate limited' using errcode='54000';
  else
    update private.community_burst_limits_v11 set event_count=event_count+1,updated_at=now() where limit_key=p_limit_key;
  end if;
end $$;

create or replace function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(request_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_shop_id::text||chr(31)||p_field_key||chr(31)||btrim(coalesce(p_proposed_value,''))||chr(31)||coalesce(nullif(btrim(p_source_url),''),''),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid correction payload' using errcode='22023'; end if;
 select entity_id,payload_hash into v_id,v_payload from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then
   if v_payload is distinct from p_payload_hash then raise exception 'correction replay payload changed' using errcode='22023'; end if;
   return query select request.id,request.revision,request.state,true from private.store_correction_requests_v11 request where request.id=v_id; return;
 end if;
 if not private.community_target_is_public_v11('shop',p_shop_id,null) then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('correction'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('correction',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select request.id,request.revision,request.state,false from private.store_correction_requests_v11 request where request.id=v_id;
end $$;

create or replace function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(post_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_receipt text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_scope_kind||chr(31)||coalesce(p_shop_id,p_area_id)::text||chr(31)||btrim(coalesce(p_body,'')),'sha256'),'hex');
 if p_payload_hash<>v_expected then raise exception 'invalid community payload' using errcode='22023'; end if;
 select operation.entity_id,operation.payload_hash,post.receipt_hash into v_id,v_payload,v_receipt from private.community_idempotency_v11 operation join private.community_posts_v11 post on post.id=operation.entity_id where operation.operation='post' and operation.scope_hash=p_scope_hash and operation.key_hash=p_idempotency_hash for update of operation,post;
 if found then
   if v_payload is distinct from p_payload_hash or v_receipt<>p_receipt_hash then raise exception 'community replay credential changed' using errcode='22023'; end if;
   return query select post.id,post.revision,post.moderation_state,true from private.community_posts_v11 post where post.id=v_id; return;
 end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) or not private.community_target_is_public_v11(p_scope_kind,p_shop_id,p_area_id) then raise exception 'community target is unavailable' using errcode='P0002'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('post'||p_scope_hash,'sha256'),'hex'),5,interval '1 hour');
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id,payload_hash) values('post',p_scope_hash,p_idempotency_hash,v_id,p_payload_hash);
 return query select post.id,post.revision,post.moderation_state,false from private.community_posts_v11 post where post.id=v_id;
end $$;

create or replace function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id) for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 perform private.assert_community_burst_v11(encode(extensions.digest('reaction'||p_browser_tag_hash||p_post_id::text,'sha256'),'hex'),20,interval '1 minute');
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.withdraw_community_post_by_receipt_v11(p_receipt_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,pg_temp as $$
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community receipt' using errcode='22023'; end if;
 return query update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.receipt_hash=p_receipt_hash and post.publication_state<>'withdrawn'
  returning post.id,post.revision,post.moderation_state;
 if not found then raise exception 'community receipt is unavailable' using errcode='40001'; end if;
end $$;

create or replace function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 if p_decision='hidden' then
   update private.community_posts_v11 post set moderation_state='rejected',publication_state='withdrawn',withdrawn_at=now(),operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='approved' and post.publication_state='published' and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 else
   update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1
   where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000 returning revision into v_revision;
 end if;
 if not found then raise exception 'community post changed' using errcode='40001'; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',p_post_id,p_decision,btrim(coalesce(p_reason,'')),'dashboard_shared_operator',v_revision);
 return p_decision;
end $$;

create or replace function private.edit_review_experience_v11(p_session_secret_hash text,p_experience_id uuid,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_current private.review_experience_revisions%rowtype; v_has boolean; v_state text;
begin
 perform private.assert_review_edit_session_v11(p_session_secret_hash,p_experience_id);
 select experience.state into v_state from private.review_experiences experience where experience.id=p_experience_id for update;
 if v_state not in ('submitted','approved') then raise exception 'review must be appealed, not edited' using errcode='40001'; end if;
 select * into v_current from private.review_experience_revisions history where history.experience_id=p_experience_id order by history.revision desc limit 1 for update;
 if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
 select exists(select 1 from private.review_assessments assessment where assessment.experience_id=p_experience_id and assessment.target_kind='therapist') into v_has;
 if (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') or char_length(btrim(coalesce(p_comment,'')))>400 or char_length(btrim(coalesce(p_nickname,'')))>30 or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and (p_therapist_rating not between 1 and 5 or not v_has)) then raise exception 'invalid review edit' using errcode='22023'; end if;
 insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state) values(p_experience_id,v_current.revision+1,nullif(btrim(p_nickname),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
 update private.review_experiences set state='submitted',reviewed_at=null,moderation_revision=moderation_revision+1 where id=p_experience_id;
 update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1 where publication.experience_id=p_experience_id and publication.publication_state='published';
 return query select p_experience_id,v_current.revision+1,'submitted'::text;
end $$;

create function api.withdraw_community_post_by_receipt_v11(p_receipt_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.withdraw_community_post_by_receipt_v11(p_receipt_hash) $$;
revoke all on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) from public,anon,authenticated;
grant execute on function private.assert_community_burst_v11(text,integer,interval),private.withdraw_community_post_by_receipt_v11(text),private.submit_store_correction_v11(uuid,text,text,text,text,text,text),private.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),private.react_to_community_post_v11(uuid,text,text,integer),private.moderate_community_post_v11(uuid,text,text,integer),private.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint),api.withdraw_community_post_by_receipt_v11(text),api.submit_store_correction_v11(uuid,text,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text,text),api.react_to_community_post_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer),api.edit_review_experience_v11(text,uuid,integer,text,text,smallint,smallint) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_02_3$], 'eskomi_community_receipts_and_burst_controls', null, null, null);

-- SOURCE 20261017154000_eskomi_public_shop_detail_reviews.sql
-- SHA-256 95c30eb40048b69c4ea70a8828b2dcf0092d9ad8dab90f4c306764cc470c12e2
-- Public shop-detail review projection for the v1.1 canonical shop path.
-- It is intentionally limited to already-approved publications and approved
-- partner replies.  No guest receipt, moderation note, or private identity is
-- exposed through this read model.

-- New submissions create the revision before the one or two assessment rows.
-- Capture both rows while that initial revision is pending so every public
-- surface reads the same immutable score snapshot (rather than a legacy
-- assessment row or an empty default JSON object).
create or replace function private.capture_pending_review_assessment_snapshot_v11()
returns trigger language plpgsql security definer set search_path = private, pg_temp as $$
begin
  update private.review_experience_revisions as revision
  set assessment_snapshot = jsonb_build_object(
    'shopRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'shop'
    ),
    'therapistRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'therapist'
    )
  )
  where revision.experience_id = new.experience_id
    and revision.revision = (
      select max(current_revision.revision)
      from private.review_experience_revisions as current_revision
      where current_revision.experience_id = new.experience_id
    )
    and revision.moderation_state = 'pending';
  return new;
end;
$$;

drop trigger if exists review_assessment_snapshot_capture_v11 on private.review_assessments;
create trigger review_assessment_snapshot_capture_v11
after insert on private.review_assessments
for each row execute function private.capture_pending_review_assessment_snapshot_v11();

update private.review_experience_revisions as revision
set assessment_snapshot = jsonb_build_object(
  'shopRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'shop'),
  'therapistRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'therapist')
)
where revision.assessment_snapshot = '{}'::jsonb;

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text,
  p_limit integer default 20,
  p_offset integer default 0
) returns table(
  public_handle uuid,
  rating smallint,
  body text,
  display_name text,
  therapist_display_name text,
  published_at timestamptz,
  reply_body text,
  reply_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    revision.experience_comment,
    revision.nickname,
    publication.therapist_display_name_snapshot,
    publication.published_at,
    reply.body,
    reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision
    on revision.id = publication.active_revision_id
   and revision.moderation_state = 'approved'
  join app.shops as shop
    on shop.id = publication.shop_id
   and shop.publication_status = 'published'
  left join private.managed_shops as managed
    on managed.app_shop_id = shop.id
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id
      and response.state = 'approved'
    order by response.revision desc
    limit 1
  ) as reply on true
  where shop.slug = p_shop_slug
    and publication.publication_state = 'published'
    and (managed.id is null or managed.publication_state = 'published')
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20))
  offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(
  p_shop_slug text
) returns table(
  review_count bigint,
  rating_count bigint,
  average_rating numeric,
  oldest_published_at timestamptz,
  latest_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    count(*),
    count(rating),
    avg(rating)::numeric,
    min(published_at),
    max(published_at)
  from (
    select
      publication.published_at,
      nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision
      on revision.id = publication.active_revision_id
     and revision.moderation_state = 'approved'
    join app.shops as shop
      on shop.id = publication.shop_id
     and shop.publication_status = 'published'
    left join private.managed_shops as managed
      on managed.app_shop_id = shop.id
    where shop.slug = p_shop_slug
      and publication.publication_state = 'published'
      and (managed.id is null or managed.publication_state = 'published')
  ) as published
$$;

revoke all on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;
grant execute on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to service_role;

notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017154000', array[$eskomi_packet_02_4$-- Public shop-detail review projection for the v1.1 canonical shop path.
-- It is intentionally limited to already-approved publications and approved
-- partner replies.  No guest receipt, moderation note, or private identity is
-- exposed through this read model.

-- New submissions create the revision before the one or two assessment rows.
-- Capture both rows while that initial revision is pending so every public
-- surface reads the same immutable score snapshot (rather than a legacy
-- assessment row or an empty default JSON object).
create or replace function private.capture_pending_review_assessment_snapshot_v11()
returns trigger language plpgsql security definer set search_path = private, pg_temp as $$
begin
  update private.review_experience_revisions as revision
  set assessment_snapshot = jsonb_build_object(
    'shopRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'shop'
    ),
    'therapistRating', (
      select assessment.rating
      from private.review_assessments as assessment
      where assessment.experience_id = new.experience_id
        and assessment.target_kind = 'therapist'
    )
  )
  where revision.experience_id = new.experience_id
    and revision.revision = (
      select max(current_revision.revision)
      from private.review_experience_revisions as current_revision
      where current_revision.experience_id = new.experience_id
    )
    and revision.moderation_state = 'pending';
  return new;
end;
$$;

drop trigger if exists review_assessment_snapshot_capture_v11 on private.review_assessments;
create trigger review_assessment_snapshot_capture_v11
after insert on private.review_assessments
for each row execute function private.capture_pending_review_assessment_snapshot_v11();

update private.review_experience_revisions as revision
set assessment_snapshot = jsonb_build_object(
  'shopRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'shop'),
  'therapistRating', (select assessment.rating from private.review_assessments as assessment where assessment.experience_id = revision.experience_id and assessment.target_kind = 'therapist')
)
where revision.assessment_snapshot = '{}'::jsonb;

create or replace function api.list_public_shop_detail_reviews_v11(
  p_shop_slug text,
  p_limit integer default 20,
  p_offset integer default 0
) returns table(
  public_handle uuid,
  rating smallint,
  body text,
  display_name text,
  therapist_display_name text,
  published_at timestamptz,
  reply_body text,
  reply_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating', '')::smallint,
    revision.experience_comment,
    revision.nickname,
    publication.therapist_display_name_snapshot,
    publication.published_at,
    reply.body,
    reply.reviewed_at
  from app.review_experience_publications as publication
  join private.review_experience_revisions as revision
    on revision.id = publication.active_revision_id
   and revision.moderation_state = 'approved'
  join app.shops as shop
    on shop.id = publication.shop_id
   and shop.publication_status = 'published'
  left join private.managed_shops as managed
    on managed.app_shop_id = shop.id
  left join lateral (
    select response.body, response.reviewed_at
    from private.review_experience_reply_revisions as response
    where response.publication_id = publication.id
      and response.state = 'approved'
    order by response.revision desc
    limit 1
  ) as reply on true
  where shop.slug = p_shop_slug
    and publication.publication_state = 'published'
    and (managed.id is null or managed.publication_state = 'published')
  order by publication.published_at desc, publication.id desc
  limit greatest(1, least(p_limit, 20))
  offset greatest(p_offset, 0)
$$;

create or replace function api.get_public_shop_detail_review_summary_v11(
  p_shop_slug text
) returns table(
  review_count bigint,
  rating_count bigint,
  average_rating numeric,
  oldest_published_at timestamptz,
  latest_published_at timestamptz
)
language sql security invoker set search_path = private, app, pg_temp as $$
  select
    count(*),
    count(rating),
    avg(rating)::numeric,
    min(published_at),
    max(published_at)
  from (
    select
      publication.published_at,
      nullif(revision.assessment_snapshot->>'shopRating', '')::smallint as rating
    from app.review_experience_publications as publication
    join private.review_experience_revisions as revision
      on revision.id = publication.active_revision_id
     and revision.moderation_state = 'approved'
    join app.shops as shop
      on shop.id = publication.shop_id
     and shop.publication_status = 'published'
    left join private.managed_shops as managed
      on managed.app_shop_id = shop.id
    where shop.slug = p_shop_slug
      and publication.publication_state = 'published'
      and (managed.id is null or managed.publication_state = 'published')
  ) as published
$$;

revoke all on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
from public, anon, authenticated;
grant execute on function
  private.capture_pending_review_assessment_snapshot_v11(),
  api.list_public_shop_detail_reviews_v11(text, integer, integer),
  api.get_public_shop_detail_review_summary_v11(text)
to service_role;

notify pgrst, 'reload schema';
$eskomi_packet_02_4$], 'eskomi_public_shop_detail_reviews', null, null, null);

-- SOURCE 20261017155000_eskomi_canonical_managed_directory_operations.sql
-- SHA-256 1c7d841cf88a636cd2db6946424bd09423304a22b79ddba8f263100abc5d021e
-- Canonical operator-managed shops use app.shops as their durable identity.
-- These wrappers keep that identity aligned with the reviewed directory
-- publication without changing the behaviour of legacy WordPress imports.

create or replace function private.sync_canonical_managed_shop_publication_v11(
  p_managed_shop_id uuid
) returns void
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_publication private.managed_shop_publications%rowtype;
  v_area_id uuid;
  v_description text;
begin
  select * into v_shop from private.managed_shops where id = p_managed_shop_id for key share;
  if not found or v_shop.app_shop_id is null then
    raise exception 'canonical managed shop not found' using errcode = 'P0002';
  end if;

  select * into v_publication from private.managed_shop_publications
  where managed_shop_id = v_shop.id for key share;

  if v_shop.publication_state = 'published' and v_publication.managed_shop_id is null then
    raise exception 'published canonical managed shop has no reviewed publication' using errcode = '23514';
  end if;

  if v_publication.managed_shop_id is not null then
    insert into app.areas (slug, name, is_published, published_at)
    values (v_publication.area_slug, v_publication.area_name, v_shop.publication_state = 'published',
      case when v_shop.publication_state = 'published' then now() else null end)
    on conflict (slug) do update set
      name = excluded.name,
      is_published = app.areas.is_published or excluded.is_published,
      published_at = case when app.areas.published_at is null and excluded.is_published then now() else app.areas.published_at end,
      updated_at = now()
    returning id into v_area_id;

    v_description := replace(replace(replace(replace(replace(coalesce(v_publication.introduction, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    update app.shops set
      name = v_publication.shop_name,
      description_html = v_description,
      excerpt = coalesce(v_publication.introduction, ''),
      official_url = v_publication.official_url,
      phone = v_publication.phone,
      address_text = v_publication.address,
      booking_url = v_publication.booking_url,
      publication_status = case v_shop.publication_state
        when 'published' then 'published'
        when 'deleted' then 'archived'
        else 'review'
      end,
      published_at = case when v_shop.publication_state = 'published' then coalesce(app.shops.published_at, v_publication.published_at, now()) else null end,
      updated_at = now()
    where id = v_shop.app_shop_id;

    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

create or replace function private.create_and_publish_canonical_managed_shop(
  p_shop_slug text, p_payload jsonb, p_actor_label text
) returns uuid
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_managed_shop_id uuid; v_app_shop_id uuid; v_result text;
begin
  select managed_shop_id, app_shop_id into v_managed_shop_id, v_app_shop_id
  from private.create_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label);
  -- Older installations may contain a pre-foundation implementation under
  -- this function name.  Preserve the freshly-created managed row, but never
  -- allow it to be published without first binding one new app.shops record.
  select app_shop_id into v_app_shop_id from private.managed_shops where id = v_managed_shop_id for update;
  if v_app_shop_id is null then
    insert into app.shops (slug, canonical_path, name, description_html, excerpt, official_url, address_text, booking_url, publication_status)
    values (
      p_shop_slug, '/shops/' || p_shop_slug || '/', trim(p_payload ->> 'shop_name'),
      '', coalesce(nullif(trim(p_payload ->> 'introduction'), ''), ''),
      nullif(trim(p_payload ->> 'official_url'), ''), nullif(trim(p_payload ->> 'address'), ''),
      nullif(trim(p_payload ->> 'booking_url'), ''), 'draft'
    ) returning id into v_app_shop_id;
    update private.managed_shops set app_shop_id = v_app_shop_id, updated_at = now() where id = v_managed_shop_id;
  end if;
  v_result := private.publish_managed_shop_revision(v_managed_shop_id, 1, p_actor_label);
  if v_result <> 'ok' then raise exception 'canonical managed shop publication failed' using errcode = '23514'; end if;
  perform private.sync_canonical_managed_shop_publication_v11(v_managed_shop_id);
  return v_managed_shop_id;
end;
$$;

create or replace function private.save_and_publish_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.save_and_publish_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.set_canonical_managed_shop_visibility(
  p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.set_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.review_canonical_managed_shop_revision(
  p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.review_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note);
  if v_result = 'ok' and p_decision = 'approved' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.archive_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.archive_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.restore_canonical_managed_shop_to_unlisted(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.restore_archived_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function api.create_and_publish_canonical_managed_shop(p_shop_slug text, p_payload jsonb, p_actor_label text)
returns uuid language sql security invoker set search_path = private, api, pg_temp as $$
  select private.create_and_publish_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label)
$$;
create or replace function api.save_and_publish_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.save_and_publish_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label)
$$;
create or replace function api.set_canonical_managed_shop_visibility(p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.set_canonical_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label)
$$;
create or replace function api.review_canonical_managed_shop_revision(p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.review_canonical_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note)
$$;
create or replace function api.archive_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.archive_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;
create or replace function api.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
revoke all on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;
grant execute on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;

notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017155000', array[$eskomi_packet_02_5$-- Canonical operator-managed shops use app.shops as their durable identity.
-- These wrappers keep that identity aligned with the reviewed directory
-- publication without changing the behaviour of legacy WordPress imports.

create or replace function private.sync_canonical_managed_shop_publication_v11(
  p_managed_shop_id uuid
) returns void
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare
  v_shop private.managed_shops%rowtype;
  v_publication private.managed_shop_publications%rowtype;
  v_area_id uuid;
  v_description text;
begin
  select * into v_shop from private.managed_shops where id = p_managed_shop_id for key share;
  if not found or v_shop.app_shop_id is null then
    raise exception 'canonical managed shop not found' using errcode = 'P0002';
  end if;

  select * into v_publication from private.managed_shop_publications
  where managed_shop_id = v_shop.id for key share;

  if v_shop.publication_state = 'published' and v_publication.managed_shop_id is null then
    raise exception 'published canonical managed shop has no reviewed publication' using errcode = '23514';
  end if;

  if v_publication.managed_shop_id is not null then
    insert into app.areas (slug, name, is_published, published_at)
    values (v_publication.area_slug, v_publication.area_name, v_shop.publication_state = 'published',
      case when v_shop.publication_state = 'published' then now() else null end)
    on conflict (slug) do update set
      name = excluded.name,
      is_published = app.areas.is_published or excluded.is_published,
      published_at = case when app.areas.published_at is null and excluded.is_published then now() else app.areas.published_at end,
      updated_at = now()
    returning id into v_area_id;

    v_description := replace(replace(replace(replace(replace(coalesce(v_publication.introduction, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
    update app.shops set
      name = v_publication.shop_name,
      description_html = v_description,
      excerpt = coalesce(v_publication.introduction, ''),
      official_url = v_publication.official_url,
      phone = v_publication.phone,
      address_text = v_publication.address,
      booking_url = v_publication.booking_url,
      publication_status = case v_shop.publication_state
        when 'published' then 'published'
        when 'deleted' then 'archived'
        else 'review'
      end,
      published_at = case when v_shop.publication_state = 'published' then coalesce(app.shops.published_at, v_publication.published_at, now()) else null end,
      updated_at = now()
    where id = v_shop.app_shop_id;

    insert into app.shop_areas (shop_id, area_id, is_primary, source_system)
    values (v_shop.app_shop_id, v_area_id, true, 'operator-managed')
    on conflict (shop_id, area_id) do update set is_primary = true, source_system = excluded.source_system;
    update app.shop_areas set is_primary = false
    where shop_id = v_shop.app_shop_id and area_id <> v_area_id and is_primary;
  else
    update app.shops set publication_status = 'draft', published_at = null, updated_at = now()
    where id = v_shop.app_shop_id;
  end if;
end;
$$;

create or replace function private.create_and_publish_canonical_managed_shop(
  p_shop_slug text, p_payload jsonb, p_actor_label text
) returns uuid
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_managed_shop_id uuid; v_app_shop_id uuid; v_result text;
begin
  select managed_shop_id, app_shop_id into v_managed_shop_id, v_app_shop_id
  from private.create_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label);
  -- Older installations may contain a pre-foundation implementation under
  -- this function name.  Preserve the freshly-created managed row, but never
  -- allow it to be published without first binding one new app.shops record.
  select app_shop_id into v_app_shop_id from private.managed_shops where id = v_managed_shop_id for update;
  if v_app_shop_id is null then
    insert into app.shops (slug, canonical_path, name, description_html, excerpt, official_url, address_text, booking_url, publication_status)
    values (
      p_shop_slug, '/shops/' || p_shop_slug || '/', trim(p_payload ->> 'shop_name'),
      '', coalesce(nullif(trim(p_payload ->> 'introduction'), ''), ''),
      nullif(trim(p_payload ->> 'official_url'), ''), nullif(trim(p_payload ->> 'address'), ''),
      nullif(trim(p_payload ->> 'booking_url'), ''), 'draft'
    ) returning id into v_app_shop_id;
    update private.managed_shops set app_shop_id = v_app_shop_id, updated_at = now() where id = v_managed_shop_id;
  end if;
  v_result := private.publish_managed_shop_revision(v_managed_shop_id, 1, p_actor_label);
  if v_result <> 'ok' then raise exception 'canonical managed shop publication failed' using errcode = '23514'; end if;
  perform private.sync_canonical_managed_shop_publication_v11(v_managed_shop_id);
  return v_managed_shop_id;
end;
$$;

create or replace function private.save_and_publish_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.save_and_publish_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.set_canonical_managed_shop_visibility(
  p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.set_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.review_canonical_managed_shop_revision(
  p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.review_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note);
  if v_result = 'ok' and p_decision = 'approved' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.archive_canonical_managed_shop(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.archive_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function private.restore_canonical_managed_shop_to_unlisted(
  p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text
) returns text
language plpgsql security definer set search_path = private, app, pg_temp as $$
declare v_result text;
begin
  if not exists (select 1 from private.managed_shops where id = p_managed_shop_id and app_shop_id is not null) then return 'not_found'; end if;
  v_result := private.restore_archived_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label);
  if v_result = 'ok' then perform private.sync_canonical_managed_shop_publication_v11(p_managed_shop_id); end if;
  return v_result;
end;
$$;

create or replace function api.create_and_publish_canonical_managed_shop(p_shop_slug text, p_payload jsonb, p_actor_label text)
returns uuid language sql security invoker set search_path = private, api, pg_temp as $$
  select private.create_and_publish_canonical_managed_shop(p_shop_slug, p_payload, p_actor_label)
$$;
create or replace function api.save_and_publish_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_payload jsonb, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.save_and_publish_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_payload, p_actor_label)
$$;
create or replace function api.set_canonical_managed_shop_visibility(p_managed_shop_id uuid, p_expected_revision integer, p_visibility text, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.set_canonical_managed_shop_visibility(p_managed_shop_id, p_expected_revision, p_visibility, p_actor_label)
$$;
create or replace function api.review_canonical_managed_shop_revision(p_managed_shop_id uuid, p_expected_revision integer, p_decision text, p_reviewer_label text, p_note text default null)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.review_canonical_managed_shop_revision(p_managed_shop_id, p_expected_revision, p_decision, p_reviewer_label, p_note)
$$;
create or replace function api.archive_canonical_managed_shop(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.archive_canonical_managed_shop(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;
create or replace function api.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id uuid, p_expected_revision integer, p_actor_label text)
returns text language sql security invoker set search_path = private, api, pg_temp as $$
  select private.restore_canonical_managed_shop_to_unlisted(p_managed_shop_id, p_expected_revision, p_actor_label)
$$;

revoke all on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
revoke all on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) from public, anon, authenticated;
grant execute on function private.sync_canonical_managed_shop_publication_v11(uuid), private.create_and_publish_canonical_managed_shop(text,jsonb,text), private.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), private.set_canonical_managed_shop_visibility(uuid,integer,text,text), private.review_canonical_managed_shop_revision(uuid,integer,text,text,text), private.archive_canonical_managed_shop(uuid,integer,text), private.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;
grant execute on function api.create_and_publish_canonical_managed_shop(text,jsonb,text), api.save_and_publish_canonical_managed_shop(uuid,integer,jsonb,text), api.set_canonical_managed_shop_visibility(uuid,integer,text,text), api.review_canonical_managed_shop_revision(uuid,integer,text,text,text), api.archive_canonical_managed_shop(uuid,integer,text), api.restore_canonical_managed_shop_to_unlisted(uuid,integer,text) to service_role;

notify pgrst, 'reload schema';
$eskomi_packet_02_5$], 'eskomi_canonical_managed_directory_operations', null, null, null);

-- SOURCE 20261017156000_eskomi_v11_global_review_projection.sql
-- SHA-256 d9ecfafb62a977d63dd6334f3c049bf357255f022df0ac98b3ea361d9038fbd5
-- The global review list reads the same approved v1.1 publication revision
-- as the shop detail.  It intentionally exposes no receipt, session, or
-- moderation material.
create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  directory_id bigint, shop_slug text, shop_name text, area_slug text, area_name text
) language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating','')::smallint,
    revision.experience_comment, revision.nickname, publication.therapist_display_name_snapshot,
    publication.published_at, managed.directory_id, shop.slug, shop.name,
    area.slug, area.name
  from app.review_experience_publications publication
  join private.review_experience_revisions revision
    on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.managed_shop_publications directory on directory.managed_shop_id=managed.id
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published'
    and (p_area_slug is null or area.slug=p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1,least(p_limit,50)) offset greatest(p_offset,0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint language sql security invoker set search_path=private,app,api,pg_temp as $$
  select count(*) from app.review_experience_publications publication
  join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published' and (p_area_slug is null or area.slug=p_area_slug)
$$;

revoke all on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) from public, anon, authenticated;
grant execute on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) to service_role;
notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017156000', array[$eskomi_packet_02_6$-- The global review list reads the same approved v1.1 publication revision
-- as the shop detail.  It intentionally exposes no receipt, session, or
-- moderation material.
create or replace function api.list_public_review_experience_publications_global(
  p_limit integer default 20, p_offset integer default 0, p_area_slug text default null
) returns table(
  public_handle uuid, rating smallint, body text, display_name text,
  therapist_display_name text, published_at timestamptz,
  directory_id bigint, shop_slug text, shop_name text, area_slug text, area_name text
) language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.public_handle,
    nullif(revision.assessment_snapshot->>'shopRating','')::smallint,
    revision.experience_comment, revision.nickname, publication.therapist_display_name_snapshot,
    publication.published_at, managed.directory_id, shop.slug, shop.name,
    area.slug, area.name
  from app.review_experience_publications publication
  join private.review_experience_revisions revision
    on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.managed_shop_publications directory on directory.managed_shop_id=managed.id
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published'
    and (p_area_slug is null or area.slug=p_area_slug)
  order by publication.published_at desc, publication.id desc
  limit greatest(1,least(p_limit,50)) offset greatest(p_offset,0)
$$;

create or replace function api.count_public_review_experience_publications_global(p_area_slug text default null)
returns bigint language sql security invoker set search_path=private,app,api,pg_temp as $$
  select count(*) from app.review_experience_publications publication
  join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join app.shop_areas shop_area on shop_area.shop_id=shop.id and shop_area.is_primary
  join app.areas area on area.id=shop_area.area_id and area.is_published
  where publication.publication_state='published' and (p_area_slug is null or area.slug=p_area_slug)
$$;

revoke all on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) from public, anon, authenticated;
grant execute on function api.list_public_review_experience_publications_global(integer,integer,text), api.count_public_review_experience_publications_global(text) to service_role;
notify pgrst, 'reload schema';
$eskomi_packet_02_6$], 'eskomi_v11_global_review_projection', null, null, null);

-- SOURCE 20261017157000_eskomi_canonical_partner_home_and_listing.sql
-- SHA-256 a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615
-- Canonical Partner home and listing workflow.
--
-- New managed stores never need a WordPress post or attachment identifier.
-- These RPCs resolve the signed-in membership to app.shops first, then keep
-- Partner mutations on the same managed_shop_revisions lifecycle used by the
-- operator dashboard.  They intentionally do not adapt the legacy
-- listing_stores or WordPress campaign tables.

-- Every mutation performs the same live publication check as the canonical
-- Partner home. A stopped shop must not remain operable through a stale
-- therapist/operations tab, while legacy rows without a managed projection
-- keep working until they are explicitly migrated.
create or replace function private.assert_partner_therapist_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  perform 1
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if not found then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
end $$;

create or replace function private.assert_partner_canonical_membership(
  p_workspace_id uuid, p_auth_user_id uuid
) returns uuid
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  select workspace.app_shop_id into v_shop_id
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
    and managed.publication_state='published'
  for update of membership,workspace,managed;
  if v_shop_id is null then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
  return v_shop_id;
end $$;

-- The v1.1 operations, therapist and widget RPCs share a live membership
-- check. They also support existing canonical stores that predate the managed
-- directory projection, so only the new home/listing boundary requires a
-- managed_shops row.
create or replace function private.assert_partner_v11_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id, shop.id, shop.slug, membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published' and managed.publication_state='published'
$$;

create or replace function private.get_partner_canonical_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return query
    select workspace.id,shop.id,shop.slug,shop.name,'https://mens-esthe-kuchikomi.com' || shop.canonical_path,workspace.state::text,membership.role::text
    from private.partner_workspaces workspace
    join private.partner_memberships membership on membership.workspace_id=workspace.id and membership.auth_user_id=p_auth_user_id
    join app.shops shop on shop.id=v_shop
    where workspace.id=p_workspace_id;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select link.public_handle into v_review_handle
  from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  select widget.public_handle into v_widget_handle
  from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

create or replace function private.get_partner_canonical_listing_editor(
  p_workspace_id uuid,p_auth_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return (
    select jsonb_build_object(
      'store_id',managed.id,'app_shop_id',v_shop,'shop_slug',managed.shop_slug,'canonical_url',managed.canonical_url,
      'current_revision',managed.current_revision,
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'latest_review',(select jsonb_build_object('decision',review.decision,'note',review.note)
        from private.managed_shop_reviews review where review.managed_shop_id=managed.id order by review.created_at desc limit 1)
    )
    from private.managed_shops managed
    join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
    where managed.app_shop_id=v_shop
  );
end $$;

create or replace function private.save_partner_canonical_listing_draft(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_name','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area:=btrim(coalesce(p_patch->>'area_name',v_revision.area_name));
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120 or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_revision.area_slug,'area_name',v_area,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.submit_partner_canonical_listing_change(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  if v_managed is null then raise exception 'managed shop is unavailable' using errcode='42501'; end if;
  return private.submit_managed_shop_revision(v_managed,p_expected_revision,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.reserve_partner_canonical_listing_banner_upload(
  p_workspace_id uuid,p_auth_user_id uuid,p_content_type text
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_managed is null or v_extension is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  return 'managed-shops/' || v_managed || '/' || gen_random_uuid() || '.' || v_extension;
end $$;

create or replace function private.attach_partner_canonical_listing_banner_asset(
  p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer
) returns uuid
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_asset uuid; v_state text; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select managed.id,revision.state into v_managed,v_state from private.managed_shops managed
  join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
  where managed.app_shop_id=v_shop for update of managed;
  if v_managed is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  v_asset:=substring(p_object_key from '^managed-shops/[0-9a-f-]+/([0-9a-f-]+)[.](png|jpg|webp)$')::uuid;
  if v_state not in ('draft','changes_requested','approved') or v_extension is null
    or p_object_key<>format('managed-shops/%s/%s.%s',v_managed,v_asset,v_extension)
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 5242880 or p_width not between 1 and 8000 or p_height not between 1 and 8000 then
    raise exception 'listing banner is unavailable' using errcode='42501';
  end if;
  insert into private.managed_shop_assets(id,managed_shop_id,object_key,sha256,content_type,byte_size,width,height)
  values(v_asset,v_managed,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height);
  return v_asset;
end $$;

create or replace function api.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_auth_membership(p_auth_user_id) $$;
create or replace function api.get_partner_canonical_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_workspace_identity(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_growth_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_growth_v11(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_listing_editor(p_workspace_id uuid,p_auth_user_id uuid)
returns jsonb language sql security invoker set search_path=private,api,pg_temp as $$ select private.get_partner_canonical_listing_editor(p_workspace_id,p_auth_user_id) $$;
create or replace function api.save_partner_canonical_listing_draft(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.save_partner_canonical_listing_draft(p_workspace_id,p_auth_user_id,p_expected_revision,p_patch) $$;
create or replace function api.submit_partner_canonical_listing_change(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.submit_partner_canonical_listing_change(p_workspace_id,p_auth_user_id,p_expected_revision) $$;
create or replace function api.reserve_partner_canonical_listing_banner_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.reserve_partner_canonical_listing_banner_upload(p_workspace_id,p_auth_user_id,p_content_type) $$;
create or replace function api.attach_partner_canonical_listing_banner_asset(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language sql security invoker set search_path=private,api,pg_temp as $$ select private.attach_partner_canonical_listing_banner_asset(p_workspace_id,p_auth_user_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) $$;

revoke all on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;

notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017157000', array[$eskomi_packet_02_7$-- Canonical Partner home and listing workflow.
--
-- New managed stores never need a WordPress post or attachment identifier.
-- These RPCs resolve the signed-in membership to app.shops first, then keep
-- Partner mutations on the same managed_shop_revisions lifecycle used by the
-- operator dashboard.  They intentionally do not adapt the legacy
-- listing_stores or WordPress campaign tables.

-- Every mutation performs the same live publication check as the canonical
-- Partner home. A stopped shop must not remain operable through a stale
-- therapist/operations tab, while legacy rows without a managed projection
-- keep working until they are explicitly migrated.
create or replace function private.assert_partner_therapist_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  perform 1
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace,shop;
  if not found then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
end $$;

create or replace function private.assert_partner_canonical_membership(
  p_workspace_id uuid, p_auth_user_id uuid
) returns uuid
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  select workspace.app_shop_id into v_shop_id
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.workspace_id=p_workspace_id
    and membership.auth_user_id=p_auth_user_id
    and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
    and managed.publication_state='published'
  for update of membership,workspace,managed;
  if v_shop_id is null then
    raise exception 'partner membership is unavailable' using errcode='42501';
  end if;
  return v_shop_id;
end $$;

-- The v1.1 operations, therapist and widget RPCs share a live membership
-- check. They also support existing canonical stores that predate the managed
-- directory projection, so only the new home/listing boundary requires a
-- managed_shops row.
create or replace function private.assert_partner_v11_membership(
  p_workspace_id uuid,p_auth_user_id uuid
) returns uuid language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  select workspace.app_shop_id into v_shop
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id
    and membership.status='active' and membership.role='owner'
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published'
  for update of membership,workspace;
  if v_shop is null then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
  return v_shop;
end $$;

create or replace function private.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text)
language sql security definer set search_path=private,app,pg_temp as $$
  select workspace.id, shop.id, shop.slug, membership.role::text
  from private.partner_memberships membership
  join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  join app.shops shop on shop.id=workspace.app_shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  where membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role in ('owner','manager')
    and workspace.state in ('free_official_partner','active_partner')
    and shop.publication_status='published' and managed.publication_state='published'
$$;

create or replace function private.get_partner_canonical_workspace_identity(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return query
    select workspace.id,shop.id,shop.slug,shop.name,'https://mens-esthe-kuchikomi.com' || shop.canonical_path,workspace.state::text,membership.role::text
    from private.partner_workspaces workspace
    join private.partner_memberships membership on membership.workspace_id=workspace.id and membership.auth_user_id=p_auth_user_id
    join app.shops shop on shop.id=v_shop
    where workspace.id=p_workspace_id;
end $$;

create or replace function private.get_partner_canonical_growth_v11(
  p_workspace_id uuid,p_auth_user_id uuid
) returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_review_handle uuid; v_widget_handle uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select link.public_handle into v_review_handle
  from private.create_partner_review_entry_link(p_workspace_id,null,'line') link;
  select widget.public_handle into v_widget_handle
  from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) widget;
  return query
    select p_workspace_id,v_shop,v_review_handle,v_widget_handle,shop.name,shop.canonical_path,
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state<>'withdrawn'),
      (select count(*) from private.review_experiences experience where experience.shop_id=v_shop and experience.state in ('submitted','under_review')),
      (select count(*) from app.review_experience_publications publication where publication.shop_id=v_shop and publication.publication_state='published')
    from app.shops shop where shop.id=v_shop;
end $$;

create or replace function private.get_partner_canonical_listing_editor(
  p_workspace_id uuid,p_auth_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  return (
    select jsonb_build_object(
      'store_id',managed.id,'app_shop_id',v_shop,'shop_slug',managed.shop_slug,'canonical_url',managed.canonical_url,
      'current_revision',managed.current_revision,
      'revision',jsonb_build_object('state',revision.state,'shop_name',revision.shop_name,'area',revision.area_name,
        'website_url',revision.official_url,'introduction',revision.introduction,'banner_asset_id',revision.banner_asset_id),
      'latest_review',(select jsonb_build_object('decision',review.decision,'note',review.note)
        from private.managed_shop_reviews review where review.managed_shop_id=managed.id order by review.created_at desc limit 1)
    )
    from private.managed_shops managed
    join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
    where managed.app_shop_id=v_shop
  );
end $$;

create or replace function private.save_partner_canonical_listing_draft(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed private.managed_shops%rowtype; v_revision private.managed_shop_revisions%rowtype; v_payload jsonb; v_name text; v_area text; v_url text; v_intro text; v_banner uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  if jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) key where key not in ('shop_name','area_name','official_url','introduction','banner_asset_id')) then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  select * into v_managed from private.managed_shops where app_shop_id=v_shop for update;
  if not found or v_managed.current_revision<>p_expected_revision then return 'conflict'; end if;
  select * into v_revision from private.managed_shop_revisions where managed_shop_id=v_managed.id and revision=v_managed.current_revision for key share;
  v_name:=btrim(coalesce(p_patch->>'shop_name',v_revision.shop_name));
  v_area:=btrim(coalesce(p_patch->>'area_name',v_revision.area_name));
  v_url:=btrim(coalesce(p_patch->>'official_url',v_revision.official_url));
  v_intro:=nullif(btrim(coalesce(p_patch->>'introduction',v_revision.introduction,'')),'');
  v_banner:=case when p_patch ? 'banner_asset_id' and p_patch->>'banner_asset_id' is not null then (p_patch->>'banner_asset_id')::uuid else v_revision.banner_asset_id end;
  if char_length(v_name) not between 1 and 120 or char_length(v_area) not between 1 and 120 or v_url !~ '^https?://' or char_length(coalesce(v_intro,''))>5000 then
    raise exception 'invalid listing patch' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('shop_name',v_name,'area_slug',v_revision.area_slug,'area_name',v_area,'official_url',v_url,
    'introduction',v_intro,'address',v_revision.address,'business_hours',v_revision.business_hours,'phone',v_revision.phone,
    'line_url',v_revision.line_url,'booking_url',v_revision.booking_url,'basic_price',v_revision.basic_price,'price_90',v_revision.price_90,
    'banner_asset_id',v_banner,'gallery_asset_ids',coalesce(to_jsonb(v_revision.gallery_asset_ids),'[]'::jsonb));
  return private.save_managed_shop_draft(v_managed.id,p_expected_revision,v_payload,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.submit_partner_canonical_listing_change(
  p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  if v_managed is null then raise exception 'managed shop is unavailable' using errcode='42501'; end if;
  return private.submit_managed_shop_revision(v_managed,p_expected_revision,'partner_workspace:' || p_workspace_id);
end $$;

create or replace function private.reserve_partner_canonical_listing_banner_upload(
  p_workspace_id uuid,p_auth_user_id uuid,p_content_type text
) returns text
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select id into v_managed from private.managed_shops where app_shop_id=v_shop for key share;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  if v_managed is null or v_extension is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  return 'managed-shops/' || v_managed || '/' || gen_random_uuid() || '.' || v_extension;
end $$;

create or replace function private.attach_partner_canonical_listing_banner_asset(
  p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer
) returns uuid
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_shop uuid; v_managed uuid; v_asset uuid; v_state text; v_extension text;
begin
  v_shop:=private.assert_partner_canonical_membership(p_workspace_id,p_auth_user_id);
  select managed.id,revision.state into v_managed,v_state from private.managed_shops managed
  join private.managed_shop_revisions revision on revision.managed_shop_id=managed.id and revision.revision=managed.current_revision
  where managed.app_shop_id=v_shop for update of managed;
  if v_managed is null then raise exception 'listing banner is unavailable' using errcode='42501'; end if;
  v_extension:=case p_content_type when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else null end;
  v_asset:=substring(p_object_key from '^managed-shops/[0-9a-f-]+/([0-9a-f-]+)[.](png|jpg|webp)$')::uuid;
  if v_state not in ('draft','changes_requested','approved') or v_extension is null
    or p_object_key<>format('managed-shops/%s/%s.%s',v_managed,v_asset,v_extension)
    or p_sha256 !~ '^[0-9a-f]{64}$' or p_byte_size not between 1 and 5242880 or p_width not between 1 and 8000 or p_height not between 1 and 8000 then
    raise exception 'listing banner is unavailable' using errcode='42501';
  end if;
  insert into private.managed_shop_assets(id,managed_shop_id,object_key,sha256,content_type,byte_size,width,height)
  values(v_asset,v_managed,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height);
  return v_asset;
end $$;

create or replace function api.get_partner_canonical_auth_membership(p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_auth_membership(p_auth_user_id) $$;
create or replace function api.get_partner_canonical_workspace_identity(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,shop_slug text,shop_name text,canonical_url text,state text,role text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_workspace_identity(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_growth_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(workspace_id uuid,app_shop_id uuid,review_handle uuid,widget_handle uuid,shop_name text,canonical_path text,submitted_reviews bigint,pending_reviews bigint,published_reviews bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_canonical_growth_v11(p_workspace_id,p_auth_user_id) $$;
create or replace function api.get_partner_canonical_listing_editor(p_workspace_id uuid,p_auth_user_id uuid)
returns jsonb language sql security invoker set search_path=private,api,pg_temp as $$ select private.get_partner_canonical_listing_editor(p_workspace_id,p_auth_user_id) $$;
create or replace function api.save_partner_canonical_listing_draft(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_patch jsonb)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.save_partner_canonical_listing_draft(p_workspace_id,p_auth_user_id,p_expected_revision,p_patch) $$;
create or replace function api.submit_partner_canonical_listing_change(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.submit_partner_canonical_listing_change(p_workspace_id,p_auth_user_id,p_expected_revision) $$;
create or replace function api.reserve_partner_canonical_listing_banner_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.reserve_partner_canonical_listing_banner_upload(p_workspace_id,p_auth_user_id,p_content_type) $$;
create or replace function api.attach_partner_canonical_listing_banner_asset(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language sql security invoker set search_path=private,api,pg_temp as $$ select private.attach_partner_canonical_listing_banner_asset(p_workspace_id,p_auth_user_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height) $$;

revoke all on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
revoke all on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function private.assert_partner_canonical_membership(uuid,uuid),private.get_partner_canonical_auth_membership(uuid),private.get_partner_canonical_workspace_identity(uuid,uuid),private.get_partner_canonical_growth_v11(uuid,uuid),private.get_partner_canonical_listing_editor(uuid,uuid),private.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),private.submit_partner_canonical_listing_change(uuid,uuid,integer),private.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),private.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
grant execute on function api.get_partner_canonical_auth_membership(uuid),api.get_partner_canonical_workspace_identity(uuid,uuid),api.get_partner_canonical_growth_v11(uuid,uuid),api.get_partner_canonical_listing_editor(uuid,uuid),api.save_partner_canonical_listing_draft(uuid,uuid,integer,jsonb),api.submit_partner_canonical_listing_change(uuid,uuid,integer),api.reserve_partner_canonical_listing_banner_upload(uuid,uuid,text),api.attach_partner_canonical_listing_banner_asset(uuid,uuid,text,text,text,integer,integer,integer) to service_role;

notify pgrst,'reload schema';
$eskomi_packet_02_7$], 'eskomi_canonical_partner_home_and_listing', null, null, null);
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'stage', '02',
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ('20261017151000', 'eskomi_review_target_and_redemption_hardening', '60481b9c98b5121835ddaa9aeb44ad5ff0fe4f08999310f06cf15b644c20e371'), ('20261017152000', 'eskomi_community_ui_safety_and_review_projection', '5e14ae52c991dc3c6ecedbae540199c5913d4fca3bd4ecf18a3bf16a2b49624a'), ('20261017153000', 'eskomi_community_receipts_and_burst_controls', '91640643717c46b07fbefa4ee89185a839976a8fab1b534dae73c5feb50f3b65'), ('20261017154000', 'eskomi_public_shop_detail_reviews', '95c30eb40048b69c4ea70a8828b2dcf0092d9ad8dab90f4c306764cc470c12e2'), ('20261017155000', 'eskomi_canonical_managed_directory_operations', '1c7d841cf88a636cd2db6946424bd09423304a22b79ddba8f263100abc5d021e'), ('20261017156000', 'eskomi_v11_global_review_projection', 'd9ecfafb62a977d63dd6334f3c049bf357255f022df0ac98b3ea361d9038fbd5'), ('20261017157000', 'eskomi_canonical_partner_home_and_listing', 'a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615')) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
