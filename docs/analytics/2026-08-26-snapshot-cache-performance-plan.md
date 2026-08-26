# Analytics Snapshot Cache Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe shared Analytics Snapshot cache and cap GA4 `runReport` concurrency at four while preserving Snapshot v1.0.0 and all security boundaries.

**Architecture:** A server-only `getAnalyticsSnapshot({ days })` boundary combines Next.js 16.3.1 `"use cache: remote"`, period-specific `cacheLife`, non-cacheable-result rejection, stale-warning projection, and a per-period in-process flight guard. The existing GA4 definitions run through a bounded worker pool that stores results by original index.

**Tech Stack:** Next.js 16.3.1 Cache Components, React 19.2.4, TypeScript 5, Node.js built-in test runner.

**Spec:** `docs/analytics/2026-08-26-snapshot-cache-performance-design.md`

## Global Constraints

- Cache only aggregate Analytics Snapshot v1.0.0 data.
- Use TTL 900 seconds for period 7 and 1,800 seconds for period 28.
- Keep 7/28 cache keys and in-process flights separate.
- Keep browser/API responses `private, no-store`; never cache credentials, raw Google responses, PII, or user-level data.
- Do not add dependencies or change package/lock, proxy, PHP, Supabase, workflow, or public UI files.
- Do not push, deploy, write production data, or change Google/WordPress/Supabase configuration.

---

### Task 1: Cache policy and single-flight core

**Files:**
- Create: `headless/lib/analytics/snapshot-cache.ts`
- Create: `headless/tests/analytics/snapshot-cache.test.mjs`

**Interfaces:**
- Consumes: `AnalyticsDays`, `AnalyticsSnapshot`, and a loader `(days) => Promise<AnalyticsSnapshot>`.
- Produces: `SNAPSHOT_CACHE_TTL_SECONDS`, `isAnalyticsSnapshotCacheable(snapshot)`, `createAnalyticsSnapshotReader(dependencies)`, and `getAnalyticsSnapshot({ days })`.

- [ ] **Step 1: Write the failing policy tests**

Add literal Snapshots covering all-`ok`, legitimate `no_data`, bounded
`partial`, `not_configured`, `auth_error`, `invalid_response`, `timeout`, and
systemic `api_error`. Assert only the first three categories are cacheable.

- [ ] **Step 2: Run the policy tests and verify RED**

Run:

```bash
node --test tests/analytics/snapshot-cache.test.mjs
```

Expected: FAIL because `snapshot-cache.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimum cache policy**

Define the exact TTL mapping:

```ts
export const SNAPSHOT_CACHE_TTL_SECONDS = Object.freeze({ 7: 900, 28: 1800 });
```

Reject root systemic source states and partial warnings that represent auth,
timeout, invalid-response, or systemic API failures. Do not inspect or retain
credential values.

- [ ] **Step 4: Run the policy tests and verify GREEN**

Run the Task 1 command and require PASS with no warnings.

- [ ] **Step 5: Write the failing reader tests**

Using a deterministic fake remote loader and clock, add behavior tests for:
consecutive 7/28 hits, key separation, TTL hit, TTL expiration, ten concurrent
same-period calls, concurrent different periods, rejection cleanup, failed
refresh preserving a good entry, stale warning projection, and unchanged
`generatedAt`/`collectedAt`.

- [ ] **Step 6: Run the reader tests and verify RED**

Run the Task 1 command. Expected: FAIL on missing reader behavior, with the
collector call count showing the exact broken contract.

- [ ] **Step 7: Implement the reader and remote loader**

Implement a dependency-injected reader used by the production export:

```ts
type SnapshotLoader = (days: AnalyticsDays) => Promise<AnalyticsSnapshot>;

export function createAnalyticsSnapshotReader(options: {
  load: SnapshotLoader;
  now?: () => Date;
}): (input: { days: AnalyticsDays }) => Promise<AnalyticsSnapshot>;
```

Keep `Map<AnalyticsDays, Promise<AnalyticsSnapshot>>` flights and delete only
the matching Promise in `finally`. The production loader must contain:

```ts
"use cache: remote";
cacheLife({ stale: 0, revalidate: ttl, expire: ttl * 4 });
```

If a collected Snapshot is non-cacheable, store the aggregate in a bounded,
opaque-invocation handoff and throw a digest-only internal error before returning
so the cache handler cannot replace a good entry. Catch it only at the outer
server boundary, consume it once, and expire an unrecovered background handoff
after 120 seconds. Keep resolved failure Snapshots for only 120 seconds in the
separate process-local quota guard; framework retries must reuse that failure
without repeating the full external collection.

- [ ] **Step 8: Run the reader tests and verify GREEN**

Run the Task 1 command and require all cache cases PASS.

- [ ] **Step 9: Refactor without changing behavior**

Deduplicate test fixtures, keep all test-only clocks/backends in the test file,
and rerun the Task 1 command.

### Task 2: GA4 bounded concurrency

**Files:**
- Modify: `headless/lib/analytics/ga4.ts`
- Modify: `headless/tests/analytics/ga4.test.mjs`

**Interfaces:**
- Consumes: the existing ten ordered `fetchReport` jobs.
- Produces: the same `Ga4AnalyticsData` shape with no more than four concurrent
  `runReport` calls.

- [ ] **Step 1: Write the failing concurrency test**

Use a delayed synthetic `fetchImpl` that counts active GA4 `runReport` requests,
excludes the OAuth request, returns all ten complete report fixtures, and asserts:

```js
assert.equal(runReportCalls, 10);
assert.ok(maxActiveRunReports <= 4);
```

Also assert representative current/previous overview, Organic Search, landing,
organic landing, and device values so an ordering mutation fails the test.

- [ ] **Step 2: Run the GA4 test and verify RED**

Run:

```bash
node --test tests/analytics/ga4.test.mjs
```

Expected: FAIL because existing maximum concurrency is 10.

- [ ] **Step 3: Implement a four-worker ordered mapper**

Create a small internal helper that preallocates its result array, advances one
shared index, and writes each result to that index. Wrap jobs in a module-wide
four-permit semaphore so simultaneous period collectors share the same
process-level quota. Replace only the ten-report `Promise.all`; leave OAuth and
report definitions unchanged.

- [ ] **Step 4: Run the GA4 test and verify GREEN**

Run the Task 2 command. Require all ten calls, maximum concurrency at most four,
and existing fixture tests PASS.

### Task 3: Shared Dashboard and API boundary

**Files:**
- Modify: `headless/app/dashboard/analytics/page.tsx`
- Modify: `headless/app/api/dashboard/analytics/current/route.ts`
- Modify: `headless/tests/analytics/dashboard-ui.test.mjs`
- Modify: `headless/tests/analytics/analytics-api.test.mjs`

**Interfaces:**
- Consumes: `getAnalyticsSnapshot({ days })`.
- Produces: unchanged Dashboard rendering and protected API JSON.

- [ ] **Step 1: Write failing boundary tests**

Change the Dashboard production-boundary assertion to require
`getAnalyticsSnapshot`. Add an API default-handler integration seam that proves
authorization occurs before the shared loader and that the returned Snapshot is
unchanged. Keep existing injected-handler tests.

- [ ] **Step 2: Run boundary tests and verify RED**

Run:

```bash
node --test tests/analytics/dashboard-ui.test.mjs tests/analytics/analytics-api.test.mjs
```

Expected: FAIL because page and production route still import the raw collector.

- [ ] **Step 3: Route both consumers through the shared reader**

Replace raw collector imports/calls with `getAnalyticsSnapshot`. Do not move API
authorization or query parsing, and do not change response headers or route
shape (`?period=7|28`, no new subpaths).

- [ ] **Step 4: Run boundary tests and verify GREEN**

Run the Task 3 command and require all authorization, no-store, noindex, query,
and presentation assertions PASS.

### Task 4: Export contract and validation documentation

**Files:**
- Modify: `headless/tests/analytics/export-current.test.mjs`
- Modify: `docs/analytics/snapshot-api-export-validation.md`
- Create: `docs/analytics/snapshot-cache-performance-validation.md`

**Interfaces:**
- Consumes: standalone CLI `collectAnalyticsSnapshot({ days })`.
- Produces: documented fresh-export contract and performance/verification packet.

- [ ] **Step 1: Write the failing export-contract test**

Add a behavior assertion that the standalone exporter invokes its supplied
fresh collector for every export call while API/UI ownership tests require the
shared boundary. Do not merely grep prose.

- [ ] **Step 2: Run the export test and verify RED**

Run:

```bash
node --test tests/analytics/export-current.test.mjs
```

Expected: FAIL until the fresh-export behavior is exposed as the formal default
contract without changing atomic output semantics.

- [ ] **Step 3: Make the fresh contract explicit and document it**

Name the default collector `collectFreshAnalyticsSnapshot` in the export module,
retain one collection per CLI invocation, and document why App Router remote
cache is not used from standalone Node. Preserve exact API/export aggregate
parity when supplied the same Snapshot.

- [ ] **Step 4: Run the export test and verify GREEN**

Run the Task 4 command and require all parser, atomic-write, mode-0600,
concurrency, cleanup, and parity cases PASS.

### Task 5: Performance evidence and full verification

**Files:**
- Modify: `headless/tests/analytics/snapshot-cache.test.mjs`
- Modify: `docs/analytics/snapshot-cache-performance-validation.md`

**Interfaces:**
- Consumes: production reader factory and bounded GA4 collector.
- Produces: cold/warm, concurrency, five-view, source-call, and regression evidence.

- [ ] **Step 1: Add deterministic performance assertions**

Record literal counters for cold 7, warm 7, cold 28, warm 28, ten same-period
requests, and five view reads. Assert warm/source deltas are zero and each cold
period performs one full collection.

- [ ] **Step 1a: Exercise the compiled production cache boundary**

After `npm run build`, run the Analytics-owned production E2E with a test-only
provider-style Remote Cache handler and intercepted synthetic sources. Require
auth-before-cache, 7/28 separation, same-period single-flight, warm source delta
zero, five-view source delta zero, stale failed-refresh preservation, opaque
handoff correlation, `private, no-store`, and Secret exposure zero.

- [ ] **Step 2: Run focused Analytics tests**

```bash
node --test tests/analytics/snapshot-cache.test.mjs
node --test tests/analytics/ga4.test.mjs
node --test tests/analytics/*.test.mjs
```

Record test counts, durations, maximum GA4 concurrency, collector calls, and
source-call deltas in the validation document.

- [ ] **Step 3: Run repository verification**

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:portal-browser-layout
npm audit --audit-level=high
```

Every command must exit zero. Existing packet evidence cannot replace a failure
introduced by this task.

- [ ] **Step 4: Run scope and security checks**

```bash
git diff --check
git diff --name-only HEAD
git diff -- package.json package-lock.json proxy.ts '.github/workflows/**'
git grep -n -I -E 'PRIVATE KEY|Authorization: Bearer|GOOGLE_SERVICE_ACCOUNT_JSON=' -- ':!package-lock.json'
git status --short
```

Confirm no secret value, PII, package/lock change, proxy change, workflow change,
PHP change, Supabase migration, or public UI change.

- [ ] **Step 5: Commit implementation and evidence**

Stage only explicit Analytics-owned paths and commit without amend:

```bash
git add headless/lib/analytics headless/tests/analytics headless/app/dashboard/analytics/page.tsx headless/app/api/dashboard/analytics/current/route.ts headless/scripts/analytics/export-current.mjs docs/analytics
git commit -m "feat(analytics): cache shared snapshots safely"
```

### Task 6: Independent final reviews

**Files:**
- Read only: committed base-to-target diff and all changed files.

**Interfaces:**
- Consumes: clean committed implementation and verification evidence.
- Produces: independent SPEC and QUALITY/SECURITY review packets.

- [ ] **Step 1: Run independent SPEC review**

Require explicit findings by Critical/Important/Minor, cache architecture,
period/TTL/key/freshness/single-flight/failure semantics, GA4 concurrency,
API/UI/export contract, route shape, scope, and tests.

- [ ] **Step 2: Run independent QUALITY/SECURITY review**

Require explicit analysis of cache poisoning, collision, auth bypass, secret
caching, stale semantics, races, rejected-Promise retention, thundering herd,
multi-instance limitations, quota headroom, production-path tests, and no-store.

- [ ] **Step 3: Apply only authorized Analytics-scope Important fixes**

For every actionable finding, first add a failing regression test, verify RED,
apply the minimum fix, rerun focused/full checks, and create a new non-amended
commit. Do not fix out-of-scope or Minor findings without authorization.

- [ ] **Step 4: Close the gate**

Require `Critical = 0`, `Important = 0`, a clean worktree, repository changes
limited to approved paths, production changes zero, and no push/deploy. Return
the execution result packet and stop before production release work.
