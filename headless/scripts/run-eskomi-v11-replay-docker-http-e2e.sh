#!/usr/bin/env bash
set -euo pipefail

# Disposable HTTP/browser acceptance without a host port, host network, or a
# Docker socket mount.  PostgREST, Next, and Playwright stay on one internal
# Docker network.  It deliberately shares no production configuration.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
headless_root="$repo_root/headless"
network_name="${ESKOMI_E2E_NETWORK:-eskomi-v11-replay-http-e2e-net}"
database_container="${ESKOMI_PG17_CONTAINER:-eskomi-pg17-v11-http-e2e}"
postgrest_container="${ESKOMI_POSTGREST_CONTAINER:-eskomi-postgrest-v164-http-e2e}"
next_container="${ESKOMI_NEXT_CONTAINER:-eskomi-next-v11-http-e2e}"
browser_container="${ESKOMI_BROWSER_CONTAINER:-eskomi-browser-v11-http-e2e}"
database_name="${ESKOMI_PG17_DATABASE:-eskomi_verify}"
jwt_secret="e2e-only-local-postgrest-jwt-secret-012345678901234567890123456789"
replay_key="${ESKOMI_REVIEW_REPLAY_KEY:-MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=}"

cleanup() {
  docker rm -f "$browser_container" "$next_container" "$postgrest_container" "$database_container" >/dev/null 2>&1 || true
  docker network rm "$network_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

service_role_jwt="$(node -e 'const c=require("node:crypto");const b=(x)=>Buffer.from(JSON.stringify(x)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"});const p=b({role:"service_role"});process.stdout.write(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"));' "$jwt_secret")"

docker network create --internal "$network_name" >/dev/null
docker run -d --rm --name "$database_container" --network "$network_name" --network-alias postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null

docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role authenticator login password 'fixture-authenticator-password';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
SQL
for migration in "$repo_root"/supabase/migrations/*.sql; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$migration"
done
for acceptance in \
  verify_eskomi_canonical_foundation.sql \
  verify_eskomi_canonical_managed_directory_e2e.sql \
  verify_eskomi_canonical_partner_home_listing.sql \
  verify_eskomi_canonical_integrity_fixes.sql \
  verify_eskomi_review_entry_v2.sql \
  verify_eskomi_review_entry_therapist_selection.sql \
  verify_eskomi_partner_therapist_tools.sql \
  verify_eskomi_public_profiles_access.sql \
  verify_eskomi_v11_acceptance_hardening.sql \
  verify_eskomi_v11_operations.sql \
  verify_eskomi_v11_rpc_contract.sql \
  verify_eskomi_community_v11.sql \
  verify_eskomi_v11_private_controls.sql \
  verify_eskomi_v11_vertical_slice.sql; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/$acceptance"
done
ESKOMI_PG17_CONTAINER="$database_container" ESKOMI_PG17_DATABASE="$database_name" "$headless_root/scripts/verify-eskomi-v11-mutation-races.sh"

entry_handle="$(docker exec -i "$database_container" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
with shop as (
  insert into app.shops(slug, canonical_path, name, publication_status, published_at)
  values ('v11-replay-e2e', '/shops/v11-replay-e2e/', 'V11 replay E2E fixture', 'published', now())
  returning id
)
insert into private.review_entry_links(shop_id, link_kind, created_by)
select id, 'shop_qr', 'isolated-v11-replay-e2e' from shop
returning public_handle;
SQL
)"

docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create or replace function api.eskomi_e2e_replay_counts(p_session_hash text)
returns table(experience_count bigint, operation_count bigint, replay_count bigint)
language sql security definer set search_path = private, pg_temp as $$
  select (select count(*) from private.review_experiences e join private.operation_idempotency o on o.result_entity_id=e.id where o.operation='review_submit' and o.actor_scope_hash=p_session_hash),
    (select count(*) from private.operation_idempotency o where o.operation='review_submit' and o.actor_scope_hash=p_session_hash),
    (select count(*) from private.operation_secret_replays r join private.operation_idempotency o on o.id=r.operation_id where o.operation='review_submit' and o.actor_scope_hash=p_session_hash)
$$;
create or replace function api.eskomi_e2e_expire_replay(p_session_hash text)
returns void language sql security definer set search_path = private, pg_temp as $$
  update private.guest_operation_sessions set replay_expires_at=now()-interval '1 second' where session_secret_hash=p_session_hash
$$;
revoke all on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text) from public, anon, authenticated;
grant execute on function api.eskomi_e2e_replay_counts(text), api.eskomi_e2e_expire_replay(text) to service_role;
notify pgrst, 'reload schema';
SQL

docker run -d --rm --name "$postgrest_container" --network "$network_name" --network-alias postgrest \
  -e PGRST_DB_URI="postgres://authenticator:fixture-authenticator-password@postgres:5432/$database_name" \
  -e PGRST_DB_SCHEMAS=api -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$jwt_secret" \
  postgrest/postgrest:v16.4 >/dev/null
for _ in $(seq 1 30); do docker logs "$postgrest_container" 2>&1 | grep -q 'API server listening' && break; sleep 1; done
docker logs "$postgrest_container" 2>&1 | grep -q 'API server listening'

docker run -d --rm --name "$next_container" --network "$network_name" --network-alias next \
  --mount "type=bind,src=$headless_root,dst=/app" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" -e ESKOMI_REVIEW_REPLAY_KEY="$replay_key" \
  node:24-bookworm-slim sh -c 'npm run dev -- --hostname 0.0.0.0 --port 57000' >/dev/null
for _ in $(seq 1 90); do docker logs "$next_container" 2>&1 | grep -Eq 'Ready|started server' && break; sleep 1; done
docker logs "$next_container" 2>&1 | grep -Eq 'Ready|started server'

docker run -d --rm --name "$browser_container" --network "$network_name" --network-alias browser \
  --entrypoint /usr/bin/google-chrome browserless/chrome:latest \
  --headless=new --no-sandbox --disable-gpu --proxy-server=direct:// --proxy-bypass-list='*' \
  --remote-debugging-address=0.0.0.0 --remote-debugging-port=9222 >/dev/null
sleep 2
cdp_path="$(docker logs "$browser_container" 2>&1 | sed -n 's@.*ws://127\.0\.0\.1:9222\(/devtools/browser/.*\)@\1@p' | tail -n 1)"
test -n "$cdp_path"
docker run --rm --network "$network_name" --network-alias runner --mount "type=bind,src=$headless_root,dst=/app,readonly" -w /app \
  -e SUPABASE_URL="http://postgrest:3000" -e SUPABASE_SERVICE_ROLE_KEY="$service_role_jwt" \
  -e ESKOMI_E2E_ENTRY_HANDLE="$entry_handle" -e ESKOMI_E2E_NEXT_URL="http://next:57000" \
  -e ESKOMI_E2E_CDP_URL="ws://browser:9222${cdp_path}" \
  -e ESKOMI_E2E_BROWSER_PROXY_ORIGIN="http://runner" \
  node:24-bookworm-slim node scripts/check-eskomi-v11-replay-browser.mjs

echo "Eskomi v1.1 Docker-network HTTP/Chromium replay acceptance: PASS"
