-- Private workflow control-plane for Free Official Partner. Apply only through an
-- explicitly approved Supabase migration workflow; this repository change does not
-- write production data.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create type private.partner_workspace_state as enum (
  'normal_listing',
  'shop_confirmed',
  'free_official_partner',
  'active_partner'
);

create table private.partner_workspaces (
  id uuid primary key default gen_random_uuid(),
  wp_shop_id bigint not null unique check (wp_shop_id > 0),
  shop_slug text not null check (char_length(shop_slug) between 1 and 200),
  shop_name text not null check (char_length(shop_name) between 1 and 120),
  canonical_url text not null check (
    canonical_url = 'https://mens-esthe-kuchikomi.com/shops/' || shop_slug || '/'
  ),
  state private.partner_workspace_state not null default 'normal_listing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.partner_state_history (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  from_state private.partner_workspace_state,
  to_state private.partner_workspace_state not null,
  transition_source text not null check (
    transition_source in ('provisioning', 'self_registration', 'operator', 'approved_automation')
  ),
  actor_label text,
  reason text,
  created_at timestamptz not null default now()
);

create table private.partner_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.partner_workspaces(id) on delete restrict,
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  contact_role text not null check (
    contact_role in ('owner', 'manager', 'staff', 'authorized_agency')
  ),
  contact_email text not null check (char_length(contact_email) between 3 and 254),
  confirmation_details text not null check (char_length(confirmation_details) between 1 and 2000),
  source_url text not null check (char_length(source_url) between 1 and 2048),
  consent_terms boolean not null check (consent_terms),
  status text not null default 'received' check (status in ('received', 'under_review', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table private.partner_workspaces enable row level security;
alter table private.partner_state_history enable row level security;
alter table private.partner_registration_submissions enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema private to service_role;
grant usage, select on all sequences in schema private to service_role;
revoke update, delete on table private.partner_state_history from service_role;

create or replace function private.provision_partner_workspace(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_shop_name text,
  p_canonical_url text,
  p_source text default 'provisioning'
)
returns table (workspace_id uuid, state text, initialized boolean)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_workspace private.partner_workspaces%rowtype;
begin
  insert into private.partner_workspaces (wp_shop_id, shop_slug, shop_name, canonical_url)
  values (p_wp_shop_id, p_shop_slug, p_shop_name, p_canonical_url)
  on conflict (wp_shop_id) do nothing
  returning * into v_workspace;

  if v_workspace.id is null then
    update private.partner_workspaces
    set shop_slug = p_shop_slug,
        shop_name = p_shop_name,
        canonical_url = p_canonical_url,
        updated_at = now()
    where wp_shop_id = p_wp_shop_id
    returning * into v_workspace;
    return query select v_workspace.id, v_workspace.state::text, false;
    return;
  end if;

  insert into private.partner_state_history (
    workspace_id, from_state, to_state, transition_source, reason
  ) values (
    v_workspace.id, null, v_workspace.state, p_source, 'workspace initialized'
  );

  return query select v_workspace.id, v_workspace.state::text, true;
end;
$$;

create or replace function private.record_partner_registration(p_workspace_id uuid)
returns text
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_before private.partner_workspace_state;
  v_after private.partner_workspace_state;
begin
  select state into v_before
  from private.partner_workspaces
  where id = p_workspace_id
  for update;

  if v_before is null then
    raise exception 'partner workspace not found';
  end if;

  v_after := case when v_before = 'normal_listing' then 'shop_confirmed' else v_before end;
  if v_after <> v_before then
    update private.partner_workspaces set state = v_after, updated_at = now() where id = p_workspace_id;
    insert into private.partner_state_history (
      workspace_id, from_state, to_state, transition_source, reason
    ) values (
      p_workspace_id, v_before, v_after, 'self_registration', 'canonical shop registration received'
    );
  end if;

  return v_after::text;
end;
$$;

create or replace function private.set_partner_workspace_state(
  p_workspace_id uuid,
  p_next_state private.partner_workspace_state,
  p_actor_label text,
  p_reason text,
  p_source text default 'operator'
)
returns text
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_before private.partner_workspace_state;
begin
  select state into v_before from private.partner_workspaces where id = p_workspace_id for update;
  if v_before is null then
    raise exception 'partner workspace not found';
  end if;
  if v_before = p_next_state then
    return v_before::text;
  end if;
  if not (
    (v_before = 'normal_listing' and p_next_state = 'shop_confirmed')
    or (v_before = 'shop_confirmed' and p_next_state = 'free_official_partner')
    or (v_before = 'free_official_partner' and p_next_state = 'active_partner')
  ) then
    raise exception 'invalid partner state transition';
  end if;
  update private.partner_workspaces set state = p_next_state, updated_at = now() where id = p_workspace_id;
  insert into private.partner_state_history (
    workspace_id, from_state, to_state, transition_source, actor_label, reason
  ) values (p_workspace_id, v_before, p_next_state, p_source, p_actor_label, p_reason);
  return p_next_state::text;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- The API schema is only a service-role RPC transport. Partner tables and history
-- remain private; no browser role receives execute permission on these adapters.
create or replace function api.provision_partner_workspace(
  p_wp_shop_id bigint,
  p_shop_slug text,
  p_shop_name text,
  p_canonical_url text,
  p_source text default 'provisioning'
)
returns table (workspace_id uuid, state text, initialized boolean)
language sql
security invoker
set search_path = private, api, pg_temp
as $$
  select * from private.provision_partner_workspace(
    p_wp_shop_id, p_shop_slug, p_shop_name, p_canonical_url, p_source
  );
$$;

create or replace function api.register_partner_submission(
  p_workspace_id uuid,
  p_contact_name text,
  p_contact_role text,
  p_contact_email text,
  p_confirmation_details text,
  p_source_url text,
  p_consent_terms boolean
)
returns text
language plpgsql
security invoker
set search_path = private, api, pg_temp
as $$
begin
  insert into private.partner_registration_submissions (
    workspace_id, contact_name, contact_role, contact_email, confirmation_details, source_url, consent_terms
  ) values (
    p_workspace_id, p_contact_name, p_contact_role, p_contact_email,
    p_confirmation_details, p_source_url, p_consent_terms
  );
  return private.record_partner_registration(p_workspace_id);
end;
$$;

revoke all on function api.provision_partner_workspace(bigint, text, text, text, text) from public, anon, authenticated;
revoke all on function api.register_partner_submission(uuid, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function api.provision_partner_workspace(bigint, text, text, text, text) to service_role;
grant execute on function api.register_partner_submission(uuid, text, text, text, text, text, boolean) to service_role;
