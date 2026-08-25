# GSC Search Analytics adapter validation

`headless/lib/analytics/gsc.ts` is server-only and queries only the fixed Search
Console property `sc-domain:mens-esthe-kuchikomi.com`. It uses Search Analytics
with `type: "web"`, `dataState: "final"`, and the read-only
`https://www.googleapis.com/auth/webmasters.readonly` OAuth scope. The endpoint,
property, and scope are closed in code; callers cannot supply an endpoint or a
different property.

GSC uses the shared server-only Google credential loader. The loader prefers
`GOOGLE_SERVICE_ACCOUNT_JSON` and retains `GOOGLE_APPLICATION_CREDENTIALS` as a
local file fallback only when the inline variable is absent. A present but
invalid inline value fails closed; it never falls through to a valid local file.
Both sources must pass the same service-account, RSA private-key, and exact
Google OAuth token-endpoint validation before any fetch.

For each requested 7-day or 28-day Tokyo period, the adapter first discovers the
latest final date using a date dimension. It retains copied `requested` ranges,
then shifts copied `effective` current and previous ranges together to end on the
latest final date. This preserves like-for-like current/previous durations while
never mutating the caller's period object.

The site aggregate uses its own no-dimension `aggregationType: "byProperty"`
request. Query, page, device, and country reports use separate `auto` aggregation
requests and must never be summed into an aggregate. Search Analytics can omit
rows, so all successful dimension data carries `rowCoverage: "NOT_RETURNED"`.
An omitted row is not represented as a zero and is not evidence of completeness.

Metrics are clicks, impressions, CTR, and **average position**. Position is an
average value returned by GSC; it is not a fixed rank. Numeric zero is valid.
The adapter rejects negative clicks or impressions, CTR outside 0 through 1,
negative position, non-finite or non-numeric metrics, malformed keys, duplicate
dimension keys, and invalid calendar dates. Dimension pages are bounded,
de-duplicated, and sorted by clicks descending then keys ascending. Reaching the
page cap returns `partial` with a warning rather than a misleading `ok`.

The historical D0 reference is not an equality assertion: latest final
`2026-08-20`, current `2026-07-24` through `2026-08-20`, country `JPN`, clicks
`506`, impressions `28,461`, CTR `1.7779%`, and average position `9.9147`.
Matching it would require live E2E for the identical period, country, search type,
and data state; no live API call is part of this validation.
