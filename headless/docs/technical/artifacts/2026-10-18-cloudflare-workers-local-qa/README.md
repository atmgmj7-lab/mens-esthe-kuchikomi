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

The source contracts, Worker bundle, lint, and typecheck passed in this
continuation. The existing preserved Docker fixtures were intentionally not
removed. Repeated attempts to complete the new full fixture were interrupted
after Wrangler's local server start: the app container exited before the
fixture's client/metrics script could retain its JSON output. The initial
runner issue was fixed: it now accepts Wrangler's `Starting local server`
readiness log in addition to Next's `Ready`/`started server` messages.

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
