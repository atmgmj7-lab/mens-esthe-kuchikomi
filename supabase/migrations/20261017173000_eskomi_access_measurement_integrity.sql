-- Measurement integrity follow-up.  An accepted client event is not proof
-- that every visitor was observed; only the scheduled collector health check
-- may close a past JST day as complete.  Anonymous context hashes are scoped
-- to one shop/day/event/session and are purged after their short lifetime.

alter table private.partner_shop_access_dedupe_v11 rename column browser_tag_hash to access_context_hash;
alter table private.partner_shop_access_dedupe_v11 drop constraint if exists partner_shop_access_dedupe_v11_browser_tag_hash_check;
alter table private.partner_shop_access_dedupe_v11 add constraint partner_shop_access_dedupe_v11_access_context_hash_check check (access_context_hash ~ '^[0-9a-f]{64}$');

create table private.partner_shop_access_context_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  session_scope_hash text not null check (session_scope_hash ~ '^[0-9a-f]{64}$'),
  accepted_event_count smallint not null default 0 check (accepted_event_count between 0 and 2),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,session_scope_hash)
);
create index partner_shop_access_context_limits_expiry_v11 on private.partner_shop_access_context_limits_v11(expires_at);

-- `observed` used to mean that at least one browser event arrived.  That is
-- not sufficient evidence for a zero.  Preserve its audit trail as partial.
update private.partner_shop_access_observation_days_v11 set collection_state='missing' where collection_state='observed';
alter table private.partner_shop_access_observation_days_v11 drop constraint partner_shop_access_observation_days_v11_collection_state_check;
alter table private.partner_shop_access_observation_days_v11 add constraint partner_shop_access_observation_days_v11_collection_state_check check (collection_state in ('complete','partial','missing'));
alter table private.partner_shop_access_observation_days_v11 alter column collection_state set default 'missing';

create table private.partner_shop_access_collection_runs_v11 (
  observed_on date primary key,
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_context_limits_v11 enable row level security;
alter table private.partner_shop_access_collection_runs_v11 enable row level security;
revoke all on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_limits_v11,private.partner_shop_access_collection_runs_v11 to service_role;

drop function api.record_public_shop_access_v11(text,text,text);
drop function private.record_public_shop_access_v11(text,text,text);
create function private.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_inserted integer; v_current bigint; v_context_inserted integer;
begin
  if p_event_kind not in ('shop_view','official_line_click') or p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$'
    or p_access_context_hash !~ '^[0-9a-f]{64}$' or p_session_scope_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid public access event' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;
  insert into private.partner_shop_access_daily_v11(shop_id,observed_on) values(v_shop_id,v_day) on conflict do nothing;
  select case when p_event_kind='shop_view' then shop_view_count else official_line_click_count end into v_current
    from private.partner_shop_access_daily_v11 where shop_id=v_shop_id and observed_on=v_day for update;
  if v_current >= 10000 then raise exception 'access event burst limit reached' using errcode='22023'; end if;
  insert into private.partner_shop_access_dedupe_v11(shop_id,observed_on,event_kind,access_context_hash,expires_at)
    values(v_shop_id,v_day,p_event_kind,p_access_context_hash,now()+interval '2 days') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return; end if;
  insert into private.partner_shop_access_context_limits_v11(shop_id,observed_on,session_scope_hash,accepted_event_count,expires_at)
    values(v_shop_id,v_day,p_session_scope_hash,1,now()+interval '2 days')
    on conflict(shop_id,observed_on,session_scope_hash) do update set accepted_event_count=private.partner_shop_access_context_limits_v11.accepted_event_count+1,
      expires_at=excluded.expires_at where private.partner_shop_access_context_limits_v11.accepted_event_count<2;
  get diagnostics v_context_inserted = row_count;
  if v_context_inserted=0 then
    delete from private.partner_shop_access_dedupe_v11 where shop_id=v_shop_id and observed_on=v_day and event_kind=p_event_kind and access_context_hash=p_access_context_hash;
    raise exception 'access context burst limit reached' using errcode='22023';
  end if;
  update private.partner_shop_access_daily_v11 set
    shop_view_count=shop_view_count + case when p_event_kind='shop_view' then 1 else 0 end,
    official_line_click_count=official_line_click_count + case when p_event_kind='official_line_click' then 1 else 0 end,
    updated_at=now() where shop_id=v_shop_id and observed_on=v_day;
  -- This is the first accepted telemetry event, not a proof that a zero day
  -- was fully measured.  The scheduled finalizer controls complete/partial.
  insert into private.partner_shop_access_rollup_state_v11(shop_id,first_observed_on) values(v_shop_id,v_day)
    on conflict(shop_id) do update set updated_at=now();
end $$;
create function api.record_public_shop_access_v11(p_shop_slug text,p_event_kind text,p_access_context_hash text,p_session_scope_hash text)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_public_shop_access_v11(p_shop_slug,p_event_kind,p_access_context_hash,p_session_scope_hash)
$$;

create function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts) into v_deleted;
  return v_deleted;
end $$;

create function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  perform private.prune_partner_shop_access_short_lived_v11(now());
  insert into private.partner_shop_access_collection_runs_v11(observed_on,collection_state,checked_at,updated_at)
    values(p_observed_on,p_collection_state,now(),now())
    on conflict(observed_on) do update set collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  insert into private.partner_shop_access_observation_days_v11(shop_id,observed_on,collection_state,updated_at)
  select state.shop_id,p_observed_on,p_collection_state,now()
  from private.partner_shop_access_rollup_state_v11 state
  join app.shops shop on shop.id=state.shop_id and shop.publication_status='published'
  join private.managed_shops managed on managed.app_shop_id=shop.id and managed.publication_state='published'
  where state.first_observed_on<=p_observed_on
  on conflict(shop_id,observed_on) do update set collection_state=excluded.collection_state,updated_at=excluded.updated_at;
  get diagnostics v_changed=row_count;
  return v_changed;
end $$;
create function api.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language sql security invoker set search_path=private,api,pg_temp as $$
  select private.finalize_partner_shop_access_collection_day_v11(p_observed_on,p_collection_state)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- A legacy appeal is only bound where the appealed action demonstrably
-- happened no later than the appeal itself.  Never infer a newer rejection.
with requires_manual_close as (
  update private.community_post_appeals_v11 appeal set target_post_revision=null,target_event_id=null,target_reason=null,state='reviewing',operator_reason='legacy appeal requires manual closure: moderation target time cannot be proven',revision=revision+1
  where appeal.state in ('received','reviewing') and appeal.target_post_revision is not null
    and not exists(select 1 from private.community_moderation_events_v11 event where event.id=appeal.target_event_id and event.created_at<=appeal.created_at)
  returning appeal.post_id
)
insert into private.community_moderation_events_v11(entity_kind,entity_id,action,reason,operator_actor,revision)
select 'community_post',post_id,'appeal_legacy_requires_review','legacy appeal target time cannot be proven','migration_20261017173000',post.revision
from requires_manual_close join private.community_posts_v11 post on post.id=requires_manual_close.post_id;

revoke all on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function private.record_public_shop_access_v11(text,text,text,text),api.record_public_shop_access_v11(text,text,text,text),private.prune_partner_shop_access_short_lived_v11(timestamptz),private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date) to service_role;
notify pgrst,'reload schema';
