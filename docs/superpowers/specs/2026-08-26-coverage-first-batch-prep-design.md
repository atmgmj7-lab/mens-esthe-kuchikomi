# Coverage First Batch Prep Design

## 1. Purpose

`COVERAGE-FIRST-BATCH-PREP-01` prepares the 30 `BASIC_VERIFIED` Shinosaka and
Sakaihigashi candidate-area rows for safe WordPress dry-run and later controlled
publication. The implementation supports `UPDATE_EXISTING`, `CREATE_NEW`, and
`ADD_AREA_RELATION` without writing to production in this task.

The system is batch-ready from the start. The eight named pilot candidates are a
fixed subset of the same manifest, schema, writer, allowlist, conflict contract,
idempotency contract, and rollback contract used by the remaining candidates.

## 2. Authoritative Inputs

The batch compiler accepts only these source artifacts:

- `ESKOMI_COVERAGE_FIRST_WP_MAPPING_2026-08-24.xlsx`
- `ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv`
- `ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv`
- `ESKOMI_COVERAGE_FIRST_WP_MAP_REPORT_2026-08-24.md`
- `ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv`
- `ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv`

The compiler records the SHA-256 of every source it reads. It rejects a missing
source, an unexpected header, duplicate `(target_area, Master_ID)` rows, or a
mapping set other than exactly 20 Shinosaka and 10 Sakaihigashi rows with
`BASIC_VERIFIED=YES`.

## 3. Fixed Target Set and Operation Cardinality

The reporting contract remains 30 candidate-area rows:

- Shinosaka: 20
- Sakaihigashi: 10

The writer contract uses 28 execution entities. `M0145` and `M0241` each occur in
both areas:

- `M0145` is one `CREATE_NEW` operation with both area term IDs 13 and 17.
- `M0241` is one `UPDATE_EXISTING` operation for WordPress post 683, which already
  has both area relations.

The compiler must preserve both area rows in CSV reporting while emitting only one
writer operation for each of these Master IDs. A cardinality assertion rejects any
manifest that is not 30 candidate-area rows and 28 execution entities.

## 4. Selected Architecture

The implementation consists of three isolated units.

### 4.1 Batch compiler and dry-run engine

A Python standard-library-only package under `tools/eskomi_coverage_batch/` reads
the authoritative CSV inputs, fetches the current public WordPress snapshot, builds
the immutable manifest, computes field-level diffs and current hashes, performs
duplicate checks, and writes the five required artifacts.

Dry-run is the default and requires no WordPress credentials. A future apply client
may read credentials only from environment variables; credentials, Basic headers,
and tokens never enter artifacts, logs, fixtures, or command output.

### 4.2 Immutable batch manifest

`data/coverage-first/coverage-batch-manifest-2026-08-25.json` is generated from the
authoritative inputs. It contains only the approved 28 execution entities and their
30 candidate-area projections. It records:

- batch ID and schema version
- source artifact hashes
- Master ID and canonical identity
- target area rows and fixed term IDs
- action and expected WordPress ID/slug
- exact proposed fields and provenance
- per-field observed date and expected current hash
- operation ID and canonical payload hash
- pilot membership

The JSON schema is fail-closed: unknown keys, unknown actions, unknown fields,
unknown area IDs, and non-HTTPS provenance URLs are rejected. The PHP writer loads
this server-side file and does not trust a caller-supplied manifest.

### 4.3 Dedicated WordPress writer

`coverage-batch-writer.php` registers a separate POST-only route:

`/wp-json/escomi/v1/coverage-batch`

The existing daily route remains unchanged and cannot be used for this batch.
The writer receives a batch ID, operation ID, attempt UUID, canonical payload hash,
and mode. It resolves all mutable values from the server-side manifest.

Production writes are fail-closed behind the WordPress constant
`ESKOMI_COVERAGE_BATCH_WRITE_ENABLED`. When the constant is absent or not exactly
`true`, apply requests return 503. Authenticated dry-run remains available so a
future production task can repeat validation before enabling a write window.

## 5. Authentication and Authorization

The route requires both:

- `current_user_can('escomi_publish_coverage_batch')`
- the applicable WordPress capability for the target operation

`UPDATE_EXISTING` and `ADD_AREA_RELATION` additionally require
`current_user_can('edit_post', $post_id)`. `CREATE_NEW` requires the shop post type's
create/publish capabilities. A future caller uses a dedicated WordPress Application
Password account; it does not reuse the daily-update account or secret.

The route returns 503 when the capability contract or batch manifest cannot be
loaded, 401/403 through WordPress authentication and permission handling, 400 for
invalid input, 409 for lock or current-state conflict, and 200/201 for no-op or
applied operations.

## 6. Strict Write Allowlist

Caller-supplied arbitrary meta and arbitrary post status are prohibited.

Direct field allowlist:

| Manifest field | WordPress contract | Validation |
|---|---|---|
| `official_url` | ACF `official_url` | HTTPS URL, normalized host/path |
| `shop_address` | ACF `shop_address` | non-empty text, maximum 1000 characters |
| `basic_price` | ACF `basic_price` | integer, 1 to 1,000,000 |
| `shop_hours` | ACF `shop_hours` | non-empty text, maximum 500 characters |
| `shop_tel` | ACF `shop_tel` | normalized public business telephone text |
| `shop_booking` | ACF `shop_booking` | non-empty text, maximum 500 characters |
| `area_relation` | taxonomy `area` | only term IDs 13 and 17, append-only |

Create-only values:

- `post_type` is server-fixed to `shop`.
- `post_status` is server-fixed to `publish`; the caller cannot provide it.
- `post_title` is the approved official name.
- `post_name` is the approved slug candidate after collision validation.
- the initial area relations come only from the manifest.

Before writing an ACF value, the writer resolves the field object and requires an
existing ACF field key. On a new post it calls `update_field()` with the resolved
field key so the ACF reference meta is created correctly. A missing ACF definition
defers that field and never falls back to an unknown meta write.

`shop_fact_provenance` is server-generated, not caller-controlled. Existing
supported provenance categories (`official`, `price`, `hours`, and `booking`) are
updated in the same atomic unit as their values. Address and telephone provenance
remain in the private audit record and exported evidence because the current public
provenance schema does not support those field names.

## 7. Deferred Fields

The compiler preserves proposed evidence but never sends these fields to the writer:

- `shop_station`
- `shop_access`
- `shop_booking_url`
- `shop_line`
- image data or uploads
- therapist and attendance data
- editorial analysis
- external portal attention
- ranking, review, and rating data

Each deferred field is emitted as `DEFERRED_FIELD`; it does not prevent other safe
fields for the same candidate from becoming ready.

## 8. Current Hash Contract and Conflict Handling

Each field hash is SHA-256 over canonical UTF-8 JSON containing:

```json
{"exists":true,"field":"shop_hours","value":"10:00～翌5:00"}
```

Keys are serialized in the order `exists`, `field`, `value`, without insignificant
whitespace, with unescaped Unicode and slashes. Missing values use
`{"exists":false,"field":"...","value":null}`; an empty string is not equivalent
to missing.

The compiler computes hashes from the current REST snapshot. The writer recomputes
them from WordPress immediately before apply. A mismatch marks only that field as
`CONFLICT`; it is not overwritten. Other ready fields may proceed, but the candidate
cannot receive Pilot PASS while any intended field is in conflict.

For existing shops, WordPress ID and decoded slug must both match the manifest before
field evaluation. A mismatch holds the complete operation.

## 9. Update Path

For each allowlisted proposed field:

1. Read current existence and raw value.
2. Verify the expected current hash.
3. Return `NO_CHANGE` when the normalized current and proposed values are equal.
4. Mark only hash mismatches as `CONFLICT`.
5. Snapshot ready fields.
6. Write ready fields and their supported provenance.
7. Verify readback.
8. Roll back fields written by this attempt if a write or readback fails.

No `NO_CHANGE`, `DEFERRED_FIELD`, or `CONFLICT` field is sent to the mutation layer.

## 10. Area Relation Path

Area relation updates are append-only. The writer verifies the target term exists in
taxonomy `area` and is one of the fixed IDs. If already related, it returns
`NO_CHANGE`. Otherwise it appends the term and verifies readback. It never replaces
or removes existing relations during forward apply and never changes Primary Area.

## 11. Create Path and Duplicate Prevention

Immediately before create, the authenticated writer searches all relevant WordPress
post statuses for exact collisions on:

- official URL after normalization
- telephone after normalization
- address after normalization
- approved slug
- exact normalized canonical title
- an existing successful ledger entry for the operation ID and payload hash

Any collision returns `CONFLICT` and no post is created. Name similarity alone is not
used for automatic matching.

The writer creates the post with its server-fixed type and status, writes allowlisted
ACF fields using resolved field keys, adds fixed area relations, verifies all
readbacks, and only then records success. If the operation fails before successful
commit, the post is changed to draft rather than hard-deleted and the failure is
recorded for manual review.

## 12. Concurrency and Idempotency

Every execution entity has a deterministic operation ID derived from batch ID,
Master ID, action, and target entity. Every exact operation has a canonical payload
hash.

An atomic `add_option()` lock serializes each operation. Its value contains a safe
timestamp and random token and has a bounded stale-lock recovery path using
compare-and-swap. The caller never receives the token.

The persistent ledger is keyed by batch ID, operation ID, and payload hash. A retry
of an applied operation returns the stored result without creating, relating, or
updating again. A reused operation ID with a different payload hash is a conflict.
The dry-run test executes the same compiled batch twice and requires:

- duplicate shop: 0
- duplicate relation: 0
- second update writes: 0

## 13. Audit and Rollback

The writer records a private append-only audit entry containing safe identifiers,
field names, before/after hashes, area relations added, created post ID, source URLs,
observed dates, attempt UUID, result, and timestamps. It never records credentials,
authorization headers, lock tokens, or full secret-bearing requests.

Rollback is a new batch attempt and never edits or deletes the original audit event:

- UPDATE restores only fields changed by the original attempt after verifying the
  current value still matches the original applied hash.
- AREA RELATION removes only relations added by the original attempt after verifying
  the relation and current entity identity.
- CREATE changes the created post to draft after verifying its ID, slug, operation
  ledger, and current hash. It never hard-deletes or archives the post.

Any rollback hash mismatch returns `CONFLICT` and requires manual review.

## 14. Cache Revalidation

WordPress apply success and Next.js cache revalidation are separate ledger stages.
The future apply client calls the existing authenticated revalidation route only
after WordPress success. Revalidation failure records `CACHE_RETRY_REQUIRED` and may
retry cache invalidation without resending the WordPress operation.

No cache request is made in this task's public-data dry-run.

## 15. Pilot and Remainder Contract

The fixed pilot subset is:

1. M0004 Alivie, WP 770, UPDATE_EXISTING
2. M0118 SPALOT.Mrs, WP 712, UPDATE_EXISTING
3. M0501 Refre Lise, WP 889, ADD_AREA_RELATION
4. M0251 MONOTONE SPA, CREATE_NEW
5. M0536 Mrs.RankUp, WP 768, UPDATE_EXISTING
6. M0209 YOLUSPA, WP 737, UPDATE_EXISTING
7. M0653 Inca Rose, WP 734, UPDATE_EXISTING
8. M0654 ROYAL MADAM, CREATE_NEW

The remainder artifact contains the other 22 candidate-area rows and 20 execution
entities. A remainder operation is `SAME_CONTRACT_READY` only when its action and all
write fields were exercised by a passed pilot operation. The cross-area create for
M0145 is `RE_PILOT_REQUIRED` because it combines CREATE with two area relations; it
is not silently treated as equivalent to a single-area create.

## 16. Required Outputs

The compiler writes these exact filenames:

1. `ESKOMI_COVERAGE_BATCH_DRYRUN_2026-08-25.csv`
2. `ESKOMI_COVERAGE_PILOT_8_PAYLOAD_2026-08-25.json`
3. `ESKOMI_COVERAGE_BATCH_REMAINDER_2026-08-25.csv`
4. `ESKOMI_COVERAGE_ROLLBACK_PLAN_2026-08-25.md`
5. `ESKOMI_COVERAGE_BATCH_PREP_REPORT_2026-08-25.md`

The dry-run CSV is field-level and contains candidate status, field status, current
value/hash, proposed value/hash, source URL, observed date, operation ID, payload
hash, and defer/conflict reason. The report contains a candidate-level 30/30 summary
and a separate 28-entity execution summary.

## 17. Testing Strategy

All production behavior is developed test-first.

Python focused tests cover source hashes, exact 20+10 extraction, 30-to-28 entity
projection, pilot identity, schema rejection, field deferral, current hashes,
duplicate discovery, slug collisions, current-state conflicts, output shape, and
two-pass dry-run idempotency.

PHP focused tests use WordPress stubs to cover POST-only registration, capability
checks, disabled-write 503, immutable manifest selection, unknown field rejection,
ID/slug mismatch, field-level conflict, ACF field-key requirement, no-op updates,
append-only relations, duplicate create rejection, operation locks, ledger replay,
rollback restoration, create-to-draft rollback, and safe audit logging.

Related verification includes:

- focused Python tests
- focused PHP tests
- existing WordPress security tests
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build` because `functions.php` and the shared test contract change
- PHP syntax checks for every changed PHP file
- `git diff --check`
- secret and PII scan
- final dry-run 30/30

## 18. Safety Boundary

This task performs no production WordPress request with a mutation method, no
Supabase write, no main push, no deployment, no URL/canonical/sitemap change, no
hard delete, and no archive. The generated pilot payload contains no credentials and
is not executed automatically. Completion stops after local implementation,
verification, and the five artifacts.
