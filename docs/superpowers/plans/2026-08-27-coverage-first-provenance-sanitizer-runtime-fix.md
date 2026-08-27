# Coverage First Provenance Sanitizer Runtime Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dry-run and apply use the same WordPress provenance URL/sanitizer path, isolate candidate-specific failures, and safely reconcile the existing M0240 draft without creating or deleting a shop.

**Architecture:** `coverage-batch-writer.php` will prepare a complete provenance plan before any ledger or content mutation. The plan resolves only public HTTPS redirects through WordPress safe HTTP APIs, requires the final host to match the original host modulo `www.`, then passes the exact records through `escomi_sanitize_shop_fact_provenance()`. Runtime results carry a server-owned `SAME_CONTRACT_READY`, `CANDIDATE_HOLD`, or `SYSTEMIC_BLOCKING` classification. A pinned M0240 reconcile contract validates WP5086 and either moves its ledger to retry-ready for same-post resume or to an idempotent provenance HOLD while leaving the draft untouched.

**Tech Stack:** PHP 8, WordPress REST API/HTTP API/options/posts/taxonomy, ACF, shell-based PHP contract tests, Python unittest, Next.js npm gates.

**Spec:** `/Users/narikiyo/.codex/attachments/f94ef0f0-8bf7-4fd6-9d6b-ea6e6809bd92/pasted-text.txt`

## Global Constraints

- Never bypass `wp_http_validate_url()` or permit private/reserved IP addresses.
- Never add unsafe URL allowlists or hard-coded DNS/IP values.
- M0240 must reuse WP5086; do not create a second post and do not hard-delete WP5086.
- Candidate HOLD may continue the batch only when detected before mutation or after complete draft recovery/readback.
- Any unknown mutation, recovery failure, auth/manifest/taxonomy/ACF failure is `SYSTEMIC_BLOCKING`.
- Keep M0217, M0293, M0408, and M0661 untouched.
- Keep Primary Area unchanged and finish every production block with WRITE_ENABLED FALSE.
- Do not merge or push to `main`; the source branch may be pushed after the full local gate and independent review.

---

### Task 1: Fail-first provenance sanitizer parity tests

**Files:**
- Modify: `tests/php/check-coverage-batch-writer-contract.php`
- Test: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Consumes: manifest operations and the existing WordPress test doubles.
- Produces: test doubles for `escomi_shop_public_meta_url()`, `escomi_sanitize_shop_fact_provenance()`, and `wp_safe_remote_head()` plus assertions for `escomi_coverage_prepare_provenance()`.

- [x] **Step 1: Add literal URL fixtures and safe-head responses**

```php
$GLOBALS['coverage_source_contracts'] = [
    'https://accepted.example/' => ['status' => 200],
    'https://redirect.example/' => ['status' => 301, 'location' => 'https://www.redirect.example/final/'],
    'https://unsafe.example/' => ['error' => 'http_request_failed'],
];
```

- [x] **Step 2: Add behavior tests before implementation**

```php
coverage_expect(escomi_coverage_prepare_provenance([], $accepted_fields)['status'] === 'PROVENANCE_READY', 'Accepted source must be ready');
coverage_expect_error(escomi_coverage_prepare_provenance([], $rejected_fields), 'provenance_source_rejected');
coverage_expect_error(escomi_coverage_prepare_provenance([], $unsafe_redirect_fields), 'provenance_source_rejected');
```

The fixtures separately cover accepted, rejected, same-host redirect, unsafe redirect, private IP, malformed URL, and M0240 production DNS rejection.

- [x] **Step 3: Run RED**

Run: `php tests/php/check-coverage-batch-writer-contract.php`

Expected: FAIL because `escomi_coverage_prepare_provenance()` and the failure-scope contract do not exist.

---

### Task 2: Shared provenance plan and failure-scope contract

**Files:**
- Modify: `coverage-batch-writer.php`
- Test: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Consumes: `escomi_shop_public_meta_url()`, `escomi_sanitize_shop_fact_provenance()`, `wp_safe_remote_head()`, manifest field evidence.
- Produces:
  - `escomi_coverage_prepare_provenance(array $current, array $field_items)`
  - `escomi_coverage_failure_scope($result): string`
  - runtime arrays containing `classification`, `provenance_status`, and `hold_reason`

- [x] **Step 1: Resolve a source with the WordPress safe path**

```php
function escomi_coverage_resolve_provenance_source(string $source) {
    $accepted = escomi_shop_public_meta_url($source);
    if ($accepted === '') {
        return new WP_Error('provenance_source_rejected', 'Provenance source was rejected.', [
            'status' => 409,
            'failure_scope' => 'CANDIDATE_HOLD',
        ]);
    }
    // Follow a bounded redirect chain with wp_safe_remote_head(), validating
    // every target and requiring the canonical final host to match.
    return $accepted;
}
```

- [x] **Step 2: Build and sanitize the exact records once**

```php
function escomi_coverage_prepare_provenance(array $current, array $field_items) {
    // Replace records by category, resolve each unique source, then run the
    // full candidate through escomi_sanitize_shop_fact_provenance().
    // Any dropped or changed record fails before mutation.
}
```

- [x] **Step 3: Reuse the plan in dry-run and apply**

`escomi_coverage_validate_runtime_operation()` prepares the plan before returning READY. `escomi_coverage_apply_update()` and `escomi_coverage_apply_create()` pass the prepared value to `escomi_coverage_write_provenance()` instead of rebuilding it after field writes.

- [x] **Step 4: Make server-owned failure scope observable**

Candidate field/current-state/collision/provenance failures return a non-writable HOLD result with `classification=CANDIDATE_HOLD`. Auth, manifest, ACF, taxonomy, lock, ledger, and recovery errors return `failure_scope=SYSTEMIC_BLOCKING`.

- [x] **Step 5: Run GREEN and regression tests**

Run:

```bash
php tests/php/check-coverage-batch-writer-contract.php
php tests/php/check-coverage-batch-hash-contract.php
```

Expected: both PASS.

---

### Task 3: M0240 failed-draft reconcile contract

**Files:**
- Modify: `coverage-batch-writer.php`
- Modify: `tests/php/check-coverage-batch-writer-contract.php`

**Interfaces:**
- Consumes: pinned M0240 payload/audit/post contract and `escomi_coverage_prepare_provenance()`.
- Produces: M0240 reconcile result `retry_ready` or `candidate_hold`, preserving WP5086 and audit/ledger lineage.

- [x] **Step 1: Add RED fixtures for the exact production state**

```php
$m0240_contract = [
    'post_id' => 5086,
    'status' => 'draft',
    'failure_audit_id' => 5087,
    'area_terms' => [13],
    'provenance_value' => [],
];
```

Assert that a rejected source leaves fields, relations, Primary Area, post count, and status unchanged; appends one private lineage audit; and moves the ledger to `candidate_hold_provenance` idempotently.

- [x] **Step 2: Add accepted-source resume tests**

Change only the test URL contract to accepted, reconcile to `retry_ready`, then apply with a new attempt. Assert the same WP5086 is published after provenance/draft/publish readback and no second shop is inserted.

- [x] **Step 3: Add the pinned reconcile implementation**

Validate identity, draft status, all planned ACF values, `[13]`, absent Primary Area, empty sanitized provenance, ledger payload/attempt lineage, original audit 5087, and no lock. Reserve the ledger before appending a new audit so retries cannot create orphan audits.

- [x] **Step 4: Run RED then GREEN**

Run: `php tests/php/check-coverage-batch-writer-contract.php`

Expected RED: missing M0240 reconcile contract. Expected GREEN: all writer contract assertions PASS.

---

### Task 4: Local release gate and independent review

**Files:**
- Verify: `coverage-batch-writer.php`
- Verify: `tests/php/check-coverage-batch-writer-contract.php`
- Verify: `docs/superpowers/plans/2026-08-27-coverage-first-provenance-sanitizer-runtime-fix.md`

- [x] **Step 1: Run the full local gate**

```bash
php -l coverage-batch-writer.php
php tests/php/check-coverage-batch-writer-contract.php
php tests/php/check-coverage-batch-hash-contract.php
python3 -m unittest discover -s tools/eskomi_coverage_batch/tests -v
cd headless && npm test && npm run lint && npm run typecheck && npm run build
git diff --check
```

Run the repository secret-pattern scan without printing matched secret values.

- [x] **Step 2: Independent review**

Request separate specification and code-quality/security review. Fix every Critical and Important finding, then rerun the complete gate.

- [x] **Step 3: Commit and push only the source branch**

Verify `origin/main` divergence and exclude unrelated main release commits. Commit the plan, writer, and test changes, then push `codex/coverage-first-batch-prep-01`. Do not push or merge `main`.

---

### Task 5: Production patch, classify 11 entities, and resume Wave1

**Files:**
- Production replace only: `wp-content/themes/swell_child/coverage-batch-writer.php`

- [x] **Step 1: Patch with WRITE_ENABLED FALSE**

Back up the exact current writer, upload to a temporary path, run PHP syntax and SHA checks, then atomically replace the writer. Recheck writer/manifest/functions SHA and endpoint with content mutation 0.

- [x] **Step 2: Run production sanitizer parity evidence**

Verify accepted, same-host redirect, unsafe/private/malformed rejection, and the M0240 classification without enabling writes.

- [x] **Step 3: Fresh-classify all 11 unfinished entities**

Invoke the production REST handler for M0240 and the ten NOT_STARTED operations. If any response is `SYSTEMIC_BLOCKING`, keep the gate FALSE and stop. Exclude only server-classified `CANDIDATE_HOLD` operations.

- [x] **Step 4: Reconcile M0240**

With the current classification C, reconcile WP5086 to an idempotent candidate HOLD. Confirm draft, original audit 5087, new lineage audit, unchanged ACF/relations/Primary Area, no duplicate, lock 0, and no public route.

- [x] **Step 5: Apply only SAME_CONTRACT_READY operations**

Enable the gate only around sequential REST apply. After every operation verify final readback, ledger, audit, lock, duplicate, relation, Primary Area, and unknown meta. A mutation-time failure is systemic and stops the batch. Always restore gate FALSE.

- [x] **Step 6: Coverage and public QA**

Measure direct term 13 and 17 relations from WordPress, compare 53/20 and sprint 48/18 baselines, then verify Top, both area pages, changed shops, and M0240 non-exposure. Stop before Wave2.

## Execution evidence (2026-08-27)

- Source commits: `0d0344c7532d3acfb39bffa56bf483d1b6ef66a8`, `b904c42e046ac320036a58feece916f0f0597d1f`.
- Production writer SHA-256: `8014ec1e4cb9bbcf78aa75555e27cb21f211a64017d56a2c03eaaa4ce59c3cc3`.
- Fresh classification: 9 `SAME_CONTRACT_READY`, 2 `CANDIDATE_HOLD` (M0240 and M0655), 0 `SYSTEMIC_BLOCKING`.
- Applied: M0241, M0244, M0250, M0260, M0480, M0644, M0647, M0660, M0663.
- M0240: WP5086 remains draft; audit 5087 retained; candidate-hold lineage audit 5126; public route 404.
- Coverage: shinosaka 53 to 54 (sprint 48 to 54); sakai 20 to 22 (sprint 18 to 22).
- Final safety: WRITE_ENABLED false, lock count 0, hard delete 0, Wave2 not started.
