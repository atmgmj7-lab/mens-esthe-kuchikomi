#!/usr/bin/env bash
set -euo pipefail

# Applies the bf46aa1-era migration boundary to a disposable PostgreSQL 17
# database, inserts representative persisted rows, then applies only later
# migrations.  No production endpoint, volume, or Docker socket is used.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
database_container="${ESKOMI_UPGRADE_PG17_CONTAINER:-eskomi-pg17-v11-populated-upgrade}"
database_name="${ESKOMI_UPGRADE_PG17_DATABASE:-eskomi_upgrade_verify}"
cleanup() { docker rm -f "$database_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --rm --name "$database_container" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
for _ in $(seq 1 30); do docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null 2>&1 && break; sleep 1; done
docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null
docker exec -i "$database_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin; create role authenticator login password 'fixture'; grant anon, authenticated, service_role to authenticator;
create schema extensions; create extension pgcrypto with schema extensions; create schema storage; create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
SQL
while read -r migration; do
  git -C "$repo_root" show "bf46aa1:${migration}" | docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name"
done < <(git -C "$repo_root" ls-tree -r --name-only bf46aa1 -- supabase/migrations | sort)
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/fixture_eskomi_populated_upgrade_pre143.sql"
for migration in "$repo_root"/supabase/migrations/*.sql; do
  [[ "$(basename "$migration")" > "20261017140000_eskomi_review_entry_therapist_selection.sql" ]] || continue
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$migration"
done
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/verify_eskomi_populated_upgrade.sql"
echo "Eskomi populated bf46aa1-to-current upgrade: PASS"
