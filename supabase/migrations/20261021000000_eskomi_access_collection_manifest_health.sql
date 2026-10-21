-- A collector may mark a past access-report day complete only after it has
-- recorded an independently checkable manifest.  This stores aggregate check
-- counts and a content hash, never visitor identifiers, request bodies, or IPs.

create table private.partner_shop_access_collection_manifests_v11 (
  observed_on date primary key,
  collector_label text not null check (collector_label ~ '^[a-z0-9][a-z0-9_-]{2,63}$'),
  required_check_count smallint not null check (required_check_count between 1 and 16),
  passed_check_count smallint not null check (passed_check_count between 0 and 16 and passed_check_count<=required_check_count),
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  collection_state text not null check (collection_state in ('complete','partial')),
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.partner_shop_access_collection_manifests_v11 enable row level security;
revoke all on table private.partner_shop_access_collection_manifests_v11 from public,anon,authenticated;
grant select,insert,update,delete on table private.partner_shop_access_collection_manifests_v11 to service_role;

-- Fail closed: a direct finalizer call can still record a partial day, but it
-- cannot manufacture a complete day without the matching health manifest.
create or replace function private.finalize_partner_shop_access_collection_day_v11(p_observed_on date,p_collection_state text)
returns integer language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_changed integer;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collection_state not in ('complete','partial') then raise exception 'invalid collection finalization' using errcode='22023'; end if;
  if p_collection_state='complete' and not exists(
    select 1 from private.partner_shop_access_collection_manifests_v11 manifest
    where manifest.observed_on=p_observed_on and manifest.collection_state='complete'
  ) then raise exception 'complete collection requires a health manifest' using errcode='22023'; end if;
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

create function private.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language plpgsql security definer set search_path=private,app,pg_temp as $$
declare v_state text;
begin
  if p_observed_on is null or p_observed_on >= (now() at time zone 'Asia/Tokyo')::date
    or p_collector_label !~ '^[a-z0-9][a-z0-9_-]{2,63}$'
    or p_required_check_count not between 1 and 16
    or p_passed_check_count not between 0 and p_required_check_count
    or p_manifest_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid collection manifest' using errcode='22023'; end if;
  v_state:=case when p_passed_check_count=p_required_check_count then 'complete' else 'partial' end;
  insert into private.partner_shop_access_collection_manifests_v11(
    observed_on,collector_label,required_check_count,passed_check_count,manifest_hash,collection_state,checked_at,updated_at
  ) values (
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash,v_state,now(),now()
  ) on conflict(observed_on) do update set
    collector_label=excluded.collector_label,required_check_count=excluded.required_check_count,
    passed_check_count=excluded.passed_check_count,manifest_hash=excluded.manifest_hash,
    collection_state=excluded.collection_state,checked_at=excluded.checked_at,updated_at=excluded.updated_at;
  perform private.finalize_partner_shop_access_collection_day_v11(p_observed_on,v_state);
  return v_state;
end $$;

create function api.record_partner_shop_access_collection_manifest_v11(
  p_observed_on date,
  p_collector_label text,
  p_required_check_count smallint,
  p_passed_check_count smallint,
  p_manifest_hash text
) returns text language sql security invoker set search_path=private,api,pg_temp as $$
  select private.record_partner_shop_access_collection_manifest_v11(
    p_observed_on,p_collector_label,p_required_check_count,p_passed_check_count,p_manifest_hash
  )
$$;

revoke all on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) from public,anon,authenticated;
grant execute on function private.finalize_partner_shop_access_collection_day_v11(date,text),api.finalize_partner_shop_access_collection_day_v11(date,text),private.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text),api.record_partner_shop_access_collection_manifest_v11(date,text,smallint,smallint,text) to service_role;
notify pgrst,'reload schema';
