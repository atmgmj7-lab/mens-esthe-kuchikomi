-- Eskomi v1.1 manual SQL Editor packet: stage 01 of 05
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
      ('20261017143000', 'eskomi_v11_acceptance_hardening', '33ccc0d8da8f3fdbdea1ce68036c632cad3328a33c47b389b18f19d3d65c5b54')
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
    where version in ('20261017144000', '20261017145000', '20261017146000', '20261017147000', '20261017148000', '20261017149000', '20261017150000')
  ) then
    raise exception 'stage 01 is already partly or wholly recorded; stop and use 00-checkpoint.sql';
  end if;
end;
$eskomi_preflight$;

-- SOURCE 20261017144000_eskomi_partner_therapist_history_and_membership.sql
-- SHA-256 f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f
-- Preserve each consent assertion and bind every browser-originated mutation
-- to an active membership row locked in the same DB transaction.
create table private.therapist_assignment_rights_history (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references app.therapist_assignments(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  permission_policy_version text not null,
  permission_confirmed_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
insert into private.therapist_assignment_rights_history(assignment_id,workspace_id,permission_policy_version,permission_confirmed_at)
select assignment_id,workspace_id,permission_policy_version,permission_confirmed_at from private.therapist_assignment_rights
on conflict do nothing;
alter table private.therapist_assignment_rights_history enable row level security;
revoke all on table private.therapist_assignment_rights_history from public,anon,authenticated;
grant select,insert on table private.therapist_assignment_rights_history to service_role;
create or replace function private.audit_therapist_assignment_rights() returns trigger language plpgsql security definer set search_path=private,pg_temp as $$
begin insert into private.therapist_assignment_rights_history(assignment_id,workspace_id,permission_policy_version,permission_confirmed_at) values(new.assignment_id,new.workspace_id,new.permission_policy_version,new.permission_confirmed_at); return new; end $$;
drop trigger if exists therapist_assignment_rights_history_audit on private.therapist_assignment_rights;
create trigger therapist_assignment_rights_history_audit after insert or update of permission_policy_version,permission_confirmed_at on private.therapist_assignment_rights for each row execute function private.audit_therapist_assignment_rights();

alter table private.review_experiences add column if not exists subject_snapshot jsonb not null default '{}'::jsonb;
alter table app.review_experience_publications add column if not exists therapist_display_name_snapshot text;
update private.review_experiences experience set subject_snapshot=jsonb_build_object(
  'shopName',(select shop.name from app.shops shop where shop.id=experience.shop_id),
  'therapistDisplayName',(select assignment.display_name from private.review_assessments assessment join app.therapist_assignments assignment on assignment.id=assessment.therapist_assignment_id where assessment.experience_id=experience.id and assessment.target_kind='therapist' limit 1)
) where experience.subject_snapshot='{}'::jsonb;
update app.review_experience_publications publication set therapist_display_name_snapshot=experience.subject_snapshot->>'therapistDisplayName'
from private.review_experiences experience where experience.id=publication.experience_id and publication.therapist_display_name_snapshot is null;
create or replace function private.capture_review_subject_snapshot() returns trigger language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_name text; v_therapist_name text;
begin
  select shop.name,assignment.display_name into v_shop_name,v_therapist_name from app.shops shop left join app.therapist_assignments assignment on assignment.id=new.therapist_assignment_id where shop.id=new.shop_id;
  update private.review_experiences set subject_snapshot=jsonb_build_object('shopName',v_shop_name,'therapistDisplayName',v_therapist_name) where id=new.experience_id and (subject_snapshot='{}'::jsonb or new.target_kind='therapist');
  return new;
end $$;
drop trigger if exists review_subject_snapshot_capture on private.review_assessments;
create trigger review_subject_snapshot_capture after insert on private.review_assessments for each row execute function private.capture_review_subject_snapshot();
create or replace function private.capture_publication_subject_snapshot() returns trigger language plpgsql security definer set search_path=private,pg_temp as $$
begin select experience.subject_snapshot->>'therapistDisplayName' into new.therapist_display_name_snapshot from private.review_experiences experience where experience.id=new.experience_id; return new; end $$;
drop trigger if exists review_publication_subject_snapshot_capture on app.review_experience_publications;
create trigger review_publication_subject_snapshot_capture before insert or update of active_revision_id on app.review_experience_publications for each row execute function private.capture_publication_subject_snapshot();
create or replace function api.list_public_review_experience_publications(p_shop_slug text,p_limit integer default 20,p_offset integer default 0)
returns table(public_handle uuid,rating smallint,body text,display_name text,therapist_display_name text,published_at timestamptz)
language sql security invoker set search_path=private,app,pg_temp as $$
 select publication.public_handle,assessment.rating,revision.experience_comment,revision.nickname,publication.therapist_display_name_snapshot,publication.published_at
 from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='shop'
 join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published' left join private.managed_shops managed on managed.app_shop_id=shop.id
 where shop.slug=p_shop_slug and publication.publication_state='published' and (managed.id is null or managed.publication_state='published')
 order by publication.published_at desc,publication.id desc limit greatest(1,least(p_limit,20)) offset greatest(p_offset,0)
$$;

create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active'
    and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null for key share of membership;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;

create or replace function api.create_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.create_partner_therapist_assignment(p_workspace_id,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.update_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_assignment_id uuid,p_expected_revision integer,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.update_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.end_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_assignment_id uuid,p_expected_revision integer)
returns table(assignment_id uuid,lifecycle_state text,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.end_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision); end $$;
create or replace function api.create_partner_review_entry_link(p_workspace_id uuid,p_auth_user_id uuid,p_therapist_assignment_id uuid,p_channel text)
returns table(public_handle uuid,therapist_display_name text) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.create_partner_review_entry_link(p_workspace_id,p_therapist_assignment_id,p_channel); end $$;
create or replace function api.preview_partner_review_request(p_workspace_id uuid,p_auth_user_id uuid,p_therapist_assignment_id uuid,p_channel text,p_greeting_variant text)
returns table(subject text,body text,review_url text,therapist_display_name text) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.preview_partner_review_request(p_workspace_id,p_therapist_assignment_id,p_channel,p_greeting_variant); end $$;
revoke all on function private.assert_partner_therapist_membership(uuid,uuid),api.create_partner_therapist_assignment(uuid,uuid,text,uuid,text,boolean),api.update_partner_therapist_assignment(uuid,uuid,uuid,integer,text,uuid,text,boolean),api.end_partner_therapist_assignment(uuid,uuid,uuid,integer),api.create_partner_review_entry_link(uuid,uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.assert_partner_therapist_membership(uuid,uuid),api.create_partner_therapist_assignment(uuid,uuid,text,uuid,text,boolean),api.update_partner_therapist_assignment(uuid,uuid,uuid,integer,text,uuid,text,boolean),api.end_partner_therapist_assignment(uuid,uuid,uuid,integer),api.create_partner_review_entry_link(uuid,uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017144000', array[$eskomi_packet_01_1$-- Preserve each consent assertion and bind every browser-originated mutation
-- to an active membership row locked in the same DB transaction.
create table private.therapist_assignment_rights_history (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references app.therapist_assignments(id) on delete restrict,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  permission_policy_version text not null,
  permission_confirmed_at timestamptz not null,
  recorded_at timestamptz not null default now()
);
insert into private.therapist_assignment_rights_history(assignment_id,workspace_id,permission_policy_version,permission_confirmed_at)
select assignment_id,workspace_id,permission_policy_version,permission_confirmed_at from private.therapist_assignment_rights
on conflict do nothing;
alter table private.therapist_assignment_rights_history enable row level security;
revoke all on table private.therapist_assignment_rights_history from public,anon,authenticated;
grant select,insert on table private.therapist_assignment_rights_history to service_role;
create or replace function private.audit_therapist_assignment_rights() returns trigger language plpgsql security definer set search_path=private,pg_temp as $$
begin insert into private.therapist_assignment_rights_history(assignment_id,workspace_id,permission_policy_version,permission_confirmed_at) values(new.assignment_id,new.workspace_id,new.permission_policy_version,new.permission_confirmed_at); return new; end $$;
drop trigger if exists therapist_assignment_rights_history_audit on private.therapist_assignment_rights;
create trigger therapist_assignment_rights_history_audit after insert or update of permission_policy_version,permission_confirmed_at on private.therapist_assignment_rights for each row execute function private.audit_therapist_assignment_rights();

alter table private.review_experiences add column if not exists subject_snapshot jsonb not null default '{}'::jsonb;
alter table app.review_experience_publications add column if not exists therapist_display_name_snapshot text;
update private.review_experiences experience set subject_snapshot=jsonb_build_object(
  'shopName',(select shop.name from app.shops shop where shop.id=experience.shop_id),
  'therapistDisplayName',(select assignment.display_name from private.review_assessments assessment join app.therapist_assignments assignment on assignment.id=assessment.therapist_assignment_id where assessment.experience_id=experience.id and assessment.target_kind='therapist' limit 1)
) where experience.subject_snapshot='{}'::jsonb;
update app.review_experience_publications publication set therapist_display_name_snapshot=experience.subject_snapshot->>'therapistDisplayName'
from private.review_experiences experience where experience.id=publication.experience_id and publication.therapist_display_name_snapshot is null;
create or replace function private.capture_review_subject_snapshot() returns trigger language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_name text; v_therapist_name text;
begin
  select shop.name,assignment.display_name into v_shop_name,v_therapist_name from app.shops shop left join app.therapist_assignments assignment on assignment.id=new.therapist_assignment_id where shop.id=new.shop_id;
  update private.review_experiences set subject_snapshot=jsonb_build_object('shopName',v_shop_name,'therapistDisplayName',v_therapist_name) where id=new.experience_id and (subject_snapshot='{}'::jsonb or new.target_kind='therapist');
  return new;
end $$;
drop trigger if exists review_subject_snapshot_capture on private.review_assessments;
create trigger review_subject_snapshot_capture after insert on private.review_assessments for each row execute function private.capture_review_subject_snapshot();
create or replace function private.capture_publication_subject_snapshot() returns trigger language plpgsql security definer set search_path=private,pg_temp as $$
begin select experience.subject_snapshot->>'therapistDisplayName' into new.therapist_display_name_snapshot from private.review_experiences experience where experience.id=new.experience_id; return new; end $$;
drop trigger if exists review_publication_subject_snapshot_capture on app.review_experience_publications;
create trigger review_publication_subject_snapshot_capture before insert or update of active_revision_id on app.review_experience_publications for each row execute function private.capture_publication_subject_snapshot();
create or replace function api.list_public_review_experience_publications(p_shop_slug text,p_limit integer default 20,p_offset integer default 0)
returns table(public_handle uuid,rating smallint,body text,display_name text,therapist_display_name text,published_at timestamptz)
language sql security invoker set search_path=private,app,pg_temp as $$
 select publication.public_handle,assessment.rating,revision.experience_comment,revision.nickname,publication.therapist_display_name_snapshot,publication.published_at
 from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
 left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='shop'
 join app.shops shop on shop.id=publication.shop_id and shop.publication_status='published' left join private.managed_shops managed on managed.app_shop_id=shop.id
 where shop.slug=p_shop_slug and publication.publication_state='published' and (managed.id is null or managed.publication_state='published')
 order by publication.published_at desc,publication.id desc limit greatest(1,least(p_limit,20)) offset greatest(p_offset,0)
$$;

create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active'
    and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null for key share of membership;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;

create or replace function api.create_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.create_partner_therapist_assignment(p_workspace_id,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.update_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_assignment_id uuid,p_expected_revision integer,p_display_name text,p_photo_asset_id uuid,p_permission_policy_version text,p_permission_confirmed boolean)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.update_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision,p_display_name,p_photo_asset_id,p_permission_policy_version,p_permission_confirmed); end $$;
create or replace function api.end_partner_therapist_assignment(p_workspace_id uuid,p_auth_user_id uuid,p_assignment_id uuid,p_expected_revision integer)
returns table(assignment_id uuid,lifecycle_state text,revision integer) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.end_partner_therapist_assignment(p_workspace_id,p_assignment_id,p_expected_revision); end $$;
create or replace function api.create_partner_review_entry_link(p_workspace_id uuid,p_auth_user_id uuid,p_therapist_assignment_id uuid,p_channel text)
returns table(public_handle uuid,therapist_display_name text) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.create_partner_review_entry_link(p_workspace_id,p_therapist_assignment_id,p_channel); end $$;
create or replace function api.preview_partner_review_request(p_workspace_id uuid,p_auth_user_id uuid,p_therapist_assignment_id uuid,p_channel text,p_greeting_variant text)
returns table(subject text,body text,review_url text,therapist_display_name text) language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return query select * from private.preview_partner_review_request(p_workspace_id,p_therapist_assignment_id,p_channel,p_greeting_variant); end $$;
revoke all on function private.assert_partner_therapist_membership(uuid,uuid),api.create_partner_therapist_assignment(uuid,uuid,text,uuid,text,boolean),api.update_partner_therapist_assignment(uuid,uuid,uuid,integer,text,uuid,text,boolean),api.end_partner_therapist_assignment(uuid,uuid,uuid,integer),api.create_partner_review_entry_link(uuid,uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.assert_partner_therapist_membership(uuid,uuid),api.create_partner_therapist_assignment(uuid,uuid,text,uuid,text,boolean),api.update_partner_therapist_assignment(uuid,uuid,uuid,integer,text,uuid,text,boolean),api.end_partner_therapist_assignment(uuid,uuid,uuid,integer),api.create_partner_review_entry_link(uuid,uuid,uuid,text),api.preview_partner_review_request(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_1$], 'eskomi_partner_therapist_history_and_membership', null, null, null);

-- SOURCE 20261017145000_eskomi_partner_photo_membership_guard.sql
-- SHA-256 f41242ef3fe79188e4256e77ae5b9e01676cffe1411423bb399920ab6802f6de
create or replace function api.reserve_partner_therapist_photo_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.reserve_partner_therapist_photo_upload(p_workspace_id,p_content_type); end $$;
create or replace function api.attach_partner_therapist_photo(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.attach_partner_therapist_photo(p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height); end $$;
revoke all on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017145000', array[$eskomi_packet_01_2$create or replace function api.reserve_partner_therapist_photo_upload(p_workspace_id uuid,p_auth_user_id uuid,p_content_type text)
returns text language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.reserve_partner_therapist_photo_upload(p_workspace_id,p_content_type); end $$;
create or replace function api.attach_partner_therapist_photo(p_workspace_id uuid,p_auth_user_id uuid,p_object_key text,p_sha256 text,p_content_type text,p_byte_size integer,p_width integer,p_height integer)
returns uuid language plpgsql security invoker set search_path=private,api,pg_temp as $$ begin perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id); return private.attach_partner_therapist_photo(p_workspace_id,p_object_key,p_sha256,p_content_type,p_byte_size,p_width,p_height); end $$;
revoke all on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function api.reserve_partner_therapist_photo_upload(uuid,uuid,text),api.attach_partner_therapist_photo(uuid,uuid,text,text,text,integer,integer,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_2$], 'eskomi_partner_photo_membership_guard', null, null, null);

-- SOURCE 20261017146000_eskomi_moderation_and_membership_race_fix.sql
-- SHA-256 4b51333970488a1837e19d2923cd170c6307fe72d1bcb745e71e9e8f69734a0f
-- Close the pre-revision moderation callable surface and serialize a Partner
-- mutation with membership revocation (status is a non-key column, so KEY
-- SHARE was insufficient).
revoke execute on function private.moderate_review_experience_v11(uuid,text,text,text) from service_role;

create or replace function private.moderate_review_experience_v11(
  p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience private.review_experiences%rowtype; v_revision private.review_experience_revisions%rowtype;
begin
  if p_expected_revision is null or p_expected_revision<1 or p_decision not in ('approved','rejected','withdrawn') or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid moderation decision' using errcode='22023'; end if;
  select * into v_experience from private.review_experiences experience where experience.id=p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode='P0002'; end if;
  if p_expected_revision<>v_experience.moderation_revision then raise exception 'review moderation changed' using errcode='40001'; end if;
  if v_experience.state in ('withdrawn','rejected') then raise exception 'review state is terminal' using errcode='40001'; end if;
  if v_experience.state='approved' and p_decision<>'withdrawn' then return 'approved'; end if;
  select * into v_revision from private.review_experience_revisions revision where revision.experience_id=v_experience.id order by revision.revision desc limit 1 for update;
  update private.review_experiences set state=p_decision,reviewed_at=now(),withdrawn_at=case when p_decision='withdrawn' then now() else null end,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience.id;
  update private.review_experience_revisions set moderation_state=case when p_decision='approved' then 'approved' when p_decision='withdrawn' then 'withdrawn' else 'rejected' end,reviewed_at=now() where id=v_revision.id;
  if p_decision='approved' then insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,therapist_assignment_id,publication_state,published_at) values(v_experience.id,v_revision.id,v_experience.shop_id,(select therapist_assignment_id from private.review_assessments where experience_id=v_experience.id and target_kind='therapist'),'published',now()) on conflict(experience_id) do update set active_revision_id=excluded.active_revision_id,publication_state='published',published_at=now(),hidden_at=null,public_version=app.review_experience_publications.public_version+1,updated_at=now();
  elsif p_decision='withdrawn' then update app.review_experience_publications set publication_state='hidden',hidden_at=now(),public_version=public_version+1,updated_at=now() where experience_id=v_experience.id and publication_state<>'hidden'; end if;
  insert into private.review_moderation_decisions(experience_id,decision,actor_label,note) values(v_experience.id,p_decision,btrim(p_actor_label),nullif(btrim(coalesce(p_note,'')),''));
  insert into private.review_outbox(event_type,aggregate_id,payload) values(case when p_decision='approved' then 'review_approved' when p_decision='withdrawn' then 'review_withdrawn' else 'review_rejected' end,v_experience.id,jsonb_build_object('v11',true,'expectedRevision',p_expected_revision)); return p_decision;
end $$;
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null for update of membership;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;
grant execute on function private.moderate_review_experience_v11(uuid,text,text,text,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017146000', array[$eskomi_packet_01_3$-- Close the pre-revision moderation callable surface and serialize a Partner
-- mutation with membership revocation (status is a non-key column, so KEY
-- SHARE was insufficient).
revoke execute on function private.moderate_review_experience_v11(uuid,text,text,text) from service_role;

create or replace function private.moderate_review_experience_v11(
  p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience private.review_experiences%rowtype; v_revision private.review_experience_revisions%rowtype;
begin
  if p_expected_revision is null or p_expected_revision<1 or p_decision not in ('approved','rejected','withdrawn') or char_length(btrim(coalesce(p_actor_label,''))) not between 1 and 120 then raise exception 'invalid moderation decision' using errcode='22023'; end if;
  select * into v_experience from private.review_experiences experience where experience.id=p_experience_id for update;
  if not found then raise exception 'review experience not found' using errcode='P0002'; end if;
  if p_expected_revision<>v_experience.moderation_revision then raise exception 'review moderation changed' using errcode='40001'; end if;
  if v_experience.state in ('withdrawn','rejected') then raise exception 'review state is terminal' using errcode='40001'; end if;
  if v_experience.state='approved' and p_decision<>'withdrawn' then return 'approved'; end if;
  select * into v_revision from private.review_experience_revisions revision where revision.experience_id=v_experience.id order by revision.revision desc limit 1 for update;
  update private.review_experiences set state=p_decision,reviewed_at=now(),withdrawn_at=case when p_decision='withdrawn' then now() else null end,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience.id;
  update private.review_experience_revisions set moderation_state=case when p_decision='approved' then 'approved' when p_decision='withdrawn' then 'withdrawn' else 'rejected' end,reviewed_at=now() where id=v_revision.id;
  if p_decision='approved' then insert into app.review_experience_publications(experience_id,active_revision_id,shop_id,therapist_assignment_id,publication_state,published_at) values(v_experience.id,v_revision.id,v_experience.shop_id,(select therapist_assignment_id from private.review_assessments where experience_id=v_experience.id and target_kind='therapist'),'published',now()) on conflict(experience_id) do update set active_revision_id=excluded.active_revision_id,publication_state='published',published_at=now(),hidden_at=null,public_version=app.review_experience_publications.public_version+1,updated_at=now();
  elsif p_decision='withdrawn' then update app.review_experience_publications set publication_state='hidden',hidden_at=now(),public_version=public_version+1,updated_at=now() where experience_id=v_experience.id and publication_state<>'hidden'; end if;
  insert into private.review_moderation_decisions(experience_id,decision,actor_label,note) values(v_experience.id,p_decision,btrim(p_actor_label),nullif(btrim(coalesce(p_note,'')),''));
  insert into private.review_outbox(event_type,aggregate_id,payload) values(case when p_decision='approved' then 'review_approved' when p_decision='withdrawn' then 'review_withdrawn' else 'review_rejected' end,v_experience.id,jsonb_build_object('v11',true,'expectedRevision',p_expected_revision)); return p_decision;
end $$;
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null for update of membership;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;
grant execute on function private.moderate_review_experience_v11(uuid,text,text,text,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_3$], 'eskomi_moderation_and_membership_race_fix', null, null, null);

-- SOURCE 20261017147000_eskomi_v11_operations_and_receipts.sql
-- SHA-256 8cbd3f41016329961871e23d98f974956a85aa7001fd2162694f54f8079b17d0
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

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017147000', array[$eskomi_packet_01_4$-- Operational v1.1 completion.  This is deliberately additive: issued
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
$eskomi_packet_01_4$], 'eskomi_v11_operations_and_receipts', null, null, null);

-- SOURCE 20261017148000_eskomi_v11_guest_edits_and_widget.sql
-- SHA-256 91877f85d3ebc4756f7f4e18f2a8d4ffa3293a8a291874d4a92dcff155fb6b4e
-- v1.1 guest editing and canonical widget projection.  All private authority
-- remains behind a short-lived edit session; public handles never recover it.

alter table private.review_experience_revisions
  add column if not exists assessment_snapshot jsonb not null default '{}'::jsonb;

update private.review_experience_revisions revision
set assessment_snapshot=jsonb_build_object(
  'shopRating',(select assessment.rating from private.review_assessments assessment where assessment.experience_id=revision.experience_id and assessment.target_kind='shop'),
  'therapistRating',(select assessment.rating from private.review_assessments assessment where assessment.experience_id=revision.experience_id and assessment.target_kind='therapist')
)
where revision.assessment_snapshot='{}'::jsonb;

create table private.review_appeals_v11 (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references private.review_experiences(id) on delete restrict,
  revision integer not null check (revision > 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 400),
  state text not null default 'pending' check (state in ('pending','resolved','rejected')),
  created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(experience_id,revision,state) deferrable initially immediate
);
alter table private.review_appeals_v11 enable row level security;
revoke all on table private.review_appeals_v11 from public,anon,authenticated;
grant select,insert,update on table private.review_appeals_v11 to service_role;

create table private.review_widget_settings_v11 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references private.partner_workspaces(id) on delete restrict,
  shop_id uuid not null unique references app.shops(id) on delete restrict,
  public_handle uuid not null unique default gen_random_uuid(),
  state text not null default 'active' check (state in ('active','disabled')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.review_widget_settings_v11 enable row level security;
revoke all on table private.review_widget_settings_v11 from public,anon,authenticated;
grant select,insert,update on table private.review_widget_settings_v11 to service_role;

create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text)
returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid edit session' using errcode='22023'; end if;
  select (session.context_snapshot->>'experienceId')::uuid into v_experience
  from private.guest_operation_sessions session
  where session.session_secret_hash=p_session_secret_hash and session.revoked_at is null
    and session.submit_context_expires_at>now() and session.context_snapshot->>'scope'='edit_own'
  for update;
  if v_experience is null then raise exception 'edit session is unavailable' using errcode='42501'; end if;
  return v_experience;
end $$;

create or replace function private.get_review_editable_v11(p_session_secret_hash text)
returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  return query select experience.id,revision.revision,revision.nickname,revision.experience_comment,
    nullif(revision.assessment_snapshot->>'shopRating','')::smallint,nullif(revision.assessment_snapshot->>'therapistRating','')::smallint,
    receipt.expires_at,experience.state
  from private.review_experiences experience join private.review_experience_revisions revision on revision.experience_id=experience.id
  join private.review_edit_receipts receipt on receipt.experience_id=experience.id
  where experience.id=v_experience and revision.revision=(select max(r.revision) from private.review_experience_revisions r where r.experience_id=experience.id);
end $$;

create or replace function private.edit_review_experience_v11(
  p_session_secret_hash text,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint
) returns table(experience_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience uuid; v_current private.review_experience_revisions%rowtype; v_has_therapist boolean;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  if p_expected_revision is null or p_expected_revision<1 or char_length(btrim(coalesce(p_nickname,'')))>30 or char_length(btrim(coalesce(p_comment,'')))>400
    or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and p_therapist_rating not between 1 and 5)
    or (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') then raise exception 'invalid review edit' using errcode='22023'; end if;
  select * into v_current from private.review_experience_revisions revision where revision.experience_id=v_experience order by revision.revision desc limit 1 for update;
  if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
  if (select experience.state from private.review_experiences experience where experience.id=v_experience for update) in ('withdrawn','rejected') then raise exception 'review cannot be edited' using errcode='40001'; end if;
  select exists(select 1 from private.review_assessments assessment where assessment.experience_id=v_experience and assessment.target_kind='therapist') into v_has_therapist;
  if p_therapist_rating is not null and not v_has_therapist then raise exception 'therapist target is unavailable' using errcode='22023'; end if;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state)
  values(v_experience,v_current.revision+1,nullif(btrim(coalesce(p_nickname,'')),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
  update private.review_experiences set state='submitted',reviewed_at=null,withdrawn_at=null,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience;
  update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1,updated_at=now() where publication.experience_id=v_experience and publication.publication_state='published';
  insert into private.review_outbox(event_type,aggregate_id,payload) values('review_submitted',v_experience,jsonb_build_object('reason','guest_edit','revision',v_current.revision+1));
  return query select v_experience,v_current.revision+1,'pending'::text;
end $$;

create or replace function private.withdraw_review_experience_v11(p_session_secret_hash text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience uuid; v_revision integer;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  select history.revision into v_revision from private.review_experience_revisions history
   where history.experience_id=v_experience order by history.revision desc limit 1 for update;
  if p_expected_revision is null or p_expected_revision<>v_revision then raise exception 'review changed' using errcode='40001'; end if;
  update private.review_experiences set state='withdrawn',withdrawn_at=now(),moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience and state<>'withdrawn';
  if not found then raise exception 'review already withdrawn' using errcode='40001'; end if;
  update private.review_experience_revisions history set moderation_state='withdrawn',reviewed_at=now() where history.experience_id=v_experience and history.revision=v_revision;
  update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1,updated_at=now() where publication.experience_id=v_experience and publication.publication_state<>'hidden';
  insert into private.review_outbox(event_type,aggregate_id,payload) values('review_withdrawn',v_experience,jsonb_build_object('reason','guest_withdrawal','revision',v_revision));
  return 'withdrawn';
end $$;

create or replace function private.create_review_appeal_v11(p_session_secret_hash text,p_expected_revision integer,p_reason text)
returns table(appeal_id uuid,state text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid; v_id uuid;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  if p_expected_revision is null or p_expected_revision<>coalesce((select max(history.revision) from private.review_experience_revisions history where history.experience_id=v_experience),0)
    or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
  if exists(select 1 from private.review_appeals_v11 appeal where appeal.experience_id=v_experience and appeal.revision=p_expected_revision and appeal.state='pending') then raise exception 'appeal already pending' using errcode='23505'; end if;
  insert into private.review_appeals_v11(experience_id,revision,reason) values(v_experience,p_expected_revision,btrim(p_reason)) returning id into v_id;
  return query select v_id,'pending'::text;
end $$;

create or replace function private.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  insert into private.review_widget_settings_v11(workspace_id,shop_id) values(p_workspace_id,v_shop) on conflict(workspace_id) do nothing;
  return query select setting.public_handle,setting.state,setting.revision,shop.name,shop.canonical_path from private.review_widget_settings_v11 setting join app.shops shop on shop.id=setting.shop_id where setting.workspace_id=p_workspace_id;
end $$;

create or replace function private.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0)
returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 with setting as (select widget.shop_id from private.review_widget_settings_v11 widget join app.shops shop on shop.id=widget.shop_id and shop.publication_status='published' where widget.public_handle=p_handle and widget.state='active'),
 reviews as (select publication.id,publication.public_version,publication.published_at,revision.experience_comment,coalesce(nullif(revision.assessment_snapshot->>'shopRating','')::smallint,assessment.rating) rating
   from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
   left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='shop'
   where publication.shop_id=(select shop_id from setting) and publication.publication_state='published'),
 summary as (select count(*) count,avg(rating)::numeric average,coalesce(max(public_version),0) version from reviews)
 select shop.name,shop.canonical_path,summary.count,summary.average,summary.version,now(),reviews.experience_comment,reviews.rating,reviews.published_at,reply.body,reply.reviewed_at
 from setting join app.shops shop on shop.id=setting.shop_id cross join summary left join reviews on true
 left join lateral (select r.body,r.reviewed_at from private.review_experience_reply_revisions r where r.publication_id=reviews.id and r.state='approved' order by r.revision desc limit 1) reply on true
 order by reviews.published_at desc nulls last,reviews.id desc nulls last limit greatest(1,least(p_limit,7)) offset greatest(p_offset,0)
$$;

create or replace function api.get_review_editable_v11(text) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11($1) $$;
create or replace function api.edit_review_experience_v11(text,integer,text,text,smallint,smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11($1,$2,$3,$4,$5,$6) $$;
create or replace function api.withdraw_review_experience_v11(text,integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11($1,$2) $$;
create or replace function api.create_review_appeal_v11(text,integer,text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11($1,$2,$3) $$;
create or replace function api.get_partner_review_widget_v11(uuid,uuid) returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_review_widget_v11($1,$2) $$;
create or replace function api.get_public_review_widget_v11(uuid,integer,integer) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_review_widget_v11($1,$2,$3) $$;
revoke all on function private.assert_review_edit_session_v11(text),private.get_review_editable_v11(text),private.edit_review_experience_v11(text,integer,text,text,smallint,smallint),private.withdraw_review_experience_v11(text,integer),private.create_review_appeal_v11(text,integer,text),private.get_partner_review_widget_v11(uuid,uuid),private.get_public_review_widget_v11(uuid,integer,integer),api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.assert_review_edit_session_v11(text),private.get_review_editable_v11(text),private.edit_review_experience_v11(text,integer,text,text,smallint,smallint),private.withdraw_review_experience_v11(text,integer),private.create_review_appeal_v11(text,integer,text),private.get_partner_review_widget_v11(uuid,uuid),private.get_public_review_widget_v11(uuid,integer,integer),api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017148000', array[$eskomi_packet_01_5$-- v1.1 guest editing and canonical widget projection.  All private authority
-- remains behind a short-lived edit session; public handles never recover it.

alter table private.review_experience_revisions
  add column if not exists assessment_snapshot jsonb not null default '{}'::jsonb;

update private.review_experience_revisions revision
set assessment_snapshot=jsonb_build_object(
  'shopRating',(select assessment.rating from private.review_assessments assessment where assessment.experience_id=revision.experience_id and assessment.target_kind='shop'),
  'therapistRating',(select assessment.rating from private.review_assessments assessment where assessment.experience_id=revision.experience_id and assessment.target_kind='therapist')
)
where revision.assessment_snapshot='{}'::jsonb;

create table private.review_appeals_v11 (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references private.review_experiences(id) on delete restrict,
  revision integer not null check (revision > 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 400),
  state text not null default 'pending' check (state in ('pending','resolved','rejected')),
  created_at timestamptz not null default now(), resolved_at timestamptz,
  unique(experience_id,revision,state) deferrable initially immediate
);
alter table private.review_appeals_v11 enable row level security;
revoke all on table private.review_appeals_v11 from public,anon,authenticated;
grant select,insert,update on table private.review_appeals_v11 to service_role;

create table private.review_widget_settings_v11 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references private.partner_workspaces(id) on delete restrict,
  shop_id uuid not null unique references app.shops(id) on delete restrict,
  public_handle uuid not null unique default gen_random_uuid(),
  state text not null default 'active' check (state in ('active','disabled')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table private.review_widget_settings_v11 enable row level security;
revoke all on table private.review_widget_settings_v11 from public,anon,authenticated;
grant select,insert,update on table private.review_widget_settings_v11 to service_role;

create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text)
returns uuid language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid edit session' using errcode='22023'; end if;
  select (session.context_snapshot->>'experienceId')::uuid into v_experience
  from private.guest_operation_sessions session
  where session.session_secret_hash=p_session_secret_hash and session.revoked_at is null
    and session.submit_context_expires_at>now() and session.context_snapshot->>'scope'='edit_own'
  for update;
  if v_experience is null then raise exception 'edit session is unavailable' using errcode='42501'; end if;
  return v_experience;
end $$;

create or replace function private.get_review_editable_v11(p_session_secret_hash text)
returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text)
language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  return query select experience.id,revision.revision,revision.nickname,revision.experience_comment,
    nullif(revision.assessment_snapshot->>'shopRating','')::smallint,nullif(revision.assessment_snapshot->>'therapistRating','')::smallint,
    receipt.expires_at,experience.state
  from private.review_experiences experience join private.review_experience_revisions revision on revision.experience_id=experience.id
  join private.review_edit_receipts receipt on receipt.experience_id=experience.id
  where experience.id=v_experience and revision.revision=(select max(r.revision) from private.review_experience_revisions r where r.experience_id=experience.id);
end $$;

create or replace function private.edit_review_experience_v11(
  p_session_secret_hash text,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint
) returns table(experience_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience uuid; v_current private.review_experience_revisions%rowtype; v_has_therapist boolean;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  if p_expected_revision is null or p_expected_revision<1 or char_length(btrim(coalesce(p_nickname,'')))>30 or char_length(btrim(coalesce(p_comment,'')))>400
    or (p_shop_rating is not null and p_shop_rating not between 1 and 5) or (p_therapist_rating is not null and p_therapist_rating not between 1 and 5)
    or (p_shop_rating is null and p_therapist_rating is null and btrim(coalesce(p_comment,''))='') then raise exception 'invalid review edit' using errcode='22023'; end if;
  select * into v_current from private.review_experience_revisions revision where revision.experience_id=v_experience order by revision.revision desc limit 1 for update;
  if v_current.revision<>p_expected_revision then raise exception 'review changed' using errcode='40001'; end if;
  if (select experience.state from private.review_experiences experience where experience.id=v_experience for update) in ('withdrawn','rejected') then raise exception 'review cannot be edited' using errcode='40001'; end if;
  select exists(select 1 from private.review_assessments assessment where assessment.experience_id=v_experience and assessment.target_kind='therapist') into v_has_therapist;
  if p_therapist_rating is not null and not v_has_therapist then raise exception 'therapist target is unavailable' using errcode='22023'; end if;
  insert into private.review_experience_revisions(experience_id,revision,nickname,experience_comment,assessment_snapshot,moderation_state)
  values(v_experience,v_current.revision+1,nullif(btrim(coalesce(p_nickname,'')),''),btrim(coalesce(p_comment,'')),jsonb_build_object('shopRating',p_shop_rating,'therapistRating',p_therapist_rating),'pending');
  update private.review_experiences set state='submitted',reviewed_at=null,withdrawn_at=null,moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience;
  update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1,updated_at=now() where publication.experience_id=v_experience and publication.publication_state='published';
  insert into private.review_outbox(event_type,aggregate_id,payload) values('review_submitted',v_experience,jsonb_build_object('reason','guest_edit','revision',v_current.revision+1));
  return query select v_experience,v_current.revision+1,'pending'::text;
end $$;

create or replace function private.withdraw_review_experience_v11(p_session_secret_hash text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_experience uuid; v_revision integer;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  select history.revision into v_revision from private.review_experience_revisions history
   where history.experience_id=v_experience order by history.revision desc limit 1 for update;
  if p_expected_revision is null or p_expected_revision<>v_revision then raise exception 'review changed' using errcode='40001'; end if;
  update private.review_experiences set state='withdrawn',withdrawn_at=now(),moderation_revision=moderation_revision+1,updated_at=now() where id=v_experience and state<>'withdrawn';
  if not found then raise exception 'review already withdrawn' using errcode='40001'; end if;
  update private.review_experience_revisions history set moderation_state='withdrawn',reviewed_at=now() where history.experience_id=v_experience and history.revision=v_revision;
  update app.review_experience_publications publication set publication_state='hidden',hidden_at=now(),public_version=publication.public_version+1,updated_at=now() where publication.experience_id=v_experience and publication.publication_state<>'hidden';
  insert into private.review_outbox(event_type,aggregate_id,payload) values('review_withdrawn',v_experience,jsonb_build_object('reason','guest_withdrawal','revision',v_revision));
  return 'withdrawn';
end $$;

create or replace function private.create_review_appeal_v11(p_session_secret_hash text,p_expected_revision integer,p_reason text)
returns table(appeal_id uuid,state text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_experience uuid; v_id uuid;
begin
  v_experience:=private.assert_review_edit_session_v11(p_session_secret_hash);
  if p_expected_revision is null or p_expected_revision<>coalesce((select max(history.revision) from private.review_experience_revisions history where history.experience_id=v_experience),0)
    or char_length(btrim(coalesce(p_reason,''))) not between 1 and 400 then raise exception 'invalid appeal' using errcode='22023'; end if;
  if exists(select 1 from private.review_appeals_v11 appeal where appeal.experience_id=v_experience and appeal.revision=p_expected_revision and appeal.state='pending') then raise exception 'appeal already pending' using errcode='23505'; end if;
  insert into private.review_appeals_v11(experience_id,revision,reason) values(v_experience,p_expected_revision,btrim(p_reason)) returning id into v_id;
  return query select v_id,'pending'::text;
end $$;

create or replace function private.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid)
returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  insert into private.review_widget_settings_v11(workspace_id,shop_id) values(p_workspace_id,v_shop) on conflict(workspace_id) do nothing;
  return query select setting.public_handle,setting.state,setting.revision,shop.name,shop.canonical_path from private.review_widget_settings_v11 setting join app.shops shop on shop.id=setting.shop_id where setting.workspace_id=p_workspace_id;
end $$;

create or replace function private.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0)
returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
 with setting as (select widget.shop_id from private.review_widget_settings_v11 widget join app.shops shop on shop.id=widget.shop_id and shop.publication_status='published' where widget.public_handle=p_handle and widget.state='active'),
 reviews as (select publication.id,publication.public_version,publication.published_at,revision.experience_comment,coalesce(nullif(revision.assessment_snapshot->>'shopRating','')::smallint,assessment.rating) rating
   from app.review_experience_publications publication join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
   left join private.review_assessments assessment on assessment.experience_id=publication.experience_id and assessment.target_kind='shop'
   where publication.shop_id=(select shop_id from setting) and publication.publication_state='published'),
 summary as (select count(*) count,avg(rating)::numeric average,coalesce(max(public_version),0) version from reviews)
 select shop.name,shop.canonical_path,summary.count,summary.average,summary.version,now(),reviews.experience_comment,reviews.rating,reviews.published_at,reply.body,reply.reviewed_at
 from setting join app.shops shop on shop.id=setting.shop_id cross join summary left join reviews on true
 left join lateral (select r.body,r.reviewed_at from private.review_experience_reply_revisions r where r.publication_id=reviews.id and r.state='approved' order by r.revision desc limit 1) reply on true
 order by reviews.published_at desc nulls last,reviews.id desc nulls last limit greatest(1,least(p_limit,7)) offset greatest(p_offset,0)
$$;

create or replace function api.get_review_editable_v11(text) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11($1) $$;
create or replace function api.edit_review_experience_v11(text,integer,text,text,smallint,smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11($1,$2,$3,$4,$5,$6) $$;
create or replace function api.withdraw_review_experience_v11(text,integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11($1,$2) $$;
create or replace function api.create_review_appeal_v11(text,integer,text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11($1,$2,$3) $$;
create or replace function api.get_partner_review_widget_v11(uuid,uuid) returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_review_widget_v11($1,$2) $$;
create or replace function api.get_public_review_widget_v11(uuid,integer,integer) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_review_widget_v11($1,$2,$3) $$;
revoke all on function private.assert_review_edit_session_v11(text),private.get_review_editable_v11(text),private.edit_review_experience_v11(text,integer,text,text,smallint,smallint),private.withdraw_review_experience_v11(text,integer),private.create_review_appeal_v11(text,integer,text),private.get_partner_review_widget_v11(uuid,uuid),private.get_public_review_widget_v11(uuid,integer,integer),api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.assert_review_edit_session_v11(text),private.get_review_editable_v11(text),private.edit_review_experience_v11(text,integer,text,text,smallint,smallint),private.withdraw_review_experience_v11(text,integer),private.create_review_appeal_v11(text,integer,text),private.get_partner_review_widget_v11(uuid,uuid),private.get_public_review_widget_v11(uuid,integer,integer),api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_5$], 'eskomi_v11_guest_edits_and_widget', null, null, null);

-- SOURCE 20261017149000_eskomi_v11_rpc_contract_and_upgrade_fix.sql
-- SHA-256 ccb5a4ff3282f95676e43d8527ad5aefbedb411ecb298d29c35bc8d98f01fdc6
-- Correct the service RPC surface after the operational migration. PostgREST
-- resolves named JSON keys, so every api wrapper explicitly preserves its
-- p_* parameter names. This is additive for already-migrated databases.

create or replace function private.submit_partner_review_reply_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text
) returns table(reply_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_revision integer; v_body text; v_id uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  v_body:=btrim(coalesce(p_body,''));
  if p_expected_revision is null or p_expected_revision<0 or char_length(v_body) not between 1 and 500 then raise exception 'invalid reply request' using errcode='22023'; end if;
  perform 1 from app.review_experience_publications publication where publication.id=p_publication_id and publication.shop_id=v_shop and publication.publication_state='published' for key share;
  if not found then raise exception 'review is unavailable for this workspace' using errcode='42501'; end if;
  select coalesce(max(locked.revision),0) into v_revision from (
    select reply.revision from private.review_experience_reply_revisions reply
    where reply.publication_id=p_publication_id and reply.workspace_id=p_workspace_id for update
  ) locked;
  if v_revision<>p_expected_revision then raise exception 'reply changed' using errcode='40001'; end if;
  insert into private.review_experience_reply_revisions(publication_id,workspace_id,revision,body,state)
  values(p_publication_id,p_workspace_id,v_revision+1,v_body,'pending') returning id into v_id;
  insert into private.review_outbox(event_type,aggregate_id,payload)
  values('reply_submitted',v_id,jsonb_build_object('publicationId',p_publication_id,'revision',v_revision+1));
  return query select v_id,v_revision+1,'pending'::text;
end $$;

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
  select * into v_program from private.benefit_programs program where program.workspace_id=p_workspace_id and program.shop_id=v_shop for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'benefit program changed' using errcode='40001'; end if;
    insert into private.benefit_programs(workspace_id,shop_id,state,eligibility_rule,benefit_text,current_version,revision)
    values(p_workspace_id,v_shop,'pending_approval','accepted_submission',btrim(p_terms_text),1,1) returning * into v_program;
  else
    if p_expected_revision<>v_program.revision then raise exception 'benefit program changed' using errcode='40001'; end if;
    update private.benefit_programs as program set state='pending_approval',benefit_text=btrim(p_terms_text),current_version=program.current_version+1,revision=program.revision+1,operator_approved_at=null,operator_approved_by=null,updated_at=now()
    where program.id=v_program.id returning * into v_program;
  end if;
  v_version:=v_program.current_version;
  insert into private.benefit_program_versions(program_id,version,title,benefit_kind,amount_yen,rate,terms_text,issuer_label,funding_party_label,valid_from,valid_until,redeem_valid_days,combinable,eligibility_version)
  values(v_program.id,v_version,btrim(p_title),p_benefit_kind,p_amount_yen,p_rate,btrim(p_terms_text),btrim(p_issuer_label),btrim(p_funding_party_label),p_valid_from,p_valid_until,p_redeem_valid_days,coalesce(p_combinable,false),'v1.1');
  return query select v_program.id,v_program.revision,v_version,v_program.state;
end $$;

-- Therapist mutations use the identical live authority check: a manager
-- downgrade, revocation, or workspace stop cannot race a stale tab mutation.
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role='owner' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null
  for update of membership,workspace;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;

-- Older populated ledgers retain the pre-therapist context signature. Rename
-- it, then publish the current named signature and the retired-person flag.
do $$ begin
  if to_regprocedure('private.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('private.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function private.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
  if to_regprocedure('api.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('api.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function api.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
end $$;
drop function if exists private.create_review_submission_context(uuid,text,text);
drop function if exists api.create_review_submission_context(uuid,text,text);
-- A partially upgraded ledger can already have the four-argument function
-- with the pre-retirement row shape.  PostgreSQL cannot replace OUT columns,
-- so remove only this compatibility surface and recreate it below.
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
drop function if exists private.create_review_submission_context(uuid,text,text,uuid);
create or replace function private.create_review_submission_context(
  p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null
) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_link private.review_entry_links%rowtype; v_assignment app.therapist_assignments%rowtype; v_requested uuid; v_unavailable boolean:=false;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_context_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid review context' using errcode='22023'; end if;
  select link.* into v_link from private.review_entry_links link join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
    left join private.managed_shops managed on managed.app_shop_id=shop.id where link.public_handle=p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at>now()) and (managed.id is null or managed.publication_state='published') for key share of link;
  if not found then raise exception 'review context is unavailable' using errcode='P0002'; end if;
  if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is not null and p_therapist_assignment_id<>v_link.therapist_assignment_id then raise exception 'dedicated therapist link cannot change target' using errcode='22023'; end if;
  v_requested:=coalesce(v_link.therapist_assignment_id,p_therapist_assignment_id);
  if v_requested is not null then
    select * into v_assignment from app.therapist_assignments assignment where assignment.id=v_requested and assignment.shop_id=v_link.shop_id and assignment.lifecycle_state='active' and (assignment.active_until is null or assignment.active_until>now());
    if not found then if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is null then v_assignment:=null;v_unavailable:=true; else raise exception 'therapist assignment is unavailable' using errcode='P0002'; end if; end if;
  end if;
  insert into private.guest_operation_sessions(session_secret_hash,context_fingerprint,context_snapshot) values(p_session_secret_hash,p_context_fingerprint,jsonb_build_object('entryHandle',v_link.public_handle,'shopId',v_link.shop_id,'assignmentId',v_assignment.id,'formVersion','v1.1'));
  return query select v_link.public_handle,shop.slug,shop.name,v_assignment.display_name,v_unavailable,now()+interval '30 minutes' from app.shops shop where shop.id=v_link.shop_id;
end $$;

-- Drop/recreate only api wrappers: it is the sole way to change parameter
-- names in PostgreSQL and migrations run atomically before PostgREST reload.
drop function if exists api.get_review_benefit_receipt_v11(uuid,text);
drop function if exists api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text);
drop function if exists api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean);
drop function if exists api.list_partner_benefit_operations_v11(uuid,uuid);
drop function if exists api.list_partner_replyable_reviews_v11(uuid,uuid);
drop function if exists api.list_review_moderation_v11();
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists api.list_operator_review_replies_v11();
drop function if exists api.moderate_review_experience_v11(uuid,text,text,text,integer);
drop function if exists api.moderate_partner_review_reply_v11(uuid,text,text);
drop function if exists api.approve_benefit_program_v11(uuid,integer,text);
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
create function api.get_review_benefit_receipt_v11(p_experience_id uuid,p_session_secret_hash text) returns table(benefit_status text,expires_at timestamptz,benefit_snapshot jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_benefit_receipt_v11(p_experience_id,p_session_secret_hash) $$;
create function api.submit_partner_review_reply_v11(p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text) returns table(reply_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_partner_review_reply_v11(p_workspace_id,p_auth_user_id,p_publication_id,p_expected_revision,p_body) $$;
create function api.save_partner_benefit_program_v11(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_title text,p_benefit_kind text,p_amount_yen integer,p_rate numeric,p_terms_text text,p_issuer_label text,p_funding_party_label text,p_valid_from timestamptz,p_valid_until timestamptz,p_redeem_valid_days integer,p_combinable boolean) returns table(program_id uuid,revision integer,version integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.save_partner_benefit_program_v11(p_workspace_id,p_auth_user_id,p_expected_revision,p_title,p_benefit_kind,p_amount_yen,p_rate,p_terms_text,p_issuer_label,p_funding_party_label,p_valid_from,p_valid_until,p_redeem_valid_days,p_combinable) $$;
create function api.list_partner_benefit_operations_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(program_id uuid,revision integer,state text,version integer,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,combinable boolean,issued_count bigint,redeemed_count bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_benefit_operations_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_partner_replyable_reviews_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(publication_id uuid,body text,published_at timestamptz,reply_revision integer,reply_state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_replyable_reviews_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_review_moderation_v11() $$;
create function api.list_operator_benefit_programs_v11() returns table(program_id uuid,revision integer,state text,title text,terms_text text,valid_from timestamptz,valid_until timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
create function api.list_operator_review_replies_v11() returns table(reply_id uuid,shop_name text,body text,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_review_replies_v11() $$;
create function api.moderate_review_experience_v11(p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_review_experience_v11(p_experience_id,p_decision,p_actor_label,p_note,p_expected_revision) $$;
create function api.moderate_partner_review_reply_v11(p_reply_id uuid,p_decision text,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_partner_review_reply_v11(p_reply_id,p_decision,p_actor_label) $$;
create function api.approve_benefit_program_v11(p_program_id uuid,p_expected_revision integer,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.approve_benefit_program_v11(p_program_id,p_expected_revision,p_actor_label) $$;
create function api.create_review_submission_context(p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_submission_context(p_entry_handle,p_session_secret_hash,p_context_fingerprint,p_therapist_assignment_id) $$;
revoke all on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) to service_role;

-- Operator approval must show every immutable commercial condition, not a
-- title and free text alone. Recreate the service-only reader with its named
-- parameters preserved.
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists private.list_operator_benefit_programs_v11();
create function private.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security definer set search_path=private,app,pg_temp as $$
 select program.id,program.revision,program.state,shop.name,version.title,version.benefit_kind,version.amount_yen,version.rate,version.terms_text,version.issuer_label,version.funding_party_label,version.valid_from,version.valid_until,version.redeem_valid_days,version.redeem_deadline,version.combinable
 from private.benefit_programs program join private.benefit_program_versions version on version.program_id=program.id and version.version=program.current_version join app.shops shop on shop.id=program.shop_id
 where program.state='pending_approval' order by version.created_at asc
$$;
create function api.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
revoke all on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() from public,anon,authenticated;
grant execute on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() to service_role;

drop function if exists api.get_review_editable_v11(text);
drop function if exists api.edit_review_experience_v11(text,integer,text,text,smallint,smallint);
drop function if exists api.withdraw_review_experience_v11(text,integer);
drop function if exists api.create_review_appeal_v11(text,integer,text);
drop function if exists api.get_partner_review_widget_v11(uuid,uuid);
drop function if exists api.get_public_review_widget_v11(uuid,integer,integer);
create function api.get_review_editable_v11(p_session_secret_hash text) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11(p_session_secret_hash) $$;
create function api.edit_review_experience_v11(p_session_secret_hash text,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11(p_session_secret_hash,p_expected_revision,p_nickname,p_comment,p_shop_rating,p_therapist_rating) $$;
create function api.withdraw_review_experience_v11(p_session_secret_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11(p_session_secret_hash,p_expected_revision) $$;
create function api.create_review_appeal_v11(p_session_secret_hash text,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11(p_session_secret_hash,p_expected_revision,p_reason) $$;
create function api.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) $$;
create function api.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_review_widget_v11(p_handle,p_limit,p_offset) $$;
revoke all on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) from public,anon,authenticated;
grant execute on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) to service_role;

-- Sessions carry a comma-separated capability set.  The original v1.1
-- assertion compared it as a scalar, which rejected the normal edit receipt.
create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text)
returns uuid language plpgsql security definer
set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid edit session' using errcode='22023'; end if;
  select (session.context_snapshot->>'experienceId')::uuid into v_experience
  from private.guest_operation_sessions session
   where session.session_secret_hash=p_session_secret_hash
     and session.revoked_at is null
     and session.submit_context_expires_at>now()
     and position('edit_own' in coalesce(session.context_snapshot->>'scope',''))>0
   for update;
  if v_experience is null then raise exception 'review edit session is unavailable' using errcode='42501'; end if;
  return v_experience;
end $$;
revoke all on function private.assert_review_edit_session_v11(text) from public,anon,authenticated;
grant execute on function private.assert_review_edit_session_v11(text) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017149000', array[$eskomi_packet_01_6$-- Correct the service RPC surface after the operational migration. PostgREST
-- resolves named JSON keys, so every api wrapper explicitly preserves its
-- p_* parameter names. This is additive for already-migrated databases.

create or replace function private.submit_partner_review_reply_v11(
  p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text
) returns table(reply_id uuid,revision integer,state text)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop uuid; v_revision integer; v_body text; v_id uuid;
begin
  v_shop:=private.assert_partner_v11_membership(p_workspace_id,p_auth_user_id);
  v_body:=btrim(coalesce(p_body,''));
  if p_expected_revision is null or p_expected_revision<0 or char_length(v_body) not between 1 and 500 then raise exception 'invalid reply request' using errcode='22023'; end if;
  perform 1 from app.review_experience_publications publication where publication.id=p_publication_id and publication.shop_id=v_shop and publication.publication_state='published' for key share;
  if not found then raise exception 'review is unavailable for this workspace' using errcode='42501'; end if;
  select coalesce(max(locked.revision),0) into v_revision from (
    select reply.revision from private.review_experience_reply_revisions reply
    where reply.publication_id=p_publication_id and reply.workspace_id=p_workspace_id for update
  ) locked;
  if v_revision<>p_expected_revision then raise exception 'reply changed' using errcode='40001'; end if;
  insert into private.review_experience_reply_revisions(publication_id,workspace_id,revision,body,state)
  values(p_publication_id,p_workspace_id,v_revision+1,v_body,'pending') returning id into v_id;
  insert into private.review_outbox(event_type,aggregate_id,payload)
  values('reply_submitted',v_id,jsonb_build_object('publicationId',p_publication_id,'revision',v_revision+1));
  return query select v_id,v_revision+1,'pending'::text;
end $$;

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
  select * into v_program from private.benefit_programs program where program.workspace_id=p_workspace_id and program.shop_id=v_shop for update;
  if not found then
    if p_expected_revision<>0 then raise exception 'benefit program changed' using errcode='40001'; end if;
    insert into private.benefit_programs(workspace_id,shop_id,state,eligibility_rule,benefit_text,current_version,revision)
    values(p_workspace_id,v_shop,'pending_approval','accepted_submission',btrim(p_terms_text),1,1) returning * into v_program;
  else
    if p_expected_revision<>v_program.revision then raise exception 'benefit program changed' using errcode='40001'; end if;
    update private.benefit_programs as program set state='pending_approval',benefit_text=btrim(p_terms_text),current_version=program.current_version+1,revision=program.revision+1,operator_approved_at=null,operator_approved_by=null,updated_at=now()
    where program.id=v_program.id returning * into v_program;
  end if;
  v_version:=v_program.current_version;
  insert into private.benefit_program_versions(program_id,version,title,benefit_kind,amount_yen,rate,terms_text,issuer_label,funding_party_label,valid_from,valid_until,redeem_valid_days,combinable,eligibility_version)
  values(v_program.id,v_version,btrim(p_title),p_benefit_kind,p_amount_yen,p_rate,btrim(p_terms_text),btrim(p_issuer_label),btrim(p_funding_party_label),p_valid_from,p_valid_until,p_redeem_valid_days,coalesce(p_combinable,false),'v1.1');
  return query select v_program.id,v_program.revision,v_version,v_program.state;
end $$;

-- Therapist mutations use the identical live authority check: a manager
-- downgrade, revocation, or workspace stop cannot race a stale tab mutation.
create or replace function private.assert_partner_therapist_membership(p_workspace_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path=private,pg_temp as $$
begin
  perform 1 from private.partner_memberships membership join private.partner_workspaces workspace on workspace.id=membership.workspace_id
  where membership.workspace_id=p_workspace_id and membership.auth_user_id=p_auth_user_id and membership.status='active'
    and membership.role='owner' and workspace.state in ('free_official_partner','active_partner') and workspace.app_shop_id is not null
  for update of membership,workspace;
  if not found then raise exception 'partner membership is unavailable' using errcode='42501'; end if;
end $$;

-- Older populated ledgers retain the pre-therapist context signature. Rename
-- it, then publish the current named signature and the retired-person flag.
do $$ begin
  if to_regprocedure('private.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('private.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function private.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
  if to_regprocedure('api.create_review_submission_context(uuid,text,text)') is not null and to_regprocedure('api.create_review_submission_context(uuid,text,text,uuid)') is null then
    alter function api.create_review_submission_context(uuid,text,text) rename to create_review_submission_context_pre140;
  end if;
end $$;
drop function if exists private.create_review_submission_context(uuid,text,text);
drop function if exists api.create_review_submission_context(uuid,text,text);
-- A partially upgraded ledger can already have the four-argument function
-- with the pre-retirement row shape.  PostgreSQL cannot replace OUT columns,
-- so remove only this compatibility surface and recreate it below.
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
drop function if exists private.create_review_submission_context(uuid,text,text,uuid);
create or replace function private.create_review_submission_context(
  p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null
) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_link private.review_entry_links%rowtype; v_assignment app.therapist_assignments%rowtype; v_requested uuid; v_unavailable boolean:=false;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' or p_context_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid review context' using errcode='22023'; end if;
  select link.* into v_link from private.review_entry_links link join app.shops shop on shop.id=link.shop_id and shop.publication_status='published'
    left join private.managed_shops managed on managed.app_shop_id=shop.id where link.public_handle=p_entry_handle and link.is_active and (link.expires_at is null or link.expires_at>now()) and (managed.id is null or managed.publication_state='published') for key share of link;
  if not found then raise exception 'review context is unavailable' using errcode='P0002'; end if;
  if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is not null and p_therapist_assignment_id<>v_link.therapist_assignment_id then raise exception 'dedicated therapist link cannot change target' using errcode='22023'; end if;
  v_requested:=coalesce(v_link.therapist_assignment_id,p_therapist_assignment_id);
  if v_requested is not null then
    select * into v_assignment from app.therapist_assignments assignment where assignment.id=v_requested and assignment.shop_id=v_link.shop_id and assignment.lifecycle_state='active' and (assignment.active_until is null or assignment.active_until>now());
    if not found then if v_link.therapist_assignment_id is not null and p_therapist_assignment_id is null then v_assignment:=null;v_unavailable:=true; else raise exception 'therapist assignment is unavailable' using errcode='P0002'; end if; end if;
  end if;
  insert into private.guest_operation_sessions(session_secret_hash,context_fingerprint,context_snapshot) values(p_session_secret_hash,p_context_fingerprint,jsonb_build_object('entryHandle',v_link.public_handle,'shopId',v_link.shop_id,'assignmentId',v_assignment.id,'formVersion','v1.1'));
  return query select v_link.public_handle,shop.slug,shop.name,v_assignment.display_name,v_unavailable,now()+interval '30 minutes' from app.shops shop where shop.id=v_link.shop_id;
end $$;

-- Drop/recreate only api wrappers: it is the sole way to change parameter
-- names in PostgreSQL and migrations run atomically before PostgREST reload.
drop function if exists api.get_review_benefit_receipt_v11(uuid,text);
drop function if exists api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text);
drop function if exists api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean);
drop function if exists api.list_partner_benefit_operations_v11(uuid,uuid);
drop function if exists api.list_partner_replyable_reviews_v11(uuid,uuid);
drop function if exists api.list_review_moderation_v11();
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists api.list_operator_review_replies_v11();
drop function if exists api.moderate_review_experience_v11(uuid,text,text,text,integer);
drop function if exists api.moderate_partner_review_reply_v11(uuid,text,text);
drop function if exists api.approve_benefit_program_v11(uuid,integer,text);
drop function if exists api.create_review_submission_context(uuid,text,text,uuid);
create function api.get_review_benefit_receipt_v11(p_experience_id uuid,p_session_secret_hash text) returns table(benefit_status text,expires_at timestamptz,benefit_snapshot jsonb) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_benefit_receipt_v11(p_experience_id,p_session_secret_hash) $$;
create function api.submit_partner_review_reply_v11(p_workspace_id uuid,p_auth_user_id uuid,p_publication_id uuid,p_expected_revision integer,p_body text) returns table(reply_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_partner_review_reply_v11(p_workspace_id,p_auth_user_id,p_publication_id,p_expected_revision,p_body) $$;
create function api.save_partner_benefit_program_v11(p_workspace_id uuid,p_auth_user_id uuid,p_expected_revision integer,p_title text,p_benefit_kind text,p_amount_yen integer,p_rate numeric,p_terms_text text,p_issuer_label text,p_funding_party_label text,p_valid_from timestamptz,p_valid_until timestamptz,p_redeem_valid_days integer,p_combinable boolean) returns table(program_id uuid,revision integer,version integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.save_partner_benefit_program_v11(p_workspace_id,p_auth_user_id,p_expected_revision,p_title,p_benefit_kind,p_amount_yen,p_rate,p_terms_text,p_issuer_label,p_funding_party_label,p_valid_from,p_valid_until,p_redeem_valid_days,p_combinable) $$;
create function api.list_partner_benefit_operations_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(program_id uuid,revision integer,state text,version integer,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,combinable boolean,issued_count bigint,redeemed_count bigint) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_benefit_operations_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_partner_replyable_reviews_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(publication_id uuid,body text,published_at timestamptz,reply_revision integer,reply_state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_partner_replyable_reviews_v11(p_workspace_id,p_auth_user_id) $$;
create function api.list_review_moderation_v11() returns table(experience_id uuid,moderation_revision integer,state text,shop_name text,comment text,shop_rating smallint,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_review_moderation_v11() $$;
create function api.list_operator_benefit_programs_v11() returns table(program_id uuid,revision integer,state text,title text,terms_text text,valid_from timestamptz,valid_until timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
create function api.list_operator_review_replies_v11() returns table(reply_id uuid,shop_name text,body text,submitted_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_review_replies_v11() $$;
create function api.moderate_review_experience_v11(p_experience_id uuid,p_decision text,p_actor_label text,p_note text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_review_experience_v11(p_experience_id,p_decision,p_actor_label,p_note,p_expected_revision) $$;
create function api.moderate_partner_review_reply_v11(p_reply_id uuid,p_decision text,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_partner_review_reply_v11(p_reply_id,p_decision,p_actor_label) $$;
create function api.approve_benefit_program_v11(p_program_id uuid,p_expected_revision integer,p_actor_label text) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.approve_benefit_program_v11(p_program_id,p_expected_revision,p_actor_label) $$;
create function api.create_review_submission_context(p_entry_handle uuid,p_session_secret_hash text,p_context_fingerprint text,p_therapist_assignment_id uuid default null) returns table(entry_handle uuid,shop_slug text,shop_name text,therapist_display_name text,therapist_unavailable boolean,expires_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_submission_context(p_entry_handle,p_session_secret_hash,p_context_fingerprint,p_therapist_assignment_id) $$;
revoke all on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function api.get_review_benefit_receipt_v11(uuid,text),api.submit_partner_review_reply_v11(uuid,uuid,uuid,integer,text),api.save_partner_benefit_program_v11(uuid,uuid,integer,text,text,integer,numeric,text,text,text,timestamptz,timestamptz,integer,boolean),api.list_partner_benefit_operations_v11(uuid,uuid),api.list_partner_replyable_reviews_v11(uuid,uuid),api.list_review_moderation_v11(),api.list_operator_benefit_programs_v11(),api.list_operator_review_replies_v11(),api.moderate_review_experience_v11(uuid,text,text,text,integer),api.moderate_partner_review_reply_v11(uuid,text,text),api.approve_benefit_program_v11(uuid,integer,text),api.create_review_submission_context(uuid,text,text,uuid) to service_role;

-- Operator approval must show every immutable commercial condition, not a
-- title and free text alone. Recreate the service-only reader with its named
-- parameters preserved.
drop function if exists api.list_operator_benefit_programs_v11();
drop function if exists private.list_operator_benefit_programs_v11();
create function private.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security definer set search_path=private,app,pg_temp as $$
 select program.id,program.revision,program.state,shop.name,version.title,version.benefit_kind,version.amount_yen,version.rate,version.terms_text,version.issuer_label,version.funding_party_label,version.valid_from,version.valid_until,version.redeem_valid_days,version.redeem_deadline,version.combinable
 from private.benefit_programs program join private.benefit_program_versions version on version.program_id=program.id and version.version=program.current_version join app.shops shop on shop.id=program.shop_id
 where program.state='pending_approval' order by version.created_at asc
$$;
create function api.list_operator_benefit_programs_v11()
returns table(program_id uuid,revision integer,state text,shop_name text,title text,benefit_kind text,amount_yen integer,rate numeric,terms_text text,issuer_label text,funding_party_label text,valid_from timestamptz,valid_until timestamptz,redeem_valid_days integer,redeem_deadline timestamptz,combinable boolean)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_benefit_programs_v11() $$;
revoke all on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() from public,anon,authenticated;
grant execute on function private.list_operator_benefit_programs_v11(),api.list_operator_benefit_programs_v11() to service_role;

drop function if exists api.get_review_editable_v11(text);
drop function if exists api.edit_review_experience_v11(text,integer,text,text,smallint,smallint);
drop function if exists api.withdraw_review_experience_v11(text,integer);
drop function if exists api.create_review_appeal_v11(text,integer,text);
drop function if exists api.get_partner_review_widget_v11(uuid,uuid);
drop function if exists api.get_public_review_widget_v11(uuid,integer,integer);
create function api.get_review_editable_v11(p_session_secret_hash text) returns table(experience_id uuid,revision integer,nickname text,comment text,shop_rating smallint,therapist_rating smallint,expires_at timestamptz,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_review_editable_v11(p_session_secret_hash) $$;
create function api.edit_review_experience_v11(p_session_secret_hash text,p_expected_revision integer,p_nickname text,p_comment text,p_shop_rating smallint,p_therapist_rating smallint) returns table(experience_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.edit_review_experience_v11(p_session_secret_hash,p_expected_revision,p_nickname,p_comment,p_shop_rating,p_therapist_rating) $$;
create function api.withdraw_review_experience_v11(p_session_secret_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_review_experience_v11(p_session_secret_hash,p_expected_revision) $$;
create function api.create_review_appeal_v11(p_session_secret_hash text,p_expected_revision integer,p_reason text) returns table(appeal_id uuid,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.create_review_appeal_v11(p_session_secret_hash,p_expected_revision,p_reason) $$;
create function api.get_partner_review_widget_v11(p_workspace_id uuid,p_auth_user_id uuid) returns table(public_handle uuid,state text,revision integer,shop_name text,canonical_path text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_review_widget_v11(p_workspace_id,p_auth_user_id) $$;
create function api.get_public_review_widget_v11(p_handle uuid,p_limit integer default 3,p_offset integer default 0) returns table(shop_name text,canonical_path text,review_count bigint,average_rating numeric,public_version bigint,data_as_of timestamptz,review_body text,review_rating smallint,published_at timestamptz,reply_body text,reply_published_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_public_review_widget_v11(p_handle,p_limit,p_offset) $$;
revoke all on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) from public,anon,authenticated;
grant execute on function api.get_review_editable_v11(text),api.edit_review_experience_v11(text,integer,text,text,smallint,smallint),api.withdraw_review_experience_v11(text,integer),api.create_review_appeal_v11(text,integer,text),api.get_partner_review_widget_v11(uuid,uuid),api.get_public_review_widget_v11(uuid,integer,integer) to service_role;

-- Sessions carry a comma-separated capability set.  The original v1.1
-- assertion compared it as a scalar, which rejected the normal edit receipt.
create or replace function private.assert_review_edit_session_v11(p_session_secret_hash text)
returns uuid language plpgsql security definer
set search_path=private,pg_temp as $$
declare v_experience uuid;
begin
  if p_session_secret_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid edit session' using errcode='22023'; end if;
  select (session.context_snapshot->>'experienceId')::uuid into v_experience
  from private.guest_operation_sessions session
   where session.session_secret_hash=p_session_secret_hash
     and session.revoked_at is null
     and session.submit_context_expires_at>now()
     and position('edit_own' in coalesce(session.context_snapshot->>'scope',''))>0
   for update;
  if v_experience is null then raise exception 'review edit session is unavailable' using errcode='42501'; end if;
  return v_experience;
end $$;
revoke all on function private.assert_review_edit_session_v11(text) from public,anon,authenticated;
grant execute on function private.assert_review_edit_session_v11(text) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_6$], 'eskomi_v11_rpc_contract_and_upgrade_fix', null, null, null);

-- SOURCE 20261017150000_eskomi_corrections_and_community.sql
-- SHA-256 912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d
-- Private corrections and manually moderated community posts.  They never
-- participate in ratings, review counts, offers, or ranking inputs.

create table private.store_correction_requests_v11 (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references app.shops(id) on delete restrict,
  field_key text not null check (field_key in ('name','category','price','hours','access','official_url','image','other')),
  proposed_value text not null check (char_length(btrim(proposed_value)) between 1 and 1000),
  source_url text check (source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https://')),
  state text not null default 'received' check (state in ('received','reviewing','applied','closed')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table private.community_posts_v11 (
  id uuid primary key default gen_random_uuid(), scope_kind text not null check (scope_kind in ('shop','area')),
  shop_id uuid references app.shops(id) on delete restrict, area_id uuid references app.areas(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 400 and body !~ E'[\\n\\r]{3,}'),
  revision integer not null default 1 check (revision>0), moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected')),
  publication_state text not null default 'draft' check (publication_state in ('draft','published','withdrawn')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$'),
  ip_risk_tag text not null check (ip_risk_tag ~ '^[0-9a-f]{64}$'), ip_risk_expires_at timestamptz not null,
  created_at timestamptz not null default now(), published_at timestamptz, withdrawn_at timestamptz,
  check ((scope_kind='shop' and shop_id is not null and area_id is null) or (scope_kind='area' and area_id is not null and shop_id is null)),
  check ((publication_state='published') = (moderation_state='approved'))
);
create table private.community_reactions_v11 (
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'), value text not null check (value in ('like','dislike')),
  expires_at timestamptz not null, updated_at timestamptz not null default now(), primary key(post_id,browser_tag_hash)
);
create table private.community_idempotency_v11 (
  operation text not null check (operation in ('correction','post')), scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'), entity_id uuid not null, created_at timestamptz not null default now(),
  primary key(operation,scope_hash,key_hash)
);
alter table private.store_correction_requests_v11 enable row level security;
alter table private.community_posts_v11 enable row level security;
alter table private.community_reactions_v11 enable row level security;
alter table private.community_idempotency_v11 enable row level security;

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text)
returns table(request_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id; return; end if;
 if not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('correction',p_scope_hash,p_idempotency_hash,v_id);
 return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='post' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id; return; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) then raise exception 'invalid community post' using errcode='22023'; end if;
 if p_scope_kind='shop' and not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_scope_kind='area' and not exists(select 1 from app.areas area where area.id=p_area_id and area.is_published) then raise exception 'area is unavailable' using errcode='P0002'; end if;
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('post',p_scope_hash,p_idempotency_hash,v_id);
 return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id;
end $$;

create function private.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
begin
 update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.id=p_post_id and post.receipt_hash=p_receipt_hash and post.revision=p_expected_revision and post.publication_state<>'withdrawn';
 if not found then raise exception 'community post changed' using errcode='40001'; end if; return 'withdrawn';
end $$;

create function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published' and ((p_shop_id is not null and post.shop_id=p_shop_id) or (p_area_id is not null and post.area_id=p_area_id))
 group by post.id order by post.published_at desc limit 30
$$;

create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id where request.state in ('received','reviewing') order by request.created_at $$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.revision,post.created_at from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id where post.moderation_state='pending' and post.publication_state='draft' order by post.created_at $$;
create function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'correction changed' using errcode='40001'; end if; return p_state; end $$;
create function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'community post changed' using errcode='40001'; end if; return p_decision; end $$;

create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash) $$;
create function api.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_community_post_v11(p_post_id,p_receipt_hash,p_expected_revision) $$;
create function api.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer) returns table(like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.react_to_community_post_v11(p_post_id,p_browser_tag_hash,p_value,p_expected_revision) $$;
create function api.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null) returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_public_community_posts_v11(p_shop_id,p_area_id,p_browser_tag_hash) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;
create function api.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_store_correction_v11(p_request_id,p_state,p_reason,p_expected_revision) $$;
create function api.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_community_post_v11(p_post_id,p_decision,p_reason,p_expected_revision) $$;
revoke all on table private.store_correction_requests_v11,private.community_posts_v11,private.community_reactions_v11,private.community_idempotency_v11 from public,anon,authenticated;
revoke all on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations
  (version, statements, name, created_by, idempotency_key, rollback)
values
  ('20261017150000', array[$eskomi_packet_01_7$-- Private corrections and manually moderated community posts.  They never
-- participate in ratings, review counts, offers, or ranking inputs.

create table private.store_correction_requests_v11 (
  id uuid primary key default gen_random_uuid(), shop_id uuid not null references app.shops(id) on delete restrict,
  field_key text not null check (field_key in ('name','category','price','hours','access','official_url','image','other')),
  proposed_value text not null check (char_length(btrim(proposed_value)) between 1 and 1000),
  source_url text check (source_url is null or (char_length(source_url)<=2048 and source_url ~ '^https://')),
  state text not null default 'received' check (state in ('received','reviewing','applied','closed')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table private.community_posts_v11 (
  id uuid primary key default gen_random_uuid(), scope_kind text not null check (scope_kind in ('shop','area')),
  shop_id uuid references app.shops(id) on delete restrict, area_id uuid references app.areas(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 400 and body !~ E'[\\n\\r]{3,}'),
  revision integer not null default 1 check (revision>0), moderation_state text not null default 'pending' check (moderation_state in ('pending','approved','rejected')),
  publication_state text not null default 'draft' check (publication_state in ('draft','published','withdrawn')),
  operator_reason text not null default '' check (char_length(operator_reason)<=1000), receipt_hash text not null unique check (receipt_hash ~ '^[0-9a-f]{64}$'),
  ip_risk_tag text not null check (ip_risk_tag ~ '^[0-9a-f]{64}$'), ip_risk_expires_at timestamptz not null,
  created_at timestamptz not null default now(), published_at timestamptz, withdrawn_at timestamptz,
  check ((scope_kind='shop' and shop_id is not null and area_id is null) or (scope_kind='area' and area_id is not null and shop_id is null)),
  check ((publication_state='published') = (moderation_state='approved'))
);
create table private.community_reactions_v11 (
  post_id uuid not null references private.community_posts_v11(id) on delete restrict,
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'), value text not null check (value in ('like','dislike')),
  expires_at timestamptz not null, updated_at timestamptz not null default now(), primary key(post_id,browser_tag_hash)
);
create table private.community_idempotency_v11 (
  operation text not null check (operation in ('correction','post')), scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'), entity_id uuid not null, created_at timestamptz not null default now(),
  primary key(operation,scope_hash,key_hash)
);
alter table private.store_correction_requests_v11 enable row level security;
alter table private.community_posts_v11 enable row level security;
alter table private.community_reactions_v11 enable row level security;
alter table private.community_idempotency_v11 enable row level security;

create function private.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text)
returns table(request_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid correction credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='correction' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id; return; end if;
 if not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_field_key not in ('name','category','price','hours','access','official_url','image','other') or char_length(btrim(coalesce(p_proposed_value,''))) not between 1 and 1000 or (p_source_url is not null and (char_length(p_source_url)>2048 or p_source_url !~ '^https://')) then raise exception 'invalid correction' using errcode='22023'; end if;
 insert into private.store_correction_requests_v11(shop_id,field_key,proposed_value,source_url) values(p_shop_id,p_field_key,btrim(p_proposed_value),nullif(btrim(p_source_url),'')) returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('correction',p_scope_hash,p_idempotency_hash,v_id);
 return query select correction.id,correction.revision,correction.state from private.store_correction_requests_v11 correction where correction.id=v_id;
end $$;

create function private.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text)
returns table(post_id uuid,revision integer,state text) language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_id uuid;
begin
 if p_receipt_hash !~ '^[0-9a-f]{64}$' or p_ip_risk_tag !~ '^[0-9a-f]{64}$' or p_scope_hash !~ '^[0-9a-f]{64}$' or p_idempotency_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid community credential' using errcode='22023'; end if;
 select entity_id into v_id from private.community_idempotency_v11 where operation='post' and scope_hash=p_scope_hash and key_hash=p_idempotency_hash for update;
 if found then return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id; return; end if;
 if char_length(btrim(coalesce(p_body,''))) not between 1 and 400 or (p_scope_kind='shop' and (p_shop_id is null or p_area_id is not null)) or (p_scope_kind='area' and (p_area_id is null or p_shop_id is not null)) then raise exception 'invalid community post' using errcode='22023'; end if;
 if p_scope_kind='shop' and not exists(select 1 from app.shops shop where shop.id=p_shop_id and shop.publication_status='published') then raise exception 'shop is unavailable' using errcode='P0002'; end if;
 if p_scope_kind='area' and not exists(select 1 from app.areas area where area.id=p_area_id and area.is_published) then raise exception 'area is unavailable' using errcode='P0002'; end if;
 insert into private.community_posts_v11(scope_kind,shop_id,area_id,body,receipt_hash,ip_risk_tag,ip_risk_expires_at) values(p_scope_kind,p_shop_id,p_area_id,btrim(p_body),p_receipt_hash,p_ip_risk_tag,now()+interval '7 days') returning id into v_id;
 insert into private.community_idempotency_v11(operation,scope_hash,key_hash,entity_id) values('post',p_scope_hash,p_idempotency_hash,v_id);
 return query select post.id,post.revision,post.moderation_state from private.community_posts_v11 post where post.id=v_id;
end $$;

create function private.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$
begin
 update private.community_posts_v11 post set publication_state='withdrawn',moderation_state=case when post.moderation_state='approved' then 'rejected' else post.moderation_state end,withdrawn_at=now(),revision=post.revision+1
  where post.id=p_post_id and post.receipt_hash=p_receipt_hash and post.revision=p_expected_revision and post.publication_state<>'withdrawn';
 if not found then raise exception 'community post changed' using errcode='40001'; end if; return 'withdrawn';
end $$;

create function private.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer)
returns table(like_count bigint,dislike_count bigint,my_value text) language plpgsql security definer set search_path=private,pg_temp as $$
declare v_revision integer;
begin
 select post.revision into v_revision from private.community_posts_v11 post where post.id=p_post_id and post.moderation_state='approved' and post.publication_state='published' for key share;
 if not found or p_expected_revision<>v_revision or p_browser_tag_hash !~ '^[0-9a-f]{64}$' or p_value not in ('like','dislike','') then raise exception 'community post changed' using errcode='40001'; end if;
 if p_value='' then delete from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.browser_tag_hash=p_browser_tag_hash;
 else insert into private.community_reactions_v11(post_id,browser_tag_hash,value,expires_at) values(p_post_id,p_browser_tag_hash,p_value,now()+interval '14 days') on conflict(post_id,browser_tag_hash) do update set value=excluded.value,expires_at=excluded.expires_at,updated_at=now(); end if;
 return query select count(*) filter(where reaction.value='like'),count(*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash) from private.community_reactions_v11 reaction where reaction.post_id=p_post_id and reaction.expires_at>now();
end $$;

create function private.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null)
returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security definer set search_path=private,pg_temp as $$
 select post.id,post.body,post.revision,post.published_at,count(reaction.*) filter(where reaction.value='like'),count(reaction.*) filter(where reaction.value='dislike'),max(reaction.value) filter(where reaction.browser_tag_hash=p_browser_tag_hash)
 from private.community_posts_v11 post left join private.community_reactions_v11 reaction on reaction.post_id=post.id and reaction.expires_at>now()
 where post.moderation_state='approved' and post.publication_state='published' and ((p_shop_id is not null and post.shop_id=p_shop_id) or (p_area_id is not null and post.area_id=p_area_id))
 group by post.id order by post.published_at desc limit 30
$$;

create function private.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select request.id,shop.name,request.field_key,request.proposed_value,request.source_url,request.state,request.revision,request.created_at from private.store_correction_requests_v11 request join app.shops shop on shop.id=request.shop_id where request.state in ('received','reviewing') order by request.created_at $$;
create function private.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security definer set search_path=private,app,pg_temp as $$ select post.id,post.scope_kind,coalesce(shop.name,area.name),post.body,post.moderation_state,post.revision,post.created_at from private.community_posts_v11 post left join app.shops shop on shop.id=post.shop_id left join app.areas area on area.id=post.area_id where post.moderation_state='pending' and post.publication_state='draft' order by post.created_at $$;
create function private.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.store_correction_requests_v11 request set state=p_state,operator_reason=btrim(p_reason),revision=request.revision+1,resolved_at=case when p_state in ('applied','closed') then now() else null end where request.id=p_request_id and request.revision=p_expected_revision and p_state in ('reviewing','applied','closed') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'correction changed' using errcode='40001'; end if; return p_state; end $$;
create function private.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language plpgsql security definer set search_path=private,pg_temp as $$ begin update private.community_posts_v11 post set moderation_state=case when p_decision='approved' then 'approved' else 'rejected' end,publication_state=case when p_decision='approved' then 'published' else 'draft' end,published_at=case when p_decision='approved' then now() else null end,operator_reason=btrim(p_reason),revision=post.revision+1 where post.id=p_post_id and post.revision=p_expected_revision and post.moderation_state='pending' and post.publication_state='draft' and p_decision in ('approved','rejected') and char_length(btrim(coalesce(p_reason,'')))<=1000; if not found then raise exception 'community post changed' using errcode='40001'; end if; return p_decision; end $$;

create function api.submit_store_correction_v11(p_shop_id uuid,p_field_key text,p_proposed_value text,p_source_url text,p_scope_hash text,p_idempotency_hash text) returns table(request_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_store_correction_v11(p_shop_id,p_field_key,p_proposed_value,p_source_url,p_scope_hash,p_idempotency_hash) $$;
create function api.submit_community_post_v11(p_scope_kind text,p_shop_id uuid,p_area_id uuid,p_body text,p_receipt_hash text,p_ip_risk_tag text,p_scope_hash text,p_idempotency_hash text) returns table(post_id uuid,revision integer,state text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.submit_community_post_v11(p_scope_kind,p_shop_id,p_area_id,p_body,p_receipt_hash,p_ip_risk_tag,p_scope_hash,p_idempotency_hash) $$;
create function api.withdraw_community_post_v11(p_post_id uuid,p_receipt_hash text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.withdraw_community_post_v11(p_post_id,p_receipt_hash,p_expected_revision) $$;
create function api.react_to_community_post_v11(p_post_id uuid,p_browser_tag_hash text,p_value text,p_expected_revision integer) returns table(like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.react_to_community_post_v11(p_post_id,p_browser_tag_hash,p_value,p_expected_revision) $$;
create function api.list_public_community_posts_v11(p_shop_id uuid,p_area_id uuid,p_browser_tag_hash text default null) returns table(post_id uuid,body text,revision integer,published_at timestamptz,like_count bigint,dislike_count bigint,my_value text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_public_community_posts_v11(p_shop_id,p_area_id,p_browser_tag_hash) $$;
create function api.list_operator_corrections_v11() returns table(request_id uuid,shop_name text,field_key text,proposed_value text,source_url text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_corrections_v11() $$;
create function api.list_operator_community_posts_v11() returns table(post_id uuid,scope_kind text,target_name text,body text,state text,revision integer,created_at timestamptz) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.list_operator_community_posts_v11() $$;
create function api.moderate_store_correction_v11(p_request_id uuid,p_state text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_store_correction_v11(p_request_id,p_state,p_reason,p_expected_revision) $$;
create function api.moderate_community_post_v11(p_post_id uuid,p_decision text,p_reason text,p_expected_revision integer) returns text language sql security invoker set search_path=private,api,pg_temp as $$ select private.moderate_community_post_v11(p_post_id,p_decision,p_reason,p_expected_revision) $$;
revoke all on table private.store_correction_requests_v11,private.community_posts_v11,private.community_reactions_v11,private.community_idempotency_v11 from public,anon,authenticated;
revoke all on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function api.submit_store_correction_v11(uuid,text,text,text,text,text),api.submit_community_post_v11(text,uuid,uuid,text,text,text,text,text),api.withdraw_community_post_v11(uuid,text,integer),api.react_to_community_post_v11(uuid,text,text,integer),api.list_public_community_posts_v11(uuid,uuid,text),api.list_operator_corrections_v11(),api.list_operator_community_posts_v11(),api.moderate_store_correction_v11(uuid,text,text,integer),api.moderate_community_post_v11(uuid,text,text,integer) to service_role;
notify pgrst,'reload schema';
$eskomi_packet_01_7$], 'eskomi_corrections_and_community', null, null, null);
commit;

select jsonb_build_object(
  'status', 'COMMITTED',
  'project_ref_expected', 'goeagrxjsjcbbatpotbu',
  'stage', '01',
  'records', (
    select jsonb_agg(jsonb_build_object(
      'version', expected.version,
      'name', expected.name,
      'source_sha256', encode(extensions.digest(ledger.statements[1], 'sha256'), 'hex')
    ) order by expected.version)
    from (values ('20261017144000', 'eskomi_partner_therapist_history_and_membership', 'f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f'), ('20261017145000', 'eskomi_partner_photo_membership_guard', 'f41242ef3fe79188e4256e77ae5b9e01676cffe1411423bb399920ab6802f6de'), ('20261017146000', 'eskomi_moderation_and_membership_race_fix', '4b51333970488a1837e19d2923cd170c6307fe72d1bcb745e71e9e8f69734a0f'), ('20261017147000', 'eskomi_v11_operations_and_receipts', '8cbd3f41016329961871e23d98f974956a85aa7001fd2162694f54f8079b17d0'), ('20261017148000', 'eskomi_v11_guest_edits_and_widget', '91877f85d3ebc4756f7f4e18f2a8d4ffa3293a8a291874d4a92dcff155fb6b4e'), ('20261017149000', 'eskomi_v11_rpc_contract_and_upgrade_fix', 'ccb5a4ff3282f95676e43d8527ad5aefbedb411ecb298d29c35bc8d98f01fdc6'), ('20261017150000', 'eskomi_corrections_and_community', '912fa31aaff18e28c695f43199550034cbbd59bc57a15debd810234e2ed3498d')) as expected(version, name, source_sha256)
    join supabase_migrations.schema_migrations as ledger using (version)
  )
) as stage_result;
