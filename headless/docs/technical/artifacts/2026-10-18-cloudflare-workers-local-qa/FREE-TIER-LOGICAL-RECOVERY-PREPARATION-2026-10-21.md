# Free-tier logical recovery preparation — 2026-10-21

This is a preparation record and fail-closed tooling only. It does **not**
create a backup, transfer production data, create a database, alter Supabase,
or authorize a production migration.

## Confirmed service boundary

The supplied Supabase dashboard evidence at 2026-10-21 15:25 JST shows that
project `goeagrxjsjcbbatpotbu` is on the Free plan: **“Free Plan does not
include project backups”**; point-in-time recovery and restore-to-new-project
are Pro features. No plan change is proposed.

The current release candidate is commit
`ed94f2641b9694bd4f249301ec4d586a4c13d6d1`, with the reviewed 50 migration
packet. The already-applied primary-directory migration remains outside that
packet and must not be reapplied.

## What must be protected

| Component | Minimal recoverable evidence | Important boundary |
| --- | --- | --- |
| Database schema | Custom logical schema archive: schemas, functions, triggers, extensions, RLS policies and ACLs. | A schema dump does not recreate an entire managed Supabase project by itself. |
| Database data | Custom data archive, including application data and the migration ledger. | It can include personal/partner data, review/community data, Auth data, abuse/idempotency material and Storage metadata. Encrypt it. |
| Roles and global privileges | `pg_dumpall --globals-only` archive plus a non-secret catalog snapshot of roles, memberships, policies and default ACLs. | The globals archive can contain role password hashes; encrypt it and never commit it. |
| Migration ledger | Included in the data archive; compare it before and after rehearsal. | Do not edit migration history to make a failed release appear applied. |
| Storage metadata | Included only if represented in database data. | It is **not** a backup of Storage object bytes. |
| Storage object bytes | Separate bucket inventory, object metadata, count/size/checksum manifest and encrypted object export. | Database backup/restore cannot reconstruct images or other object bytes. |

## Cloud readiness check (non-secret)

On this shared cloud environment: `pg_dump`, `pg_dumpall`, `pg_restore` and
`psql` are absent; GnuPG is installed but has zero public keys; rclone is
installed but has zero configured remotes. `/workspace`, `/tmp`,
`/workspace/.aws` and `/workspace/.codex` exist, but their presence is **not
an approved backup destination** and no credentials or configuration contents
were inspected. Therefore no production export was attempted.

The two scripts added with this record deliberately refuse a URI/password,
refuse `/tmp`, `/workspace` and the repository as a destination, require a
mode-0700-or-stricter existing destination, a full pre-existing GPG recipient
fingerprint, a `PGSERVICE` profile and an action-time approval ID. They stream
the logical archives directly to GPG; they do not create a plaintext dump file.

## Minimum approval before data leaves production

An operator needs to provide only the following references, not their secret
values in chat or Git:

1. An existing access-controlled, encrypted destination path, its data owner,
   retention/deletion period and the party allowed to decrypt it.
2. The full public GPG fingerprint for that party (a public identifier, not a
   private key), available in the operator environment.
3. An existing protected libpq `PGSERVICE`/credential process with authority
   to read the required database scope. The service value and credential file
   contents must not be logged or copied to this repository.
4. A separate Storage export decision: either an approved encrypted bucket
   export mechanism and service authority, or a release statement that the
   specific migration makes no Storage object-byte mutation. The latter does
   not claim that a full project recovery can recreate media.
5. A named isolated restore owner and target with no production network path,
   plus permission to handle the sensitive logical dump there.

## Prepared commands (do not run in this shared cloud)

After the five items above are explicitly approved, the operator-controlled
secure environment may run:

```bash
export PGSERVICE='operator-managed-service-name'
export ESKOMI_BACKUP_DESTINATION='/approved/encrypted/recovery-store'
export ESKOMI_BACKUP_GPG_RECIPIENT='FULL_PUBLIC_FINGERPRINT'
export ESKOMI_BACKUP_APPROVAL_ID='approved-change-reference'
bash headless/scripts/capture-supabase-encrypted-logical-backup.sh \
  --execute-approved-encrypted-backup
```

No production URL, password, token, key or bucket identifier belongs in this
record. The script creates an encrypted package containing `schema.custom.gpg`,
`data.custom.gpg`, `globals.sql.gpg`, `catalog.json.gpg`, an explicit manifest
and checksums. It marks Storage object bytes `NOT_INCLUDED` rather than
silently claiming they were saved.

Before a production migration, a secure restore environment first runs:

```bash
export ESKOMI_RECOVERY_PACKAGE_DIRECTORY='/approved/encrypted/recovery-store/PACKAGE'
bash headless/scripts/verify-supabase-encrypted-logical-backup.sh \
  --verify-approved-encrypted-backup
```

This checks checksums, decryptability and PostgreSQL archive structure only; it
does not restore data. It must **not run in this shared cloud** because an
unsanitized production dump must not be imported here.

## Isolated restore rehearsal checklist

The named operator performs these steps only on the approved isolated host:

1. Confirm the target has no route/credential alias to production and has no
   external mail delivery; record its target identity without recording
   secrets.
2. Verify the encrypted package as above. Restore globals first, then schema,
   then data to a clean isolated PostgreSQL/Supabase-compatible target. Use
   the owning administrator's reviewed commands; do not infer that a vanilla
   PostgreSQL target reproduces Supabase platform services.
3. Compare catalog snapshot, table/function/policy/ACL/role counts, migration
   ledger, and selected non-mutating RPC contracts. Do not send mail or create
   external accounts.
4. Restore Storage object bytes separately and compare inventory count, size
   and checksum manifest. Do not treat `storage.objects` rows as byte proof.
5. Record package checksum, restore target identity, verifier, timestamp,
   deviations and secure deletion/retention decision. Only then is the package
   usable as rollback evidence for the SQL release.

## Ordered path to production review and store-onboarding decision

1. Obtain and rehearse the manual recovery package above. This is the current
   blocker for any DDL because the Free plan has no platform rollback.
2. Re-run the read-only production preflight: exact migration ledger, 50-file
   SHA-256 packet, 379-public/3-draft invariants, no automatic area inference,
   and exact-ID mapping manifests. Keep the 14 excluded records excluded.
3. Apply only the reviewed packet in order after the recovery gate; do not
   reapply the existing directory migration. Stop on the first failed ledger or
   invariant and use the rehearsal-backed recovery decision rather than editing
   the ledger.
4. Perform controlled production boundary tests: the four public RPCs only,
   direct table reads rejected, unpublished/managed-nonpublic records hidden,
   primary-null global visibility retained, and area-filter visibility only
   where explicit primary evidence exists.
5. Only after mapping is separately approved, apply exact `WP ID + slug +
   app_shop_id` mappings. No name/address similarity matching, no automatic
   managed projection or publishing.
6. Complete the still-unrun Auth, Storage, Mail, browser and Cloudflare runtime
   checks in an approved environment. New secret/scheduler/DNS/deploy actions
   remain separate action-time approvals.

Passing the synthetic migration chain, code contracts or Worker build is not a
store-onboarding decision. The 335 primary-null records remain explicitly
unresolved for regional filtering/SEO, even though global published review and
detail paths have a null-safe code contract.
