-- Follow-up hardening for the public therapist/profile and aggregate access
-- delivery added in 17171000.  This migration is deliberately additive: it
-- repairs already-applied projections rather than rewriting migration history.

create or replace function private.public_therapist_assignment_is_visible_v11(p_assignment_id uuid)
returns boolean language sql security definer set search_path=private,app,pg_temp as $$
  select exists(
    select 1
    from app.therapist_assignments assignment
    join app.shops shop on shop.id=assignment.shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
    join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
    where assignment.id=p_assignment_id and assignment.lifecycle_state='active'
      and assignment.photo_rights_confirmed_at is not null
      and (assignment.active_until is null or assignment.active_until > now())
  )
$$;

create or replace function private.list_public_therapists_for_shop_v11(p_shop_slug text,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,photo_asset_id uuid)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,asset.id
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id and shop.slug=p_shop_slug
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.active_from desc,assignment.id desc
  limit greatest(1,least(p_limit,50))
$$;

create or replace function private.get_public_therapist_profile_detail_v11(p_assignment_id uuid,p_limit integer default 20)
returns table(assignment_id uuid,display_name text,shop_slug text,shop_name text,shop_path text,official_line_url text,photo_asset_id uuid,review_handle uuid,rating smallint,body text,published_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.display_name,shop.slug,shop.name,shop.canonical_path,publication_shop.line_url,asset.id,
    publication.public_handle,nullif(revision.assessment_snapshot->>'therapistRating','')::smallint,revision.experience_comment,publication.published_at
  from app.therapist_assignments assignment
  join app.shops shop on shop.id=assignment.shop_id
  join private.managed_shops managed on managed.app_shop_id=shop.id
  left join private.managed_shop_publications publication_shop on publication_shop.managed_shop_id=managed.id
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  left join app.review_experience_publications publication on publication.therapist_assignment_id=assignment.id and publication.publication_state='published'
  left join private.review_experience_revisions revision on revision.id=publication.active_revision_id and revision.moderation_state='approved'
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by publication.published_at desc nulls last,publication.id desc nulls last
  limit greatest(1,least(p_limit,20))
$$;

create or replace function private.list_public_therapist_sitemap_v11()
returns table(assignment_id uuid,updated_at timestamptz)
language sql security definer set search_path=private,app,pg_temp as $$
  select assignment.id,assignment.updated_at
  from app.therapist_assignments assignment
  where private.public_therapist_assignment_is_visible_v11(assignment.id)
  order by assignment.id
$$;

create or replace function private.get_public_therapist_photo_v11(p_assignment_id uuid)
returns table(object_key text,content_type text)
language sql security definer set search_path=private,app,pg_temp as $$
  select asset.object_key,asset.content_type
  from app.therapist_assignments assignment
  join private.therapist_assignment_rights rights on rights.assignment_id=assignment.id
  join private.therapist_assets asset on asset.workspace_id=rights.workspace_id and asset.object_key=assignment.photo_asset_key
  where assignment.id=p_assignment_id and private.public_therapist_assignment_is_visible_v11(assignment.id)
$$;

create table private.partner_shop_access_observation_days_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  collection_state text not null default 'observed' check (collection_state in ('observed','missing')),
  updated_at timestamptz not null default now(),
  primary key(shop_id,observed_on)
);
create table private.partner_shop_access_dedupe_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  event_kind text not null check (event_kind in ('shop_view','official_line_click')),
  browser_tag_hash text not null check (browser_tag_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,event_kind,browser_tag_hash)
);
create index partner_shop_access_dedupe_expiry_v11 on private.partner_shop_access_dedupe_v11(expires_at);
alter table private.partner_shop_access_observation_days_v11 enable row level security;
alter table private.partner_shop_access_dedupe_v11 enable row level security;
revoke all on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_observation_days_v11,private.partner_shop_access_dedupe_v11 to service_role;

-- Existing event days are known observations.  The old first-observed marker
-- cannot prove a no-event day was collected, so those days intentionally stay
-- unknown rather than being displayed as zero.
insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
select shop_id,observed_on,'observed',updated_at from private.partner_shop_access_daily_v11
on conflict(shop_id,observed_on) do nothing;

drop function api.record_public_shop_access_v11(text,text);
drop function private.record_public_shop_access_v11(text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_browser_tag_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,browser_tag_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_browser_tag_hash,now()+interval '2 days')
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now()
    where shop_id=v_shop_id and observed_on=v_day;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
    values(v_shop_id,v_day,'observed')
    on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on)
    values(v_shop_id,v_day) on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_browser_tag_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_browser_tag_hash)
$$;

create function private.mark_partner_shop_access_observed_day_v11(p_observed_on date)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
begin
  if p_observed_on is null or p_observed_on > (now() at time zone 'Asia/Tokyo')::date then raise exception 'invalid observation day' using errcode='22023'; end if;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state)
  select shop.id,p_observed_on,'observed'
  from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
  where shop.publication_status='published' and managed.publication_state='published'
  on conflict(shop_id,observed_on) do update set collection_state='observed',updated_at=now();
end $$;

create or replace function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  perform private.assert_partner_therapist_membership(p_workspace_id,p_auth_user_id);
  select workspace.app_shop_id into v_shop_id from private.partner_workspaces workspace
    join app.shops shop on shop.id=workspace.app_shop_id and shop.publication_status='published'
    join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
    where workspace.id=p_workspace_id;
  if v_shop_id is null then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query
    select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='observed',
      greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;

-- Bind only legacy appeals whose currently active action is provably the exact
-- rejected/hidden state.  Others are retained for an auditable manual close;
-- no migration path guesses that a visitor withdrawal may be reopened.
with bindable as (
  select appeal.id,post.revision as target_post_revision,event.id as target_event_id,event.reason as target_reason
  from private.community_post_appeals_v11 appeal
  join private.community_posts_v11 post on post.id=appeal.post_id
  join lateral (
    select row.id,row.action,row.reason,row.revision from private.community_moderation_events_v11 row
    where row.entity_kind='community_post' and row.entity_id=post.id
    order by row.created_at desc,row.id desc limit 1
  ) event on true
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
    and event.revision=post.revision
    and ((event.action='rejected' and post.moderation_state='rejected' and post.publication_state='draft' and post.withdrawn_at is null)
      or (event.action='hidden' and post.moderation_state='rejected' and post.publication_state='withdrawn'))
)
update private.community_post_appeals_v11 appeal
set target_post_revision=bindable.target_post_revision,target_event_id=bindable.target_event_id,target_reason=bindable.target_reason
from bindable where appeal.id=bindable.id;

with requires_manual_close as (
  update private.community_post_appeals_v11 appeal
  set state='reviewing',operator_reason='legacy appeal requires manual closure: current moderation target cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is null
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target cannot be proven','migration_20261017172000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

create or replace function private.review_community_appeal_v11(p_appeal_id uuid,p_decision text,p_reason text,p_expected_revision integer)
returns text language plpgsql security definer set search_path=private,pg_temp as $$
declare v_appeal private.community_post_appeals_v11%rowtype; v_post_revision integer; v_event_revision integer;
begin
  select * into v_appeal from private.community_post_appeals_v11
    where id=p_appeal_id and revision=p_expected_revision and state in ('received','reviewing') for update;
  if not found or p_decision not in ('dismiss','reopen_review') or char_length(btrim(coalesce(p_reason,'')))>1000 then raise exception 'appeal changed' using errcode='40001'; end if;
  if p_decision='reopen_review' then
    if v_appeal.target_post_revision is null or v_appeal.target_event_id is null then raise exception 'appeal target requires manual closure' using errcode='40001'; end if;
    update private.community_posts_v11 post set moderation_state='pending',publication_state='draft',published_at=null,withdrawn_at=null,operator_reason=btrim(p_reason),revision=revision+1
      where post.id=v_appeal.post_id and post.revision=v_appeal.target_post_revision and post.moderation_state='rejected'
        and ((post.publication_state='draft' and post.withdrawn_at is null) or post.publication_state='withdrawn')
        and exists(select 1 from private.community_moderation_events_v11 event where event.id=v_appeal.target_event_id and event.entity_kind='community_post'
          and event.entity_id=post.id and event.action in ('hidden','rejected') and event.revision=post.revision and event.reason=v_appeal.target_reason)
      returning revision into v_post_revision;
    if not found then raise exception 'appeal target is stale' using errcode='40001'; end if;
  end if;
  update private.community_post_appeals_v11 set state=case when p_decision='dismiss' then 'dismissed' else 'resolved' end,
    operator_reason=btrim(p_reason),revision=revision+1,resolved_at=now() where id=p_appeal_id;
  select revision into v_event_revision from private.community_posts_v11 where id=v_appeal.post_id;
  insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
    values('community_post',v_appeal.post_id,'appeal_'||p_decision,btrim(p_reason),'dashboard_shared_operator',coalesce(v_post_revision,v_event_revision));
  return p_decision;
end $$;

revoke all on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) from public,anon,authenticated;
grant execute on function private.public_therapist_assignment_is_visible_v11(uuid),private.mark_partner_shop_access_observed_day_v11(date),private.record_public_shop_access_v11(text,text,text),api.record_public_shop_access_v11(text,text,text) to service_role;
notify pgrst,'reload schema';
