create table private.operation_secret_replays (
  operation_id uuid primary key references private.operation_idempotency(id) on delete restrict,
  ciphertext text not null check (char_length(ciphertext) between 1 and 4096),
  nonce text not null check (char_length(nonce) between 1 and 128),
  key_version text not null check (char_length(key_version) between 1 and 80),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.operation_secret_replays enable row level security;
revoke all on table private.operation_secret_replays from public, anon, authenticated;
grant select, insert, update, delete on table private.operation_secret_replays to service_role;

create or replace function private.store_review_secret_replay(p_session_hash text, p_idempotency_hash text, p_ciphertext text, p_nonce text, p_key_version text)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare v_operation private.operation_idempotency%rowtype;
begin
  select * into v_operation from private.operation_idempotency as operation where operation.operation='review_submit' and operation.actor_scope_hash=p_session_hash and operation.key_hash=p_idempotency_hash for update;
  if not found then raise exception 'review operation is unavailable' using errcode='P0002'; end if;
  insert into private.operation_secret_replays(operation_id,ciphertext,nonce,key_version,expires_at) values(v_operation.id,p_ciphertext,p_nonce,p_key_version,now()+interval '24 hours')
  on conflict(operation_id) do update set ciphertext=excluded.ciphertext,nonce=excluded.nonce,key_version=excluded.key_version,expires_at=excluded.expires_at;
end; $$;
create or replace function private.fetch_review_secret_replay(p_session_hash text, p_idempotency_hash text)
returns table(ciphertext text, nonce text, key_version text) language sql security definer set search_path=private,pg_temp as $$
  select replay.ciphertext,replay.nonce,replay.key_version from private.operation_secret_replays as replay
  join private.operation_idempotency as operation on operation.id=replay.operation_id
  where operation.operation='review_submit' and operation.actor_scope_hash=p_session_hash and operation.key_hash=p_idempotency_hash and replay.expires_at > now()
$$;
create or replace function api.store_review_secret_replay(text,text,text,text,text) returns void language sql security invoker set search_path=private,api,pg_temp as $$ select private.store_review_secret_replay($1,$2,$3,$4,$5) $$;
create or replace function api.fetch_review_secret_replay(text,text) returns table(ciphertext text,nonce text,key_version text) language sql security invoker set search_path=private,api,pg_temp as $$ select * from private.fetch_review_secret_replay($1,$2) $$;
revoke all on function private.store_review_secret_replay(text,text,text,text,text),private.fetch_review_secret_replay(text,text),api.store_review_secret_replay(text,text,text,text,text),api.fetch_review_secret_replay(text,text) from public,anon,authenticated;
grant execute on function private.store_review_secret_replay(text,text,text,text,text),private.fetch_review_secret_replay(text,text),api.store_review_secret_replay(text,text,text,text,text),api.fetch_review_secret_replay(text,text) to service_role;
notify pgrst,'reload schema';
