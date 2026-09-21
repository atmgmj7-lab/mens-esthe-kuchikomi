create table if not exists private.ai_review_assist_telemetry (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  estimated_cost_usd numeric(12,8) not null check (estimated_cost_usd >= 0),
  decision text not null check (decision in ('SAFE', 'REWRITE_SAFE', 'HUMAN_REVIEW', 'REJECT', 'UNAVAILABLE')),
  latency_ms integer not null check (latency_ms >= 0),
  mode text not null check (mode in ('standard', 'batch'))
);

create or replace function private.record_ai_review_assist_telemetry(
  p_occurred_at timestamptz, p_model text, p_input_tokens integer, p_output_tokens integer,
  p_estimated_cost_usd numeric, p_decision text, p_latency_ms integer, p_mode text
) returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
  if p_occurred_at is null or p_model is null or char_length(p_model) not between 1 and 120
    or p_input_tokens is null or p_input_tokens < 0 or p_output_tokens is null or p_output_tokens < 0
    or p_estimated_cost_usd is null or p_estimated_cost_usd < 0 or p_latency_ms is null or p_latency_ms < 0
    or p_decision not in ('SAFE', 'REWRITE_SAFE', 'HUMAN_REVIEW', 'REJECT', 'UNAVAILABLE')
    or p_mode not in ('standard', 'batch') then
    raise exception using errcode = '22023', message = 'AI review telemetry is invalid';
  end if;
  insert into private.ai_review_assist_telemetry (occurred_at, model, input_tokens, output_tokens, estimated_cost_usd, decision, latency_ms, mode)
  values (p_occurred_at, p_model, p_input_tokens, p_output_tokens, p_estimated_cost_usd, p_decision, p_latency_ms, p_mode);
end;
$$;

create or replace function api.record_ai_review_assist_telemetry(
  p_occurred_at timestamptz, p_model text, p_input_tokens integer, p_output_tokens integer,
  p_estimated_cost_usd numeric, p_decision text, p_latency_ms integer, p_mode text
) returns void language sql security invoker set search_path = pg_catalog as $$
  select private.record_ai_review_assist_telemetry(p_occurred_at, p_model, p_input_tokens, p_output_tokens, p_estimated_cost_usd, p_decision, p_latency_ms, p_mode)
$$;

revoke all on table private.ai_review_assist_telemetry from public, anon, authenticated;
revoke all on function private.record_ai_review_assist_telemetry(timestamptz, text, integer, integer, numeric, text, integer, text) from public, anon, authenticated;
grant execute on function private.record_ai_review_assist_telemetry(timestamptz, text, integer, integer, numeric, text, integer, text) to service_role;
revoke all on function api.record_ai_review_assist_telemetry(timestamptz, text, integer, integer, numeric, text, integer, text) from public, anon, authenticated;
grant execute on function api.record_ai_review_assist_telemetry(timestamptz, text, integer, integer, numeric, text, integer, text) to service_role;
