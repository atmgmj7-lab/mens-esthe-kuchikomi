# Analytics ContentService validation

## Boundary

`headless/lib/analytics/content-service.ts` is a server-only Analytics read model. Its production
`WordPressAdapter` uses the existing WordPress request, shop normalization, approved-public-review
validator, and shop-fact provenance helpers. WordPress remains the public source of truth. The
`ContentService` interface is intentionally source-neutral so a later approved Supabase adapter can
implement the same contract without changing callers.

The adapter has one injectable WordPress network seam for synthetic tests. It is not an
origin/endpoint option: the production client continues to use the existing fixed WordPress origin.

## Safety and semantics

- Only exact `publish` shops are accepted. Page and record values are positive bounded integers;
  duplicate shop IDs/slugs across a page or paginated collection fail closed.
- Areas, shops, review identifiers, and Content Health rows have stable slug/ID ordering.
- Approved-review summaries use only the existing approved public review endpoint and validator.
  They expose aggregate counts plus grouping IDs/slugs only; review body and author fields never
  cross into Analytics.
- A current fact is counted only when its reviewed provenance, valid date, allowed source URL/type,
  current-value hash, and existing detail-model representation agree. Missing, invalid, stale, or
  mismatched values are never invented as zero.
- Content Health uses price, hours, official URL, and access. `missingRate` is the missing fraction
  of those four facts and is `null` for an area with zero published shops.
- A shop is stale only when its latest safely verified required-fact confirmation is older than 180
  completed calendar days relative to the injected clock. No verified date is missing, not stale.
- Successful empty collections are `no_data`; HTTP/auth, timeout, body-read/network, and malformed
  payloads retain distinct Analytics source states.

## Local verification

```sh
cd headless
node --test tests/analytics/content-service.test.mjs
node --test tests/analytics/ga4.test.mjs tests/analytics/gsc.test.mjs tests/analytics/site-health.test.mjs tests/analytics/content-service.test.mjs
npm run lint
npm run typecheck
```

No live WordPress or external API call is required by these synthetic tests.
