# Analytics Snapshot / API / Export validation

`AnalyticsSnapshot` version `1.0.0` is the server-only aggregate contract shared by the authenticated dashboard API, Work export, and the later dashboard UI. It uses `Asia/Tokyo` and accepts only completed 7- or 28-day periods.

## Safety contract

- The collector calls the four fixed sources only: GA4, GSC, the six-target Site Health collector, and regional Content Health.
- Each source keeps its own eight-state result, timestamp, sanitized warning codes, and applicable period. A source exception becomes that source's `api_error`; it does not erase successful sources.
- Snapshot fields are aggregate-only. Source credential material, HTTP authorization data, raw errors/bodies, review/shop identifiers, review text, and user-level data are not serialized.
- GA4 and GSC retain their own effective periods. In particular, a GSC `final` clamp is never presented as a GA4 date.

## Aggregate rules

- Numeric zero is retained only from a successful source row. Missing, unavailable, `no_data`, and error values remain `null`; deltas are `null` whenever either side is unavailable.
- Landing paths are normalized to same-origin paths. GA4 variants may be summed and recalculate engagement rate from summed engaged sessions and sessions. Unsafe inputs are omitted with a warning. GSC path normalization collisions are omitted completely rather than selecting an upstream row.
- The five focus areas are fixed in order: 堺東, 新大阪, 大阪日本橋, 堺筋本町, 梅田. Main-query evidence comes only from the paginated GSC `[query,page]` report. Top10/20/30 counts are `null` unless all five current main-query rows are complete.

## API and export

`GET /api/dashboard/analytics/current?period=7|28` reuses the existing dashboard authorization before parsing or collection. Every response uses `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow`.

`node scripts/analytics/export-current.mjs --period 7|28 --output /absolute/or/relative/file.json` validates all arguments before collection, writes only the same snapshot JSON followed by a newline to a restrictive temporary file, and atomically renames it in the destination directory. Collection or write failure preserves an existing destination and removes temporary output.

## Local verification

Run the focused adapter/snapshot/API/export tests, then all Analytics tests, lint, typecheck, and build. Synthetic source injection exercises the production snapshot construction path; no live Google or WordPress calls are needed for these checks.
