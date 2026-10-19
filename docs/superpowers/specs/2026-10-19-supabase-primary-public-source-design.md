# Supabase-primary public source design

## Intent

WordPressを公開正本から段階的に外す。ただし、未移行の店舗・エリア・公開記事を0件または欠落として配信しない。既存のWordPress読取経路はロールバック用に残し、`CONTENT_DATA_SOURCE=supabase` では公開ルートがWordPress RESTを呼ばない。

## Confirmed current contracts

| Public concern | Current compatibility source | Canonical Supabase target | Cutover condition |
| --- | --- | --- | --- |
| 店舗一覧・詳細・sitemap | `lib/wp/shops.ts` plus managed overlay | `app.shops`, `app.shop_areas`, `app.shop_images` | published rows, primary area, legacy `wp_post_id` for every expected legacy shop |
| エリア | `lib/wp/areas.ts` | `app.areas`, `app.shop_areas` | all expected published areas and parent slugs present |
| 公開記事・column sitemap | `lib/wp/posts.ts` | `app.contents` with `/column/<slug>/` route key | article count explicitly reconciled; an empty set is only valid when expected count is zero |
| 口コミ投稿先の解決 | `getShopBySlug` / `getShopById` | same canonical public directory | resolved store is published and has immutable legacy identity required by the current review submission RPC |
| 公開口コミ | WordPress fallback or v1.1 public RPC flag | existing review v1.1 public RPCs | only approved/published user reviews; current moderation contract remains unchanged |

`app.shops`, `app.areas`, `app.contents` and their audit/import structures already exist, but this checkout has no evidence that the production-sized shop, area, or article corpus has been imported. The previous configuration resolver was not consumed by public routes; `SHOP_DIRECTORY_SOURCE=supabase` only overlaid managed listings on top of WordPress.

## Chosen boundary

`api.get_public_site_directory_v1()` is a narrowly shaped read-only projection. It returns only published shops with a published primary area, published areas, and published global `/column/` content. It excludes drafts, moderation queues, partner workspaces, private imports, and any base table endpoint. The projection uses a publishable key; server-side update and approval RPCs remain service-role-only.

The application validates three explicitly configured reconciliation counts (`SUPABASE_CONTENT_EXPECTED_SHOPS`, `...AREAS`, `...POSTS`) plus legacy-shop identity coverage. Any mismatch, invalid projection, transport failure, or missing environment value raises `ContentMigrationIncompleteError`; it never falls back to WordPress in primary mode. This preserves canonical URLs and makes an incomplete article migration a blocking condition rather than quietly dropping URLs from the sitemap.

## Non-goals for this branch

- No production or cloud Supabase writes, Secret registration, DNS changes, authentication expansion, billing action, or `main` merge.
- No deletion of WordPress readers, existing data, fixture volumes, or artifacts.
- No claim that a production migration is complete: a future controlled data import and reconciliation report are mandatory before enabling primary mode.

## Compatibility and operations

- Shop URLs remain `/shops/<slug>/`; area URLs remain `/area/<slug>/`; articles remain `/column/<slug>/`.
- A listing suspension is represented by absence from the published projection, producing detail 404 and omission from list/area/sitemap paths.
- Direct administrator publication and partner change approval continue to use the existing private/service-role workflows. The public projection reads only their approved published output.
- Review publication remains gated by the existing approved + published v1.1 rules. The new directory does not promote, transform, or expose review records.
