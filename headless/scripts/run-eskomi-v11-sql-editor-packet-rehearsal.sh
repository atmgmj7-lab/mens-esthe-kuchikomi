#!/usr/bin/env bash
set -euo pipefail

# Disposable proof for the manual SQL Editor packet. It uses a PostgreSQL 17
# container on an internal-only Docker network and synthetic fixture data only.
# It never connects to a Supabase project.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
packet_dir="$repo_root/headless/docs/technical/artifacts/2026-10-18-cloudflare-workers-local-qa/manual-sql-editor-v11-2026-10-21"
production_anchor_hash="77520bc6a1e9b5aa5708e7e3848e517f6f6cb3bb7091bbb1380eb20eaaae95d2"
ledger_boundary="20261015182000"
network_name="${ESKOMI_SQL_EDITOR_PACKET_NETWORK:-eskomi-sql-editor-packet-net-$$}"
database_container="${ESKOMI_SQL_EDITOR_PACKET_PG17_CONTAINER:-eskomi-pg17-sql-editor-packet-$$}"
database_name="${ESKOMI_SQL_EDITOR_PACKET_PG17_DATABASE:-eskomi_sql_editor_packet}"
network_created=0
database_created=0
rehearsal_packet_dir="$(mktemp -d)"

cleanup() {
  if [[ "$database_created" -eq 1 ]]; then docker rm -f "$database_container" >/dev/null 2>&1 || true; fi
  if [[ "$network_created" -eq 1 ]]; then docker network rm "$network_name" >/dev/null 2>&1 || true; fi
  rm -rf "$rehearsal_packet_dir"
}
trap cleanup EXIT

psql_exec() {
  docker exec -i "$database_container" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$database_name" "$@"
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

apply_source_atomically() {
  local migration="$1" ledger_version="${2:-}" ledger_name="${3:-}"
  local filename source_version source_name source
  filename="$(basename "$migration")"
  source_version="${filename%%_*}"
  source_name="${filename#*_}"; source_name="${source_name%.sql}"
  ledger_version="${ledger_version:-$source_version}"
  ledger_name="${ledger_name:-$source_name}"
  source="$(cat "$migration")"
  {
    printf 'begin;\n'
    cat "$migration"
    # Command substitution strips the checked-in final LF; restore its one-LF
    # source-file invariant inside the dollar-quoted ledger value.
    printf "\ninsert into supabase_migrations.schema_migrations(version, statements, name, created_by, idempotency_key, rollback) values ('%s', array[\$source\$%s\n\$source\$], '%s', null, null, null);\ncommit;\n" "$ledger_version" "$source" "$ledger_name"
  } | psql_exec
}

while IFS= read -r migration; do
  apply_source_atomically "$migration"
done < <(LC_ALL=C find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort | while IFS= read -r migration; do
  version="$(basename "$migration")"; version="${version%%_*}"
  [[ "$version" < "$ledger_boundary" || "$version" == "$ledger_boundary" ]] && printf '%s\n' "$migration"
done)

psql_exec < "$repo_root/supabase/tests/fixture_eskomi_20261015182000_synthetic_baseline.sql"
apply_source_atomically "$repo_root/supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql" "20261020020548" "eskomi_supabase_primary_public_directory"

# Production's reviewed anchor text is not included in this synthetic fixture.
# Preserve the production packet unchanged; only this disposable copy expects
# the synthetic anchor's own source hash so the exact-hash guard is exercised.
synthetic_anchor_hash="$(sha256sum "$repo_root/supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql" | awk '{print $1}')"
for stage in "$packet_dir"/0[1-5]-stage-0[1-5].sql; do
  sed "s/$production_anchor_hash/$synthetic_anchor_hash/g" "$stage" > "$rehearsal_packet_dir/$(basename "$stage")"
done
sed "s/$production_anchor_hash/$synthetic_anchor_hash/g" "$packet_dir/99-final-readonly-verification.sql" > "$rehearsal_packet_dir/99-final-readonly-verification.sql"

for version in 20261017120000 20261017121000 20261017122000 20261017123000 20261017124000 20261017130000 20261017131000 20261017132000 20261017133000 20261017134000 20261017135000 20261017140000 20261017141000 20261017142000 20261017143000; do
  migration="$(find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name "${version}_*.sql" -print -quit)"
  apply_source_atomically "$migration"
done

# Inject one SQL error after every source/ledger insert in stage 01 but before
# COMMIT. The actual packet must leave no source or ledger side effect behind.
if perl -0pe 's/\ncommit;\n/\nselect 1\/0;\ncommit;\n/' "$rehearsal_packet_dir/01-stage-01.sql" | psql_exec; then
  echo 'injected packet failure unexpectedly committed' >&2
  exit 1
fi
rolled_back="$(psql_exec -A -t -c "select count(*) from supabase_migrations.schema_migrations where version between '20261017144000' and '20261017150000';")"
[[ "$rolled_back" == "0" ]] || { echo "packet failure did not roll back its ledger rows: $rolled_back" >&2; exit 1; }

for stage in "$rehearsal_packet_dir"/0[1-5]-stage-0[1-5].sql; do
  psql_exec < "$stage" >/dev/null
done

result="$(psql_exec -A -t < "$rehearsal_packet_dir/99-final-readonly-verification.sql")"
[[ "$result" == *'"packet_exact": 50'* ]] || { echo "packet final exact-count check failed: $result" >&2; exit 1; }
[[ "$result" == *'"packet_mismatch_or_missing": 0'* ]] || { echo "packet final mismatch check failed: $result" >&2; exit 1; }
echo 'Eskomi manual SQL Editor packet rehearsal: PASS (rollback guard + 35 remaining sources)'
