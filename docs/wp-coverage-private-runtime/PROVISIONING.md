# Private coverage provisioning and release contract

Status: local implementation only. Every production step below requires separate approval. Do not dispatch `coverage-batch`, `apply` or `reconcile` for availability testing. Reconcile historically precedes the apply-enabled flag and can mutate ledgers/audits.

## Location and ownership

No comparable private operational JSON convention was found in scoped repository/live inspection. Existing runtime configuration uses wp-config constants/environment variables; private migration backups already live outside the web root. This contract derives a fixed location without introducing any Secret/environment value:

- `$WP_ROOT`: the existing WordPress `ABSPATH`, with trailing separator removed.
- `$SITE_ROOT`: `dirname($WP_ROOT)`.
- Private root: `$SITE_ROOT/private/escomi-coverage`.
- Owner: the existing Xserver WordPress/deploy account (`xs454693`). PHP effective user must match where POSIX identity inspection is available.
- `private` and `escomi-coverage` directories: 0700, or 0500 after provisioning. Files: 0600, or 0400. No symlinks anywhere in the path; no hard-linked files; canonical real paths required. All data remains outside `public_html`, the child theme and Git.
- Files: `recovery-contracts.json`, `coverage-batch-manifest-2026-08-25.json`, `ESKOMI_COVERAGE_WAVE2_BATCH_MANIFEST_2026-08-28.json`.

Source release is reproducible only together with this separately provisioned private state and existing WP/ACF/database dependencies. Git alone intentionally does not contain operational data. Until provisioning succeeds, candidate deployment fails before its first source upload.

## Version 1 schema

`coverage-private-runtime.php` is the executable schema and validator. Envelope has exactly `version: 1` and `recoveryContracts`, a list of exactly three records. Each record has exactly `operation_id` and `contract`. Operation identity is supplied privately, unique and grammar-validated. Each of these existing behavioral kinds appears exactly once:

| kind | additional required contract fields |
| --- | --- |
| `retry_ready` | `failure_audit_id`, `area_terms`, `provenance_exists` |
| `applied_create_relation` | `applied_audit_id`, `required_area_terms`, `allowed_derived_area_terms` |
| `failed_create_provenance` | `failure_audit_id`, `failure_audit_post_id`, `title`, `slug`, `area_terms`, `provenance_exists`, `provenance_value`, `failure_code` |

All have `reconcile_kind`, `payload_hash`, `post_id`, `status`, `primary_exists`. IDs are positive integers (failure_audit_post_id may be null); taxonomy lists contain unique positive integers and are nonempty; boolean fields remain booleans; payload hash is lowercase SHA256; status must be publish/draft; strings are nonempty; historical empty provenance is an actual empty list. No extra keys, duplicate JSON keys, duplicate identities/kinds, missing/extra records or unknown version. Loaded map preserves every private value, not normalized IDs or guessed defaults. Synthetic examples are constructed in the tests; no live record is a committed fixture.

Both manifests are bounded to 1MiB, regular readable private files, valid JSON with unique keys, schema_version1 and expected batch identity. Their SHA256 values are pinned in the loader. The original full manifest business validator remains unchanged and runs in both the request guard and standalone preflight. Recovery config missing/invalid or either manifest missing/invalid fails closed before any route dispatch.

## Local extraction and equivalence (read-only source input)

1. Capture the current live writer and both manifests via read-only SSH into a new outside-repository migration directory0700; files0600. Record timestamps and SHA256. Do not reuse a stale writer snapshot. Never print contents.
2. Extract only the existing literal recovery array to a NEW local file:

   `php scripts/extract-coverage-private-contract.php "$PRIVATE_MIGRATION/live-writer.php" "$PRIVATE_MIGRATION/recovery-contracts.json"`

   The extractor permits literal PHP array tokens only. It does not load the module or execute its operational functions; output creation is exclusive and private. Input should be the verified pre-migration live baseline. After migration, use the existing private config backup as the authoritative source, not this one-time extractor.
3. Build a local synthetic site layout with the exact private config and manifest copies. Compare the old return-map canonical JSON with the new loader result in separate PHP processes. Record only count3, structural digest and equality. This proves data-object equivalence; do not run coverage operations.
4. Generate and run the read-only candidate preflight against that local WordPress-root directory:

   `python3 scripts/build-coverage-private-preflight.py > "$PRIVATE_MIGRATION/preflight.php.txt"`

   `php -r 'eval(stream_get_contents(STDIN));' -- "$LOCAL_WP_ROOT" < "$PRIVATE_MIGRATION/preflight.php.txt"`

   The bundle contains candidate source only. It imports declarations and invokes private readers plus the pure manifest contract validator. It never boots WordPress, opens a database, sends HTTP requests, or calls apply/reconcile. Only PASS/FAIL and record/manifest counts are printed.

## Later separately approved provisioning

Before changing any production code, re-read live hashes and confirm the private extraction source matches the currently approved baseline. Save original live functions.php, writer, all replaced source files and both operational manifests into a timestamped account-owned directory outside public_html (directory0700/files0600). If private config already exists, preserve a byte-for-byte copy and its hash; never overwrite it blindly.

Provision the three validated files into a temporary private directory on the same filesystem, owned by the PHP/deploy account. Set parent/root0700 and files0600 before any source activation. Verify digests, ownership, absence of symlinks and exact recovery equivalence. Move the validated directory into the destination as one directory-level operation only when its target is known absent; an existing destination requires a reviewed replacement/backup procedure and maintenance coordination. Do not modify wp-config, Secret values or ESKOMI_COVERAGE_BATCH_WRITE_ENABLED. Preserve original private manifests in the old theme location for approved rollback; no deletion is needed.

Run the candidate preflight through read-only SSH against the actual `$WP_ROOT`, with the same PHP user as WordPress. Require PASS. PHP CLI and web runtime identity/permissions must be confirmed separately during release preflight; local test success does not prove the production SAPI.

## Deployment and rollback

The workflow builds candidate-only validation code locally and streams it to SSH stdin before **any** runtime source upload. This matters because live functions.php already includes the coverage writer. The dependency list transfers the private loader before the sanitized writer. Existing foundation projection precedes its writer. Full theme transfer excludes functions.php; read-only private preflight runs again; functions.php transfers last.

Private inputs and local evidence are excluded from stage and forbidden by stage validation. Uploads have no remote-delete option. Private root lies outside the fixed child-theme upload destination. This is sequential rsync, not a globally atomic release switch. Any interrupted source transfer requires exact hash readback before retry; no assumption of whole-release atomicity.

If provisioning fails before code deployment, retain the old live code and its original manifests; no source activation occurs. If an approved code release requires rollback, separately authorize restoration of the captured live source dependency set and functions.php in a reviewed order. Original live writer still uses its original theme manifest locations; preserve those exact files/hashes. Keep private config backups rather than deleting data during rollback. Any private-state replacement must restore exact hash and permissions and re-run its standalone validation before reactivation. Data/ledger rollback is a different operation and is not authorized by a code rollback.

Stop after local source commit in this task. Main push, code deployment, private provisioning, schema activation and canary each remain outside this authorization.
