#!/usr/bin/env bash
# Verify an encrypted recovery package without contacting any database and
# without restoring production data.  Run only in the approved secure restore
# environment, where the decryption key is already available.

set -euo pipefail
umask 077

fail() {
  printf 'Recovery package verification failed: %s\n' "$*" >&2
  exit 1
}

[[ "${1:-}" == "--verify-approved-encrypted-backup" ]] ||
  fail "refusing to inspect without --verify-approved-encrypted-backup"
[[ -n "${ESKOMI_RECOVERY_PACKAGE_DIRECTORY:-}" ]] ||
  fail "ESKOMI_RECOVERY_PACKAGE_DIRECTORY is required"
[[ "$ESKOMI_RECOVERY_PACKAGE_DIRECTORY" = /* && -d "$ESKOMI_RECOVERY_PACKAGE_DIRECTORY" ]] ||
  fail "recovery package directory must be an existing absolute directory"
command -v gpg >/dev/null 2>&1 || fail "gpg is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore is required to validate PostgreSQL archives"

PACKAGE_DIRECTORY="$(cd "$ESKOMI_RECOVERY_PACKAGE_DIRECTORY" && pwd -P)"
for file_name in schema.custom.gpg data.custom.gpg globals.sql.gpg catalog.json.gpg manifest.txt SHA256SUMS; do
  [[ -f "$PACKAGE_DIRECTORY/$file_name" ]] || fail "missing $file_name"
done

(cd "$PACKAGE_DIRECTORY" && sha256sum --check --status SHA256SUMS) || fail "checksum mismatch"
grep -Fqx 'package_format=eskomi-logical-recovery-v1' "$PACKAGE_DIRECTORY/manifest.txt" ||
  fail "unexpected package format"
grep -Fqx 'storage_object_bytes=NOT_INCLUDED; capture separately before any Storage-mutating release' "$PACKAGE_DIRECTORY/manifest.txt" ||
  fail "storage byte scope must be stated explicitly"

TEMPORARY_DIRECTORY="$(mktemp -d)"
cleanup() { rm -rf -- "$TEMPORARY_DIRECTORY"; }
trap cleanup EXIT

gpg --batch --decrypt --output "$TEMPORARY_DIRECTORY/schema.custom" "$PACKAGE_DIRECTORY/schema.custom.gpg"
gpg --batch --decrypt --output "$TEMPORARY_DIRECTORY/data.custom" "$PACKAGE_DIRECTORY/data.custom.gpg"
gpg --batch --decrypt --output "$TEMPORARY_DIRECTORY/globals.sql" "$PACKAGE_DIRECTORY/globals.sql.gpg"
gpg --batch --decrypt --output "$TEMPORARY_DIRECTORY/catalog.json" "$PACKAGE_DIRECTORY/catalog.json.gpg"
pg_restore --list "$TEMPORARY_DIRECTORY/schema.custom" >/dev/null
pg_restore --list "$TEMPORARY_DIRECTORY/data.custom" >/dev/null
grep -Fq 'CREATE ROLE' "$TEMPORARY_DIRECTORY/globals.sql" || fail "globals archive has no role definitions"
grep -Fq 'recovery_catalog' "$TEMPORARY_DIRECTORY/catalog.json" || fail "catalog snapshot is malformed"
printf 'Encrypted database package is internally consistent. This did not restore data or validate Storage object bytes.\n'
