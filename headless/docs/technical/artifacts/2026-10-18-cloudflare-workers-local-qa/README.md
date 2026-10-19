# Cloudflare Workers local QA continuation — 2026-10-18

## Implemented measurement boundary

`scripts/eskomi-v11-internal-prefix-proxy.mjs` now offers a fixture-only,
loopback-bound PostgREST metrics endpoint when
`ESKOMI_INTERNAL_PROXY_METRICS=1`. It aggregates **only**:

- HTTP method;
- URL pathname with query strings removed;
- request count; and
- aggregate/minimum/maximum elapsed milliseconds.

It does not store or emit headers, credentials, cookies, query values, request
or response bodies, status values, tokens, email addresses, or any other
personal data. The report explicitly describes this as PostgREST **HTTP-call**
counting, not SQL-query counting.

`scripts/measure-eskomi-v11-public-http.mjs` resets and snapshots this endpoint
around `/`, `/area/fixture-area/`, `/shops/fixture-partner-store/`, and
`/reviews/`, for one initial request, one repeat request, and three concurrent
requests. It writes a JSON artifact only when the entire run succeeds.

## QA coverage added to the fixture

- Actual public HTTP assertions cover status, title, canonical, representative
  body content, `robots.txt`, sitemap inclusion, and a seeded private-review
  marker that must never occur in public HTML or sitemap output.
- The fixture performs unlisting only after measurement/SEO checks, then checks
  HTTP 404 for detail plus omission from public listing and sitemap.
- Worker image contracts cover PNG/JPEG/WebP, EXIF orientations 1–8, metadata
  stripping, corrupted/truncated inputs, 5 MiB rejection, over-4096px early
  rejection, a 4096px memory-budget failure, and real fixture foreign-store
  denial. The generated Worker build also rejects any retained `sharp` or
  native `.node` reference; image display is covered by the fixture's real
  PNG-to-JPEG public photo/profile flow.

## Current execution evidence

### Completed canonical public-review HTTP proof

The preserved prepared Linux runtime volume was reused after the fresh `npm ci`
attempt was OOM-killed. The successful isolated Next fixture generated
`public-http-postgrest-metrics-27235-27770.json` and passed every runner
assertion:

- one v1.1 review was approved through `private.moderate_review_experience_v11`;
  a separate pending review remained private, and a second shop remained at
  zero public reviews;
- `/reviews/`, `/shops/fixture-partner-store/`, and the public Partner widget
  rendered the approved marker and rejected the private marker over HTTP;
- the metric report observed the canonical global list/count RPCs and the
  shop-detail list/summary RPCs. It counts PostgREST HTTP calls, never SQL
  statements;
- after normal dashboard unlisting, the shop detail returned 404 and the shop
  was absent from both `/shops/` and `/sitemap.xml`;
- the final source passed the fixture-runner contract, proxy privacy-metrics
  contract, typecheck, lint, offline `npm run build`, and `npm run workers:build`.

The top-page 5-run follow-up was 214.254, 94.233, 68.764, 70.639, and
70.228 ms in the same isolated fixture. The historical 5661.013 ms repeat
outlier did not recur. The detail's `get_public_listing_store_by_slug` call is
now one call in the first HTTP request via request-local `React.cache`; this
does not create a cross-request cache.

The source contracts, Worker bundle, lint, and typecheck passed in this
continuation. The existing preserved Docker fixtures were intentionally not
removed. Container inspection established that the exited Worker fixtures had
`OOMKilled=true` after Wrangler's local server start; their exit code alone was
therefore misleading. A still-running older Worker fixture consumed about
845 MiB, so it was **stopped but not removed** before retrying. The runner now
also excludes ignored `.eskomi-cloudflare-dynamic-builds/` output when making
its runtime volume; artifact-copying itself was independently confirmed to
succeed. The readiness check accepts Wrangler's `Starting local server` in
addition to Next's `Ready`/`started server` messages.

The earlier interrupted attempt remains preserved as a historical local
artifact only. It must not be used as release evidence; the completed artifact
above is the authoritative fixture result.

## Cloudflare account-readiness follow-up

[`CLOUDFLARE-ACCOUNT-READINESS-AUDIT.md`](CLOUDFLARE-ACCOUNT-READINESS-AUDIT.md)
records the 2026-10-18 read-only account-access finding and the remaining
account, data, email, analytics, and runtime gates. It contains no token,
secret, private UUID, or production-row value.

No Cloudflare account, DNS, secret, OAuth, production database/Auth, main
merge, or deployment was used.

## Supabase-primary local public-read rehearsal — 2026-10-19

The dedicated contract test `test:eskomi-supabase-primary-public-directory`
and local database rehearsal `test:eskomi-supabase-primary-public-directory-local`
cover the new public directory RPC. The database test runs inside a rolled-back
transaction and proves `anon` receives a published shop, hierarchy, and column
article while receiving neither draft shop nor draft article.

The rehearsal also proves that a shop whose **primary** area is unpublished is
omitted even when it has a published secondary area, that a published primary
area remains authoritative, and that a published child does not expose an
unpublished parent's slug. Primary-mode route fallbacks rethrow migration and
coverage failures, so they cannot return an empty HTTP 200 page or sitemap.

For the actual local HTTP rehearsal, an idempotent local-only fixture added one
published shop, two published areas, one published column article, and matching
draft rows to the existing fixture. With `CONTENT_DATA_SOURCE=supabase`, the
explicit expected counts `1/2/1`, and a loopback WordPress request proxy:

- `/`, `/shops/`, `/shops/primary-http-shop/`,
  `/area/primary-http-area/`, `/sitemap.xml`, and
  `/reviews/submit/?shop=primary-http-shop` all returned HTTP 200;
- every page rendered the published fixture marker and omitted the draft marker;
- the sitemap contained the published shop and excluded the draft slug; and
- the WordPress proxy received no application request (the sole recorded
  `/probe` request was the proxy readiness check).

The fixture proves the route selection and fail-closed data gate locally. It
does not prove a production corpus migration; static pages currently fail
closed in primary mode until their `app.contents` projection and reconciliation
are implemented.

## Fixed-page projection and WordPress-disabled HTTP rehearsal — 2026-10-19

The public directory projection now includes the exact six fixed routes
(`/contact/`, `/about/`, `/sitemap/`, `/storelisting/`, `/advertise/`, and
`/osaka-nihonbashi/`). Its expected-count gate also checks the exact route set,
so duplicates, substitutions, or an omitted page cannot be hidden by a matching
count. The local rollback fixture verifies the projection and excludes routes
outside that allowlist.

For a fresh HTTP rehearsal, Next ran with
`CONTENT_DATA_SOURCE=supabase` and `WP_API_BASE_URL=http://127.0.0.1:9/wp-json`.
`/`, shop listing/detail, area, column, every fixed route, `/sitemap.xml`, and
the review form all returned HTTP 200; the five WordPress-backed fixed pages
rendered the Supabase fixture marker. The sitemap included the published fixture
shop and omitted its draft counterpart. The temporary server was stopped after
the check.

The read-only source inventory on the same date found 394 published WordPress
shops, 34 areas, six pages, zero public posts, and 268 media entries, while the
production Supabase project contains 382 draft shops, 34 unpublished areas,
241 private images, and no published contents. Reconciliation is 380 matched
IDs, 14 source-only shops, and two app-only draft records retained as excluded;
it is not a 12-row auto-publish delta. All 268 source media remain WordPress
uploads (26,772,927 bytes total), and the 241 referenced URLs are release
blockers until an object manifest and approved destination exist. No cloud data
was modified.
