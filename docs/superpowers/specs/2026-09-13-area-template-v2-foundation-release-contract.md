# Area Template V2 Foundation release contract

Scope: accepted 01A through 01B3, prepared locally under 01C. No feature content is connected to the extension slot. No production operation is authorized by this document.

## Responsibility and ownership

| Unit | Owner / paths | Contract |
| --- | --- | --- |
| A regression foundation | Lane B; Area visibility, foundation fixtures, browser contract | Separate mutable verified WordPress facts from immutable structure, identity and SEO assertions. |
| B PPR | Lane B; generic Area route and five-Area parity checks | Render canonical priority Hub content before the search-parameter Suspense boundary; retain legacy page-scroll behavior. |
| C Area adapter | Lane B for this approved fix; WP Area adapter/order helper | Enumerate minimal ID/date records in unique ID ASC transport order, then publish date DESC / ID DESC. Share the complete index between paged and all-Area reads. |
| D slot | Lane B; AreaHubPageTemplate and slot contract | Only `slots.afterComparison?: ReactElement | null`, after comparison sections and before promotion/latest-reviews branch. Omitted/null/undefined emits no DOM. |
| E documentation | Lane B | Document these contracts and boundaries; do not update shared control facts without evidence. |

Lane A owns Analytics backend/history/dashboard/workflows. Lane C owns official facts, internal-link and comparison content preparation. Neither is connected by this Foundation. New Area content requires a separate task and review after this Foundation is fixed.

## Ordering and failure behavior

Transport order is not visible listing order. Publish `date` is the primary key; post ID descending is the deterministic tie-break. `modified`, price, title and ranking scores do not enter this comparator. Full-record responses are mapped back to requested IDs, never trusted to arrive in requested order. Missing/duplicate/invalid IDs, invalid dates, page cardinality/metadata failures and changed full-record dates fail closed. A changing enumeration total retries once from page one; repeated inconsistency falls back as a whole through the existing resilience contract, never returning accumulated partial records.

Priority five-Area default listing and non-PR ItemList preserve canonical relative order. Generic non-Hub pages take canonical slices and retain their pre-existing legacy in-page ranking presentation. This does not change the ranking algorithm or PR policy.

The shared minimal index and outer adapters use `cacheLife("minutes")` and common `wp`, `shops`, `area:shops:<id>` tags. Cold reads add chunked index requests; cache reuse avoids repeating the index for each page. This is not a transactional snapshot across concurrent WordPress edits or independently cached generations.

## Release and rollback boundaries

Potential public differences are equal-publish-date listing tie order and the three generic priority routes' no-JS/PPR content delivery. Empty slot composition has no visible effect. URL/metadata/canonical/robots/sitemap, review/rating, public WordPress source and stored data are unchanged.

Local commits are separated into A, B, C, D, E. Reverse-order reverts of the full range restore the code baseline. D can be reverted with its slot tests; C can be reverted with the shared helper, both adapter edits, focused test and temporary-browser copy entry; B can be reverted with its route/parity tests. A remains useful characterization, but full regression must be rerun after any selective revert. No code rollback includes the accepted official-data batch or any WordPress/Supabase write.

Before any future main push, recheck origin/main and the exact workflow/control-plane deployment effects. A main push may itself trigger production-target build/deploy; local acceptance is not authorization to push, deploy or promote. Follow the operation-specific approval packet and retain staged exact-URL QA and promotion boundaries.
