#!/usr/bin/env bash
set -euo pipefail

# This is a repository-schema plus synthetic-data rehearsal. It is not a
# production snapshot, dump, backup, or data export. It creates only an owned
# disposable PostgreSQL container on an internal Docker network.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ledger_boundary="20261015182000"
network_name="${ESKOMI_SYNTHETIC_BASELINE_NETWORK:-eskomi-v11-synthetic-baseline-net-$$}"
database_container="${ESKOMI_SYNTHETIC_BASELINE_PG17_CONTAINER:-eskomi-pg17-synthetic-baseline-$$}"
database_name="${ESKOMI_SYNTHETIC_BASELINE_PG17_DATABASE:-eskomi_synthetic_baseline}"
network_created=0
database_created=0

cleanup() {
  if [[ "$database_created" -eq 1 ]]; then docker rm -f "$database_container" >/dev/null 2>&1 || true; fi
  if [[ "$network_created" -eq 1 ]]; then docker network rm "$network_name" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

base_migrations=()
upgrade_migrations=()
while IFS= read -r migration; do
  name="$(basename "$migration")"
  version="${name%%_*}"
  if [[ "$version" < "$ledger_boundary" || "$version" == "$ledger_boundary" ]]; then
    base_migrations+=("$migration")
  else
    upgrade_migrations+=("$migration")
  fi
done < <(LC_ALL=C find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)

[[ "${#base_migrations[@]}" -gt 0 ]] || { echo "missing synthetic baseline migrations" >&2; exit 1; }
# Keep this explicit so a future migration cannot silently extend the rehearsed
# chain.  The current branch includes the v1.1 continuation plus the primary
# directory and canonical public-review reader migrations.
[[ "${#upgrade_migrations[@]}" -eq 51 ]] || { echo "expected 51 migrations after $ledger_boundary, found ${#upgrade_migrations[@]}" >&2; exit 1; }

docker network create --internal "$network_name" >/dev/null
network_created=1
docker run -d --rm --name "$database_container" --network "$network_name" \
  -e POSTGRES_PASSWORD=synthetic-rehearsal-only -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
database_created=1
for _ in $(seq 1 30); do
  docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null

docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role authenticator login password 'synthetic-rehearsal-only';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
SQL

for migration in "${base_migrations[@]}"; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$migration"
done
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/fixture_eskomi_20261015182000_synthetic_baseline.sql"
for migration in "${upgrade_migrations[@]}"; do
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$migration"
done

verification_sql="$repo_root/supabase/tests/verify_eskomi_20261015182000_synthetic_rehearsal.sql"
if [[ "${ESKOMI_SYNTHETIC_BASELINE_PROVE_NON_TARGET_GUARD:-0}" == "1" ]]; then
  if {
    printf "set eskomi_rehearsal.inject_non_target_mapping = 'on';\\n"
    cat "$verification_sql"
  } | docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name"; then
    echo "non-target workspace guard unexpectedly accepted the abnormal fixture" >&2
    exit 1
  fi
  echo "Eskomi synthetic non-target workspace guard proof: PASS (expected rejection)"
  exit 0
fi

docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$verification_sql"
docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" < "$repo_root/supabase/tests/verify_eskomi_public_review_read_rpc.sql"

echo "Eskomi synthetic 20261015182000 baseline rehearsal: PASS"
