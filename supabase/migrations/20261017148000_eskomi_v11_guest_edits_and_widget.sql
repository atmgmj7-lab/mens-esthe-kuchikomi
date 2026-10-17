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
