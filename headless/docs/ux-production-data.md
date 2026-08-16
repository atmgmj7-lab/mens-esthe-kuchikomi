# UX production data boundary

This adapter records only what the current public sources can prove. It does not create a new database, WordPress field, REST route, or public payload.

## Current storage mapping

| Public concept | Current authority | Production boundary |
| --- | --- | --- |
| Shop identity | WordPress `shop` post ID and slug | Keep the positive post ID and canonical slug. Never join by display name. |
| Card/header image | WordPress `featured_media` plus embedded media, then legacy ACF URL | Preserve the featured media ID with the chosen embedded URL, alt, and available dimensions. ACF remains a legacy URL fallback with `mediaId: null`. |
| Detail banner | No approved role/rights storage | `null`; do not reuse the card image as a banner. |
| Approved user reviews | Existing read-only WordPress `reviews` contract | Reuse only `publish` and `approved` results whose canonical shop relation points to a public shop. The shop reader binds the requested shop ID; the global reader returns the canonical shop and every assigned public area. Both local source wrappers reject caller-assembled objects. |
| Review relation | Review ID, the authenticated local reader wrapper, and the already-resolved public shop/area context | One `ReviewRelationView` per canonical review. The wrapper's source shop ID must equal the context shop ID; a mismatch or missing shop/area identity excludes the item from public discovery. |
| Existing recommendation/ranking snapshot | Existing WordPress/Next.js recommendation helpers | Legacy display order only. It is not the strict, audited ranking contract. |
| Strict overall/area/shop ranking | No approved storage | `unavailable / storage-not-configured`; no empty record, synthetic ID, or conversion from legacy ranking. |

The same `ShopView.media.cardSquare` object is the normalization result for list, Area, and Shop-header consumers. The compatibility field `ShopView.imageUrl` remains the same URL so existing components continue to behave as before.

## Review entity separation

`approved-user-review`, `editorial-comment`, `editorial-article`, and `shop-reply` are separate content kinds. Existing shop editorial fields remain comments and never become articles. An editorial article is available only with a positive WordPress post ID, an approved post type, a canonical slug, and a canonical Eskomi WordPress link. Shop replies and Q&A remain unavailable. Editorial content, replies, Q&A, PR, pending reviews, rejected reviews, and private reviews do not count as user reviews and do not enter review graphs or `AggregateRating`.

The current response has no formal therapist relation, helpful count, shop-reply reader, or experience-verification field. Those capabilities remain explicitly unavailable. Display names and body text must not be used to infer IDs or verification.

The global latest-review feed is `GET /wp-json/escomi/v1/reviews`, with `page` and `per_page` only. The default and maximum page size are 20, and page is capped at 1000 before a cache entry or WordPress offset is created. WordPress filters `publish` plus `approved` reviews through exactly one stored positive shop ID and exactly one approval value, requires the related shop to be public, orders by published date and review ID descending, and resolves page shops and all assigned `area` terms in bulk. Duplicate relation/moderation meta and query failures fail closed. The Next.js reader uses the existing `wp` invalidation tag plus `reviews:global`; it does not call one shop endpoint per shop.

## Submission context

- Top and review Hub have no prefilled target context.
- Area may carry a frontend-only area prefilter. It does not add a backend request field.
- Shop keeps the existing `?shop={canonical-slug}` URL and existing API payload contract.
- Therapist context is not created until a formal therapist ID and backend field are approved.

## Storage decision gate

The UI contract describes future role-based media and audited manual rankings, but their reader/writer cannot be implemented until `UX-DATA-STORAGE-01` approves storage, authority, audit, rights, effective-window, and rollback rules. Supabase remains private staging and is not selected as a public source by this adapter. WordPress remains the public authority.

Phase 19 therapist/schedule storage is not connected here. Adding it requires a separate approved plan and must not be simulated with existing names, legacy recommendations, ACF prose, or prototype data.
