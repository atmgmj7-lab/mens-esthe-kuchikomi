# Primary-area read-only dry-run manifest — 2026-10-21

## Scope and immutability

This is a read-only reconciliation record for the production project
`goeagrxjsjcbbatpotbu`.  It creates no import batch, does not update
`app.shop_areas`, and is not an authorization to run the previously prepared
primary-area SQL.  It is unrelated to the three *candidate* partner
workspaces; no workspace identity is a primary-area input.

The candidate universe is the existing, exact 379-shop WordPress identity set:

| WP post-ID set | Count |
| --- | ---: |
| 640–894 | 255 |
| 1165–1254 | 90 |
| 1256–1258 | 3 |
| 1260–1271 | 12 |
| 1273–1291 | 19 |
| **Total** | **379** |

No name, address, slug similarity, or choice of the first/single area relation
is used as primary-area evidence.

## Accepted explicit evidence (dry run only)

The sole eligible source is the saved exact-only evidence manifest
[`docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json`](../../../../../docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json)
(SHA-256 `1f00c21547a34721b09b57843ff0099f48614850c301da24e291d8af960cf910`).
It contains exactly 44 `READY_PRIMARY_ONLY` records, each with its WP ID,
target term ID, official public evidence URL, observed time, and expected WP
revision.  It is the full per-row candidate manifest; this document does not
turn its other historical proposal categories into evidence.

The 2026-10-21 production read-only check found all 44 records satisfy every
precondition below:

| Precondition | Matching records | Failures |
| --- | ---: | ---: |
| Published candidate shop still exists | 44 | 0 |
| Saved target term is a currently published existing `app.shop_areas` relation | 44 | 0 |
| Saved `private.import_records.source_payload.area_ids` contains that term | 44 | 0 |
| A stored source `modified_gmt` equals the saved expected revision | 44 | 0 |
| Current app area-term set equals the saved source area-ID set (order-insensitive) | 44 | 0 |
| Existing `is_primary = true` among all 379 candidates | 0 | — |

These 44 are **conditionally eligible**, not approved DML targets.  Before any
write, the executor must repeat the above identity/relation/revision checks and
obtain the separate write/rollback approval.  The current import payload does
not retain `acf.shop_primary_area_term_id`: `app.shops.legacy_payload` and all
415 shop import `source_payload`s had no `acf` object.  The preserved
exact-only file is therefore necessary evidence, but it is not replaceable by
an inferred current relation.

### Fresh public-source corroboration (2026-10-21 04:26 UTC)

An unauthenticated public WordPress JSON read, performed in the approved dot
cloud Chrome, read the four normal pages (100/100/100/94) of the same endpoint.
It returned 394 unique published shops: 44 positive explicit values,
350 explicit `null` values, and no missing ACF primary field.  Every positive
value was a member of that record's `area` array.

The supplied 44 fresh `(WP ID, slug, modified_gmt, area[], explicit term)`
records were read-only compared with production.  All 44 have a published app
shop, matching saved/imported slug and revision, a matching current published
target relation, and an exact order-insensitive area-term-set match.  This
corroborates the saved per-row evidence; it does not perform its associated
primary write.

The source's other 350 records are explicit `null`, not an omitted field.
Removing the 14 review-required records and the managed-unlisted record leaves
the 335 deferred candidate records below.  Thus no relation heuristic may
upgrade any of those records to primary.

## Deferred records — no inferred primary

The other 335 candidates have a fresh explicit `null` primary value and remain
deferred.  Current production relation counts are shown only to explain the
gap; none authorizes a selection:

| Deferred state | Count | Decision |
| --- | ---: | --- |
| No current `app.shop_areas` relation | 75 | Do not derive from name, address, or public URL |
| Exactly one relation, no accepted explicit evidence | 73 | Do not promote the single relation |
| Two or more relations, no accepted explicit evidence | 187 | Do not choose among relations |
| **Total deferred** | **335** | No `is_primary` change |

The 75 relation-free WP IDs are explicitly retained as unresolved:

`743, 744, 746, 778, 870, 872, 873, 877, 878, 881, 882, 884, 889, 890, 892, 894, 1165, 1173, 1178, 1179, 1180, 1181, 1182, 1183, 1184, 1186, 1187, 1188, 1190, 1192, 1197, 1198, 1200, 1202, 1204, 1207, 1209, 1213, 1214, 1215, 1216, 1217, 1220, 1222, 1225, 1226, 1227, 1228, 1231, 1233, 1234, 1235, 1243, 1244, 1246, 1247, 1248, 1249, 1250, 1251, 1252, 1253, 1256, 1262, 1266, 1268, 1269, 1271, 1275, 1280, 1282, 1283, 1285, 1286, 1287`.

## Why the directory can remain correct without a primary

The applied public-directory contract makes `primary_area_slug` optional
metadata rather than a publication gate.  A shop with no primary retains its
canonical detail URL; the reader emits `primaryArea: null`, and breadcrumb
markup omits rather than fabricates an area.  This is enforced by
`headless/scripts/check-supabase-primary-public-directory.mjs` and
`headless/lib/content-source/public-directory.ts` (lines 62–64 and 154–156).
The non-mutating checks passed on this commit:

```text
npm --prefix headless run test:supabase-primary-public-directory  PASS
npm --prefix headless run test:supabase-primary-area-delta        PASS
```

This does **not** establish regional global-review readiness.  The planned
v1.1 global-review projection and the four final public-review RPCs join only
`app.shop_areas.is_primary` (`20261017156000` and `20261020030000`), and are
still unapplied.  Thus unfiltered directory/detail publication can preserve
all 379 canonical shops without a primary; area-filtered v1.1 global reviews
cannot claim coverage for the 335 deferred shops until primary evidence is
remediated and separately approved.

### Display/cutover boundary and required operator decision

The safe current state is to preserve the existing public display boundary:
directory and canonical shop-detail paths may include all 379 shops; a
primary-null shop has no fabricated primary breadcrumb or primary SEO term.
Its normal area relations can remain association metadata, not an asserted
primary.  The current WordPress review display remains the fallback while the
v1.1 review migrations/RPCs are unapplied.

There are only two valid choices for each of the 335 explicit-null shops:

1. Keep it primary-null.  No mapping or write is needed; it is outside any
   primary-dependent regional global-review claim.
2. Have an operator provide a per-shop explicit primary decision with a source
   revision and an existing area relation.  It then needs a fresh preflight,
   bounded mapping/rollback packet, and explicit write approval.

Neither a single relation nor a multi-relation hierarchy chooses between those
choices.  In particular, do not switch on the v1.1 global area-review path as
full-coverage functionality for the 335 until option 2 has been completed for
the intended scope.

## Reproducible read-only checks

The check used only `SELECT`/CTE statements over `app.shops`, `app.areas`,
`app.shop_areas`, and `private.import_records`.  A future reviewer should use
the 44 `(wp_post_id, area_term_id, expected_modified_gmt)` entries from the
saved exact-only manifest, then verify: published candidate identity, published
area relation, `source_payload.area_ids` membership, matching saved revision,
and zero pre-existing primary flags.  A mismatch changes the record to
deferred; it must not be repaired by any heuristic.

This agent made no WordPress data write, browser/Playwright retry, Mailpit
request, migration, mapping write, or public-content change for this audit.

## Current WordPress public-read reacquisition — local path blocked, source supplied

The repository contract identifies the authoritative public-read endpoint as:

```text
GET https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop
  ?per_page=1&page=1&_fields=id,slug,status,area,acf,modified_gmt
```

`headless/scripts/prepare-supabase-primary-area-delta.mjs` uses this same
hostname and requests the fields required to validate an explicit
`acf.shop_primary_area_term_id` against a shop ID, slug, area relation, and
`modified_gmt`.  The WordPress contract exposes only a validated explicit
value (or `null`) through that ACF envelope; it does not permit a breadcrumb,
single relation, name, or address to stand in for the field.

On 2026-10-21 this execution environment could not itself reacquire that public
source:

| Attempt | Result | Classification |
| --- | --- | --- |
| Normal hostname resolution with ordinary HTTPS verification | `getaddrinfo EAI_AGAIN mens-esthe-kuchikomi.com` before connection | unavailable; no HTTP request completed |
| Existing repository lookup policy (same HTTPS hostname, repository-pinned origin `85.131.213.108`, normal TLS) | `ECONNREFUSED 85.131.213.108:443` before HTTP response | blocked; no source data read |

No TLS check was disabled.  No alternate host, proxy, mirror, credential,
network workaround, or further retry was used.  The separately supplied dot
cloud Chrome extraction above resolves the data-availability question for this
audit: 44 positive, valid primary values and 350 explicit nulls.  Any future
source response must still undergo the same exact WP-ID/slug/revision/relation
comparison and leave an invalid, missing, duplicate, or relation-external ACF
value deferred.

## Source 394 to candidate 379 reconciliation

The 15 records in the fresh 394-shop source that are not candidates are exact
and intentional:

| Group | Count | Current production read-only result |
| --- | ---: | --- |
| Managed/unlisted WP ID `1272` | 1 | `app.shops` is `draft`; one `private.managed_shops` row is `unlisted` |
| Review-required WP IDs `5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189` | 14 | no `app.shops` row for any of the 14 |
| **Total source exclusion** | **15** | **394 − 15 = 379** |

This verifies the stated stopped/unlisted-one plus pending/review-required-14
boundary without changing either publication state.
