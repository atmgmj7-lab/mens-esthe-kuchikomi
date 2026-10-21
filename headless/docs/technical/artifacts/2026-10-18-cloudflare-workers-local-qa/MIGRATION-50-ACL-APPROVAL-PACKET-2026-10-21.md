# Production ACL/RLS approval packet — 2026-10-21

This source- and catalog-derived packet is for Supabase project
`goeagrxjsjcbbatpotbu`. It is not permission to apply anything. No production
migration, mapping, deploy, DNS, secret, OAuth/Auth setting, external mail, or
store contact has been performed.

## Requested bounded change

Apply exactly these 50 checked-in SQL files in timestamp order: every
`20261017120000`–`20261017175000` migration, then
`20261018100000_partner_login_email_canonical_audit.sql`,
`20261020030000_eskomi_public_review_read_rpc.sql` (SHA-256
`c073a3b926b65c7120c9b7a2c13ca4323693197dc143470818d2d3c57a0ed184`), and
`20261021000000_eskomi_access_collection_manifest_health.sql`.

The applied primary-directory migration is excluded and must not be reapplied.
The production ledger has all 50 versions absent. The intent is the
WordPress-independent v1.1 data contract for reviews, partner/therapist,
benefits, community, widgets and access collection; WordPress and Vercel remain
running and must not be deleted.

## Privilege change: before → after

| Principal | Before | After | Boundary |
| --- | --- | --- | --- |
| `public` | The v1.1 tables/functions do not exist; new PostgreSQL functions can otherwise inherit default public execute. | Explicitly no v1.1 table access or non-public function execute. | All new `app`/`private` v1.1 objects, except the four readers below. |
| `anon` | No v1.1 direct-table access. | Still no table read/write; only execute on the four named public-read RPCs. | Approved public review output only. |
| `authenticated` | No v1.1 direct-table access; no Auth user/provider change. | Still no table read/write; only those same four RPCs. Partner mutations remain server-side `service_role` calls with membership checks. | No blanket logged-in write grant. |
| `service_role` | Existing role/key; this packet generates or configures neither. | Explicitly scoped table privileges and RPC `EXECUTE` for v1.1 server routes. | New v1.1 objects only; this is a security-sensitive DB privilege change. |

The source pattern is `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL` from
`public, anon, authenticated`, then scoped `GRANT` to `service_role`. It has no
`GRANT ... ON TABLE` to `anon` or `authenticated`.

## Schemas and target table groups

`app`: `therapists`, `therapist_assignments`, `review_publications`, and
`review_experience_publications` are RLS-enabled publishable identity/projection
tables.

`private`, also RLS-enabled and browser-revoked, contains these groups:

- review/moderation: `review_entry_links`, `review_experiences`,
  `review_assessments`, `review_revisions`, `review_moderation_decisions`,
  `review_replies`, `review_submission_idempotency`,
  `review_experience_revisions`, `review_edit_receipts`,
  `guest_operation_sessions`, `operation_idempotency`,
  `operation_secret_replays`, `review_entry_rate_limits`,
  `review_submission_risk_flags`, `review_appeals_v11`, and
  `review_experience_reply_revisions`;
- benefits/outbox: `benefit_programs`, `benefit_codes`,
  `benefit_program_versions`, `benefit_redemptions`, `review_outbox`;
- partner/therapist/widget: `therapist_assets`,
  `partner_therapist_photo_uploads`, `therapist_assignment_rights`,
  `therapist_assignment_rights_history`, `partner_review_entry_link_bindings`,
  `partner_workspace_legacy_aliases_v11`, `review_widget_settings_v11`;
- community: `store_correction_requests_v11`, `community_posts_v11`,
  `community_reactions_v11`, `community_idempotency_v11`,
  `community_burst_limits_v11`, `community_post_reports_v11`,
  `community_post_appeals_v11`, `community_moderation_events_v11`; and
- access/health: `partner_shop_access_daily_v11`,
  `partner_shop_access_rollup_state_v11`, `partner_shop_access_dedupe_v11`,
  `partner_shop_access_observation_days_v11`,
  `partner_shop_access_context_limits_v11`,
  `partner_shop_access_context_issue_limits_v11`,
  `partner_shop_access_collection_runs_v11`,
  `partner_shop_access_collection_manifests_v11`.

Existing `private.managed_shops` gains nullable `app_shop_id`; existing
`private.partner_workspaces` gains nullable `app_shop_id` and an exactly-one
WP-ID/app-shop-ID check. This creates neither a mapping nor a managed
projection. The three existing workspace rows satisfy the retained legacy-ID
branch in read-only preflight.

## Only public execute grant

`20261020030000` revokes first, then grants `EXECUTE` to `anon, authenticated`
only for these `SECURITY DEFINER` functions:

1. `api.list_public_review_experience_publications_global(integer, integer, text)`
2. `api.count_public_review_experience_publications_global(text)`
3. `api.list_public_shop_detail_reviews_v11(text, integer, integer)`
4. `api.get_public_shop_detail_review_summary_v11(text)`

They return only approved/published review fields: public handle, rating,
bounded body/nickname, optional therapist display name and publication time;
global output also has canonical shop UUID/slug/name and nullable explicit
primary-area UUID/slug/name; detail may include its latest approved reply; the
summary has counts, average and time range. They do not return receipts, hashes,
IP/device signals, private moderation history, benefit codes, partner data, or
direct table access.

Every reader joins an approved active revision to a published `app.shops` row,
requires published publication state, bounds output lengths, and excludes a shop
where a linked `private.managed_shops` row is non-published. Global results use
a left join: primary-null stores appear globally but never satisfy an area
filter. The SQL sets `search_path = ''` and fully qualifies table names.

## Authenticated action boundary

The packet grants no direct authenticated table mutation. Operational API/private
functions are browser-revoked and service-role executable. Their final ordered
membership predicates require an active membership matching supplied Auth user
and workspace, an `owner` for therapist/operational writes or `owner`/`manager`
for named reads, allowed workspace state, and a published canonical shop.
Canonical home/listing also requires a linked published managed-shop row.
Review/community mutation additionally checks hashed receipt/session/idempotency
and target scope. Privileged functions use restricted explicit search paths;
these grants are still a security-sensitive approval item.

## Explicit exclusions and risk

- The 50 SQL files contain no `auth.*` reference, Auth/OAuth/provider change,
  user/account creation, credential/key generation, or external secret transfer.
- They contain no Storage bucket/policy/object-byte operation. Metadata/object
  keys are not authorization to upload; real Storage remains separately gated.
- They contain no DNS, deploy, scheduler, email send, store contact, mapping,
  managed projection, or publication invocation.
- Static audit found no top-level `DROP TABLE`, `DROP TYPE`, `DROP SCHEMA`,
  `DROP COLUMN`, `TRUNCATE`, top-level `DELETE FROM`, or type conversion.
  Seven migrations include backfill/state rewrite SQL, but their v1.1 targets do
  not exist in production and first-run scope is expected to be zero rows.
- Later service functions can withdraw/hide content, mark a managed shop
  deleted, or prune expired dedupe data when called later; migrations call none.

There is no complete down-migration set. Retained WordPress/Vercel is not a
complete Supabase partner-account/permission recovery source.

## Validation and stop rule

Immediately before an approved run: recheck existing/absent ledger versions and
the exact hashes; apply one atomic file; read back that file's ledger row,
catalog/ACL invariants and unexpected-row counts; stop at first mismatch. After
`20261020030000`, test the four anonymous RPC boundaries and direct-table
denial before mapping or runtime cutover. Stopped/draft/unclassified shops and
non-public managed states must remain excluded.

## Runner atomicity: known vs proved

Official migration documentation confirms ordered tracking in
`supabase_migrations.schema_migrations`, but the available production
`apply_migration` description/docs do not promise atomic source-file plus ledger
write. The repository's earlier synthetic runner used autocommit. No production
runner was executed or trialled.

The new synthetic-only runner
`headless/scripts/run-eskomi-v11-synthetic-atomic-migration-rehearsal.sh` uses
an internal Docker PostgreSQL 17 fixture and executes each file as `BEGIN` →
source SQL → synthetic ledger insert → `COMMIT`; it never names the production
project and removes the fixture on exit. On 2026-10-21, all migrations and the
public-RPC verifier passed. A second run injected an exception after
`20261017120000` SQL but before its ledger row, proving that neither that row
nor `app.therapists` remained. This proves the synthetic runner design only,
not production MCP behavior.

Production remains blocked until an execution path explicitly guarantees this
per-file SQL-plus-ledger transaction, or a user separately accepts documented
non-atomic runner risk.
