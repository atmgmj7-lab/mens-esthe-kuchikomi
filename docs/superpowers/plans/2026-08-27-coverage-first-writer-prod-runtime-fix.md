# Coverage First Writer Production Runtime Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productionと同じACF・hash・WP_Error・ledger条件をdry-runとapplyの共通validatorで検証し、M0004を履歴保持のまま安全にretry-readyへreconcileする。

**Architecture:** PHP writerに固定ACF definition contractとpureなruntime validatorを置き、REST dry-runとapplyが同じvalidatorを通る構成へ変更する。field-aware canonicalizationはcurrent field hashだけに適用し、immutable manifest payload hashは既存のcanonical JSON契約を維持する。M0004 reconcileはcaller入力ではなくserver-side固定contractで元audit・ledger・shop stateを検証し、追記auditとCAS ledger遷移だけを行う。

**Tech Stack:** PHP 8 / WordPress / ACF / Python 3 unittest / JSON SHA-256 / Next.js validation suite

**Spec:** `/Users/narikiyo/.codex/attachments/845b4e55-3748-43fb-8bfb-7b3d8250a98a/pasted-text.txt`

## Global Constraints

- `origin/main`とdirty rootを変更しない。
- main pushは禁止。source branch pushは許可済み。
- immutable manifest、URL、canonical、sitemap、Primary Area、HOLD 4件を変更しない。
- Production配置・reconcile・Pilot/remainderは全local gateとsecurity review PASS後のみ行う。
- Production write gateはapply直前だけTRUEとし、failureを含め必ずFALSEへ戻す。
- M0004 original ledgerとaudit ID 5066は削除・編集しない。
- Secret値をstdout、Git、reportへ出さない。

---

### Task 1: Field-aware hash contract

**Files:**
- Modify: `tools/eskomi_coverage_batch/hash_contract.py`
- Modify: `tests/fixtures/coverage-batch-hash-golden.json`
- Modify: `tools/eskomi_coverage_batch/tests/test_hash_contract.py`
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-hash-contract.php`

**Interfaces:**
- Produces: Python `canonical_field_value(field: str, exists: bool, value: Any) -> Any`
- Produces: PHP `escomi_coverage_canonical_field_value(string $field, bool $exists, $value)`
- Produces: field-aware `current_hash`; generic `payload_hash` remains byte-compatible with the immutable manifest.

- [ ] Add literal golden vectors for Japanese text, Unicode, slash, `～`, missing, empty, integer `13000`, string `"13000"`, and invalid numeric strings.
- [ ] Run Python and PHP hash tests and record RED for numeric int/string mismatch and invalid numeric acceptance.
- [ ] Implement strict `basic_price` normalization: positive integer or canonical digit string without leading zero, comma, suffix, decimal, or sign.
- [ ] Keep text values as strings and preserve missing versus empty.
- [ ] Re-run Python/PHP focused tests and confirm identical canonical bytes and SHA-256.

### Task 2: Fixed ACF definition contract

**Files:**
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Produces: `escomi_coverage_acf_contract(): array`
- Produces: `escomi_coverage_validate_acf_contract(?array $field_names = null)` returning the fixed key map or `WP_Error`.
- Consumes production definitions:
  - `official_url`: `field_6963dc02cb703`, `url`
  - `shop_address`: `field_6961cd30524ab`, `text`
  - `basic_price`: `field_69620c6d5f836`, `number`
  - `shop_hours`: `field_6961cd1b524aa`, `text`
  - `shop_tel`: `field_6961ccb0524a5`, `text`
  - `shop_booking`: `field_696452111cbb2`, `text`

- [ ] Replace the permissive test ACF mock with a complete key/name/type definition registry.
- [ ] Add RED cases for missing key, wrong name, wrong type, unknown field, and CREATE_NEW fixed-key use.
- [ ] Implement server-side fixed key/name/type contract and key-based `get_field_object()` validation.
- [ ] Make update, create, rollback, dry-run, and apply consume the validated fixed key only.
- [ ] Confirm no caller-supplied key and no raw meta fallback path exists.

### Task 3: Getter-only WP_Error and safe failure persistence

**Files:**
- Modify: `tests/php/check-coverage-batch-writer-contract.php`
- Modify: `coverage-batch-writer.php`

**Interfaces:**
- Test stub exposes only `get_error_code()`, `get_error_message()`, and `get_error_data()`.
- Writer uses WordPress getters for replay, failure audit, ledger error, and rollback error handling.

- [ ] Convert the test WP_Error stub to getter-only and record RED at every direct property access.
- [ ] Add an execution failure test that checks `error_code` in both private audit and ledger.
- [ ] Replace all `WP_Error->code` and `WP_Error->data` reads with getters.
- [ ] Re-run focused PHP tests and confirm safe error code persistence.

### Task 4: Shared pre-mutation runtime validator

**Files:**
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Produces: `escomi_coverage_validate_runtime_operation(array $manifest, array $operation, array $params)`.
- Returns a non-mutating validation plan containing status, action, post identity, fixed field keys/snapshots/planned values, area state, collision result, and ledger disposition.
- `dry_run` returns only after this validator passes; `apply` acquires the operation lock, invokes the same validator, then mutates from its returned plan.

- [ ] Add RED tests proving old dry-run falsely returns READY for bad ACF, field hash drift, slug drift, collision, and invalid ledger state.
- [ ] Add a test proving dry-run and apply return the same validator error code before mutation.
- [ ] Implement shared checks for manifest/auth, ID/slug, ACF key/name/type, field canonicalization/current hash, area ID/slug/taxonomy, collisions, ledger state, and operation/payload hash.
- [ ] Make HOLD return non-applicable without mutation and applied ledger return idempotent NO_CHANGE/replay.
- [ ] Refactor update/create/relation mutation functions to consume the validated plan and retain draft-first create/readback/publish behavior.

### Task 5: M0004 reconcile and retry ledger lifecycle

**Files:**
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Produces: `escomi_coverage_reconcile_contracts()` with the fixed M0004 audit/identity/area/Primary/provenance baseline.
- Produces: `escomi_coverage_reconcile_operation(array $manifest, array $operation, array $params)`.
- Adds request mode `reconcile`, allowed while write gate is FALSE but still requiring the dedicated capability.
- Ledger transition: `manual_review_required -> retry_ready -> applying -> applied`.

- [ ] Add RED tests for direct manual-review retry rejection, valid reconcile, state drift, payload mismatch, audit mismatch, same attempt UUID rejection, and reconcile idempotency.
- [ ] Validate audit ID 5066, original operation/payload/attempt, post 770 identity, unchanged current hashes, terms `[2,5,13,51]`, absent Primary Area, absent provenance, and zero lock.
- [ ] Append a new private reconcile audit without editing audit 5066.
- [ ] CAS the existing ledger to `retry_ready`, retaining original audit history and storing the reconciled state hash.
- [ ] Permit only a different valid attempt UUID to transition `retry_ready` to `applying`.
- [ ] Confirm a completed second request is idempotent and creates no second mutation/audit.

### Task 6: Local gate, review, and source commit

**Files:**
- Modify: `docs/superpowers/plans/2026-08-27-coverage-first-writer-prod-runtime-fix.md` only for checked execution state if needed.

- [ ] Run Python focused suite, PHP hash/writer tests, cross-language fixture, PHP lint, full `npm test`, lint, typecheck, build, `git diff --check`, and a credential-pattern scan.
- [ ] Review fixed field allowlist, REST auth/gate paths, immutable manifest SHA, ledger CAS, audit privacy, HOLD exclusion, and Secret handling; require Critical 0 / Important 0.
- [ ] Commit all reviewed source/test/plan files on `codex/coverage-first-batch-prep-01`.
- [ ] Push that source branch without force and verify `origin/main` remains unchanged.

### Task 7: Production patch and M0004 reconcile

**Files:**
- Deploy only verified `coverage-batch-writer.php`; deploy `functions.php` or manifest only if their verified bytes differ from production.

- [ ] Verify production gate FALSE and back up only the replaced writer.
- [ ] Stage, SHA-check, PHP-lint, and atomically replace the writer from the exact verified commit.
- [ ] Verify writer SHA, unchanged manifest SHA, endpoint, auth, and gate FALSE.
- [ ] Read back all six production ACF key/name/type contracts and require 6/6 PASS.
- [ ] Re-read M0004 original state, call reconcile with dedicated auth, and verify audit 5066 retained, one new reconcile audit, ledger `retry_ready`, shop/relations/Primary unchanged.

### Task 8: Fresh dry-run, Pilot, remainder, and final QA

- [ ] Execute authenticated fresh production dry-run for all 28 entities using the new shared validator.
- [ ] Require Pilot 9 blocking issues 0 and recompute SAME_CONTRACT_READY remainder; never include M0217, M0293, M0408, or M0661.
- [ ] Enable gate only for Pilot, apply nine operations sequentially with field/term/ledger/audit/public readback, then disable gate before QA.
- [ ] If Pilot passes, obtain a new snapshot, recompute remainder, enable gate, apply only fresh SAME_CONTRACT_READY operations, and disable gate immediately.
- [ ] Measure final Area counts and verify Top, both Area pages, changed shops, duplicates, wrong area, fake values, 0-yen fallback, drafts, unknown meta, Primary Area, and obvious regressions.
- [ ] Return an Execution Result Packet and stop without starting HOLD recovery, editorial, or GSC work.

## Self-review

- Spec coverage: FIX 1-6, twenty minimum tests, local gate, production patch, reconcile, 28 dry-run, Pilot/remainder, coverage, public QA, and safety all map to Tasks 1-8.
- Placeholder scan: no deferred implementation placeholders are present.
- Type consistency: Python/PHP current hash canonicalization is field-aware; payload hash stays generic and immutable-manifest compatible. Runtime validator and reconcile return either an associative plan/response or `WP_Error`.
