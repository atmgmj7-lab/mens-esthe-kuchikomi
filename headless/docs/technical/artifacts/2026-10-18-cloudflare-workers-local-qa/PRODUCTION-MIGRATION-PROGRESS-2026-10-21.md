# Production v1.1 migration progress — 2026-10-21

Scope: Supabase project `goeagrxjsjcbbatpotbu`, 50 approved v1.1 SQL files.
This record contains no secret, personal data, mapping, scheduler, deployment,
or external communication action.

## Applied and independently verified

The first 15 source-version migrations are committed and their ledger source
text SHA-256 matches the checked-in files exactly (15 expected, 15 exact,
zero mismatch):

| Version range | Count | Result |
| --- | ---: | --- |
| `20261017120000`–`20261017124000` | 5 | Applied and ledger-verified |
| `20261017130000`–`20261017134000` | 5 | Applied and ledger-verified |
| `20261017135000`, `17140000`, `17141000`, `17142000`, `17143000` | 5 | Applied and ledger-verified |

Each committed file was submitted as a single explicit PostgreSQL transaction:
transaction advisory lock, source SQL, source-text ledger insert using its
checked-in version/name, then commit. The transaction result read back its
version, name and source SHA-256 before the following file was attempted.

Independent production read-only verification after the stop found:

- `ledger_exact_count=15`, `ledger_mismatch_count=0`;
- zero RLS/direct-browser-privilege failures across the 23 v1.1 direct tables
  introduced in the applied range (RLS on; neither `anon` nor `authenticated`
  has direct `SELECT`); and
- the existing three `private.partner_workspaces` remain un-mapped
  (`app_shop_id_set=0`), so no mapping or managed projection was created.

## Stop boundary

The next exact source migration is
`20261017144000_eskomi_partner_therapist_history_and_membership.sql`
(SHA-256 `f11cf8b97e12872758e42897dac8e52589c0d85bdfdc10d6b1120e98de65281f`).

Its initial execution and the one permitted retry each returned
`McpServerError: Invalid or expired requestState`. Read-only state confirmation
after each attempt found both its ledger version absent and its new
`private.therapist_assignment_rights_history` table absent. It is therefore
known not to have executed. No subsequent file was sent.

The current checkpoint is 15/50 applied and 35/50 unrun, starting at
`20261017144000`. Resume only with a valid, current tool-specific approval
state; first re-read the ledger/schema checkpoint, then send this one file
once. Do not replay an expired request state or skip ahead.

## Approval-state observation

The provided manager notification IDs are orchestration notifications, not
accepted parameters for any available read-only status tool in this executor.
No tool for inspecting or reviving a `requestState` is exposed. The actual
execution result is unambiguous at the time of invocation: it was expired,
not an authorization denial. A fresh supported form/request state must be
issued by the platform workflow before resuming; user chat approval does not
impersonate that form.
