# 50 migration non-destructive audit — 2026-10-21

This is a read-only source and production-catalog audit. It records no
approval to apply DDL, ACL/RLS, mappings, scheduler configuration, secrets or
deployments.

## Scope and current production evidence

- Source packet: the 50 files from `20261017120000` through
  `20261017175000`, plus `20261018100000`, `20261020030000` and
  `20261021000000`. `20261020030000` has SHA-256
  `c073a3b926b65c7120c9b7a2c13ca4323693197dc143470818d2d3c57a0ed184`.
- Read-only ledger check: all 50 are absent. The separately applied primary
  directory migration remains present and is not part of this packet.
- Relevant existing rows, checked without identifiers: `partner_workspaces`
  has 3 rows, all with a positive `wp_shop_id`, none with an `app_shop_id`;
  `managed_shops` has one `unlisted` row; `partner_login_email_audit_events`
  has zero rows. The v1.1 review, benefit, community, therapist and access
  tables named by the packet are not yet present.
- No `auth.*` schema reference, new credential, OAuth/provider setting,
  Storage-byte operation, DNS operation or deployment is present in the SQL
  packet.

## Static destructive-operation result

| Operation at migration execution time | Result | Consequence |
| --- | --- | --- |
| `DROP TABLE`, `DROP TYPE`, `DROP SCHEMA`, `DROP COLUMN` | None | No direct removal of a relation or column was found. |
| `TRUNCATE` or top-level `DELETE FROM` | None | No existing row is directly deleted while applying the 50 files. |
| Column type narrowing / `ALTER COLUMN ... TYPE` | None | No source-level type conversion was found. |
| Top-level data rewrite | Seven files, listed below | They must be treated as state/data migrations despite current expected zero-row scope. |
| `DROP FUNCTION` / trigger replacement | Present | Does not delete data, but changes an API surface and can leave an interrupted service if the runner does not execute one file atomically. |

The absence of SQL `DELETE` does not mean there are no future state-changing
operations: service-only functions defined by the packet can withdraw/hide a
review or community post, mark a managed shop as `deleted`, and prune expired
access-deduplication rows **when subsequently invoked**. None is called by the
migration itself, no scheduler is created, and no mapping/projection call is
embedded in the packet.

## Direct data rewrites (not runnable without the security gate)

| File | Statement effect | Current production impact from catalog check |
| --- | --- | --- |
| `20261017124000` | Normalizes an existing benefit eligibility value to `accepted_submission`. | Target table does not exist yet. |
| `20261017144000` | Copies therapist-right history and review/publication display snapshots. | Targets do not exist yet. |
| `20261017147000` | Backfills therapist history snapshots. | Target does not exist yet. |
| `20261017148000` and `20261017154000` | Fill review assessment snapshots. | Targets do not exist yet. |
| `20261017172000` | Creates observed-day records from access data and marks unprovable legacy community appeals for review while recording audit events. | Targets do not exist yet. |
| `20261017173000` | Changes `observed` access state to `missing` and marks legacy appeals for manual review with audit events. | Targets do not exist yet. |

The existing `partner_workspaces` alteration in `20261017120000` is schema
only: it adds nullable `app_shop_id`, relaxes `wp_shop_id` nullability and
requires exactly one identity. The three current rows satisfy the retained
WordPress-ID side of that check. It does not bind an app shop, create a managed
projection, or publish a shop. `20261018100000` similarly alters a currently
empty login-email audit table.

## ACL / authentication classification

47 of the 50 files contain direct RLS, `REVOKE`, `GRANT`, policy-equivalent
function exposure, or service-role execution changes. This is a deliberate
private-by-default design but remains a security change requiring the separate
action-time approval requested for this release.

- `20261017120000` is the dependency root and is inseparable from RLS on new
  therapist/review/benefit tables, revocation from `public`, `anon` and
  `authenticated`, and service-role table/function grants.
- Most following v1.1 files repeat the same pattern for their new private
  tables and private/API functions. They do not add a credential or alter
  Supabase Auth configuration.
- `20261020030000` is the distinct public change: it grants `anon` and
  `authenticated` execution on four `SECURITY DEFINER` public-review readers.
  Their source is RPC-only and filters approved published publications and
  non-public managed states, but that public execution grant still needs its
  own explicit approval.
- Only `20261017134000`, `20261017135000` (PostgREST parameter-name wrappers)
  and `20261018100000` contain no direct `GRANT`/`REVOKE`/RLS statement. The
  first two depend on objects created by earlier gated migrations; applying
  them out of sequence would violate the ledger dependency. The last is later
  in the ordered packet and must not leap over missing versions.

Therefore there is no migration that can be applied now while both preserving
ordered ledger semantics and excluding individually-approved security changes.

## Atomicity and stop boundary

The source has no explicit `BEGIN`/`COMMIT`, `CONCURRENTLY`, `VACUUM`,
`REINDEX`, or `ALTER TYPE ... ADD VALUE` marker. PostgreSQL can transactionally
execute the represented DDL and direct DML, but source review alone cannot
prove the production migration runner wraps a file and its ledger write in one
transaction. Before applying anything, the executor must confirm that exact
per-file atomicity. Do not use a runner that autocommits individual statements.

The only safe stop points are **before each file** and **after a successful
ledger-confirmed file**. There is no packet-wide transaction and no complete
down migration set. After any committed file, rollback is not guaranteed;
stop, collect the applied-ledger and error evidence, and use a separately
reviewed forward fix or the approved recovery process.

## Minimum action-time approval packet

To begin the ordered packet, approve the following exact scope together:

1. `20261017120000`–`20261017175000`, `20261018100000`,
   `20261020030000`, and `20261021000000`, applied in timestamp order with
   one confirmed atomic transaction and ledger write per file.
2. RLS enablement and revocation from `public`/`anon`/`authenticated` for the
   new v1.1 tables; service-role grants to the listed private/API functions and
   tables. This creates no new key, but changes database privileges.
3. The four explicit anon/authenticated `EXECUTE` grants in
   `20261020030000` for public-review RPCs only; no direct table grant.
4. No invocation of import/archive/delete-like service functions, no workspace
   mapping, no managed projection/publication, no scheduler, no external mail,
   no secret/DNS/deploy change.

If approved, risk is reduced without claiming rollback: preflight the ledger
and the exact 50 hashes immediately before the first file; apply a single file;
read back its ledger entry plus expected catalog object/ACL invariants; stop at
the first mismatch; then proceed to the next file. After `20261020030000`, run
the four public RPC boundary checks and direct-table-denial checks before any
mapping or runtime cutover. Store onboarding remains blocked on those runtime
and mapping gates.
