-- Canonical Partner workspaces deliberately have app_shop_id and no WordPress
-- ID. Keep the existing legacy audit key while making exactly one identity
-- mandatory for every login-email audit event.
alter table private.partner_login_email_audit_events
  add column if not exists app_shop_id uuid references app.shops(id) on delete restrict;

alter table private.partner_login_email_audit_events
  alter column wp_shop_id drop not null;

alter table private.partner_login_email_audit_events
  drop constraint if exists partner_login_email_audit_events_identity_check;

alter table private.partner_login_email_audit_events
  add constraint partner_login_email_audit_events_identity_check
  check (num_nonnulls(wp_shop_id, app_shop_id) = 1);

create or replace function private.record_partner_login_email_change_request(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_email text
)
returns table (
  status text,
  workspace_id uuid,
  auth_user_id uuid,
  email text,
  intent text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = private, pg_temp
as $$
declare
  v_normalized_email text := lower(btrim(p_email));
  v_saved private.partner_login_email_intents%rowtype;
  v_wp_shop_id bigint;
  v_app_shop_id uuid;
begin
  if char_length(v_normalized_email) not between 3 and 254
    or v_normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid login email' using errcode = '22023';
  end if;

  select w.wp_shop_id, w.app_shop_id into v_wp_shop_id, v_app_shop_id
    from private.partner_memberships m
    join private.partner_workspaces w on w.id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = p_auth_user_id
      and m.status = 'active'
      and w.state in ('free_official_partner', 'active_partner')
    limit 1;
  if num_nonnulls(v_wp_shop_id, v_app_shop_id) <> 1 then
    raise exception 'active partner membership is required' using errcode = 'P0001';
  end if;

  insert into private.partner_login_email_intents (workspace_id, email, intent, updated_at)
  values (p_workspace_id, v_normalized_email, 'partner_change_requested', now())
  on conflict on constraint partner_login_email_intents_pkey do update
    set email = excluded.email, intent = excluded.intent, updated_at = excluded.updated_at
  returning * into v_saved;

  insert into private.partner_login_email_audit_events (
    workspace_id, wp_shop_id, app_shop_id, action, actor_kind, result
  ) values (p_workspace_id, v_wp_shop_id, v_app_shop_id, 'partner_change_requested', 'partner', 'recorded');

  return query select 'available'::text, p_workspace_id, p_auth_user_id,
    v_saved.email, v_saved.intent::text, v_saved.updated_at;
end;
$$;
