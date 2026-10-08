-- Mrs.Rank UP local verification: Supabase is the management source of truth
-- for the existing WP 768 identity. Nothing in this migration exposes a new
-- browser API or changes the public WordPress reader.

create or replace function private.is_partner_shop_fact_payload(p_facts jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(p_facts) = 'object'
    and (select count(*) from jsonb_object_keys(p_facts)) = 10
    and p_facts ?& array[
      'official_url', 'basic_price', 'shop_hours', 'shop_address', 'shop_tel',
      'shop_line', 'shop_booking', 'shop_holiday', 'price_90', 'shop_booking_url'
    ]
    and (
      jsonb_typeof(p_facts -> 'official_url') = 'null'
      or (jsonb_typeof(p_facts -> 'official_url') = 'string' and btrim(p_facts ->> 'official_url') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'basic_price') = 'null'
      or (jsonb_typeof(p_facts -> 'basic_price') = 'string' and (p_facts ->> 'basic_price') ~ '^[1-9][0-9]{0,6}$')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_hours') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_hours') = 'string' and btrim(p_facts ->> 'shop_hours') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_address') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_address') = 'string' and btrim(p_facts ->> 'shop_address') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_tel') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_tel') = 'string' and btrim(p_facts ->> 'shop_tel') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_line') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_line') = 'string' and btrim(p_facts ->> 'shop_line') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_booking') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_booking') = 'string' and btrim(p_facts ->> 'shop_booking') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_holiday') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_holiday') = 'string' and btrim(p_facts ->> 'shop_holiday') <> '')
    )
    and (
      jsonb_typeof(p_facts -> 'price_90') = 'null'
      or (jsonb_typeof(p_facts -> 'price_90') = 'string' and (p_facts ->> 'price_90') ~ '^[1-9][0-9]{0,6}$')
    )
    and (
      jsonb_typeof(p_facts -> 'shop_booking_url') = 'null'
      or (jsonb_typeof(p_facts -> 'shop_booking_url') = 'string' and btrim(p_facts ->> 'shop_booking_url') <> '')
    )
$$;

create or replace function private.is_partner_shop_fact_update(p_updates jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select jsonb_typeof(p_updates) = 'object'
    and (select count(*) from jsonb_object_keys(p_updates)) between 1 and 10
    and not exists (
      select 1
      from jsonb_object_keys(p_updates) as key
      where key not in (
        'official_url', 'basic_price', 'shop_hours', 'shop_address', 'shop_tel',
        'shop_line', 'shop_booking', 'shop_holiday', 'price_90', 'shop_booking_url'
      )
    )
    and not exists (
      select 1
      from jsonb_each(p_updates) as value(key, item)
      where jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = ''
    )
    and coalesce(p_updates ->> 'basic_price', '1') ~ '^[1-9][0-9]{0,6}$'
    and coalesce(p_updates ->> 'price_90', '1') ~ '^[1-9][0-9]{0,6}$'
$$;

create table private.partner_shop_fact_snapshots (
  wp_shop_id bigint primary key references app.shops(wp_post_id) on delete restrict,
  shop_slug text not null check (char_length(btrim(shop_slug)) between 1 and 200),
  facts jsonb not null check (private.is_partner_shop_fact_payload(facts)),
  revision bigint not null default 1 check (revision > 0),
  imported_at timestamptz not null default now(),
  imported_by text not null check (char_length(btrim(imported_by)) between 1 and 120),
  updated_at timestamptz not null default now(),
  updated_by text not null check (char_length(btrim(updated_by)) between 1 and 120)
);

create table private.partner_shop_fact_audits (
  id bigint generated always as identity primary key,
  wp_shop_id bigint not null references private.partner_shop_fact_snapshots(wp_shop_id) on delete restrict,
  event_type text not null check (event_type in ('imported', 'saved')),
  expected_revision bigint,
  revision bigint not null check (revision > 0),
  before_facts jsonb,
  after_facts jsonb not null check (private.is_partner_shop_fact_payload(after_facts)),
  actor_label text not null check (char_length(btrim(actor_label)) between 1 and 120),
  created_at timestamptz not null default now()
);

create index partner_shop_fact_audits_shop_created_idx
  on private.partner_shop_fact_audits (wp_shop_id, created_at, id);

alter table private.partner_shop_fact_snapshots enable row level security;
alter table private.partner_shop_fact_audits enable row level security;

revoke all on table private.partner_shop_fact_snapshots from public, anon, authenticated, service_role;
revoke all on table private.partner_shop_fact_audits from public, anon, authenticated, service_role;
revoke all on sequence private.partner_shop_fact_audits_id_seq from public, anon, authenticated, service_role;

create or replace function private.get_partner_shop_fact_snapshot(p_wp_shop_id bigint)
returns table (
  wp_shop_id bigint,
  shop_slug text,
  facts jsonb,
  revision bigint,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select s.wp_shop_id, s.shop_slug, s.facts, s.revision, s.updated_at
  from private.partner_shop_fact_snapshots s
  where s.wp_shop_id = p_wp_shop_id
$$;

create or replace function private.import_partner_shop_fact_snapshot(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_facts jsonb,
  p_actor_label text
)
returns table (
  state text,
  wp_shop_id bigint,
  shop_slug text,
  facts jsonb,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_shop app.shops%rowtype;
  v_workspace private.partner_workspaces%rowtype;
  v_snapshot private.partner_shop_fact_snapshots%rowtype;
begin
  if p_wp_shop_id <> 768 then
    raise exception using errcode = '22023', message = 'only the approved Mrs.Rank UP verification shop is supported';
  end if;
  if p_shop_slug is null or char_length(btrim(p_shop_slug)) not between 1 and 200
    or p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or not private.is_partner_shop_fact_payload(p_facts) then
    raise exception using errcode = '22023', message = 'partner shop fact import payload is invalid';
  end if;

  select * into v_shop from app.shops where app.shops.wp_post_id = p_wp_shop_id for key share;
  if v_shop.id is null or v_shop.slug <> btrim(p_shop_slug) then
    raise exception using errcode = '22023', message = 'canonical app shop identity is required';
  end if;
  select * into v_workspace from private.partner_workspaces
    where private.partner_workspaces.wp_shop_id = p_wp_shop_id for key share;
  if v_workspace.id is null or v_workspace.shop_slug <> v_shop.slug
    or v_workspace.state not in ('free_official_partner', 'active_partner') then
    raise exception using errcode = '22023', message = 'active partner workspace is required';
  end if;

  insert into private.partner_shop_fact_snapshots (
    wp_shop_id, shop_slug, facts, imported_by, updated_by
  ) values (
    p_wp_shop_id, v_shop.slug, p_facts, btrim(p_actor_label), btrim(p_actor_label)
  ) on conflict (wp_shop_id) do nothing
  returning * into v_snapshot;

  if v_snapshot.wp_shop_id is null then
    select * into v_snapshot from private.partner_shop_fact_snapshots
      where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id for key share;
    if v_snapshot.shop_slug <> v_shop.slug then
      raise exception using errcode = '22023', message = 'stored partner shop identity conflicts with canonical app shop';
    end if;
    return query select 'existing'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;

  insert into private.partner_shop_fact_audits (
    wp_shop_id, event_type, expected_revision, revision, before_facts, after_facts, actor_label
  ) values (
    v_snapshot.wp_shop_id, 'imported', null, v_snapshot.revision, null, v_snapshot.facts, btrim(p_actor_label)
  );
  return query select 'imported'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
    v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
end;
$$;

create or replace function private.save_partner_shop_fact_snapshot(
  p_wp_shop_id bigint,
  p_expected_revision bigint,
  p_updates jsonb,
  p_actor_label text
)
returns table (
  state text,
  wp_shop_id bigint,
  shop_slug text,
  facts jsonb,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_snapshot private.partner_shop_fact_snapshots%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_now timestamptz := now();
begin
  if p_wp_shop_id <> 768 or p_expected_revision is null or p_expected_revision < 1
    or p_actor_label is null or char_length(btrim(p_actor_label)) not between 1 and 120
    or not private.is_partner_shop_fact_update(p_updates) then
    raise exception using errcode = '22023', message = 'partner shop fact save payload is invalid';
  end if;

  select * into v_snapshot from private.partner_shop_fact_snapshots
  where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id for update;
  if v_snapshot.wp_shop_id is null then
    raise exception using errcode = '22023', message = 'partner shop fact snapshot has not been imported';
  end if;
  if v_snapshot.revision <> p_expected_revision then
    return query select 'conflict'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;
  v_before := v_snapshot.facts;
  v_after := v_before || p_updates;
  if v_after = v_before then
    return query select 'noop'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
      v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
    return;
  end if;
  if not private.is_partner_shop_fact_payload(v_after) then
    raise exception using errcode = '22023', message = 'partner shop fact result is invalid';
  end if;

  update private.partner_shop_fact_snapshots
  set facts = v_after,
      revision = revision + 1,
      updated_at = v_now,
      updated_by = btrim(p_actor_label)
  where private.partner_shop_fact_snapshots.wp_shop_id = p_wp_shop_id
  returning * into v_snapshot;
  insert into private.partner_shop_fact_audits (
    wp_shop_id, event_type, expected_revision, revision, before_facts, after_facts, actor_label
  ) values (
    v_snapshot.wp_shop_id, 'saved', p_expected_revision, v_snapshot.revision,
    v_before, v_snapshot.facts, btrim(p_actor_label)
  );
  return query select 'saved'::text, v_snapshot.wp_shop_id, v_snapshot.shop_slug,
    v_snapshot.facts, v_snapshot.revision, v_snapshot.updated_at;
end;
$$;

create or replace function api.get_partner_shop_fact_snapshot(p_wp_shop_id bigint)
returns table (wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.get_partner_shop_fact_snapshot(p_wp_shop_id)
$$;

create or replace function api.import_partner_shop_fact_snapshot(
  p_wp_shop_id bigint, p_shop_slug text, p_facts jsonb, p_actor_label text
)
returns table (state text, wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.import_partner_shop_fact_snapshot(p_wp_shop_id, p_shop_slug, p_facts, p_actor_label)
$$;

create or replace function api.save_partner_shop_fact_snapshot(
  p_wp_shop_id bigint, p_expected_revision bigint, p_updates jsonb, p_actor_label text
)
returns table (state text, wp_shop_id bigint, shop_slug text, facts jsonb, revision bigint, updated_at timestamptz)
language sql
security invoker
set search_path = pg_catalog
as $$
  select * from private.save_partner_shop_fact_snapshot(p_wp_shop_id, p_expected_revision, p_updates, p_actor_label)
$$;

revoke all on function private.get_partner_shop_fact_snapshot(bigint) from public, anon, authenticated;
revoke all on function private.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) from public, anon, authenticated;
revoke all on function private.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function private.get_partner_shop_fact_snapshot(bigint) to service_role;
grant execute on function private.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) to service_role;
grant execute on function private.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) to service_role;

revoke all on function api.get_partner_shop_fact_snapshot(bigint) from public, anon, authenticated;
revoke all on function api.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) from public, anon, authenticated;
revoke all on function api.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function api.get_partner_shop_fact_snapshot(bigint) to service_role;
grant execute on function api.import_partner_shop_fact_snapshot(bigint, text, jsonb, text) to service_role;
grant execute on function api.save_partner_shop_fact_snapshot(bigint, bigint, jsonb, text) to service_role;
