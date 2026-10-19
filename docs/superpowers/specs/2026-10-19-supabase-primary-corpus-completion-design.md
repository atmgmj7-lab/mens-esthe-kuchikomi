# Supabase-primary Corpus Completion Design

## Intent

Complete the remaining public-content migration surface without changing production data or enabling the cutover. Supabase-primary must render public shops, areas, column articles, and fixed pages without any WordPress request; a missing or incomplete corpus must be a hard failure, never an empty successful page.

## Read-only source inventory (2026-10-19)

The public WordPress REST API reported 394 published `shop` records, 34 `area` terms, 6 published pages, zero published posts, 2 shop categories, 6 shop features, 268 media records, and zero published legacy reviews. The six pages are the home page plus `contact`, `sitemap`, `storelisting`, `about`, and `osaka-nihonbashi`; `advertise` is rendered by the application's existing fallback copy and has no WordPress page source.

The authorized read-only Supabase query found 382 draft shops, 34 unpublished areas, 241 private images, and no published `app.contents`. All 241 preserved `app.shop_images.image_url` values still use the WordPress uploads host. The 394/382 source gap, all fixed-page rows, and image-object relocation are release gates rather than values to substitute with empty data.

## Architecture

Extend `api.get_public_site_directory_v1()` with a `pages` array representing published `app.contents` routes that match the fixed public-page allowlist. The server reader validates exact reconciled counts for shops, areas, columns, and fixed pages before mapping data to existing view types. The page reader resolves the canonical Supabase projection in primary mode, while static defaults remain presentation fallbacks only in WordPress mode.

A source-audit/dry-run generator reads public WordPress REST data and emits only local ignored artifacts: an idempotent SQL import candidate plus an aggregate reconciliation report. It must reject a changed count, duplicate route/slug, unsupported static route, unmapped primary area, or missing required page. It does not apply SQL to cloud or production.

## Constraints

- No production Supabase writes, Cloudflare changes, DNS, secret registration, billing action, deployment, main merge, or file/volume deletion.
- Public migration payloads are not committed; generated corpus files remain ignored local artifacts.
- Keep existing public URL paths and canonical paths exactly; never manufacture a slug, canonical route, review, price, address, or image.
- A shop may be published only with a published authoritative primary area. Fixed-page coverage is exact for `contact`, `about`, `sitemap`, `storelisting`, `advertise`, and `osaka-nihonbashi`.
- Supabase-primary never falls back to WordPress. A missing count, failed RPC, unavailable page, or stray WordPress request fails QA.
- Existing WordPress uploads URLs are preserved as source references only. Object download/upload or URL replacement needs a separately approved storage target and a reversible backup/manifest procedure.

## Production readiness gates

1. Re-run the source audit and capture a signed-off snapshot of the 394 shops, 34 areas, 0 columns, 6 fixed routes, 2 categories, 6 features, and media inventory.
2. Reconcile the 12-shop source delta, 74 no-area shops, 243 multi-area shops, 153 missing images, 53 missing official URLs, and 136 missing usable prices. No route is published until its primary-area and canonical-path mapping are reviewed.
3. Obtain approval for content rights/retention and a storage destination. Create an immutable object manifest (source media id, checksum, source URL, target key, target URL) and a tested restore procedure before changing any image URL.
4. Back up the relevant Supabase schemas and WordPress export; dry-run import twice against an isolated database and require zero diff on the second run.
5. Only after an explicit production-write and cutover approval: apply migration, compare every public route/canonical/sitemap entry, perform WP-blocked HTTP QA, then enable the environment flag. Rollback is the environment switch to WordPress; never delete source records as rollback.
