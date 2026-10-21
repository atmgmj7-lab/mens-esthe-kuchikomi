#!/usr/bin/env bash
set -euo pipefail

# Disposable proof for the release runner contract. This never connects to
# Supabase: it uses only an internal Docker network and synthetic fixture data.
# Every migration file and its synthetic ledger row are sent in one explicit
# PostgreSQL transaction. A failure injected after a selected file proves that
# both the SQL and its ledger row roll back together.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ledger_boundary="20261015182000"
network_name="${ESKOMI_ATOMIC_REHEARSAL_NETWORK:-eskomi-v11-atomic-rehearsal-net-$$}"
database_container="${ESKOMI_ATOMIC_REHEARSAL_PG17_CONTAINER:-eskomi-pg17-atomic-rehearsal-$$}"
database_name="${ESKOMI_ATOMIC_REHEARSAL_PG17_DATABASE:-eskomi_atomic_rehearsal}"
fail_after_version="${ESKOMI_ATOMIC_REHEARSAL_FAIL_AFTER_VERSION:-}"
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
  version="$(basename "$migration")"
  version="${version%%_*}"
  if [[ "$version" < "$ledger_boundary" || "$version" == "$ledger_boundary" ]]; then
    base_migrations+=("$migration")
  else
    upgrade_migrations+=("$migration")
  fi
done < <(LC_ALL=C find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)

[[ "${#upgrade_migrations[@]}" -eq 51 ]] || {
  echo "expected 51 migrations after $ledger_boundary, found ${#upgrade_migrations[@]}" >&2
  exit 1
}

docker network create --internal "$network_name" >/dev/null
network_created=1
docker run -d --rm --name "$database_container" --network "$network_name" \
  -e POSTGRES_PASSWORD=synthetic-rehearsal-only \
  -e POSTGRES_DB="$database_name" postgres:17 >/dev/null
database_created=1
for _ in $(seq 1 30); do
  docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$database_container" pg_isready -U postgres -d "$database_name" >/dev/null

psql_exec() {
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" "$@"
}

psql_exec <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role authenticator login password 'synthetic-rehearsal-only';
grant anon, authenticated, service_role to authenticator;
create schema extensions;
create extension pgcrypto with schema extensions;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text,
  created_by text,
  idempotency_key text,
  rollback text[]
);
SQL

apply_atomically() {
  local migration="$1"
  local filename version name
  filename="$(basename "$migration")"
  version="${filename%%_*}"
  name="${filename#*_}"
  name="${name%.sql}"

  {
    printf 'begin;\n'
    cat "$migration"
    if [[ "$version" == "$fail_after_version" ]]; then
      printf "\ndo \$\$ begin raise exception 'synthetic atomic migration failure'; end \$\$;\n"
    fi
    printf "\ninsert into supabase_migrations.schema_migrations(version, statements, name, created_by, idempotency_key, rollback) values ('%s', array['synthetic atomic rehearsal'], '%s', 'synthetic', '%s', array[]::text[]);\ncommit;\n" "$version" "$name" "$version"
  } | psql_exec
}

for migration in "${base_migrations[@]}"; do
  apply_atomically "$migration"
done
psql_exec < "$repo_root/supabase/tests/fixture_eskomi_20261015182000_synthetic_baseline.sql"

for migration in "${upgrade_migrations[@]}"; do
  version="$(basename "$migration")"
  version="${version%%_*}"
  if ! apply_atomically "$migration"; then
    if [[ "$version" != "$fail_after_version" ]]; then
      echo "unexpected atomic migration failure: $version" >&2
      exit 1
    fi
    state="$(psql_exec -A -t -c "select (not exists(select 1 from supabase_migrations.schema_migrations where version='$version'))::text || ',' || (to_regclass('app.therapists') is null)::text;")"
    [[ "$state" == "true,true" ]] || {
      echo "failed migration or its ledger row was not rolled back: $state" >&2
      exit 1
    }
    echo "Eskomi synthetic atomic migration rollback proof: PASS ($version)"
    exit 0
  fi
done

expected_total=$(( ${#base_migrations[@]} + ${#upgrade_migrations[@]} ))
actual_total="$(psql_exec -A -t -c 'select count(*) from supabase_migrations.schema_migrations;')"
[[ "$actual_total" == "$expected_total" ]] || {
  echo "synthetic ledger count mismatch: expected $expected_total, got $actual_total" >&2
  exit 1
}
psql_exec < "$repo_root/supabase/tests/verify_eskomi_20261015182000_synthetic_rehearsal.sql"
psql_exec < "$repo_root/supabase/tests/verify_eskomi_public_review_read_rpc.sql"
echo "Eskomi synthetic atomic migration rehearsal: PASS"
