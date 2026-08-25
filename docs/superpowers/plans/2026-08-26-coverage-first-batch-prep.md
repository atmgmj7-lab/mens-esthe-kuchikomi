# Coverage First Batch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a production-disabled strict WordPress writer plus a local compiler that dry-runs all 30 BASIC candidate-area rows as 28 execution entities and emits the five required handoff artifacts.

**Architecture:** A Python standard-library package compiles the approved CSV sources, fetches a bounded public WordPress snapshot, validates the 13/shinosaka and 17/sakai term contract, performs field-level dry-run, and emits an immutable JSON manifest and handoff artifacts. A separate PHP REST writer loads only that manifest and enforces capability, write-enable, lock, ledger, audit, conflict, draft-first create, readback, publish, and rollback contracts server-side.

**Tech Stack:** Python 3 standard library and `unittest`; WordPress PHP; existing Node contract-test harness; JSON/CSV/Markdown artifacts; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-coverage-first-batch-prep-design.md`

## Global Constraints

- Start from `origin/main@ef06f4587fd349ef5a4c6275b4a106a4b3e0fc35` in the dedicated clean worktree.
- Production WordPress write, Supabase write, main push, deploy, URL/canonical/sitemap change, hard delete, and archive are prohibited.
- The source set is exactly 20 Shinosaka plus 10 Sakaihigashi BASIC candidate-area rows and exactly 28 execution entities.
- M0145 is one cross-area create operation and is included in the initial pilot after the 2026-08-26 live collision recheck.
- CREATE is draft-first and may publish only after complete readback.
- Direct writes are limited to `official_url`, `shop_address`, `basic_price`, `shop_hours`, `shop_tel`, `shop_booking`, and fixed area terms.
- `shop_station`, `shop_access`, `shop_booking_url`, `shop_line`, image, therapist, attendance, editorial, ranking, review, and rating remain deferred.
- Python and PHP must pass the same checked-in current-hash and payload-hash golden fixture.
- No dependency or lockfile change.

---

### Task 1: Cross-language hash contract

**Files:**
- Create: `tests/fixtures/coverage-batch-hash-golden.json`
- Create: `tools/eskomi_coverage_batch/__init__.py`
- Create: `tools/eskomi_coverage_batch/hash_contract.py`
- Create: `tools/eskomi_coverage_batch/tests/__init__.py`
- Create: `tools/eskomi_coverage_batch/tests/test_hash_contract.py`
- Create: `tests/php/check-coverage-batch-hash-contract.php`

**Interfaces:**
- Produces Python `canonical_json(value) -> str`, `current_hash(field, exists, value) -> str`, and `payload_hash(payload) -> str`.
- Produces PHP `escomi_coverage_canonicalize`, `escomi_coverage_current_hash`, and `escomi_coverage_payload_hash` in the later writer file; the PHP fail-first test initially requires functions that do not exist.
- The fixture contains literal expected hashes and is normative for both languages.

- [ ] **Step 1: Add the golden fixture and Python/PHP failing tests**

The fixture covers missing, empty, integer, Unicode, URL slash, and M0145 multi-area payloads. Python tests import the three functions and assert every literal digest. The PHP test requires `coverage-batch-writer.php` and asserts the same fixture.

- [ ] **Step 2: Run RED**

Run:

```bash
python3 -m unittest tools.eskomi_coverage_batch.tests.test_hash_contract -v
php tests/php/check-coverage-batch-hash-contract.php
```

Expected: Python fails because `hash_contract` is missing; PHP fails because the writer/hash functions are missing.

- [ ] **Step 3: Implement the minimal Python hash contract and a PHP hash-only writer skeleton**

Canonical JSON recursively sorts object keys, preserves list order, uses compact separators, unescaped Unicode/slashes, and hashes UTF-8 bytes with SHA-256. PHP code must be safe to load under the test stubs and must not register or execute a mutation during include.

- [ ] **Step 4: Run GREEN**

Run the two commands from Step 2. Expected: all golden cases pass in both languages.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures tools/eskomi_coverage_batch coverage-batch-writer.php tests/php/check-coverage-batch-hash-contract.php
git commit -m "test: define coverage batch hash contract"
```

### Task 2: Strict source compiler and 30-to-28 projection

**Files:**
- Create: `tools/eskomi_coverage_batch/models.py`
- Create: `tools/eskomi_coverage_batch/compiler.py`
- Create: `tools/eskomi_coverage_batch/tests/test_compiler.py`

**Interfaces:**
- Consumes the two mapping CSVs and optional W3 CSV paths.
- Produces `compile_batch(actions_path, proposed_path, source_paths) -> BatchManifest`.
- `BatchManifest` exposes `candidate_rows`, `operations`, `pilot_operation_ids`, and `source_hashes`.

- [ ] **Step 1: Write failing compiler tests**

Tests require exact counts 20/10, 30 candidate rows, 28 operations, M0145 one create with `[13,17]`, M0241 one update for WP 683, initial pilot 9 operations/10 candidate rows, and rejection of non-BASIC, unknown actions, duplicate area/Master keys, non-HTTPS sources, and unknown direct fields.

- [ ] **Step 2: Run RED**

```bash
python3 -m unittest tools.eskomi_coverage_batch.tests.test_compiler -v
```

Expected: fail because models/compiler are absent.

- [ ] **Step 3: Implement immutable dataclasses and strict compilation**

Use `csv.field_size_limit(sys.maxsize)`, normalize only exact documented fields, preserve deferred evidence separately, derive deterministic operation IDs, and compute payload hashes through Task 1.

- [ ] **Step 4: Run GREEN and full Python focused tests**

```bash
python3 -m unittest discover -s tools/eskomi_coverage_batch/tests -v
```

- [ ] **Step 5: Commit**

```bash
git add tools/eskomi_coverage_batch
git commit -m "feat: compile fixed coverage batch manifest"
```

### Task 3: Public WordPress snapshot and dry-run classification

**Files:**
- Create: `tools/eskomi_coverage_batch/wordpress_snapshot.py`
- Create: `tools/eskomi_coverage_batch/dryrun.py`
- Create: `tools/eskomi_coverage_batch/tests/fixtures/wp_snapshot.json`
- Create: `tools/eskomi_coverage_batch/tests/test_dryrun.py`

**Interfaces:**
- `fetch_public_snapshot(base_url, timeout, retries) -> WordPressSnapshot` uses GET only.
- `dry_run(manifest, snapshot) -> DryRunResult` emits per-field statuses and candidate/entity summaries.
- Area contract is exactly `{13: "shinosaka", 17: "sakai"}`.

- [ ] **Step 1: Write failing area, conflict, duplicate, and idempotency tests**

Tests require `AREA_CONTRACT_MISMATCH` for swapped/renamed terms, `CONFLICT` only on changed fields, `NO_CHANGE` for equal values/relations, CREATE hold on exact URL/telephone/address/title/slug collision, 30/28 completeness, and identical second dry-run with duplicate shop/relation/double update counts all zero.

- [ ] **Step 2: Run RED**

```bash
python3 -m unittest tools.eskomi_coverage_batch.tests.test_dryrun -v
```

- [ ] **Step 3: Implement bounded GET client and pure dry-run engine**

Use explicit trailing slashes, `_fields`, four-page bounded pagination, connect/read timeout, maximum three retries, and no credentials or Authorization header. Treat incomplete pages as failure rather than a partial snapshot.

- [ ] **Step 4: Run GREEN**

```bash
python3 -m unittest discover -s tools/eskomi_coverage_batch/tests -v
```

- [ ] **Step 5: Commit**

```bash
git add tools/eskomi_coverage_batch
git commit -m "feat: add read-only coverage batch dry run"
```

### Task 4: Manifest and five handoff artifacts

**Files:**
- Create: `tools/eskomi_coverage_batch/artifacts.py`
- Create: `tools/eskomi_coverage_batch/cli.py`
- Create: `tools/eskomi_coverage_batch/tests/test_artifacts.py`
- Generate: `data/coverage-first/coverage-batch-manifest-2026-08-25.json`
- Generate externally: the five required artifacts under `/Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_BATCH_PREP_2026-08-25/`

**Interfaces:**
- `write_manifest(result, path)` writes canonical JSON with mode 0600.
- `write_handoff_artifacts(result, output_dir)` writes exactly the five required names.
- CLI requires explicit source/output paths and defaults to dry-run; it has no apply mode in this task.

- [ ] **Step 1: Write failing artifact tests**

Tests assert deterministic bytes, CSV formula escaping, no secrets, exact filenames, 30 candidate rows, 28 entities, pilot metadata 9 operations/10 rows while retaining the legacy `PILOT_8_PAYLOAD` filename, remainder 19 operations/20 rows, and rollback sections for update/relation/create.

- [ ] **Step 2: Run RED**

```bash
python3 -m unittest tools.eskomi_coverage_batch.tests.test_artifacts -v
```

- [ ] **Step 3: Implement artifact writers and CLI**

Write atomically through a same-directory temporary file and `os.replace`; never write source credentials or request headers. Report unknown values as empty/`NOT_VERIFIED`, never numeric zero.

- [ ] **Step 4: Run GREEN and generate the checked-in manifest**

```bash
python3 -m unittest discover -s tools/eskomi_coverage_batch/tests -v
python3 -m tools.eskomi_coverage_batch.cli --actions /Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24/ESKOMI_COVERAGE_FIRST_WP_ACTIONS_2026-08-24.csv --proposed /Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_WP_MAP_2026-08-24/ESKOMI_COVERAGE_FIRST_CURRENT_PROPOSED_2026-08-24.csv --w3-final /Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_FINAL_DATASET_2026-08-23.csv --w3-proposed /Users/narikiyo/Downloads/ESKOMI_SHINOSAKA_SAKAIHIGASHI_WP_PROPOSED_V3_2026-08-23.csv --manifest data/coverage-first/coverage-batch-manifest-2026-08-25.json --output-dir /Users/narikiyo/Downloads/ESKOMI_COVERAGE_FIRST_BATCH_PREP_2026-08-25
```

- [ ] **Step 5: Commit**

```bash
git add tools/eskomi_coverage_batch data/coverage-first/coverage-batch-manifest-2026-08-25.json
git commit -m "feat: generate coverage batch dry run artifacts"
```

### Task 5: PHP security, storage, and lifecycle contract

**Files:**
- Modify: `coverage-batch-writer.php`
- Create: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- POST `/escomi/v1/coverage-batch` accepts only `batch_id`, `operation_id`, `attempt_id`, `payload_hash`, and `mode`.
- `escomi_coverage_validate_area_contract()` requires 13/shinosaka and 17/sakai.
- Lock option: `_escomi_coverage_lock_<sha256(batch|operation)>`, non-autoloaded, TTL 120 seconds.
- Ledger option: `_escomi_coverage_ledger_<sha256(batch|operation)>`, non-autoloaded, 400-day documented retention.
- Audit CPT: `coverage_batch_audit`, private and absent from REST/UI.

- [ ] **Step 1: Write failing PHP tests for the server boundary**

Tests cover POST-only route, manifest load failure, unknown input, custom plus standard capability, absent/false write constant 503, dry-run allowed while disabled, exact area ID/slug validation, lock contention/stale CAS/release ownership, ledger payload mismatch/replay/lifecycle fields, private audit CPT, and secret-safe responses.

- [ ] **Step 2: Run RED**

```bash
php tests/php/check-coverage-batch-writer-contract.php
```

- [ ] **Step 3: Implement minimal route, validation, lock, ledger, and audit helpers**

Do not grant capabilities automatically. Read only the checked-in manifest. Never accept arbitrary meta/status. Keep apply disabled unless `defined(...) && ESKOMI_COVERAGE_BATCH_WRITE_ENABLED === true`.

- [ ] **Step 4: Run GREEN plus existing WordPress security tests**

```bash
php tests/php/check-coverage-batch-writer-contract.php
cd headless && npm run test:wp-phase0-security
```

- [ ] **Step 5: Commit**

```bash
git add coverage-batch-writer.php tests/php/check-coverage-batch-writer-contract.php
git commit -m "feat: enforce coverage batch writer boundary"
```

### Task 6: UPDATE, RELATION, draft-first CREATE, and rollback helpers

**Files:**
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- `escomi_coverage_plan_operation()` is side-effect-free.
- `escomi_coverage_apply_update()`, `escomi_coverage_apply_relation()`, and `escomi_coverage_apply_create()` mutate only manifest values.
- `escomi_coverage_apply_create()` inserts draft, writes/readbacks, then publishes/readbacks.
- `escomi_coverage_apply_rollback()` uses ledger snapshots and current-hash guards.

- [ ] **Step 1: Add failing mutation tests one behavior at a time**

Tests cover field-only conflicts, ACF field-key requirement, no-op omission, transaction-style update rollback, append-only relation/no duplicate, CREATE collision checks over all statuses, draft-first ordering, no publish before readback, publish failure returned to draft, retry returns the same draft/post ID, update rollback, relation rollback, and create rollback to draft without delete/archive.

- [ ] **Step 2: Run RED after each behavior group**

```bash
php tests/php/check-coverage-batch-writer-contract.php
```

- [ ] **Step 3: Implement the minimal mutation and rollback helpers**

All state transitions update the owned ledger by compare-and-swap and append a new private audit record. Response bodies contain IDs, field/status codes, and hashes only.

- [ ] **Step 4: Run GREEN**

```bash
php tests/php/check-coverage-batch-writer-contract.php
php tests/php/check-coverage-batch-hash-contract.php
```

- [ ] **Step 5: Commit**

```bash
git add coverage-batch-writer.php tests/php/check-coverage-batch-writer-contract.php
git commit -m "feat: add idempotent coverage batch operations"
```

### Task 7: Integration wiring and related verification

**Files:**
- Modify: `functions.php`
- Modify: `headless/package.json`
- Create: `headless/scripts/check-coverage-batch-contract.mjs`

**Interfaces:**
- `functions.php` loads the writer only from a readable child-theme file and fails closed when absent.
- `npm run test:coverage-batch` runs Python focused tests and both PHP contracts.
- Existing daily update route and public proxy remain unchanged.

- [ ] **Step 1: Write failing Node contract test**

Assert the require wiring, separate route, POST-only method, no daily allowlist expansion, no arbitrary post status/meta, no hard delete/archive, draft-before-publish markers, fixed area pair, golden fixture test references, and package script.

- [ ] **Step 2: Run RED**

```bash
cd headless && node scripts/check-coverage-batch-contract.mjs
```

- [ ] **Step 3: Add wiring and npm script**

Add `test:coverage-batch` to `headless/package.json` and include it in the main `test` chain without dependency or lockfile changes.

- [ ] **Step 4: Run GREEN and focused suite**

```bash
cd headless && npm run test:coverage-batch && npm run test:wp-phase0-security
```

- [ ] **Step 5: Commit**

```bash
git add functions.php headless/package.json headless/scripts/check-coverage-batch-contract.mjs
git commit -m "test: integrate coverage batch security checks"
```

### Task 8: Final 30/30 dry-run, full verification, and review

**Files:**
- Regenerate external five artifacts.
- Modify only implementation/report files if verification exposes a tested defect.

**Interfaces:**
- Final artifacts and manifest must reproduce from the recorded source hashes.
- Final review returns specification compliance and code-quality/security findings separately.

- [ ] **Step 1: Run final live dry-run twice**

Use the Task 4 CLI command twice and compare artifact SHA-256. Require 30/30 candidate rows, 28/28 entities, duplicate shop/relation/double update zero, Pilot 9 operations, and remainder 19 operations.

- [ ] **Step 2: Run all verification**

```bash
python3 -m unittest discover -s tools/eskomi_coverage_batch/tests -v
php -l coverage-batch-writer.php
php -l functions.php
php tests/php/check-coverage-batch-hash-contract.php
php tests/php/check-coverage-batch-writer-contract.php
cd headless && npm run test:coverage-batch && npm run lint && npm run typecheck && npm test && npm run build
git diff --check
```

Run a repository/output secret scan for private keys, Authorization headers, JWTs,
Application Password values, and service-role values. Confirm the production site
received only GET/HEAD requests during this task.

- [ ] **Step 3: Review specification compliance**

Check every original completion condition and all five revision requirements against
code, tests, artifacts, and fresh command output. Record all findings with severity;
do not declare PASS with unresolved Critical or Important findings.

- [ ] **Step 4: Review code quality and security**

Review manifest trust boundary, cross-language hashes, capability/write-enable,
locks, ledgers, audit retention, draft-first ordering, collision checks, rollback,
CSV safety, secret handling, and absence of production mutation.

- [ ] **Step 5: Commit verified local implementation**

```bash
git add -A
git commit -m "feat: prepare coverage first batch writer"
```

Do not push, deploy, or invoke the production mutation route.
