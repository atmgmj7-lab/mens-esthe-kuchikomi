# WordPress media preservation and migration decision record — 2026-10-19

## Scope and non-actions

This record covers a **read-only** inventory of public WordPress media and a
local preservation copy. No Supabase Storage object, bucket policy, database
row, WordPress record, DNS record, or production route was changed.

The generated, Git-ignored preservation artifact is:

`supabase/imports/wp-media-preservation/20261019-wp-media-preservation-v1/manifest-reconciled.json`

Its `transfer_state` is `not_transferred`. Every object records its original
URL, local relative path, SHA-256 checksum, current content reference(s), and a
**proposed** target key. A proposed key does not mean that an object has been
uploaded or that a bucket exists.

## Observed inventory

| Measure | Observed value |
| --- | ---: |
| Public WordPress media objects | 268 |
| Locally preserved objects | 268 |
| SHA-256 download failures | 0 |
| Total preserved bytes | 26,772,927 (about 25.5 MiB) |
| Largest object | 6,487,809 bytes (about 6.19 MiB) |
| Referenced by current public shop/post/page content | 242 |
| Unreferenced media objects | 26 |
| Existing `app.shop_images` rows | 241 |
| Existing `app.shop_images` objects in Supabase Storage | 0 |

The 242/241 difference is deliberate evidence, not a substitution: the
manifest classifies current WordPress content references, while the existing
Supabase image table has 241 legacy WordPress media-ID rows. Resolve that one
record difference under a named import batch before changing a public image
URL. The 26 unreferenced IDs remain preserved and are not candidates for
publication without an explicit retention decision.

The difference is now resolved as **not a shop-image discrepancy**: media ID
357 (`Gemini_Generated_Image_f8kg5yf8kg5yf8kg-scaled.png`, SHA-256
`96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c`,
6,487,809 bytes) is the featured image of WordPress page 343,
`/osaka-nihonbashi/`. It is a page asset and is deliberately excluded from the
241 `shop-images` transfer candidates. The reconciled manifest records 241
shop candidates, one referenced non-shop asset, and 26 unreferenced assets.

## Existing Storage assessment

The connected project is on the Free plan. It has one existing bucket,
`listing-application-private`, with zero objects. It is private, only allows
PNG/JPEG/WebP, has a 5,242,880-byte (5 MiB) per-object limit, and versioning is
disabled. It is the application/partner-asset route, not a public shop-image
origin. The largest preserved WordPress image exceeds its limit, so do not
reuse this bucket for the corpus without a separately approved limit change.

The current app's 241 shop-image URLs still point to the WordPress uploads host
over HTTP and are all non-public/unverified in the app. There is no existing
Supabase public image origin to standardize on.

The current Free-plan published allowance is 1 GB file storage and a 50 MB
maximum upload; the preserved corpus is about 2.6% of that nominal allowance.
The database reports zero stored objects, but account-wide remaining capacity,
egress consumption, and any future paid overage are not available from this
read-only inventory and must be treated as unknown.

## Proposed destination and restoration design

The target below is a proposal only:

| Field | Proposal |
| --- | --- |
| Bucket | New dedicated `shop-images` bucket; do not mix corpus media with listing-application assets |
| Object key | `wordpress-media/<wp_media_id>/<sha256>.<extension>` |
| Per-object limit | At least 10 MiB, covering the observed 6.19 MiB maximum with room for a retry |
| Publication | Only rights-cleared, referenced objects after checksum verification; no blanket publish of the 26 unreferenced items |
| Delivery | Choose either a public image bucket/CDN URL or a dedicated authenticated proxy before upload; do not change the existing private asset bucket's policy |

### URL-switch dry run

The generated, Git-ignored URL-switch worksheet is:

`supabase/imports/shop-image-url-switch/20261019-shop-images-public-switch-dry-run.json`

It has 241 unique source-url → proposed-key operations and no database write:
every operation is marked `upload_state: not_uploaded`,
`checksum_verification: pending_readback`, and
`database_write: not_authorized`. Its URL values use the deliberate placeholder
`https://<project-ref>.supabase.co/...`; they are not live URLs.

After an approved upload, verify each path in this order before allowing any
URL update: (1) uploaded object exists at its exact manifest key; (2) download
the object through the approved delivery path; (3) recompute SHA-256 and byte
count and match the local manifest; (4) verify MIME type and an HTTP 200
response; (5) only then apply the named mapping batch; (6) rerun the 241-path
comparison plus shop detail, listing, and sitemap HTTP checks. A mismatch is a
stop condition, not a reason to substitute an image or publish a partial set.

Restoration must be a mapping rollback, not object deletion:

1. Retain this manifest and the original WordPress URLs/checksums as immutable
   evidence before any upload.
2. Upload into a batch-scoped staging prefix and verify object count, byte
   count, MIME type, and SHA-256 against the manifest before any `image_url`
   update.
3. Record each changed `app.shop_images` row in a new import batch, retaining
   source URL and target key. Publish only after the parent shop, primary area,
   canonical route, and media rights are approved.
4. If a release fails, restore the recorded WordPress source URL mapping and
   switch the application reader to WordPress mode. Retain the staged objects
   and all records for audit; deletion requires a distinct retention approval.

## Corpus exclusions requiring approval

The migration dry run preserves relationships but does not infer publication:

- 74 shops have no source area and 243 have multiple source areas. A reviewed
  primary-area/canonical-path mapping is required for every affected public
  route.
- Fourteen WordPress-only records remain source candidates, not automatically
  published. They are still published in the source, but do not exist in
  `app.shops`; the read-only reconciliation contains no separate stop/delete
  intent for them:

  | WP ID | Name |
  | ---: | --- |
  | 5070 | イチゴみるく |
  | 5074 | MONOTONE SPA |
  | 5079 | ROYAL MADAM |
  | 5082 | 大人時間 |
  | 5129 | Mrs.Two Heart |
  | 5135 | Mrs.C’est la vie |
  | 5137 | Mrs.Nostalgia |
  | 5175 | MACHERIE |
  | 5177 | Mrs.Merci SPA |
  | 5181 | Pulchra |
  | 5183 | ヌまるSPA新大阪 |
  | 5185 | Mr.Dandies |
  | 5187 | Mrs.美Witch 一条通ルーム |
  | 5189 | ミセスムーンR 堺東ルーム |

  All fourteen have `status=publish`, no `shop_category`/`shop_feature`, no
  featured media, and no public description body. All have two or more area
  terms (5070 has three). The public metadata therefore does not establish an
  industry classification safely; each is `review_required` rather than an
  automatic men's-esthetic import candidate. Their official URLs, when present,
  are evidence to review, not publication approval.
- The two Supabase-only drafts must remain excluded: 1255 `天然温泉 ひなたの湯`
  and 1259 `あしぎぬ温泉`. Their stored payload identifies hot-spring businesses,
  not the portal's men’s-esthetic scope; both lack required price/image evidence
  and were absent from the current published WordPress shop source. There is no
  explicit historical deletion/stop reason in the inspected rows, so this is an
  exclusion pending an operator decision—not proof that either record may be
  deleted. Do not reactivate, republish, or delete them as part of this
  migration.

## Build evidence boundary

These results are intentionally distinct:

- Default-mode `npm run build` passed using WordPress fallback because the local
  build sandbox blocked outbound WordPress access. It is a fallback build
  result, not a primary-mode origin test.
- The earlier primary-mode WordPress-blocked real HTTP test is recorded in the
  local QA README and exercised the Supabase-primary fixture projection. It is
  the evidence for primary-mode HTTP behavior, not evidence that the default
  build read WordPress successfully.
- The repository-wide `test:wp-origin-tls` remains a compatibility-mode
  preflight, not a Supabase-primary correctness test: it requires reaching the
  certificate-matching WordPress origin. It is currently blocked by that origin
  reachability and must remain reported as unverified; do not describe the full
  test suite as passing or remove it from compatibility release verification.

## Required approval packet before transfer or production import

Approve all of the following as one named batch:

1. The exact manifest label and SHA-256 object set, including an explicit
   retention decision for all 26 unreferenced objects and resolution of the
   242/241 reference difference.
2. The destination bucket name, access mode (public CDN versus private proxy),
   allowed MIME types, and at least 10 MiB object limit; this changes Storage
   configuration and is not authorized by this record.
3. Rights/retention confirmation for every object to be made publicly
   accessible, and the exact `app.shop_images` rows permitted to receive new
   URLs.
4. Capacity and cost acknowledgement: nominal corpus size 25.5 MiB, current
   bucket object usage 0 bytes, Free-plan allowance 1 GB/50 MB object, while
   remaining account capacity and egress are unknown.
5. The reversible rollout: staged upload → hash/readback verification → named
   database import batch → primary HTTP/sitemap validation → explicit release;
   rollback restores source URL mappings and reader mode without deleting source
   or uploaded objects.

## Approved manual Storage-copy handoff

The approved copy can be performed from the Mac that already holds a valid
Supabase **service key**, without placing that key in this repository, a shell
argument, an environment variable, a log, or a generated artifact.

1. First inspect the fixed target project in the official dashboard:
   <https://supabase.com/dashboard/project/goeagrxjsjcbbatpotbu/storage/buckets>
2. Optionally verify the scope without any network write:
   `cd headless && node scripts/upload-approved-shop-images.mjs --dry-run`
3. To perform the approved copy, run exactly:
   `cd headless && node scripts/upload-approved-shop-images.mjs --apply`
4. Paste the existing service key only when the local TTY displays the hidden
   prompt. Characters are not echoed; the script does not accept the key by
   flag, environment, pipe, or redirected input.

The script is hard-coded to the project URL
`https://goeagrxjsjcbbatpotbu.supabase.co` and only creates/verifies a public
`shop-images` bucket with a 10 MiB limit and JPEG/PNG MIME allow-list. It
refuses a pre-existing bucket whose public flag, limit, or MIME list differs.
It considers only the 241 `transfer_candidate` manifest records. The fixed-page
image (357), 26 unreferenced images, all private application assets, and all
database writes are excluded.

For each proposed key, it reads a pre-existing object first. A matching
byte-count/SHA-256 object is recorded as already verified; a different object
causes an immediate stop and is never overwritten. Missing objects are uploaded
with `x-upsert: false`, then downloaded again and checked against the local
byte-count and SHA-256. Re-running after a failure is safe because verified
objects are skipped and mismatches still stop. URL/DB switching remains a
separate, unapproved follow-up after the copy report is reviewed.

The manual uploader has a local loopback Storage integration contract. It
covers bucket-missing responses in both HTTP 404 and the observed HTTP 400
`NoSuchBucket` form; object-missing responses in both HTTP 404 and HTTP 400
`NoSuchKey` form; bucket creation, upload, readback hash comparison, safe
re-run skip, readback-failure recovery, and bucket/object create races. It also
asserts that 401/403, generic 400/500, and an object endpoint's `NoSuchBucket`
response stop rather than being mistaken for a missing upload target. No real
credential or external Storage endpoint is used by that contract.
