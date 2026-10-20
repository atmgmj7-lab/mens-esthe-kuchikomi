# v1.1 public-review migration readiness — 2026-10-20

## Decision

Do **not** apply the whole `20261017120000`–`20261017156000` chain merely to
enable public review reads.  It is a product/workflow migration, not a
read-model-only migration: it creates private receipt/session/risk data,
submission, moderation, partner, benefit, therapist, widget, and community
surfaces; replaces existing RPC contracts; and includes immediate backfills.

For the Cloudflare public read cutover, the smallest approved candidate is
instead `20261020030000_eskomi_public_review_read_rpc.sql`, *after* the v1.1
review publication data model exists and has a separately approved source/data
plan.  The candidate creates only four bounded public projections and grants
only their `EXECUTE` privilege to `anon` and `authenticated`; it grants no
table privilege.

## Production evidence (read-only)

- The production catalog did not contain `private.review_experiences`,
  `private.review_experience_revisions`, or
  `app.review_experience_publications`; nor did it contain the four public
  review-reader RPCs.  Current production `api.published_reviews` returned
  zero rows.
- A normal certificate-validated HTTPS read of the legacy WordPress authority
  used SNI `sv16727.xserver.jp`, HTTP Host `mens-esthe-kuchikomi.com`, and
  `GET /wp-json/escomi/v1/reviews?page=1&per_page=1`.  It returned HTTP 200:
  `{"items":[],"total":0,"totalPages":0,"page":1}`.  This confirms the
  public legacy review corpus is currently empty; it is not an assertion about
  private, draft, or non-public data.
- The ordinary sandbox could not open the fixed-IP TLS connection.  The
  permitted read was repeated outside that network sandbox with certificate
  verification still enabled; no TLS bypass, credential, or write was used.

## Why the historical chain is not a safe read-only dependency

| Range | What it changes | Read-cutover status |
| --- | --- | --- |
| `171200`–`171240` | canonical shops, review/benefit tables, RLS, submission/moderation functions; alters legacy private constraints and backfills benefit eligibility | not minimal; includes write workflows |
| `171300`–`171350` | v1.1 experience-publication/receipt/session/rate-limit tables and submission wrappers | data-model prerequisite only; do not apply without a reviewed write/data plan |
| `171400`–`171470` | therapist selection/history/photo rights plus reply/benefit operations; `171440` and `171470` backfill/update existing rows | not needed to show an empty public list; replies require `171470` only after the review model exists |
| `171480`–`171530` | guest edits, widgets, RPC contract drops/replacements, redemption hardening, corrections/community and anonymous mutation controls | unrelated to the four public reads and expands personal-data/abuse scope |
| `171540` | public shop-detail projection and an immediate `assessment_snapshot` backfill | useful historical projection, but superseded for public access by the dedicated four-RPC migration; not apply solely for reads |
| `171550` | future canonical directory create/publish/archive wrappers that mutate shops/areas when invoked | unrelated to existing-read exposure |
| `171560` | global list/count functions, initially service-role-only | source for two projections, but not sufficient for browser/Worker public reads without a new, reviewed public grant |

The historical public functions in `171540`/`171560` are `SECURITY INVOKER`
and are explicitly revoked from `anon`/`authenticated`; granting them directly
would not provide the required privilege boundary.  The dedicated migration
uses `SECURITY DEFINER`, a fixed `private, app, api, pg_temp` search path,
explicit argument bounds, output allow-lists, and explicit revokes before the
two public-role grants.

## Immediate data and compatibility risks

- No top-level `DELETE`, `TRUNCATE`, `DROP TABLE`, or `DROP SCHEMA` occurs in
  the reviewed chain.  It does, however, contain immediate `UPDATE` backfills
  in `171240` (benefit eligibility), `171440` (review/publication snapshots),
  `171470` (therapist rights history), `171480` and `171540` (assessment
  snapshots).  Those updates can lock rows and change existing stored values.
- `171490`, `171510`, and `171520` drop/recreate overloads of API/private
  functions.  This can interrupt callers and changes function OIDs/argument
  contracts even though no tables are dropped.
- The chain introduces personal or sensitive operational data: hashed session,
  receipt, idempotency, replay and IP-risk values; private review bodies and
  edit appeals; therapist-rights history; partner replies; and community
  correction/reaction data.  None is necessary for today's empty public-read
  result.
- Many private functions are `SECURITY DEFINER`.  They generally pin
  `search_path` and validate inputs, but the full chain has too broad a
  privilege surface to accept by inspection as a one-purpose public-read
  deployment.  Every function owner and all schema `CREATE` grants must be
  checked in the target catalog before any application.

## Safe staged application plan (requires new approval)

1. **Baseline only (read-only):** record catalog/column/function-signature and
   ACL diffs for `app`, `private`, and `api`; capture row counts only, not
   review bodies or hashes.  Confirm no earlier migration version is already
   recorded and no application depends on the RPC signatures that later files
   drop.
2. **Clone/local rehearsal:** restore a production-shape schema into an
   isolated local database without exporting personal fields; run each proposed
   SQL unit in a transaction; retain logs; test rollback by transaction
   rollback.  Exercise 0/public/hidden review states plus unpublished shop,
   unlisted area, invalid/oversized pagination and direct-table denial.
3. **Review-model decision:** separately approve either (a) no import while
   the legacy public corpus remains empty, or (b) a source-specific migration
   that supplies only reviewed, publishable records.  Do not infer private,
   draft, or legacy WordPress data into publications.
4. **Minimal production release:** apply only the dedicated four-RPC migration
   once its prerequisites are present.  Immediately verify function owner,
   `prosecdef`, `proconfig` search path, exact `anon`/`authenticated` execute
   ACL, zero table grants, and the four HTTP/RPC results.  Verify both global
   and shop-detail projections return only published/approved data and hide
   hidden/unpublished records.
5. **Application cutover:** only then enable the Supabase public-read flag and
   run the retained local HTTP E2E.  The Cloudflare build/deploy remains a
   distinct approval; it is not implied by the database release.

## Required approvals before a production change

1. Permission to run production DDL/GRANT for the four dedicated public
   reader functions (currently expressly out of scope).
2. A source/data approval for any non-empty review migration, including
   provenance, moderation state, retention, and rollback owner.
3. If the complete v1.1 chain is desired: explicit approval for its private
   submission/receipt/session/partner/community data model, immediate
   backfills, RPC replacement window, and a maintenance/rollback plan.
4. Approval to enable the application flag and, separately, to deploy a
   Cloudflare/production build.

## Verification and rollback

The four-RPC release is atomic when run as one migration transaction.  Before
cutover, save function definitions/ACLs and the exact baseline query output.
If verification fails, keep the application flag on WordPress and restore the
previous function definitions/ACLs in a new reviewed migration; do not delete
review rows, storage objects, volumes, or migration history.  The full v1.1
chain has no safe generic down migration because it creates persistent tables
and backfills values; rollback for that path is restore/forward-fix only and
must be planned before approval.
