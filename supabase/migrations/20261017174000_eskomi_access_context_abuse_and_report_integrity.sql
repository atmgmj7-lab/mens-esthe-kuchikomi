-- Follow-up hardening for anonymous public-access measurement.  A signed
-- context proves that this server issued it, but it is not itself a complete
-- anti-abuse system.  Keep only short-lived HMAC scopes: never a raw IP.

create table private.partner_shop_access_context_issue_limits_v11 (
  shop_id uuid not null references app.shops(id) on delete restrict,
  observed_on date not null,
  scope_kind text not null check (scope_kind in ('session','network')),
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  issued_count smallint not null default 0 check (issued_count between 0 and 20),
  expires_at timestamptz not null,
  primary key(shop_id,observed_on,scope_kind,scope_hash)
);
create index partner_shop_access_context_issue_limits_expiry_v11 on private.partner_shop_access_context_issue_limits_v11(expires_at);
alter table private.partner_shop_access_context_issue_limits_v11 enable row level security;
revoke all on table private.partner_shop_access_context_issue_limits_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_context_issue_limits_v11 to service_role;

create function private.reserve_public_shop_access_context_v11(
  p_shop_slug text,
  p_session_scope_hash text,
  p_network_scope_hash text default null,
  p_is_new_session boolean default false
) returns void language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid; v_day date; v_reserved integer;
begin
  if p_shop_slug is null or p_shop_slug !~ '^[^/[:space:]\\]+$' or p_session_scope_hash !~ '^[0-9a-f]{64}$'
    or (p_network_scope_hash is not null and p_network_scope_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'invalid public access context' using errcode='22023';
  end if;
  select shop.id into v_shop_id from app.shops shop join private.managed_shops managed on managed.app_shop_id=shop.id
    where shop.slug=p_shop_slug and shop.publication_status='published' and managed.publication_state='published';
  if not found then raise exception 'shop unavailable' using errcode='P0002'; end if;
  v_day := (now() at time zone 'Asia/Tokyo')::date;

  -- This permits normal retries for a server-issued session, while bounding
  -- context minting before it can consume the shop-wide event ceiling.
  insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
    values(v_shop_id,v_day,'session',p_session_scope_hash,1,now()+interval '10 minutes')
    on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
      expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<8;
  get diagnostics v_reserved=row_count;
  if v_reserved=0 then raise exception 'access context session limit reached' using errcode='22023'; end if;

  -- Network scope is a coarse, trusted-proxy HMAC signal only.  It applies
  -- only while minting a new session, so a shared network cannot lock out an
  -- existing normal visitor.  At 20 new sessions per ten-minute window and
  -- two accepted events per session, this single-signal cap remains below the
  -- 10,000/day shop ceiling. It is not an identity or a complete bot defence.
  if p_is_new_session and p_network_scope_hash is not null then
    insert into private.partner_shop_access_context_issue_limits_v11(shop_id,observed_on,scope_kind,scope_hash,issued_count,expires_at)
      values(v_shop_id,v_day,'network',p_network_scope_hash,1,now()+interval '10 minutes')
      on conflict(shop_id,observed_on,scope_kind,scope_hash) do update set issued_count=case when private.partner_shop_access_context_issue_limits_v11.expires_at<=now() then 1 else private.partner_shop_access_context_issue_limits_v11.issued_count+1 end,
        expires_at=excluded.expires_at where private.partner_shop_access_context_issue_limits_v11.expires_at<=now() or private.partner_shop_access_context_issue_limits_v11.issued_count<20;
    get diagnostics v_reserved=row_count;
    if v_reserved=0 then raise exception 'access context network limit reached' using errcode='22023'; end if;
  end if;
end $$;
create function api.reserve_public_shop_access_context_v11(text,text,text,boolean)
returns void language sql security invoker set search_path=private,api,pg_temp as $$
  select private.reserve_public_shop_access_context_v11($1,$2,$3,$4)
$$;

drop function api.get_partner_shop_access_report_v11(uuid,uuid,date,date);
drop function private.get_partner_shop_access_report_v11(uuid,uuid,date,date);
create function private.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_shop_id uuid;
begin
  if p_from is null or p_to is null or p_from>p_to or p_to-p_from>179 then raise exception 'invalid report range' using errcode='22023'; end if;
  v_shop_id:=private.assert_partner_v11_read_membership(p_workspace_id,p_auth_user_id);
  if not exists(select 1 from private.partner_workspaces workspace join private.managed_shops managed on managed.app_shop_id=workspace.app_shop_id and managed.publication_state='published'
    where workspace.id=p_workspace_id and workspace.app_shop_id=v_shop_id) then raise exception 'partner shop is unavailable' using errcode='42501'; end if;
  return query select days.observed_on::date,coalesce(daily.shop_view_count,0),coalesce(daily.official_line_click_count,0),
      observation.collection_state='complete',daily.shop_id is not null,coalesce(observation.collection_state,'unknown'),greatest(daily.updated_at,observation.updated_at)
    from generate_series(p_from,p_to,interval '1 day') days(observed_on)
    left join private.partner_shop_access_daily_v11 daily on daily.shop_id=v_shop_id and daily.observed_on=days.observed_on::date
    left join private.partner_shop_access_observation_days_v11 observation on observation.shop_id=v_shop_id and observation.observed_on=days.observed_on::date
    order by days.observed_on;
end $$;
create function api.get_partner_shop_access_report_v11(p_workspace_id uuid,p_auth_user_id uuid,p_from date,p_to date)
returns table(observed_on date,shop_view_count bigint,official_line_click_count bigint,has_data boolean,has_recorded_data boolean,measurement_state text,updated_at timestamptz)
language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.get_partner_shop_access_report_v11(p_workspace_id,p_auth_user_id,p_from,p_to) $$;

-- Expiry is an intended upper bound, not a deletion guarantee: rows disappear
-- only after this finalizer/pruner succeeds.  A missing finalization run must
-- remain unknown in reports and be investigated operationally.
create or replace function private.prune_partner_shop_access_short_lived_v11(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=private,pg_temp as $$
declare v_deleted integer;
begin
  if p_now is null then raise exception 'invalid prune time' using errcode='22023'; end if;
  with removed_dedupe as (
    delete from private.partner_shop_access_dedupe_v11 where expires_at<=p_now returning 1
  ), removed_contexts as (
    delete from private.partner_shop_access_context_limits_v11 where expires_at<=p_now returning 1
  ), removed_issuance as (
    delete from private.partner_shop_access_context_issue_limits_v11 where expires_at<=p_now returning 1
  ) select (select count(*) from removed_dedupe)+(select count(*) from removed_contexts)+(select count(*) from removed_issuance) into v_deleted;
  return v_deleted;
end $$;

revoke all on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) from public,anon,authenticated;
grant execute on function private.reserve_public_shop_access_context_v11(text,text,text,boolean),api.reserve_public_shop_access_context_v11(text,text,text,boolean),private.get_partner_shop_access_report_v11(uuid,uuid,date,date),api.get_partner_shop_access_report_v11(uuid,uuid,date,date),private.prune_partner_shop_access_short_lived_v11(timestamptz) to service_role;
notify pgrst,'reload schema';
