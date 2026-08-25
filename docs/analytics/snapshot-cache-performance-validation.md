# Analytics Snapshot Cache Performance Validation

Date: 2026-08-26

Task: `ESKOMI-ANALYTICS-MVP-SNAPSHOT-CACHE-PERFORMANCE`

## Result

Local implementation and regression validation: PASS.

Production change, push, deploy, external write, Google setting change, package
change, and new dependency: 0.

## Cache architecture

- Built-in mechanism: Next.js 16.3.1 `"use cache: remote"` with Cache
  Components already enabled.
- Vercel semantics: provider-backed Remote Runtime Cache persists across
  requests and server instances. The process Maps are only a same-process
  single-flight guard, a bounded serialization handoff, and a 120-second
  failure quota guard; they are not the shared good cache.
- Keys: `days=7` and `days=28`, with no credential or user identity.
- TTL: 7-day revalidate 900 seconds / expire 3,600 seconds; 28-day revalidate
  1,800 seconds / expire 7,200 seconds.
- Cacheable: all source `ok`, legitimate `no_data`, GA4/GSC bounded no-row or
  pagination partial, and Web/Content partial with usable aggregate evidence.
- Non-cacheable in the good Remote Cache: `not_configured`, `auth_error`,
  `invalid_response`, `timeout`, systemic `api_error`, or systemic partial
  evidence.
- Failed refresh: digest-only rejected cache generation; existing good entry is
  not overwritten. Stale-good output preserves timestamps and adds
  `analytics_snapshot_cache_stale`.
- Resolved cold failure: process-local 120-second TTL, at most one aggregate per
  period, followed by retry. Rejected Promises are never retained.

## Concurrency and performance evidence

Synthetic production-reader results:

| Scenario | Full collector delta | GA4 | GSC | Web | Content |
| --- | ---: | ---: | ---: | ---: | ---: |
| cold 7-day | 1 | 1 | 1 | 1 | 1 |
| warm 7-day | 0 | 0 | 0 | 0 | 0 |
| cold 28-day | 1 | 1 | 1 | 1 | 1 |
| warm 28-day | 0 | 0 | 0 | 0 | 0 |
| five warm Dashboard views | 0 | 0 | 0 | 0 | 0 |

- Ten simultaneous requests for the same period: full collector 1.
- Simultaneous 7-day and 28-day requests: full collector 1 per period.
- Rejected flight: removed and successfully retried on the next request.
- GA4 `runReport` before: maximum concurrency 10 (recorded RED).
- GA4 `runReport` after: maximum concurrency 4, all 10 reports executed, exact
  current/previous aggregation order retained.

Synthetic latency harness (25 ms deterministic collector delay):

| Scenario | Elapsed |
| --- | ---: |
| cold 7-day | 26.040 ms |
| warm 7-day | 0.021 ms |
| cold 28-day | 26.100 ms |
| warm 28-day | 0.032 ms |
| ten concurrent same-period reads | 26.102 ms |
| five warm Dashboard views | 0.026 ms |

These elapsed values are local synthetic evidence, not live Google latency. The
concurrent scenario performed one collector call, and the five-view scenario
performed zero additional collector calls.

## Runtime evidence

A built production server was exercised locally with synthetic Dashboard Basic
Auth, Google credentials unset, and the WordPress API directed to a loopback
failure endpoint. Site Health performed only its fixed public READ-ONLY GETs.

- HTTP: 200
- `Cache-Control`: `private, no-store`
- schemaVersion: `1.0.0`
- GA4: `not_configured`
- GSC: `not_configured`
- Web: `ok`
- Content: `ok`
- Secret, token, Authorization, raw Google response, PII, user-level data in
  result/log: 0
- Production mutation: 0

The first runtime attempt proved that Cache Components mask custom error
properties. The final digest-only handoff was then verified against the real
production build. Next.js logs only the sanitized non-cacheable error and period
digest; it does not log the handoff Snapshot.

## Verification commands

- `node --test tests/analytics/snapshot-cache.test.mjs`: PASS, 18/18.
- `node --test tests/analytics/ga4.test.mjs`: PASS, 26/26.
- `node --test tests/analytics/*.test.mjs`: PASS, 105/105.
- `npm test`: PASS.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS, Cache Components enabled.
- `npm run test:portal-browser-layout`: PASS, 98 scenarios, 90,179
  assertions, 56 screenshots.
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities.

## Export and live checks

- Dashboard/API: shared cached Snapshot boundary.
- Standalone CLI Export: formal fresh collection, exact aggregate parity and
  atomic mode-0600 output retained.
- Live Google smoke: NOT EXECUTED. This task did not require a new credential
  context and made zero live Google calls.
