# Eskomi v1.1 — first-pilot minimum gate (2026-10-18)

## Decision and boundary

This is the executable pre-publication packet for **one** first pilot store.
It is not an authorization to migrate, map, deploy, or change a production
environment.  The operator fills the pilot manifest below before requesting
that separate authorization.

| Required manifest item | Value to record (no secrets) |
| --- | --- |
| Immutable application SHA | `<approved branch commit SHA>` |
| Pilot legacy WP shop ID | `<one positive integer>` |
| Pilot legacy slug | `<exact existing slug>` |
| Pilot legacy canonical URL | `https://mens-esthe-kuchikomi.com/shops/<slug>/` |
| Expected `workspace_id`, `managed_shop_id`, `app_shop_id` | `<three UUIDs from the read-only candidate result>` |
| Operator / reviewer / rollback owner | `<named accountable roles>` |
| Backup evidence | `<provider snapshot ID, timestamp, retention, restore authority>` |

The three values identifying a legacy store are its WP ID, slug, and canonical
URL.  Names, partial slugs, and visual similarity are never identity evidence.
Of the three existing legacy workspace/managed-shop candidates, exactly one is
in scope for this pilot; the other two remain read-only and unmapped.

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

## Read-only, one-store binding preflight

Run the following only through the approved read-only production replica or
snapshot after the canonical schema is present.  Replace the manifest
placeholders in the operator's secured console; do not include the returned
UUIDs in public tickets or source control.

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

After a separately approved pilot mapping, use only the signed pilot URL:
`https://mens-esthe-kuchikomi.com/shops/<pilot_slug>/`.  The operator performs
and records:

1. an authenticated partner login for the pilot workspace, followed by a
   canonical listing change request and ordinary administrator review;
2. a public GET of the signed pilot URL, canonical tag, JSON-LD, and the
   selected pilot's approved projection after review;
3. a public GET of `/reviews/`, the home review cards, a relevant area page,
   and any active widget.  Their reader/source setting and baseline counts
   must be unchanged for the minimum pilot; and
4. a cross-workspace denial check against an unrelated store, with identifiers
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
