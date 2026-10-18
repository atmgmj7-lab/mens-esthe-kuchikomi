# Eskomi v1.1 — first-pilot minimum gate (2026-10-18)

## Decision and boundary

This is the executable pre-publication packet for **one** first pilot store.
It is not an authorization to migrate, map, deploy, or change a production
environment.  The operator fills the pilot manifest below before requesting
that separate authorization.

| Required manifest item | Value to record (no secrets) |
| --- | --- |
| Immutable application SHA | `<approved branch commit SHA>` |
| Pilot legacy WP shop ID | `768` — Mrs.Rank UP（ミセスランクアップ） |
| Pilot legacy slug | `mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89` |
| Pilot legacy canonical URL | `https://mens-esthe-kuchikomi.com/shops/mrs-rank-up%EF%BC%88%E3%83%9F%E3%82%BB%E3%82%B9%E3%83%A9%E3%83%B3%E3%82%AF%E3%82%A2%E3%83%83%E3%83%97%EF%BC%89/` |
| Expected `workspace_id`, `managed_shop_id`, `app_shop_id` | `<three UUIDs from the read-only candidate result>` |
| Operator / reviewer / rollback owner | `<named accountable roles>` |
| Backup evidence | `<provider snapshot ID, timestamp, retention, restore authority>` |

The three values identifying a legacy store are its WP ID, slug, and canonical
URL.  Names, partial slugs, and visual similarity are never identity evidence.
The target is already fixed by existing repository records and the current
public URL; the user does not need to re-supply an ID.  Of the three existing
legacy workspace/managed-shop candidates, exactly this one is in scope; the
other two remain read-only and unmapped.  The three private UUIDs still require
the secured read-only preflight because they cannot be inferred from a URL.

## Public-reader impact assessment

`ESKOMI_V11_PUBLIC_REVIEW_SOURCE=supabase` is **not** a store-level control.
`public-adapter.ts` uses it for both the canonical shop-detail reader and the
global `listGlobalPublications` reader.  It therefore affects all shop detail
review pages and the site-wide review surfaces at the same time.

`RANKUP_NATIVE_REVIEW_READ_SOURCE=supabase` is a different existing native
review pilot.  It is not evidence that the v1.1 global reader has been cut
over, and it must not be used to justify one.

There is **No per-store public-review flag** in this release packet.  Adding
one would be a new product/security design and is out of scope.  The safe
choices are:

1. **Minimum first pilot — eligible after its separate production approval.**
   Keep `ESKOMI_V11_PUBLIC_REVIEW_SOURCE` unset/non-`supabase`; also leave
   `SHOP_DIRECTORY_SOURCE` unchanged.  Perform only the authorized pilot
   workspace mapping and partner operational workflow.  The existing public
   review and directory readers remain unchanged.  This proves the selected
   partner workflow, not a v1.1 public-review cutover.
2. **Global v1.1 public-reader cutover — blocked for the first pilot.**
   Before changing `ESKOMI_V11_PUBLIC_REVIEW_SOURCE`, compare every affected
   existing reader, including all public shop review pages, `/reviews/`, home
   review cards, area latest-review sections, widget outputs, counts, publish
   states, pagination, canonical URLs, and deny/tombstone behavior.  A
   one-store comparison cannot establish this; do not change the flag until
   the full-reader comparison has no unexplained difference and has its own
   approval.

This distinction permits a new canonical store to be operationally piloted
without mapping all three legacy workspaces.  It does not permit regressions
for the already-existing stores, nor does it relax their future exact-mapping
requirement.

## Where an approved v1.1 review is actually visible

The v1.1 individual review URL is `https://mens-esthe-kuchikomi.com/r/<review_handle>/`.
After human approval, its row is published in
`app.review_experience_publications`.  That alone does **not** make it appear
on the normal public shop page.

| Surface | With the minimum pilot flags unchanged | What this proves |
| --- | --- | --- |
| Individual entry URL `/r/<review_handle>/` | Accepts the selected shop's v1.1 review flow. | Collection only; it is not a public review list. |
| v1.1 widget `/partner/widget/<widget_handle>/` | **Displays the approved v1.1 review.** Its route first calls `getV11Widget`, which reads `get_public_review_widget_v11` directly. It requires an active widget handle, published canonical shop, and published managed-shop projection. | The shop can show the approved review in its external widget without `ESKOMI_V11_PUBLIC_REVIEW_SOURCE`. |
| Normal Mrs.Rank UP shop page and `/shops/<slug>/reviews/` | **Does not display the v1.1 review.** With the flag unchanged, `publicReviewAdapter` remains on the legacy/native path. | The minimum route is not a completed “review visible on the Eskomi store page” launch. |
| `/reviews/`, home cards, area latest-review sections | **Does not display the v1.1 review.** These use the global legacy/native path until the v1.1 flag changes. | The minimum route is not a completed site-wide review launch. |

The existing `RANKUP_NATIVE_REVIEW_READ_SOURCE=supabase` can instead show
**legacy native** Rank UP reviews on the shop page, the legacy widget route,
and the global review route.  It cannot display the v1.1 individual-link
reviews above because those are in the canonical v1.1 publication model.  In
addition, its global-reader branch fail-closes unless the current WordPress
global review total is exactly zero; a fresh authorized preflight must prove
that condition, rather than relying on the public snapshot in this document.

### Recommendation for the stated first-store goal

If “店舗導入完成” means both collection and the approved review being readable
on the normal Eskomi Mrs.Rank UP page **and** in the widget, the minimum
unchanged-reader route is insufficient.  There are only two safe choices:

1. **Widget-only operational pilot:** use the v1.1 entry and widget handles;
   label it explicitly as “collection + external widget proof, Eskomi store
   page pending.”  It is appropriate only if that limited outcome is accepted.
2. **Complete first-store introduction:** do the actual-data comparison for
   every global v1.1 reader listed above, preserve the zero/deny/tombstone
   checks, then obtain a separate approval to set
   `ESKOMI_V11_PUBLIC_REVIEW_SOURCE=supabase`.  This is a global reader
   cutover, not a store-level action; it must be rolled back as a reader/config
   change if comparison or post-publish checks fail.

The native Rank UP flag is a third, legacy-model alternative, not a substitute
for the requested canonical therapist/individual-link flow.  No new feature
flag is proposed.

## Migration application order — operator runbook

Do not select individual SQL files or alter migration history.  The source of
truth is the repository's complete `supabase/migrations/` sequence sorted by
its 14-digit timestamp filename.  The v1.1 tail begins at
`20261017120000_eskomi_canonical_shop_foundation.sql`, includes
`20261017164000_eskomi_legacy_workspace_mapping.sql`, and currently ends at
`20261018100000_partner_login_email_canonical_audit.sql`.

Before any write, an authorized production operator must:

1. Record the immutable application SHA and the exact sorted local migration
   manifest.  Compare it to the production migration ledger using the
   organization-approved **read-only** database/Supabase procedure.
2. Stop if the ledger contains a non-prefix gap, an unknown version, a changed
   file checksum, or a different candidate SHA.  Resolve that release-history
   discrepancy before a deployment window is opened.
3. Use the normal migration tool in its dry-run/plan mode to show the first
   absent migration through the current final migration.  Attach the plan to
   the release ticket; do not paste credentials or connection strings into it.
4. After explicit production approval, apply the resulting ordered plan once,
   then re-read the migration ledger.  No down migration, migration-history
   rewrite, or manual SQL reorder is allowed.

This task performed only a repository-local ordering check; it did not access
any production migration ledger.

The redacted read-only reconciliation of the actual ledger boundary and the
Mrs.Rank UP prerequisites is maintained in
[`2026-10-18-pilot-migration-gap-reconciliation.md`](2026-10-18-pilot-migration-gap-reconciliation.md).
It identifies a migration/preparation hard stop before this packet's one-row
mapping preflight can become eligible.

## Read-only, one-store binding preflight

Run the following only through the approved read-only production replica or
snapshot after the canonical schema is present.  The target WP ID, slug, and
URL are fixed above; enter only those values into the operator's secured
console.  Do not include the returned UUIDs in public tickets or source
control.

```sql
select *
from api.list_legacy_partner_workspace_mapping_candidates_v11()
where legacy_wp_shop_id = :pilot_wp_shop_id
  and legacy_shop_slug = :pilot_slug
  and legacy_canonical_url = :pilot_canonical_url;
```

The preflight passes only when the query returns **exactly one** row and all of
the following are true:

- `mapping_status = 'ready'`;
- returned legacy WP ID, slug, and canonical URL equal the signed manifest;
- the three returned UUIDs equal the manifest's `workspace_id`,
  `managed_shop_id`, and `app_shop_id`;
- `app_shop_slug` equals the legacy slug and `app_canonical_path` equals
  `/shops/<pilot_slug>/` exactly; and
- the full unfiltered candidate report has been attached as restricted release
  evidence, with the remaining two candidates marked **out of scope / no
  write**.

Zero rows, more than one row, any `mapping_status` other than `ready`, or any
identity mismatch is a hard stop.  Do not substitute a name match.  The later
write, if separately authorized, must pass the same three UUIDs first to
`api.bind_legacy_managed_shop_to_app_shop_v11(...)` and then to
`api.map_legacy_partner_workspace_to_canonical_v11(...)`; this packet neither
executes nor authorizes either call.

## Backup, recovery, and release evidence

**No production database write** was made for this packet.  **No backup
retrieval or upload** was performed.  The pilot cannot open until the operator
has recorded the backup evidence shown in the manifest and the restore owner
has confirmed they can restore to a non-production recovery target.  The
backup object, credentials, and any exported data remain outside this
repository.

For an incident after an authorized pilot write:

1. Stop new v1.1 entry/partner traffic using the approved operational control;
   do not enable `ESKOMI_V11_PUBLIC_REVIEW_SOURCE` as a workaround.
2. Return the application/read configuration to the last verified version
   without deleting migration history or application data.
3. Preserve audit rows, receipts, moderation state, deny/tombstone overlays,
   and redeemed-state evidence; do not use a destructive DB down migration.
4. Escalate a restore only to the named restore owner after scope, storage
   location, and authority are re-confirmed.  Test restoration only in the
   recovery target, not in production.

The release record must retain actor, start/end time, SHA, planned/applied
migration versions, input/output counts, observed differences, failure, and
recovery decision.

## Pilot URL and post-publish checks

After a separately approved pilot mapping, use only the signed pilot URL in
the manifest.  The operator performs and records:

1. an authenticated partner login for the pilot workspace, followed by a
   canonical listing change request and ordinary administrator review;
2. a public GET of the v1.1 widget URL from the authenticated partner growth
   readback.  It must show the human-approved review and link back to the
   signed pilot URL; record the handle only in the restricted release record;
3. for the widget-only pilot, a public GET of the signed pilot URL,
   `/reviews/`, home review cards, and a relevant area page.  Their legacy
   reader/source and baseline counts must remain unchanged, and the release
   record must state that the v1.1 review is intentionally absent there; or
4. for the complete-introduction option, the same public GETs must show the
   approved v1.1 review only after the full global-reader comparison and the
   separately approved reader cutover; and
5. a cross-workspace denial check against an unrelated store, with identifiers
   redacted from the release record.

The **camera QR** check is a manual user/device check: scan the issued QR with
a real camera, compare the resolved host/path with the signed pilot URL, and
record only pass/fail plus the device class.  Do not add an image upload or
retain the QR payload in this repository.

## Explicitly not complete

- T43 independent collector / health manifest is unimplemented.  Its status
  is **collection status unknown / comparison not possible**, distinct from
  GA4/GSC and from this pilot's HTTP evidence.
- This packet does not prove production DB contents, production email delivery,
  a Vercel preview, paid-plan eligibility, main merge, deployment, or a
  production browser traversal.
- Disposable HTTP fixtures prove the scoped normal Next paths only.  They do
  not authorize an external production action.
