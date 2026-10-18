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
