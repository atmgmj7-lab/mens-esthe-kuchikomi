# Supabase-primary access and dependency audit — 2026-10-19

## Scope and result

This audit covers the proposed `api.get_public_site_directory_v1()` migration
and the state-preserving preflight only.  It does **not** apply a production
migration, publish content, change Storage objects, enable the application
cutover flag, or modify DNS, secrets, OAuth, Auth configuration, or billing.

The current production preflight completed in a `BEGIN READ ONLY` transaction
with no result rows and no exception.  It verified all required invariants:

- 382 `app.shops`, 34 `app.areas`, and 241 current Storage image URLs;
- zero published shops, areas, and contents; and zero public shop-image rows;
- all 241 image URLs match their completed
  `wordpress-media-url-cutover` import records;
- all fourteen WordPress-only IDs are still absent from `app.shops`;
- the two Supabase-only records (1255 and 1259) remain drafts; and
- legacy WP ID 1272 remains an unlisted managed record paired with a draft app
  row.

The generated, ignored preflight artifact is
`supabase/imports/20261019-primary-preflight-v3.sql`.  It is a check only: it
contains no DML, DDL, privilege, or Storage mutation.

## Access-control finding

The migration is not merely a data-free change.  It:

1. creates a **`SECURITY DEFINER`** RPC in schema `api`;
2. revokes the function from Postgres `public`; and
3. grants function execution to Supabase `anon` and `authenticated` roles.

This is intentional because the existing `app` tables already grant browser
roles `SELECT` and depend on RLS to show only published rows.  A
`SECURITY DEFINER` RPC therefore bypasses table RLS for its own reads and must
enforce its public filter in its SQL body.

The audited function exposes only the selected public fields for:

- `app.shops` with `publication_status = 'published'` and a published primary
  area;
- published areas, posts, and the exact six fixed-page routes; and
- a featured image only when `is_public` is true.

It does not grant table privileges, touch `private.import_*`, or return private
workspace, review, receipt, or moderation fields.  The preflight tests the
actual RLS behavior correctly: `anon` may possess table `SELECT`, but must see
no rows while every relevant entity is non-public.

The primary-area delta described in
[`PRIMARY-AREA-DELTA-REHEARSAL-2026-10-19.md`](PRIMARY-AREA-DELTA-REHEARSAL-2026-10-19.md)
adds **no** grant, RLS policy, RPC, table privilege, or public state. It only
sets selected existing `app.shop_areas.is_primary` values while shops and areas
remain non-public. It therefore creates no new reader and, before the separate
directory-RPC migration plus a future publication manifest, the real public
directory remains empty. The 44 assignments are preparation, not public-access
approval.

### Managed-shop correction

The first version of the primary RPC would have selected a published app shop
without consulting the already-established managed-shop withdrawal state.  That
could re-expose an unlisted/deleted legacy identity after a later publication.

`20261019090000_eskomi_supabase_primary_public_directory.sql` now suppresses a
shop when `private.managed_shops.existing_wp_shop_id = app.shops.wp_post_id`
and `publication_state <> 'published'`.  It intentionally uses the existing
legacy WordPress identity, not the newer `app_shop_id` mapping, so it works on
the current production migration ledger.

The source contract was first made to fail for this condition, then updated.
The local rehearsal applied the actual migration plus one visible and one
unlisted synthetic managed shop in a single transaction; the RPC returned only
the visible shop and the transaction rolled back.

## Migration dependency review

Production's remote ledger currently contains 46 migration entries.  The
repository contains 101 migration files; filenames alone show 50 later source
migrations not present under the same version on the remote ledger (the former
"48" count is stale after the newer 2026-10-18 and 2026-10-19 files).  Several
older entries are timestamp aliases of already-applied semantic migrations, so
they must not be blindly replayed either.

The primary-directory migration has only these direct prerequisites:

| Required remote migration | Why it is required | Current ledger |
| --- | --- | --- |
| `20260714020257_seo_safe_content_core` | `app.shops`, areas, images, contents, RLS, and the `api` schema | present |
| `20261015031602_operator_managed_shop_directory` | `private.managed_shops` and `existing_wp_shop_id` | present |
| `20261015033805_operator_managed_shop_visibility_and_nullable_fields` | `publication_state` | present |
| `20261015171757_archived_managed_shop_state` | allows the `deleted` state covered by `<> 'published'` | present |

It has no technical dependency on the broader October-17 review/therapist/
community migration chain.  Those 50 migrations are intentionally excluded
from this narrow batch because they add unrelated private tables, review and
partner APIs, moderation behavior, and further grants.  Applying all of them
as a prerequisite would enlarge the authorization surface rather than make the
directory projection safer.

## Logical backup and local restore rehearsal

No paid PITR purchase is needed for this single-function migration.

- The state-preserving preflight acts as the data snapshot/reconciliation
  guard: it reads the relevant row counts, exact 241 URL mapping records,
  excluded IDs, and RLS visibility before any DDL.
- The local rehearsal executes the exact production migration file, exercises
  the public RPC as `anon`, verifies managed unlisting, and rolls back.  This
  proves both apply and schema rollback without changing the preserved local
  fixture.
- If the production migration were approved and needed reversal, the bounded
  rollback is the removal of this newly-created RPC and a PostgREST reload;
  it does not delete or restore any data or Storage object.  That operation
  still needs its own execution approval.

The available connected DB interface does not expose a row-restorable
`pg_dump`/Storage export.  A full logical export of all 382 shop rows is not
needed to reverse this data-free function migration, but is a required separate
gate before a future data/publication batch.  That future export may use an
existing approved database-export capability; do not add credentials merely to
make this narrow migration possible.

## Approval boundary for the next production action

Do not apply anything yet.  The smallest future request is a single migration:

```text
Apply 20261019090000_eskomi_supabase_primary_public_directory.sql only.
Before: execute the versioned read-only preflight and confirm 382/34/241,
0/0/0 public counts, fourteen exclusions, two drafts, and unlisted 1272.
After: verify the RPC exists, execute is limited to anon/authenticated,
base-table RLS still hides non-public rows, and the same preflight passes.
```

That request does **not** authorize setting `CONTENT_DATA_SOURCE=supabase`,
setting any expected public count, publishing the 394-source corpus, importing
the 14 review-required shops, changing the two hot-spring drafts, touching
image 357, or changing any account/security configuration.
