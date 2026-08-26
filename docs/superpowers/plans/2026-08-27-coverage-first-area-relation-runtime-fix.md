# COVERAGE-FIRST-AREA-RELATION-RUNTIME-FIX-01

## Decision

Classification: `A — DERIVED_PARENT_EXPECTED`.

Production term 13 (`shinosaka`) and term 17 (`sakai`) both have term 2
(`osaka`) as their direct parent. The active child theme registers
`auto_check_parent_area_terms()` on `save_post` at priority 10. During the
M0145 draft-first flow the area relations are assigned after draft insertion;
the later draft-to-publish `wp_update_post()` runs `save_post_shop` and then
`save_post`, where the active hook adds parent term 2.

Direct relation counts at the audit snapshot:

- Shinosaka: 49 published shops with term 13; 42 also directly relate term 2;
  7 do not (85.7%). The seven exceptions share the 2026-02-02 import timestamp.
- Sakai: 19 published shops with term 17; all 19 also directly relate term 2
  (100%).

Hierarchical `WP_Query` results are not used for this statistic because an
ancestor query includes descendants even when the parent relationship is not
stored directly.

## Local writer contract

1. Keep the manifest targets unchanged (`13`, `17`).
2. Validate the fixed production taxonomy contract before runtime work:
   `2=osaka,parent=0`, `13=shinosaka,parent=2`, and
   `17=sakai,parent=2`.
3. Derive allowed ancestors server-side and limit the result to term 2.
4. Accept actual relations only when every required target exists and every
   extra term is in the derived allowlist.
5. Capture the draft state before publish and read it again after publish:
   post type/status/title/slug, all six allowlisted ACF values and reference
   keys, provenance, Primary Area, and area relations.
6. Return a failure and force the new shop back to draft for a missing target,
   unknown extra relation, or any post-publish identity/ACF/provenance/Primary
   mutation.
7. Mark CREATE dry-run post-publish validation as
   `NOT_EXECUTED_DRY_RUN` because publish hooks have not run.
8. Add a pinned, content-read-only applied-state reconciliation contract for
   M0145/WP5070. It preserves applied audit 5071, keeps the ledger state
   `applied`, and appends a separate idempotent relation-reconciliation audit.
   It does not roll back or mutate WP5070.

## TDD evidence

Fail-first command:

```text
php tests/php/check-coverage-batch-writer-contract.php
```

RED reason: `escomi_coverage_allowed_derived_area_terms()` was intentionally
referenced before implementation and failed as undefined.

The focused suite covers exact targets, allowed parent, multiple targets with a
shared parent, missing targets, unknown extras, publish-hook parent addition,
publish-hook unknown addition, post-publish relation readback, proposed and
unplanned allowlisted ACF mutation, provenance mutation, Primary Area mutation,
identity mutation, UPDATE preservation, ADD_AREA_RELATION preservation,
rollback conflict protection, M0145 production state, applied reconciliation,
and reconcile replay idempotency.

Independent review initially found incomplete draft-recovery confirmation and
incomplete duplicate/final-CAS reconciliation lineage checks. Each finding was
converted to a fail-first fixture and fixed. Final independent review result:
`Critical 0 / Important 0`.

## Production resume plan (not executed in this task)

1. Keep the production write gate `FALSE`.
2. Reconfirm current production writer SHA and M0145/WP5070 state.
3. Back up and replace only `coverage-batch-writer.php`; verify the uploaded
   SHA and PHP syntax while the write gate remains `FALSE`.
4. Run all 30 operations in dry-run and explicitly retain
   `NOT_EXECUTED_DRY_RUN` for CREATE post-publish validation.
5. Reconcile M0145 applied state once using a fresh attempt ID; verify WP5070
   content hashes, relations, Primary Area, provenance, ledger, and both audits
   are unchanged except for the new reconciliation ledger fields/audit.
6. Stop for the separately authorized production-resume decision before any
   remaining Pilot or remainder operation.

Writer rollback is replacement with the pre-patch production file. M0145
content rollback is neither required nor permitted by this classification.
