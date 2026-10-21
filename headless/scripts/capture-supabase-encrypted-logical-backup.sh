#!/usr/bin/env bash
#
# Create an encrypted logical recovery package from an already-configured
# PostgreSQL service profile.  This command is deliberately fail-closed: it
# never accepts a connection URI/password, never writes under this repository
# or /tmp, and needs an explicit action-time approval marker.
#
# Required (provided only by the approved operator environment):
#   PGSERVICE                         existing libpq service name
#   ESKOMI_BACKUP_DESTINATION         existing encrypted/controlled directory
#   ESKOMI_BACKUP_GPG_RECIPIENT       full GPG public-key fingerprint
#   ESKOMI_BACKUP_APPROVAL_ID         ticket/change identifier
# Invocation:
#   .../capture-supabase-encrypted-logical-backup.sh --execute-approved-encrypted-backup

set -euo pipefail
umask 077

readonly REPOSITORY_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly ACTION="${1:-}"

fail() {
  printf 'Recovery package not created: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"
}

path_is_disallowed() {
  local candidate="$1"
  local disallowed
  for disallowed in /tmp /workspace "$REPOSITORY_DIRECTORY"; do
    if [[ "$candidate" == "$disallowed" || "$candidate" == "$disallowed"/* ]]; then
      return 0
    fi
  done
  return 1
}

[[ "$ACTION" == "--execute-approved-encrypted-backup" ]] ||
  fail "refusing to capture without --execute-approved-encrypted-backup"
[[ -n "${ESKOMI_BACKUP_APPROVAL_ID:-}" ]] ||
  fail "ESKOMI_BACKUP_APPROVAL_ID is required"
[[ -n "${ESKOMI_BACKUP_DESTINATION:-}" ]] ||
  fail "ESKOMI_BACKUP_DESTINATION is required"
[[ -n "${ESKOMI_BACKUP_GPG_RECIPIENT:-}" ]] ||
  fail "ESKOMI_BACKUP_GPG_RECIPIENT is required"
[[ -n "${PGSERVICE:-}" ]] ||
  fail "PGSERVICE is required; do not pass a database URI or password"
[[ -z "${PGPASSWORD:-}" && -z "${DATABASE_URL:-}" ]] ||
  fail "password/URI environment variables are refused; use an existing protected PGSERVICE profile"

[[ "$ESKOMI_BACKUP_DESTINATION" = /* ]] || fail "backup destination must be an absolute path"
[[ -d "$ESKOMI_BACKUP_DESTINATION" ]] || fail "backup destination must already exist"
BACKUP_DESTINATION="$(cd "$ESKOMI_BACKUP_DESTINATION" && pwd -P)"
path_is_disallowed "$BACKUP_DESTINATION" &&
  fail "backup destination cannot be /tmp, /workspace, or this repository"
[[ "$(stat -c '%u' "$BACKUP_DESTINATION")" == "$(id -u)" ]] ||
  fail "backup destination must be owned by the executing operator"
DESTINATION_MODE="$(stat -c '%a' "$BACKUP_DESTINATION")"
(( (8#$DESTINATION_MODE & 8#077) == 0 )) ||
  fail "backup destination must deny group/other access (mode 0700 or stricter)"

[[ "$ESKOMI_BACKUP_GPG_RECIPIENT" =~ ^[0-9A-Fa-f]{40,64}$ ]] ||
  fail "GPG recipient must be a full fingerprint, not an email address or short key id"

for command_name in pg_dump pg_dumpall psql gpg sha256sum stat; do
  require_command "$command_name"
done
gpg --batch --with-colons --list-keys "$ESKOMI_BACKUP_GPG_RECIPIENT" 2>/dev/null |
  awk -F: '$1 == "fpr" { print $10 }' |
  grep -Fxiq "$ESKOMI_BACKUP_GPG_RECIPIENT" ||
  fail "the requested GPG recipient fingerprint is not available locally"

readonly PACKAGE_NAME="eskomi-logical-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
readonly PACKAGE_DIRECTORY="$BACKUP_DESTINATION/$PACKAGE_NAME"
[[ ! -e "$PACKAGE_DIRECTORY" ]] || fail "refusing to overwrite an existing recovery package"
mkdir -m 700 "$PACKAGE_DIRECTORY"

cleanup_failed_capture() {
  local status="$?"
  if [[ "$status" -ne 0 ]]; then
    rm -rf -- "$PACKAGE_DIRECTORY"
    printf 'Incomplete encrypted recovery package removed.\n' >&2
  fi
  exit "$status"
}
trap cleanup_failed_capture EXIT

encrypt_stream() {
  local output_name="$1"
  gpg --batch --yes --trust-model always --encrypt \
    --recipient "$ESKOMI_BACKUP_GPG_RECIPIENT" \
    --output "$PACKAGE_DIRECTORY/$output_name"
}

# The schema archive includes functions, triggers, RLS policies and ACLs.
# The globals archive is sensitive because it can contain role password hashes.
# The data archive includes the migration ledger and any auth/storage metadata.
pg_dump --format=custom --schema-only --file=- | encrypt_stream schema.custom.gpg
pg_dump --format=custom --data-only --file=- | encrypt_stream data.custom.gpg
pg_dumpall --globals-only | encrypt_stream globals.sql.gpg

# This independent, encrypted catalog evidence is useful when comparing an
# isolated rehearsal.  It contains no password hashes or connection settings.
psql -X -q -v ON_ERROR_STOP=1 -c "
  SELECT jsonb_build_object(
    'roles', (SELECT jsonb_agg(jsonb_build_object('name', rolname, 'superuser', rolsuper, 'inherit', rolinherit, 'can_login', rolcanlogin, 'bypass_rls', rolbypassrls) ORDER BY rolname) FROM pg_roles),
    'memberships', (SELECT coalesce(jsonb_agg(jsonb_build_object('role', roleid::regrole::text, 'member', member::regrole::text, 'admin_option', admin_option) ORDER BY roleid::regrole::text, member::regrole::text), '[]'::jsonb) FROM pg_auth_members),
    'policies', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema', schemaname, 'table', tablename, 'policy', policyname, 'command', cmd, 'roles', roles, 'using', qual, 'with_check', with_check) ORDER BY schemaname, tablename, policyname), '[]'::jsonb) FROM pg_policies),
    'default_privileges', (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.defaclrole::regrole::text, d.defaclnamespace::regnamespace::text), '[]'::jsonb) FROM pg_default_acl d)
  ) AS recovery_catalog;" | encrypt_stream catalog.json.gpg

{
  printf 'package_format=eskomi-logical-recovery-v1\n'
  printf 'created_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'approval_id=%s\n' "$ESKOMI_BACKUP_APPROVAL_ID"
  printf 'source_connection=PGSERVICE-only (value intentionally omitted)\n'
  printf 'schema_archive=schema.custom.gpg (schema, functions, triggers, RLS, ACL)\n'
  printf 'data_archive=data.custom.gpg (data and migration ledger; may include Auth/Storage metadata)\n'
  printf 'globals_archive=globals.sql.gpg (roles, memberships, global ACL; sensitive)\n'
  printf 'catalog_snapshot=catalog.json.gpg (non-secret comparison evidence)\n'
  printf 'storage_object_bytes=NOT_INCLUDED; capture separately before any Storage-mutating release\n'
  printf 'restore_scope=operator-controlled isolated target only; never this shared cloud workspace\n'
} > "$PACKAGE_DIRECTORY/manifest.txt"

(cd "$PACKAGE_DIRECTORY" && sha256sum schema.custom.gpg data.custom.gpg globals.sql.gpg catalog.json.gpg manifest.txt > SHA256SUMS)
chmod 600 "$PACKAGE_DIRECTORY"/*
trap - EXIT
printf 'Encrypted recovery package created at approved destination: %s\n' "$PACKAGE_DIRECTORY"
