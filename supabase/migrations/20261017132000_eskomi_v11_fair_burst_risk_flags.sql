-- A five-request threshold is a per-guest-session double-click guard only.
-- Shared IP signals remain a high-threshold, operator-only neutral flag and
-- never reject, publish, revoke, or change benefit eligibility by themselves.
create table private.review_submission_risk_flags (
  id bigint generated always as identity primary key,
  scope_hash text not null check (scope_hash ~ '^[0-9a-f]{64}$'),
  reason_code text not null check (reason_code = 'ip_entry_burst'),
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index review_submission_risk_flags_expiry_idx on private.review_submission_risk_flags(expires_at);
alter table private.review_submission_risk_flags enable row level security;
revoke all on table private.review_submission_risk_flags from public, anon, authenticated;
grant select, insert on table private.review_submission_risk_flags to service_role;

create or replace function private.record_review_ip_burst_signal(p_ip_entry_hash text, p_idempotency_hash text)
returns boolean language plpgsql security definer set search_path = private, pg_temp as $$
declare v_allowed boolean;
begin
  select allowed into v_allowed from private.claim_review_entry_rate_limit(p_ip_entry_hash, p_idempotency_hash, 100);
  if not v_allowed then
    insert into private.review_submission_risk_flags(scope_hash, reason_code) values (p_ip_entry_hash, 'ip_entry_burst');
  end if;
  return not v_allowed;
end;
$$;
create or replace function api.record_review_ip_burst_signal(text, text) returns boolean
language sql security invoker set search_path = private, api, pg_temp as $$ select private.record_review_ip_burst_signal($1, $2) $$;
revoke all on function private.record_review_ip_burst_signal(text,text), api.record_review_ip_burst_signal(text,text) from public, anon, authenticated;
grant execute on function private.record_review_ip_burst_signal(text,text), api.record_review_ip_burst_signal(text,text) to service_role;
notify pgrst, 'reload schema';
