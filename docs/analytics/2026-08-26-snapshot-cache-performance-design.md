# Analytics Snapshot Cache Performance Design

Date: 2026-08-26

Task: `ESKOMI-ANALYTICS-MVP-SNAPSHOT-CACHE-PERFORMANCE`

Status: APPROVED FOR IMPLEMENTATION

## Goal

Reduce the approximately 102 external requests currently required by each
Analytics Snapshot without changing Snapshot v1.0.0 semantics, browser cache
policy, credentials, public UI, or production configuration.

## Constraints

- Use the built-in Next.js/Vercel server cache available in Next.js 16.3.1.
- Do not add Redis, Vercel KV, a Supabase cache table, a database migration, or
  an npm dependency.
- Do not change `package.json`, `package-lock.json`, `proxy.ts`, WordPress PHP,
  Supabase migrations, workflows, or public UI.
- Keep Dashboard and API HTTP responses `private, no-store`.
- Never cache credentials, private keys, OAuth tokens, Authorization headers,
  raw Google responses, PII, or user-level Analytics data.

## Selected architecture

The shared boundary is `getAnalyticsSnapshot({ days })`. The Dashboard page and
the protected API route both call this boundary after their existing input and
authorization checks.

The production loader uses the Next.js 16.3.1 `"use cache: remote"` directive.
On Vercel, this is backed by the provider's remote Runtime Cache and persists
across requests and server instances. Plain `"use cache"` is not used because
its default runtime storage is process memory and cannot satisfy the
multi-instance requirement.

The cache function takes only `days: 7 | 28`. The argument is therefore part of
the framework cache key and keeps the two periods completely separate without
putting a secret, user identity, or credential in the key.

References:

- <https://nextjs.org/docs/app/api-reference/directives/use-cache-remote>
- <https://nextjs.org/docs/app/api-reference/functions/cacheLife>
- <https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers>

## TTL and freshness

The cache-life values live in one Analytics-owned module:

| Period | Revalidate TTL | Expire window |
| --- | ---: | ---: |
| 7 days | 900 seconds | 3,600 seconds |
| 28 days | 1,800 seconds | 7,200 seconds |

The requested 15/30-minute TTL controls server revalidation. The longer expire
window permits an existing good entry to survive a failed background refresh.
No cache hit changes `generatedAt`, `collectedAt`, effective periods, source
timestamps, or source states.

If an entry is returned after its normal TTL, the reader returns a cloned
Snapshot with the sanitized warning code
`analytics_snapshot_cache_stale`. It retains all original timestamps and source
states. This explicitly identifies stale fallback without mutating the cached
object or pretending that a new collection occurred.

## Cacheability and failed refresh

A Snapshot is normally cacheable when every source has one of these states:

- `ok`
- `no_data`
- a documented, non-systemic `partial`

The partial-state classifier rejects a partial carrying evidence of an
authentication failure, invalid payload, timeout, or systemic API failure. A
Web or Content partial with usable aggregate data and a bounded target/item
warning remains cacheable.

A Snapshot is non-cacheable when any source is:

- `not_configured`
- `auth_error`
- `invalid_response`
- `timeout`
- systemic `api_error`

The remote cache loader throws an internal non-cacheable-result error instead
of resolving with such a Snapshot. Next.js does not write a failed cache
generation, so an existing good entry is not overwritten. The outer server-only
reader catches the internal error and returns its typed failure Snapshot on a
cold miss. During background revalidation, Next.js retains the existing entry;
the age-based stale warning makes that fallback visible.

Production Cache Components mask error name, message, and custom properties
across their Server Component serialization boundary, but preserve an explicit
`digest`. Therefore the internal error contains only the sanitized period digest
`analytics-non-cacheable:7|28`. A period-indexed transient handoff Map holds at
most two aggregate Snapshots and removes a value after the corresponding outer
reader recovers it. The error does not contain or log the Snapshot, credential,
token, Authorization header, or PII. Next.js may log the sanitized error name,
message, and period digest when a cache fill is rejected.

When no good Remote Cache entry exists, a resolved systemic Snapshot receives a
separate process-local failure TTL of 120 seconds. This best-effort quota guard
is not the Production shared cache: it stores only the two period aggregates,
never overwrites a Remote Cache entry, never stores a rejected Promise, and
retries after two minutes. A normal or stale-good Snapshot clears the same-period
failure entry.

## Single-flight

The reader keeps one in-process pending Promise per period. Concurrent requests
for the same period share it; 7-day and 28-day requests use different Promises.
Every Promise is removed in `finally`, including a rejection. The Map stores
only the period key and the aggregate Promise—never a credential or token.

Remote Runtime Cache supplies cross-request and cross-instance persistence.
The local flight Map is an additional thundering-herd guard, not the production
cache itself. Cross-instance simultaneous cold fills remain governed by the
built-in remote-cache backend; no unsupported distributed lock is introduced.

## GA4 concurrency

The ten existing GA4 `runReport` definitions remain in their exact current
order. A dependency-free bounded worker pool processes them with maximum
concurrency four. Results are written into a preallocated result array by index,
so overview/current/previous and every breakdown keep their existing mapping.
The OAuth request is outside this pool and is not counted as a `runReport`.

## API, Dashboard, and Export

- Dashboard: shared cached `getAnalyticsSnapshot` boundary.
- Dashboard compatibility: the established `collectAnalyticsSnapshot({ days })`
  page call delegates to `getAnalyticsSnapshot`; explicit synthetic `now` or
  `sources` injection delegates to the fresh collector for deterministic tests.
- API: authorization and query validation remain before shared cached
  `getAnalyticsSnapshot`; response remains `private, no-store` and `noindex`.
- CLI Export: formally remains a fresh production collector. The CLI runs in a
  standalone Node process outside the App Router Cache Components runtime, so
  invoking the remote directive there would not provide the production cache
  contract. Export retains exact Snapshot v1.0.0 parity and atomic mode-0600
  output. A future explicit `--fresh`/cached export mode is outside this task.

## Tests and evidence

Fail-first tests cover:

1. consecutive 7-day hits collect once;
2. consecutive 28-day hits collect once;
3. 7-day and 28-day keys are separate;
4. a hit within TTL performs no additional collection;
5. expiration refreshes;
6. ten same-period callers collect once;
7. concurrent different periods collect once each;
8. rejection clears the flight and permits retry;
9. failed refresh preserves the good entry;
10. cache hits preserve `generatedAt`;
11. Dashboard and API use the shared boundary;
12. Export's fresh contract is explicit;
13. all ten GA4 reports run with maximum concurrency four and preserve order.

Performance evidence records cold and warm 7/28 behavior, same-period
concurrency, five Dashboard views, total collector calls, and source-call deltas.

## Rejected alternatives

- A process `Map` or plain `"use cache"` alone: no multi-instance persistence.
- Returning failures with `cacheLife({ expire: 0 })`: Next.js can still invoke
  the cache handler's write path, so it does not prove good-cache preservation.
- Redis, KV, Supabase, or a custom persistent handler: prohibited new
  infrastructure or dependency.
