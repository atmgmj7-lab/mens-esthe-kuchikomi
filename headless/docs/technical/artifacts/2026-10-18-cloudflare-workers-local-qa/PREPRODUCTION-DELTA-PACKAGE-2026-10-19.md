# Supabase primary pre-production delta package — 2026-10-19

## Decision

This is a **state-preserving delta package**, not a repeat of the historical
WordPress full import.  Do not run
`npm run supabase:prepare-full-import` against production for this cutover.
That generator reads the old WordPress image URLs and its rendered shop rows
include `app.shop_images`; using it after the approved Storage cutover can
replace the current Supabase Storage URLs with WordPress URLs.

The immediate safe target is therefore:

- apply only the missing read-only public-directory migration;
- leave all current content and visibility state unchanged;
- publish **zero** shops, areas, columns, and fixed pages; and
- make no write at all until the named backup and the review queues below have
  an owner-approved, immutable input manifest.

This package does not authorize DNS, Cloudflare, Secrets, OAuth, Auth, Storage
object deletion, or a main-branch merge.

## Read-only baseline

The production read on 2026-10-19 returned the following counts.

| Object | Current state | Cutover target in this package |
| --- | ---: | ---: |
| `app.shops` | 382 | 382 unchanged |
| published `app.shops` | 0 | 0 |
| `app.areas` | 34 | 34 unchanged |
| published `app.areas` | 0 | 0 |
| `app.contents` published | 0 | 0 |
| `private.managed_shops` | 1 | 1 unchanged/unlisted |
| public `managed_shops` | 0 | 0 |
| `app.shop_images` | 241 current Storage URLs | 241 URLs preserved exactly |
| public `shop_images` | 0 | 0 |

The one managed-shop/app-shop overlap is legacy WordPress ID **1272**,
`はなの湯`; its managed state is `unlisted` and its matching app row is a
draft.  It is not a new managed-shop import candidate and must not be
double-counted or published.

### Reconciliation ledger

| Source/reconciliation class | Count | Required action |
| --- | ---: | --- |
| published WordPress `shop` posts | 394 | inventory only; no bulk reimport |
| exact WordPress/Supabase `wp_post_id` matches | 380 | preserve existing draft row, associations, and Storage image URL |
| WordPress-only posts | 14 | keep out of `app`; create/retain a human `review_required` queue only |
| Supabase-only drafts | 2 | keep draft and excluded; do not delete, publish, or infer source intent |
| source areas / current `app.areas` | 34 / 34 | preserve unpublished state until a publication manifest exists; no primary-area decision is required |
| source posts | 0 | no column projection |

The 14 WordPress-only records are deliberately not auto-classified because
their published metadata does not establish a safe industry/category and some
have multiple areas:

`5070 イチゴみるく`, `5074 MONOTONE SPA`, `5079 ROYAL MADAM`, `5082 大人時間`,
`5129 Mrs.Two Heart`, `5135 Mrs.C’est la vie`, `5137 Mrs.Nostalgia`,
`5175 MACHERIE`, `5177 Mrs.Merci SPA`, `5181 Pulchra`, `5183 ヌまるSPA新大阪`,
`5185 Mr.Dandies`, `5187 Mrs.美Witch 一条通ルーム`, `5189 ミセスムーンR 堺東ルーム`.

The two Supabase-only drafts are `1255 天然温泉 ひなたの湯` and
`1259 あしぎぬ温泉`.  Neither has evidence authorizing reactivation, deletion,
or publication.

### Images are already on the new side of the boundary

The completed, separately approved media transfer reconciled 241 referenced
shop images to `shop-images/wordpress-media/...` and switched the corresponding
`app.shop_images.image_url` values to Supabase Storage.  The batch is
`1b6babf3-5105-4ed5-a262-32deb10de6b2`; its 241 old/new URL pairs are retained
in `private.import_records`.  A delta import must assert all of the following
before it can start:

1. there are exactly 241 rows in the approved image set;
2. every current URL equals the recorded Supabase Storage target URL; and
3. the proposed input contains **no** `image_url`, `wp_media_id`, or
   `app.shop_images` mutation.

The fixed-page WordPress media ID **357** is not part of this 241-row shop-image
transfer.  It remains a separately scoped outstanding asset, not a reason to
rerun the shop import.

## Fixed pages and public target

The primary public projection has a strict six-route allowlist:

| Route | Source disposition | This package |
| --- | --- | --- |
| `/contact/` | WordPress fixed page | keep WordPress-backed; do not publish a projection yet |
| `/about/` | WordPress fixed page | keep WordPress-backed; do not publish a projection yet |
| `/sitemap/` | WordPress fixed page | keep WordPress-backed; do not publish a projection yet |
| `/storelisting/` | WordPress fixed page | keep WordPress-backed; do not publish a projection yet |
| `/advertise/` | application route/fallback (not a WordPress page import) | requires an approved canonical content source |
| `/osaka-nihonbashi/` | WordPress fixed page | keep WordPress-backed; do not publish a projection yet |

The WordPress inventory therefore has five source fixed pages plus one
application-owned route; the public projection requires all six exactly.  The
top page (`/`) is not one of these six.  Until the route source and each page's
canonical content are reconciled, `SUPABASE_CONTENT_EXPECTED_PAGES` must remain
unset and primary public mode must not be enabled in production.

The only safe public target now is **0 shops / 0 areas / 0 columns / 0 fixed
pages**, because no publication manifest or static-page migration exists yet.
It is **not** caused by area shape: 74 source shops have no area and 243 have
multiple areas, both of which must retain their canonical shop detail URL.
The public reader keeps every published shop, returns all of its published area
relations for area lists, and uses a generic store breadcrumb when no explicit
primary area exists. A matching row count alone is not a publication approval.

### Defined publication-candidate ID set (not an approval to publish)

The read-only 2026-10-19 reconciliation defines the source-matching draft
candidate set as these **379 WordPress IDs**:

```text
640–894, 1165–1254, 1256–1258, 1260–1271, 1273–1291
```

It is computed as 394 source IDs, minus the fourteen `review_required` records,
minus ID 1272 (`unlisted` in the managed workflow).  It contains neither of the
Supabase-only hot-spring drafts (1255 and 1259). Of the 379 candidates, 304
have at least one stored area relation, **zero have `is_primary = true`**, and
74 have no stored area relation. A source-grounded plan identifies 44 explicit
ACF-backed primary relations; its other 335 candidates need no manual decision
for publication and remain optional metadata without inference. See
[`PRIMARY-AREA-DELTA-REHEARSAL-2026-10-19.md`](PRIMARY-AREA-DELTA-REHEARSAL-2026-10-19.md).
The current approved public subset remains **empty** only because no rows or
areas are approved for publication.

Before this set can become a publication manifest, each candidate's publication
state and all expected public counts/routes must be reviewed as one immutable
manifest. Never infer a primary area from relation ordering or the presence of
a secondary area; missing primary metadata simply selects the generic route.

## Required production migration, but not executed here

The production migration ledger ends at
`20261015182000_managed_shop_nonpublic_listing_states`.  Repository migration
`20261019090000_eskomi_supabase_primary_public_directory.sql` is not present in
that ledger.  It creates a public `SECURITY DEFINER` RPC and grants execute to
`anon`/`authenticated`; it does not import, publish, update, or delete source
data.  This is still an access-control change, so the detailed audit is in
[`SUPABASE-PRIMARY-ACCESS-AND-DEPENDENCY-AUDIT-2026-10-19.md`](SUPABASE-PRIMARY-ACCESS-AND-DEPENDENCY-AUDIT-2026-10-19.md).

The repository has further unapplied October migrations.  They are not
implicitly required for this narrow RPC and are excluded from this approval;
they must never be bulk-applied merely to make the migration ledger appear
aligned.

The requested production DB-change approval must be limited to this exact
operation, after the backup gate succeeds:

```text
Apply: 20261019090000_eskomi_supabase_primary_public_directory.sql
Precondition: current published counts remain 0/0/0/0 and 241 image URLs match
the URL-cutover import-record targets.
Postcondition: RPC returns empty arrays with coverage 0/0/0/0; no base-table,
Storage, visibility, Auth, or configuration mutation.
```

Do **not** include `supabase:prepare-full-import`, the 14 review-required
records, the two Supabase-only drafts, a publication-status update, a fixed-page
projection, a primary-area inference, or image ID 357 in this approval.

## Backup, verification, and rollback gates

No provider-wide backup, PITR purchase, or Storage export/restore is a gate for
this narrow package. The approval executor must instead attach the smallest
logical snapshot that can restore the exact changed scope:

1. for `20261019090000_eskomi_supabase_primary_public_directory.sql`, the
   migration ledger state, function absence/definition, function grants, and
   the read-only count/RLS preflight; its rollback is removal of that function
   and a PostgREST reload;
2. for the optional 44-row primary-area delta, the exact `(shop_id, area_id,
   is_primary)` tuples plus the identified `private.import_batches` and
   `private.import_records` rows; its rollback SQL restores only those flags
   and marks that batch rolled back;
3. a transaction-wrapped local/branch rehearsal that applies and restores the
   exact scope, including `anon` RPC behavior and managed unlisting; and
4. a post-apply readback of only those snapshot fields, unchanged public counts,
   and unchanged ID 1272 state.

The existing 241 image URL reconciliation is a no-touch invariant, not a
request to export or restore Storage. Do not add Storage credentials or a new
export capability for data this package never changes.

If any scoped precondition differs, stop rather than adapting the input in
place.

## Local HTTP evidence for management and public boundaries

The authoritative isolated fixture report is
[`public-http-postgrest-metrics-27235-27770.json`](public-http-postgrest-metrics-27235-27770.json),
generated through real local GoTrue, PostgREST, Storage, and Next HTTP—not a
mocked response.  It proves:

- dashboard correction/resubmission/approval projects a managed shop to the
  public route;
- an approved review is visible at `/reviews/`, the shop detail, and the
  Partner widget, while a submitted private marker is absent;
- a zero-review shop stays empty;
- normal dashboard unlisting changes the detail to HTTP 404 and removes the
  shop from `/shops/` and `/sitemap.xml`; and
- the initial shop-detail request made exactly one HTTP call to
  `get_public_listing_store_by_slug`; this is request-local de-duplication,
  not cross-request caching.

The metric report counts PostgREST **HTTP calls**, not SQL statements.  On the
first `/reviews/` request it observed one call each to the canonical global
list and count RPCs; on the first shop-detail request it observed one each to
the canonical detail-list and detail-summary RPCs.  The source contracts for
that fixture and the Supabase-primary reader passed again on 2026-10-19.

## Explicit non-goes

- No production database write was performed while preparing this package.
- No current image URL is to be replaced by a WordPress URL.
- No automatic publish/unlist/delete decision is permitted for unknown,
  review-required, hot-spring, multi-area, or no-area records.
- Do not start another disposable fixture merely to restate the preserved
  successful HTTP evidence; its Docker resources and generated artifacts are
  retained intact.
