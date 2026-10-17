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
