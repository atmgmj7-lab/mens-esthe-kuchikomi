# Area Template V2 Foundation 01A contract map

Task: `AREA-TEMPLATE-V2-FOUNDATION-01A-CONTRACT-LOCK`
Characterized base: `e18de64df6da98866e32881dc7d6e373106f61da`

This map records which executable check owns each current Area contract. The new focused check is `node scripts/check-area-template-v2-foundation-contract.mjs`, run from `headless/`. It uses bounded fixtures for rendering and schema mapping. WordPress counts and IDs remain live-data evidence and are not replaced by the fixture.

| Contract | Executable owner | Fixed behavior |
| --- | --- | --- |
| A route | `check-area-template-v2-foundation-contract.mjs` | 新大阪・堺東 dedicated route → `AreaDepthStaticRoute` → shared renderer; 梅田・堺筋本町・日本橋 dynamic dispatch; alias and page-2 metadata input preserved |
| A route pagination | `check-area-list-route-contract.mjs`, `check-priority-area-hub-seo-contract.mjs` | Existing `page`, filter/sort query and canonical behavior |
| B Hotfix | New focused check plus `check-area-depth-editorial-contract.mjs` and `check-area-supporting-ppr-nojs.mjs` | One initially closed semantic `details`/`summary`; complete SSR/no-JS content; no outside duplicate or hidden PPR dependency |
| C order | New focused check; browser measurement remains `check-area-first-shop-visibility-browser.mjs` | H1/description/stats → disclosure → list/filter → comparison → following content → FAQ/related navigation |
| D list fixture | New focused check | Fixture shop links are retained; PR is excluded from ItemList; every non-PR fixture shop maps one-to-one to an ItemList entry |
| D list controls | `check-area-list-route-contract.mjs`, `check-area-list-ux-revision-contract.mjs`, `check-area-shop-card-view-model.mjs` | Filter, sort, pagination/load-more, anchor, card rank, duplicate ID and relation membership contracts |
| D live data | `check-area-depth-ssr.mjs`, `check-area-supporting-ppr-nojs.mjs`, browser baseline | WordPress-backed 新大阪58 and 堺東25. A count change is live-data drift and must not be accepted by editing the fixture unconditionally |
| E metadata | New focused fixture plus `check-priority-area-hub-seo-contract.mjs` and `check-q06-seo-metadata.mjs` | URL, slug, title, description, H1, canonical and pagination metadata |
| E schema | New focused SSR render plus `check-schema-output-conditions.mjs`, `check-review-rating.mjs`, `check-public-review-contract.mjs` | BreadcrumbList, non-PR ItemList, FAQPage and absence of invented Review/Rating/AggregateRating/noindex/fake ranking |
| F conditions | New focused check plus `check-priority-area-precision-contract.mjs` and `check-area-depth-editorial-contract.mjs` | Five canonical term IDs enable precision; only exact 58/25 count enables editorial; no slug/name inference; other three areas have no Area Depth disclosure |

## Fixed five-Area differences

| Slug | Route | Canonical precision term ID | Area Depth | Live count lock |
| --- | --- | ---: | --- | ---: |
| `shinosaka` | dedicated static | 13 | exact-count only | 58 |
| `sakai` | dedicated static | 17 | exact-count only | 25 |
| `umeda` | dynamic | 4 | absent | live evidence only |
| `sakaisujihonmachi` | dynamic | 46 | absent | live evidence only |
| `nihonbashi` | dynamic | 7 | absent | live evidence only |

## 01B optional-slot fail-first candidates

The fixture records these as candidate acceptance rules with `implemented: false`; 01A does not install permanent failing assertions.

1. Given no slot data, render no heading, wrapper, spacing, or anchor.
2. Given no slot data, render no placeholder or preparation copy.
3. Omitting the slot keeps every existing module in the same relative order.
4. Given slot data, the meaningful content exists in SSR HTML.
5. The slot does not require a new client boundary unless its accepted interaction contract requires one.

For 01B, start by turning one candidate at a time into a fail-first test against the agreed slot API. Keep the absent-data and module-order cases as the first gate. Do not infer content, rankings, reviews, or fallback data to make a slot visible.
