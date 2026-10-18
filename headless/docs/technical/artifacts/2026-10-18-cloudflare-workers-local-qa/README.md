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

The remaining completion attempt was then cut short by the local execution
wrapper while the Docker-contained `npm ci` child was still preparing the
fresh volume. This is not an application or Docker artifact-path error, but it
still prevents claiming new full-fixture HTTP/metric evidence.

Therefore, there is **no new trustworthy PostgREST measurement JSON in this
directory yet**. Do not represent the historical page timings as API-call or
SQL-count results. Re-run this command in a stable local Docker session to
generate it, without deleting existing fixtures:

```sh
ESKOMI_E2E_PRESERVE_FIXTURE=1 \
ESKOMI_E2E_APP_RUNTIME=workers \
ESKOMI_E2E_WORKERS_ARTIFACT_ROOT=<latest-generated-root> \
ESKOMI_E2E_METRICS_ARTIFACT_DIR=docs/technical/artifacts/2026-10-18-cloudflare-workers-local-qa \
bash scripts/run-eskomi-v11-internal-partner-http-e2e.sh
```

No Cloudflare account, DNS, secret, OAuth, production database/Auth, main
merge, or deployment was used.
