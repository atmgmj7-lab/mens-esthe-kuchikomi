-- Eskomi v1.1 manual SQL Editor packet: stage 04 of 05
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
      ('20261017150000', 'eskomi_corrections_and_community', '912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d'),
      ('20261017151000', 'eskomi_review_target_and_redemption_hardening', '60481b9c98b5121835ddaa9aeb44ad5ff0fe4f08999310f06cf15b644c20e371'),
      ('20261017152000', 'eskomi_community_ui_safety_and_review_projection', '5e14ae52c991dc3c6ecedbae540199c5913d4fca3bd4ecf18a3bf16a2b49624a'),
      ('20261017153000', 'eskomi_community_receipts_and_burst_controls', '91640643717c46b07fbefa4ee89185a839976a8fab1b534dae73c5feb50f3b65'),
      ('20261017154000', 'eskomi_public_shop_detail_reviews', '95c30eb40048b69c4ea70a8828b2dcf0092d9ad8dab90f4c306764cc470c12e2'),
      ('20261017155000', 'eskomi_canonical_managed_directory_operations', '1c7d841cf88a636cd2db6946424bd09423304a22b79ddba8f263100abc5d021e'),
      ('20261017156000', 'eskomi_v11_global_review_projection', 'd9ecfafb62a977d63dd6334f3c049bf357255f022df0ac98b3ea361d9038fbd5'),
      ('20261017157000', 'eskomi_canonical_partner_home_and_listing', 'a2439224b7031b77cb5bb39c7bcbc8591c32d403222a940b83400d21eaa25615'),
      ('20261017158000', 'eskomi_canonical_primary_area_transition', 'e45925db146edf2282d5bdc2a90d354c8b8ba57657f9f511aa6ff255d7913d39'),
      ('20261017159000', 'eskomi_canonical_partner_provisioning', '1b32232d0a5e8f7784c908731ccf284fb6358ebd967492b141baa5a7cd73cb9c'),
      ('20261017160000', 'eskomi_partner_workspace_compatibility', '7ca1a354a28cb2c612c0600844090aa5b82ba3ce208a1ef2e7084b34cafb3c9a'),
      ('20261017161000', 'eskomi_partner_area_selection', '925cafbdac5d25483260d099cea7159088a98b8e88e14bb6d2aa146476a3b13c'),
      ('20261017162000', 'eskomi_partner_read_roles', '99ee2ddbfef1967cd3e83eaf9e0a0ea948b6f8bffc94b417670acfdb2721127f'),
      ('20261017163000', 'eskomi_canonical_partner_registration_review', 'bbce76f47cfbb3100cdcb37bd614018b7fa187c2c57cd01d984e526812d72af1'),
      ('20261017164000', 'eskomi_legacy_workspace_mapping', '81b7924912003da5e867046754c9c226fa849257c0a2b85a8728ab4b70b8c586')
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
    where version in ('20261017165000', '20261017166000', '20261017167000', '20261017168000', '20261017169000', '20261017170000', '20261017171000')
  ) then
    raise exception 'stage 04 is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;

-- SOURCE 20261017165000_eskomi_community_reports_and_appeals.sql
-- SHA-256 060ac944cac3246ea1c4dfa4d03feb3fd603718ccea0a29e1559179d28e876d2
-- Community safety follow-up: reports never silently unpublish a post.  An
-- operator must open a re-review and every step remains auditable.

alter table private.community_idempotency_v11 drop constraint if exists community_idempotency_v11_operation_check;
alter table private.community_idempotency_v11 add constraint community_idempotency_v11_operation_check check (operation in ('correction','post','community_report','community_appeal'));

create table private.community_post_reports_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  reporter_scope_hash text not null check (reporter_scope_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other')),
  detail text not null default '' check (char_length(detail) <= 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, reporter_scope_hash, idempotency_hash)
);
create table private.community_post_appeals_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, receipt_hash, idempotency_hash)
);
alter table private.community_post_reports_v11 enable row level security;
alter table private.community_post_appeals_v11 enable row level security;
revoke all on table private.community_post_reports_v11,private.community_post_appeals_v11 from public,anon,authenticated;

create function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex');
 if v_expected<>p_payload_hash then raise exception 'invalid report payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_reports_v11 where post_id=p_post_id and reporter_scope_hash=p_scope_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;

create function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select id into v_post from private.community_posts_v11 where receipt_hash=p_receipt_hash and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_appeals_v11 where post_id=v_post and receipt_hash=p_receipt_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create function private.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_report private.community_post_reports_v11%rowtype; v_post_revision integer;
begin
 select * into v_report from private.community_post_reports_v11 where id=p_report_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'report changed' using errcode='40001'; end if;
 update private.community_post_reports_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_report_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',published_at=null,operator_reason=btrim(p_reason),revision=revision+1 where id=v_report.post_id and moderation_state='approved' and publication_state='published' returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_report.post_id,'report_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',operator_reason=btrim(p_reason),revision=revision+1 where id=v_appeal.post_id and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by report.created_at asc $$;
create function private.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by appeal.created_at asc $$;

create function api.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(report_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_report_v11(p_post_id,p_reason_code,p_detail,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text) returns table(appeal_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_appeal_v11(p_receipt_hash,p_reason,p_idempotency_hash,p_payload_hash) $$;
create function api.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_report_v11(p_report_id,p_decision,p_reason,p_expected_revision) $$;
create function api.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_appeal_v11(p_appeal_id,p_decision,p_reason,p_expected_revision) $$;
create function api.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11() $$;
create function api.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11() $$;
revoke all on function api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() from public,anon,authenticated;
grant execute on function private.submit_community_report_v11(uuid,text,text,text,text,text),private.submit_community_appeal_v11(text,text,text,text),private.review_community_report_v11(uuid,text,text,integer),private.review_community_appeal_v11(uuid,text,text,integer),private.list_operator_community_reports_v11(),private.list_operator_community_appeals_v11(),api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017165000', array[$eskomi_packet_04_1$-- Community safety follow-up: reports never silently unpublish a post.  An
-- operator must open a re-review and every step remains auditable.

alter table private.community_idempotency_v11 drop constraint if exists community_idempotency_v11_operation_check;
alter table private.community_idempotency_v11 add constraint community_idempotency_v11_operation_check check (operation in ('correction','post','community_report','community_appeal'));

create table private.community_post_reports_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  reporter_scope_hash text not null check (reporter_scope_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other')),
  detail text not null default '' check (char_length(detail) <= 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, reporter_scope_hash, idempotency_hash)
);
create table private.community_post_appeals_v11 (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  receipt_hash text not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  idempotency_hash text not null check (idempotency_hash ~ '^[0-9a-f]{64}$'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 400),
  state text not null default 'received' check (state in ('received','reviewing','resolved','dismissed')),
  operator_reason text not null default '' check (char_length(operator_reason) <= 1000),
  revision integer not null default 1 check (revision > 0), created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(post_id, receipt_hash, idempotency_hash)
);
alter table private.community_post_reports_v11 enable row level security;
alter table private.community_post_appeals_v11 enable row level security;
revoke all on table private.community_post_reports_v11,private.community_post_appeals_v11 from public,anon,authenticated;

create function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex');
 if v_expected<>p_payload_hash then raise exception 'invalid report payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_reports_v11 where post_id=p_post_id and reporter_scope_hash=p_scope_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;

create function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select id into v_post from private.community_posts_v11 where receipt_hash=p_receipt_hash and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select id,payload_hash into v_id,v_payload from private.community_post_appeals_v11 where post_id=v_post and receipt_hash=p_receipt_hash and idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create function private.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_report private.community_post_reports_v11%rowtype; v_post_revision integer;
begin
 select * into v_report from private.community_post_reports_v11 where id=p_report_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'report changed' using errcode='40001'; end if;
 update private.community_post_reports_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_report_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',published_at=null,operator_reason=btrim(p_reason),revision=revision+1 where id=v_report.post_id and moderation_state='approved' and publication_state='published' returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_report.post_id,'report_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then update private.community_posts_v11 set moderation_state='pending',publication_state='draft',operator_reason=btrim(p_reason),revision=revision+1 where id=v_appeal.post_id and moderation_state='rejected' and publication_state='draft' and withdrawn_at is null returning revision into v_post_revision; if not found then raise exception 'post changed' using errcode='40001'; end if; end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;

create function private.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by report.created_at asc $$;
create function private.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id order by appeal.created_at asc $$;

create function api.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text) returns table(report_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_report_v11(p_post_id,p_reason_code,p_detail,p_scope_hash,p_idempotency_hash,p_payload_hash) $$;
create function api.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text) returns table(appeal_id uuid,revision integer,state text,replayed boolean) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_appeal_v11(p_receipt_hash,p_reason,p_idempotency_hash,p_payload_hash) $$;
create function api.review_community_report_v11(p_report_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_report_v11(p_report_id,p_decision,p_reason,p_expected_revision) $$;
create function api.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_appeal_v11(p_appeal_id,p_decision,p_reason,p_expected_revision) $$;
create function api.list_operator_community_reports_v11() returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11() $$;
create function api.list_operator_community_appeals_v11() returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11() $$;
revoke all on function api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() from public,anon,authenticated;
grant execute on function private.submit_community_report_v11(uuid,text,text,text,text,text),private.submit_community_appeal_v11(text,text,text,text),private.review_community_report_v11(uuid,text,text,integer),private.review_community_appeal_v11(uuid,text,text,integer),private.list_operator_community_reports_v11(),private.list_operator_community_appeals_v11(),api.submit_community_report_v11(uuid,text,text,text,text,text),api.submit_community_appeal_v11(text,text,text,text),api.review_community_report_v11(uuid,text,text,integer),api.review_community_appeal_v11(uuid,text,text,integer),api.list_operator_community_reports_v11(),api.list_operator_community_appeals_v11() to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_1$], 'eskomi_community_reports_and_appeals', null, null, null);

-- SOURCE 20261017166000_eskomi_managed_reader_canonical_identity.sql
-- SHA-256 4ff2e3b87624aa8b77acb34b31cee1527e52efcab9a0b468693486a84691cfcd
-- The public managed-directory reader carries the immutable app.shops UUID so
-- ordering never falls back to a synthetic directory number for new stores.
drop function if exists api.list_published_managed_shops();
create function api.list_published_managed_shops()
returns table(managed_shop_id uuid,app_shop_id uuid,directory_id bigint,existing_wp_shop_id bigint,shop_slug text,canonical_url text,approved_revision integer,shop_name text,area_slug text,area_name text,official_url text,introduction text,address text,business_hours text,phone text,line_url text,booking_url text,basic_price integer,price_90 integer,banner_asset_id uuid,gallery_asset_ids uuid[])
language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.managed_shop_id,managed.app_shop_id,publication.directory_id,publication.existing_wp_shop_id,publication.shop_slug,publication.canonical_url,publication.approved_revision,publication.shop_name,publication.area_slug,publication.area_name,publication.official_url,publication.introduction,publication.address,publication.business_hours,publication.phone,publication.line_url,publication.booking_url,publication.basic_price,publication.price_90,publication.banner_asset_id,publication.gallery_asset_ids
  from private.managed_shop_publications publication
  join private.managed_shops managed on managed.id=publication.managed_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where managed.publication_state='published' and (managed.app_shop_id is null or shop.publication_status='published')
  order by publication.shop_slug
$$;
revoke all on function api.list_published_managed_shops() from public,anon,authenticated;
grant execute on function api.list_published_managed_shops() to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017166000', array[$eskomi_packet_04_2$-- The public managed-directory reader carries the immutable app.shops UUID so
-- ordering never falls back to a synthetic directory number for new stores.
drop function if exists api.list_published_managed_shops();
create function api.list_published_managed_shops()
returns table(managed_shop_id uuid,app_shop_id uuid,directory_id bigint,existing_wp_shop_id bigint,shop_slug text,canonical_url text,approved_revision integer,shop_name text,area_slug text,area_name text,official_url text,introduction text,address text,business_hours text,phone text,line_url text,booking_url text,basic_price integer,price_90 integer,banner_asset_id uuid,gallery_asset_ids uuid[])
language sql security invoker set search_path=private,app,api,pg_temp as $$
  select publication.managed_shop_id,managed.app_shop_id,publication.directory_id,publication.existing_wp_shop_id,publication.shop_slug,publication.canonical_url,publication.approved_revision,publication.shop_name,publication.area_slug,publication.area_name,publication.official_url,publication.introduction,publication.address,publication.business_hours,publication.phone,publication.line_url,publication.booking_url,publication.basic_price,publication.price_90,publication.banner_asset_id,publication.gallery_asset_ids
  from private.managed_shop_publications publication
  join private.managed_shops managed on managed.id=publication.managed_shop_id
  left join app.shops shop on shop.id=managed.app_shop_id
  where managed.publication_state='published' and (managed.app_shop_id is null or shop.publication_status='published')
  order by publication.shop_slug
$$;
revoke all on function api.list_published_managed_shops() from public,anon,authenticated;
grant execute on function api.list_published_managed_shops() to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_2$], 'eskomi_managed_reader_canonical_identity', null, null, null);

-- SOURCE 20261017167000_eskomi_community_hidden_post_appeals.sql
-- SHA-256 cc9896b20507c52486e1244b6e64cae19af0d5d50b50074d878d37fc0e3df3a0
-- `withdrawn` predates the appeal flow and is used for both a visitor's own
-- withdrawal and an operator hide.  The immutable moderation event is the
-- discriminator: only an operator `hidden` event may be appealed.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select post.id into v_post from private.community_posts_v11 post
 where post.receipt_hash=p_receipt_hash and post.moderation_state='rejected'
   and ((post.publication_state='draft' and post.withdrawn_at is null)
     or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
 for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.post_id=v_post and appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then
   update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
   where post.id=v_appeal.post_id and post.moderation_state='rejected'
     and ((post.publication_state='draft' and post.withdrawn_at is null)
       or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
   returning revision into v_post_revision;
   if not found then raise exception 'post changed' using errcode='40001'; end if;
 end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;
revoke all on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017167000', array[$eskomi_packet_04_3$-- `withdrawn` predates the appeal flow and is used for both a visitor's own
-- withdrawal and an operator hide.  The immutable moderation event is the
-- discriminator: only an operator `hidden` event may be appealed.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 select post.id into v_post from private.community_posts_v11 post
 where post.receipt_hash=p_receipt_hash and post.moderation_state='rejected'
   and ((post.publication_state='draft' and post.withdrawn_at is null)
     or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
 for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.post_id=v_post and appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
 select * into v_appeal from private.community_post_appeals_v11 where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
 if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
 update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id returning revision into v_post_revision;
 if p_decision='reopen_review' then
   update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
   where post.id=v_appeal.post_id and post.moderation_state='rejected'
     and ((post.publication_state='draft' and post.withdrawn_at is null)
       or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden')))
   returning revision into v_post_revision;
   if not found then raise exception 'post changed' using errcode='40001'; end if;
 end if;
 insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision) values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,1));
 return p_decision;
end $$;
revoke all on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_3$], 'eskomi_community_hidden_post_appeals', null, null, null);

-- SOURCE 20261017168000_eskomi_community_queue_pagination.sql
-- SHA-256 5026644776d69f4818980e013505e0da1267674d026187c94bde5df23e508650
-- Operator queues must not rely on PostgREST's global max_rows.  Pending work
-- is always a bounded, newest-first page; resolved history is opt-in.
drop function if exists private.list_operator_community_posts_v11();
drop function if exists private.list_operator_community_reports_v11();
drop function if exists private.list_operator_community_appeals_v11();
drop function if exists api.list_operator_community_posts_v11();
drop function if exists api.list_operator_community_reports_v11();
drop function if exists api.list_operator_community_appeals_v11();

create function private.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or post.moderation_state='pending'
 order by case when post.moderation_state='pending' then 0 else 1 end,post.created_at desc,post.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at
 from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or report.state in ('received','reviewing')
 order by case when report.state in ('received','reviewing') then 0 else 1 end,report.created_at desc,report.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at
 from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or appeal.state in ('received','reviewing')
 order by case when appeal.state in ('received','reviewing') then 0 else 1 end,appeal.created_at desc,appeal.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function api.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11(p_limit,p_offset,p_include_resolved) $$;
create or replace function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex'); if p_payload_hash<>v_expected then raise exception 'invalid report payload' using errcode='22023'; end if;
 select report.id,report.payload_hash into v_id,v_payload from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and report.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 select report.id into v_id from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and (report.state in ('received','reviewing') or report.created_at>now()-interval '10 minutes') order by report.created_at desc,report.id desc limit 1 for update;
 if found then return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;
revoke all on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean) from public,anon,authenticated;
grant execute on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),private.submit_community_report_v11(uuid,text,text,text,text,text),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean),api.list_operator_community_appeals_v11(integer,integer,boolean) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017168000', array[$eskomi_packet_04_4$-- Operator queues must not rely on PostgREST's global max_rows.  Pending work
-- is always a bounded, newest-first page; resolved history is opt-in.
drop function if exists private.list_operator_community_posts_v11();
drop function if exists private.list_operator_community_reports_v11();
drop function if exists private.list_operator_community_appeals_v11();
drop function if exists api.list_operator_community_posts_v11();
drop function if exists api.list_operator_community_reports_v11();
drop function if exists api.list_operator_community_appeals_v11();

create function private.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security definer set search_path=private,app,pg_temp as $$
 select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc) from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
 from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or post.moderation_state='pending'
 order by case when post.moderation_state='pending' then 0 else 1 end,post.created_at desc,post.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select report.id,post.id,coalesce(shop.name,area.name),post.body,report.reason_code,report.detail,report.state,report.revision,report.created_at
 from private.community_post_reports_v11 report join private.community_posts_v11 post on post.id=report.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or report.state in ('received','reviewing')
 order by case when report.state in ('received','reviewing') then 0 else 1 end,report.created_at desc,report.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function private.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select appeal.id,post.id,coalesce(shop.name,area.name),post.body,appeal.reason,appeal.state,appeal.revision,appeal.created_at
 from private.community_post_appeals_v11 appeal join private.community_posts_v11 post on post.id=appeal.post_id left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
 where p_include_resolved or appeal.state in ('received','reviewing')
 order by case when appeal.state in ('received','reviewing') then 0 else 1 end,appeal.created_at desc,appeal.id desc
 limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;
create function api.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_reports_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(report_id uuid,post_id uuid,target_name text,body text,reason_code text,detail text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_reports_v11(p_limit,p_offset,p_include_resolved) $$;
create function api.list_operator_community_appeals_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false) returns table(appeal_id uuid,post_id uuid,target_name text,body text,reason text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_appeals_v11(p_limit,p_offset,p_include_resolved) $$;
create or replace function private.submit_community_report_v11(p_post_id uuid,p_reason_code text,p_detail text,p_scope_hash text,p_idempotency_hash text,p_payload_hash text)
returns table(report_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid; v_payload text; v_expected text;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid report credential' using errcode='22023'; end if;
 if p_reason_code not in ('personal_data','threat','discrimination','unfounded_serious_claim','explicit','illegal_solicitation','spam','other') or char_length(btrim(coalesce(p_detail,'')))>400 then raise exception 'invalid report' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_post_id::text||chr(31)||p_reason_code||chr(31)||btrim(coalesce(p_detail,'')),'sha256'),'hex'); if p_payload_hash<>v_expected then raise exception 'invalid report payload' using errcode='22023'; end if;
 select report.id,report.payload_hash into v_id,v_payload from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and report.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'report replay payload changed' using errcode='22023'; end if; return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 if not exists(select 1 from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' and private.community_target_is_public_v11(post.scope_kind,post.shop_id,post.area_id)) then raise exception 'post is unavailable' using errcode='P0002'; end if;
 select report.id into v_id from private.community_post_reports_v11 report where report.post_id=p_post_id and report.reporter_scope_hash=p_scope_hash and (report.state in ('received','reviewing') or report.created_at>now()-interval '10 minutes') order by report.created_at desc,report.id desc limit 1 for update;
 if found then return query select report.id,report.revision,report.state,true from private.community_post_reports_v11 report where report.id=v_id; return; end if;
 insert into private.community_post_reports_v11(post_id,reporter_scope_hash,idempotency_hash,payload_hash,reason_code,detail) values(p_post_id,p_scope_hash,p_idempotency_hash,p_payload_hash,p_reason_code,btrim(coalesce(p_detail,''))) returning id into v_id;
 return query select report.id,report.revision,report.state,false from private.community_post_reports_v11 report where report.id=v_id;
end $$;
revoke all on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean) from public,anon,authenticated;
grant execute on function private.list_operator_community_posts_v11(integer,integer,boolean),private.list_operator_community_reports_v11(integer,integer,boolean),private.list_operator_community_appeals_v11(integer,integer,boolean),private.submit_community_report_v11(uuid,text,text,text,text,text),api.list_operator_community_posts_v11(integer,integer,boolean),api.list_operator_community_reports_v11(integer,integer,boolean),api.list_operator_community_appeals_v11(integer,integer,boolean) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_4$], 'eskomi_community_queue_pagination', null, null, null);

-- SOURCE 20261017169000_eskomi_community_appeal_replay_order.sql
-- SHA-256 120a9418f1f368a73a0be27911829cb1f31ee66ab61acae8c6e6d18a38e56e2e
-- A lost browser response must replay the original receipt-bound result even
-- when an operator has already moved the underlying post to a new state.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 select post.id into v_post from private.community_posts_v11 post where post.receipt_hash=p_receipt_hash and post.moderation_state='rejected' and ((post.publication_state='draft' and post.withdrawn_at is null) or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden'))) for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;
revoke all on function private.submit_community_appeal_v11(text,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_community_appeal_v11(text,text,text,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017169000', array[$eskomi_packet_04_5$-- A lost browser response must replay the original receipt-bound result even
-- when an operator has already moved the underlying post to a new state.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
 v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex'); if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
 select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
 if found then if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if; return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return; end if;
 select post.id into v_post from private.community_posts_v11 post where post.receipt_hash=p_receipt_hash and post.moderation_state='rejected' and ((post.publication_state='draft' and post.withdrawn_at is null) or (post.publication_state='withdrawn' and exists(select 1 from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id and event.action='hidden'))) for key share;
 if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
 insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason) values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason)) returning id into v_id;
 return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;
revoke all on function private.submit_community_appeal_v11(text,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_community_appeal_v11(text,text,text,text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_5$], 'eskomi_community_appeal_replay_order', null, null, null);

-- SOURCE 20261017170000_eskomi_public_therapist_profiles.sql
-- SHA-256 19bdf7d95b560ddc310e9de8c7c445d607f941afb092f6e21143382e13f5c77e
-- Public therapist identities are assignments, never a display-name lookup.
create function private.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,asset.id,publication.public_handle,assessment.rating,revision.experience_comment,publication.published_at
 from app.therapist_assignments assignment
 join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
 join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
 join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
 join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
 left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
 left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='therapist' and assessment.therapist_assignment_id=assignment.id
 where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
 order by publication.published_at desc nulls last,publication.id desc nulls last limit greatest(1,least(p_limit,20))
$$;
create function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text) language sql security definer set search_path=private,app,pg_temp as $$
 select asset.object_key,asset.content_type from app.therapist_assignments assignment join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published' join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published' join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
$$;
create function api.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20) returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_profile_v11(p_assignment_id,p_limit) $$;
create function api.get_public_therapist_photo_v11(p_assignment_id uuid) returns table(object_key text,content_type text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_photo_v11(p_assignment_id) $$;
revoke all on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) from public,anon,authenticated;
grant execute on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017170000', array[$eskomi_packet_04_6$-- Public therapist identities are assignments, never a display-name lookup.
create function private.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$
 select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,asset.id,publication.public_handle,assessment.rating,revision.experience_comment,publication.published_at
 from app.therapist_assignments assignment
 join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
 join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
 join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
 join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
 left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
 left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='therapist' and assessment.therapist_assignment_id=assignment.id
 where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
 order by publication.published_at desc nulls last,publication.id desc nulls last limit greatest(1,least(p_limit,20))
$$;
create function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text) language sql security definer set search_path=private,app,pg_temp as $$
 select asset.object_key,asset.content_type from app.therapist_assignments assignment join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published' join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published' join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
$$;
create function api.get_public_therapist_profile_v11(p_assignment_id uuid,p_limit integer default 20) returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_profile_v11(p_assignment_id,p_limit) $$;
create function api.get_public_therapist_photo_v11(p_assignment_id uuid) returns table(object_key text,content_type text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_therapist_photo_v11(p_assignment_id) $$;
revoke all on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) from public,anon,authenticated;
grant execute on function api.get_public_therapist_profile_v11(uuid,integer),api.get_public_therapist_photo_v11(uuid),private.get_public_therapist_profile_v11(uuid,integer),private.get_public_therapist_photo_v11(uuid) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_6$], 'eskomi_public_therapist_profiles', null, null, null);

-- SOURCE 20261017171000_eskomi_public_profiles_access_and_community_guards.sql
-- SHA-256 01e924aa1853aa57201916d6d7da738c489f84ab713c2684299e1d07a4533992
-- Public therapist delivery, aggregate-only partner access reporting, and
-- state-bound community appeals.  All additions are service-role transport;
-- browser roles retain no direct access to private rows.

alter table private.community_post_appeals_v11
  add column if not exists target_post_revision integer,
  add column if not exists target_event_id bigint,
  add column if not exists target_reason text;

create table private.partner_shop_access_daily_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  shop_view_count bigint not null default 0 check (shop_view_count >= 0),
  official_line_click_count bigint not null default 0 check (official_line_click_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, observed_on)
);
create table private.partner_shop_access_rollup_state_v11 (
  shop_id uuid primary key references app.shops(id) on delete restrict,
  first_observed_on date not null,
  updated_at timestamptz not null default now()
);
alter table private.partner_shop_access_daily_v11 enable row level security;
alter table private.partner_shop_access_rollup_state_v11 enable row level security;
revoke all on table private.partner_shop_access_daily_v11, private.partner_shop_access_rollup_state_v11 from public, anon, authenticated;
grant select, insert, update on table private.partner_shop_access_daily_v11, private.partner_shop_access_rollup_state_v11 to service_role;

create or replace function private.list_public_therapists_for_shop_v11(p_shop_slug text, p_limit integer default 20)
returns table(assignment_id uuid, display_name text, photo_asset_id uuid)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id, assignment.display_name, asset.id
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.slug=p_shop_slug and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by assignment.active_from desc, assignment.id desc
  limit greatest(1, least(p_limit, 50))
$$;

-- An active assignment is the public identity.  Reviews are joined through
-- that UUID only; names are never used for a cross-person match.
create function private.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,publication_shop.line_url,asset.id,
    publication.public_handle,assessment.rating,revision.experience_comment,publication.published_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  left join private.managed_shop_publications publication_shop on publication_shop.managed_shop_id=managed.id
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
  left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='therapist' and assessment.therapist_assignment_id=assignment.id
  where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by publication.published_at desc nulls last,publication.id desc nulls last
  limit greatest(1,least(p_limit,20))
$$;

create or replace function api.list_public_therapists_for_shop_v11(p_shop_slug text,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.list_public_therapists_for_shop_v11(p_shop_slug,p_limit)
$$;
create function private.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.updated_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by assignment.id
$$;
create function api.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_public_therapist_sitemap_v11() $$;
create function api.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_public_therapist_profile_detail_v11(p_assignment_id,p_limit)
$$;

create or replace function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on,shop_view_count,official_line_click_count)
    values(v_shop_id,v_day,case when p_event_kind='shop_view' then 1 else 0 end,case when p_event_kind='official_line_click' then 1 else 0 end)
  on conflict(shop_id,observed_on) do update set
    shop_view_count=private.partner_shop_access_daily_v11.shop_view_count + excluded.shop_view_count,
    official_line_click_count=private.partner_shop_access_daily_v11.official_line_click_count + excluded.official_line_click_count,
    updated_at=now();
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on)
    values(v_shop_id,v_day)
  on conflict(shop_id) do update set updated_at=now();
end $$;

create or replace function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_first date; v_updated timestamptz;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>91 then raise exception 'invalid report range' using errcode='22023'; end if;
  perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id);
  select workspace.app_shop_id into v_shop_id from private.partner_workspaces workspace
    join app.shops shop on shop.id=workspace.app_shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    where workspace.id=p_workspace_id;
  if v_shop_id is null then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  select state.first_observed_on,state.updated_at into v_first,v_updated from private.partner_shop_access_rollup_state_v11 state where state.shop_id=v_shop_id;
  return query
    select days.observed_on,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      v_first is not null and days.observed_on>=v_first,
      case when daily.updated_at is null then v_updated else greatest(daily.updated_at,coalesce(v_updated,daily.updated_at)) end
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;

create or replace function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind)
$$;
create or replace function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to)
$$;

-- Pending operational work is only a pending draft.  A visitor-withdrawn row
-- belongs to history and can never occupy the first page of operator work.
create or replace function private.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb)
language sql security definer set search_path=private,app,pg_temp as $$
  select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc,event.id desc)
      from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
  from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
  where case when p_include_resolved then not (post.moderation_state='pending' and post.publication_state='draft')
        else post.moderation_state='pending' and post.publication_state='draft' end
  order by post.created_at desc,post.id desc
  limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;

-- Existing replays return before state checks.  New appeals bind to the most
-- recent operator hide event and exact post revision; stale reviews cannot
-- erase a later visitor withdrawal or another moderation decision.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text; v_event bigint; v_revision integer; v_reason text;
begin
  if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
  v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex');
  if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
  select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
  if found then
    if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if;
    return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return;
  end if;
  select id into v_post from private.community_posts_v11 where receipt_hash=p_receipt_hash for key share;
  if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_post::text,0));
  select post.id,event.id,event.revision,event.reason into v_post,v_event,v_revision,v_reason
  from private.community_posts_v11 post
  join lateral (select event_row.id,event_row.revision,event_row.reason,event_row.action from private.community_moderation_events_v11 event_row
    where event_row.entity_kind='community_post' and event_row.entity_id=post.id order by event_row.created_at desc,event_row.id desc limit 1) event on true
  where post.id=v_post and post.moderation_state='rejected'
    and ((post.publication_state='draft' and post.withdrawn_at is null and event.action='rejected')
      or (post.publication_state='withdrawn' and event.action='hidden'))
    and event.revision=post.revision
  for update of post;
  if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
  if exists(select 1 from private.community_post_appeals_v11 appeal where appeal.post_id=v_post and appeal.state in ('received','reviewing')) then
    raise exception 'an appeal is already active' using errcode='23505';
  end if;
  insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason,target_post_revision,target_event_id,target_reason)
    values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason),v_revision,v_event,v_reason) returning id into v_id;
  return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
  select * into v_appeal from private.community_post_appeals_v11
    where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
  if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
  if p_decision='reopen_review' then
    update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',published_at=null,withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
      where post.id=v_appeal.post_id and post.revision=v_appeal.target_post_revision and post.moderation_state='rejected'
        and ((post.publication_state='draft' and post.withdrawn_at is null)
          or post.publication_state='withdrawn')
        and exists(select 1 from private.community_moderation_events_v11 event where event.id=v_appeal.target_event_id and event.entity_kind='community_post'
          and event.entity_id=post.id and event.action in ('hidden','rejected') and event.revision=post.revision and event.reason=v_appeal.target_reason)
      returning revision into v_post_revision;
    if not found then raise exception 'appeal target is stale' using errcode='40001'; end if;
  end if;
  update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,
    operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id;
  insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
    values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,v_appeal.target_post_revision));
  return p_decision;
end $$;

create or replace function api.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11(p_limit,p_offset,p_include_resolved) $$;
create or replace function api.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_appeal_v11(p_receipt_hash,p_reason,p_idempotency_hash,p_payload_hash) $$;
create or replace function api.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_appeal_v11(p_appeal_id,p_decision,p_reason,p_expected_revision) $$;

revoke all on function private.list_public_therapists_for_shop_v11(text,integer),private.list_public_therapist_sitemap_v11(),private.get_public_therapist_profile_detail_v11(uuid,integer),private.record_public_shop_access_v11(text,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.list_operator_community_posts_v11(integer,integer,boolean),private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer),api.list_public_therapists_for_shop_v11(text,integer),api.list_public_therapist_sitemap_v11(),api.get_public_therapist_profile_detail_v11(uuid,integer),api.record_public_shop_access_v11(text,text),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.list_operator_community_posts_v11(integer,integer,boolean),api.submit_community_appeal_v11(text,text,text,text),api.review_community_appeal_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.list_public_therapists_for_shop_v11(text,integer),private.list_public_therapist_sitemap_v11(),private.get_public_therapist_profile_detail_v11(uuid,integer),private.record_public_shop_access_v11(text,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.list_operator_community_posts_v11(integer,integer,boolean),private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer),api.list_public_therapists_for_shop_v11(text,integer),api.list_public_therapist_sitemap_v11(),api.get_public_therapist_profile_detail_v11(uuid,integer),api.record_public_shop_access_v11(text,text),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.list_operator_community_posts_v11(integer,integer,boolean),api.submit_community_appeal_v11(text,text,text,text),api.review_community_appeal_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017171000', array[$eskomi_packet_04_7$-- Public therapist delivery, aggregate-only partner access reporting, and
-- state-bound community appeals.  All additions are service-role transport;
-- browser roles retain no direct access to private rows.

alter table private.community_post_appeals_v11
  add column if not exists target_post_revision integer,
  add column if not exists target_event_id bigint,
  add column if not exists target_reason text;

create table private.partner_shop_access_daily_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  shop_view_count bigint not null default 0 check (shop_view_count >= 0),
  official_line_click_count bigint not null default 0 check (official_line_click_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, observed_on)
);
create table private.partner_shop_access_rollup_state_v11 (
  shop_id uuid primary key references app.shops(id) on delete restrict,
  first_observed_on date not null,
  updated_at timestamptz not null default now()
);
alter table private.partner_shop_access_daily_v11 enable row level security;
alter table private.partner_shop_access_rollup_state_v11 enable row level security;
revoke all on table private.partner_shop_access_daily_v11, private.partner_shop_access_rollup_state_v11 from public, anon, authenticated;
grant select, insert, update on table private.partner_shop_access_daily_v11, private.partner_shop_access_rollup_state_v11 to service_role;

create or replace function private.list_public_therapists_for_shop_v11(p_shop_slug text, p_limit integer default 20)
returns table(assignment_id uuid, display_name text, photo_asset_id uuid)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id, assignment.display_name, asset.id
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.slug=p_shop_slug and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by assignment.active_from desc, assignment.id desc
  limit greatest(1, least(p_limit, 50))
$$;

-- An active assignment is the public identity.  Reviews are joined through
-- that UUID only; names are never used for a cross-person match.
create function private.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,publication_shop.line_url,asset.id,
    publication.public_handle,assessment.rating,revision.experience_comment,publication.published_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  left join private.managed_shop_publications publication_shop on publication_shop.managed_shop_id=managed.id
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
  left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='therapist' and assessment.therapist_assignment_id=assignment.id
  where assignment.id=p_assignment_id and assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by publication.published_at desc nulls last,publication.id desc nulls last
  limit greatest(1,least(p_limit,20))
$$;

create or replace function api.list_public_therapists_for_shop_v11(p_shop_slug text,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.list_public_therapists_for_shop_v11(p_shop_slug,p_limit)
$$;
create function private.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.updated_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.lifecycle_state='active' and assignment.photo_rights_confirmed_at is not null
    and (assignment.active_until is null or assignment.active_until > now())
  order by assignment.id
$$;
create function api.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_public_therapist_sitemap_v11() $$;
create function api.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_public_therapist_profile_detail_v11(p_assignment_id,p_limit)
$$;

create or replace function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on,shop_view_count,official_line_click_count)
    values(v_shop_id,v_day,case when p_event_kind='shop_view' then 1 else 0 end,case when p_event_kind='official_line_click' then 1 else 0 end)
  on conflict(shop_id,observed_on) do update set
    shop_view_count=private.partner_shop_access_daily_v11.shop_view_count + excluded.shop_view_count,
    official_line_click_count=private.partner_shop_access_daily_v11.official_line_click_count + excluded.official_line_click_count,
    updated_at=now();
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on)
    values(v_shop_id,v_day)
  on conflict(shop_id) do update set updated_at=now();
end $$;

create or replace function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_first date; v_updated timestamptz;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>91 then raise exception 'invalid report range' using errcode='22023'; end if;
  perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id);
  select workspace.app_shop_id into v_shop_id from private.partner_workspaces workspace
    join app.shops shop on shop.id=workspace.app_shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    where workspace.id=p_workspace_id;
  if v_shop_id is null then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  select state.first_observed_on,state.updated_at into v_first,v_updated from private.partner_shop_access_rollup_state_v11 state where state.shop_id=v_shop_id;
  return query
    select days.observed_on,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      v_first is not null and days.observed_on>=v_first,
      case when daily.updated_at is null then v_updated else greatest(daily.updated_at,coalesce(v_updated,daily.updated_at)) end
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;

create or replace function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind)
$$;
create or replace function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$
  select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to)
$$;

-- Pending operational work is only a pending draft.  A visitor-withdrawn row
-- belongs to history and can never occupy the first page of operator work.
create or replace function private.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb)
language sql security definer set search_path=private,app,pg_temp as $$
  select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.publication_state,post.revision,post.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'reason',event.reason,'actor',event.operator_actor,'revision',event.revision,'at',event.created_at) order by event.created_at desc,event.id desc)
      from private.community_moderation_events_v11 event where event.entity_kind='community_post' and event.entity_id=post.id),'[]'::jsonb)
  from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id
  where case when p_include_resolved then not (post.moderation_state='pending' and post.publication_state='draft')
        else post.moderation_state='pending' and post.publication_state='draft' end
  order by post.created_at desc,post.id desc
  limit greatest(1,least(p_limit,100)) offset greatest(p_offset,0)
$$;

-- Existing replays return before state checks.  New appeals bind to the most
-- recent operator hide event and exact post revision; stale reviews cannot
-- erase a later visitor withdrawal or another moderation decision.
create or replace function private.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_id uuid; v_post uuid; v_payload text; v_expected text; v_event bigint; v_revision integer; v_reason text;
begin
  if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
  v_expected:=encode(extensions.digest(p_receipt_hash||chr(31)||btrim(p_reason),'sha256'),'hex');
  if v_expected<>p_payload_hash then raise exception 'invalid appeal payload' using errcode='22023'; end if;
  select appeal.id,appeal.payload_hash into v_id,v_payload from private.community_post_appeals_v11 appeal where appeal.receipt_hash=p_receipt_hash and appeal.idempotency_hash=p_idempotency_hash for update;
  if found then
    if v_payload<>p_payload_hash then raise exception 'appeal replay payload changed' using errcode='22023'; end if;
    return query select appeal.id,appeal.revision,appeal.state,true from private.community_post_appeals_v11 appeal where appeal.id=v_id; return;
  end if;
  select id into v_post from private.community_posts_v11 where receipt_hash=p_receipt_hash for key share;
  if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_post::text,0));
  select post.id,event.id,event.revision,event.reason into v_post,v_event,v_revision,v_reason
  from private.community_posts_v11 post
  join lateral (select event_row.id,event_row.revision,event_row.reason,event_row.action from private.community_moderation_events_v11 event_row
    where event_row.entity_kind='community_post' and event_row.entity_id=post.id order by event_row.created_at desc,event_row.id desc limit 1) event on true
  where post.id=v_post and post.moderation_state='rejected'
    and ((post.publication_state='draft' and post.withdrawn_at is null and event.action='rejected')
      or (post.publication_state='withdrawn' and event.action='hidden'))
    and event.revision=post.revision
  for update of post;
  if not found then raise exception 'appeal is unavailable' using errcode='P0002'; end if;
  if exists(select 1 from private.community_post_appeals_v11 appeal where appeal.post_id=v_post and appeal.state in ('received','reviewing')) then
    raise exception 'an appeal is already active' using errcode='23505';
  end if;
  insert into private.community_post_appeals_v11(post_id,receipt_hash,idempotency_hash,payload_hash,reason,target_post_revision,target_event_id,target_reason)
    values(v_post,p_receipt_hash,p_idempotency_hash,p_payload_hash,btrim(p_reason),v_revision,v_event,v_reason) returning id into v_id;
  return query select appeal.id,appeal.revision,appeal.state,false from private.community_post_appeals_v11 appeal where appeal.id=v_id;
end $$;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer;
begin
  select * into v_appeal from private.community_post_appeals_v11
    where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
  if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
  if p_decision='reopen_review' then
    update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',published_at=null,withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
      where post.id=v_appeal.post_id and post.revision=v_appeal.target_post_revision and post.moderation_state='rejected'
        and ((post.publication_state='draft' and post.withdrawn_at is null)
          or post.publication_state='withdrawn')
        and exists(select 1 from private.community_moderation_events_v11 event where event.id=v_appeal.target_event_id and event.entity_kind='community_post'
          and event.entity_id=post.id and event.action in ('hidden','rejected') and event.revision=post.revision and event.reason=v_appeal.target_reason)
      returning revision into v_post_revision;
    if not found then raise exception 'appeal target is stale' using errcode='40001'; end if;
  end if;
  update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,
    operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id;
  insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
    values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,v_appeal.target_post_revision));
  return p_decision;
end $$;

create or replace function api.list_operator_community_posts_v11(p_limit integer default 50,p_offset integer default 0,p_include_resolved boolean default false)
returns table(post_id uuid,scope_kind text,target_name text,body text,state text,publication_state text,revision integer,created_at timestamptz,history jsonb)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11(p_limit,p_offset,p_include_resolved) $$;
create or replace function api.submit_community_appeal_v11(p_receipt_hash text,p_reason text,p_idempotency_hash text,p_payload_hash text)
returns table(appeal_id uuid,revision integer,state text,replayed boolean)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_appeal_v11(p_receipt_hash,p_reason,p_idempotency_hash,p_payload_hash) $$;
create or replace function api.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.review_community_appeal_v11(p_appeal_id,p_decision,p_reason,p_expected_revision) $$;

revoke all on function private.list_public_therapists_for_shop_v11(text,integer),private.list_public_therapist_sitemap_v11(),private.get_public_therapist_profile_detail_v11(uuid,integer),private.record_public_shop_access_v11(text,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.list_operator_community_posts_v11(integer,integer,boolean),private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer),api.list_public_therapists_for_shop_v11(text,integer),api.list_public_therapist_sitemap_v11(),api.get_public_therapist_profile_detail_v11(uuid,integer),api.record_public_shop_access_v11(text,text),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.list_operator_community_posts_v11(integer,integer,boolean),api.submit_community_appeal_v11(text,text,text,text),api.review_community_appeal_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function private.list_public_therapists_for_shop_v11(text,integer),private.list_public_therapist_sitemap_v11(),private.get_public_therapist_profile_detail_v11(uuid,integer),private.record_public_shop_access_v11(text,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.list_operator_community_posts_v11(integer,integer,boolean),private.submit_community_appeal_v11(text,text,text,text),private.review_community_appeal_v11(uuid,text,text,integer),api.list_public_therapists_for_shop_v11(text,integer),api.list_public_therapist_sitemap_v11(),api.get_public_therapist_profile_detail_v11(uuid,integer),api.record_public_shop_access_v11(text,text),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.list_operator_community_posts_v11(integer,integer,boolean),api.submit_community_appeal_v11(text,text,text,text),api.review_community_appeal_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_04_7$], 'eskomi_public_profiles_access_and_community_guards', null, null, null);
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'stage', '04',
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ('20261017165000', 'eskomi_community_reports_and_appeals', '060ac944cac3246ea1c4dfa4d03feb3fd603718ccea0a29e1559179d28e876d2'), ('20261017166000', 'eskomi_managed_reader_canonical_identity', '4ff2e3b87624aa8b77acb34b31cee1527e52efcab9a0b468693486a84691cfcd'), ('20261017167000', 'eskomi_community_hidden_post_appeals', 'cc9896b20507c52486e1244b6e64cae19af0d5d50b50074d878d37fc0e3df3a0'), ('20261017168000', 'eskomi_community_queue_pagination', '5026644776d69f4818980e013505e0da1267674d026187c94bde5df23e508650'), ('20261017169000', 'eskomi_community_appeal_replay_order', '120a9418f1f368a73a0be27911829cb1f31ee66ab61acae8c6e6d18a38e56e2e'), ('20261017170000', 'eskomi_public_therapist_profiles', '19bdf7d95b560ddc310e9de8c7c445d607f941afb092f6e21143382e13f5c77e'), ('20261017171000', 'eskomi_public_profiles_access_and_community_guards', '01e924aa1853aa57201916d6d7da738c489f84ab713c2684299e1d07a4533992')) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
