# ESKOMI Analytics MVP REBUILD-T1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild only the server-side GA4 adapter foundation on the clean current `origin/main`, with deterministic Asia/Tokyo comparison periods, safe service-account authentication, strict GA4 response semantics, fail-first fixtures, and validation evidence.

**Architecture:** New code lives entirely under `headless/lib/analytics/**`, with a small shared result/period layer, a server-only Google credential and OAuth layer, and a server-only GA4 adapter. The adapter uses the GA4 Data API `properties.runReport` REST endpoint through injected `fetch`, never exposes credentials, and reports `ok`, `partial`, `no_data`, `not_configured`, `auth_error`, `api_error`, `invalid_response`, or `timeout` without converting missing data to zero. Tests use Node's built-in test runner and fixture JSON under `headless/tests/analytics/**`; no dependency or existing dashboard/public route changes are allowed.

**Tech Stack:** TypeScript 5, Node.js 26 built-in `fetch`, `node:crypto`, `node:fs/promises`, Node test runner, Next.js 16 server-only boundary.

**Spec:** `/Users/narikiyo/.codex/attachments/9a3c0cef-f787-4f6d-8f64-6ea6eea086f6/pasted-text.txt` sections 4-6, 14-17, 19-22.

## Global Constraints

- Execute `ESKOMI-ANALYTICS-MVP-REBUILD-T1` only; do not start GSC, Site Health, WordPressAdapter, AnalyticsSnapshot integration, API, export, or Dashboard UI.
- Public content authority remains WordPress; do not change Supabase, WordPress, public URLs, canonical, sitemap, robots, or production data.
- Modify only `headless/lib/analytics/**`, `headless/tests/analytics/**`, and `docs/analytics/**`.
- Do not modify `package.json`, `package-lock.json`, common dashboard files, `proxy.ts`, workflows, migrations, shared layout, or shared CSS.
- Add no dependency. Use standard server-side HTTP, filesystem, and crypto APIs.
- Never display or persist credential JSON, private keys, OAuth tokens, Authorization headers, `.env` contents, user-level analytics, or PII.
- Credential discovery uses `GOOGLE_APPLICATION_CREDENTIALS`; GA4 property selection uses `GA4_PROPERTY_ID`. Neither value is hard-coded into production code.
- Source states must preserve exactly: `ok`, `partial`, `no_data`, `not_configured`, `auth_error`, `api_error`, `invalid_response`, `timeout`.
- Never convert null, an absent metric, malformed/non-numeric values, an empty response, or an error to zero. An explicit numeric `"0"` from GA4 is a real zero.
- GA4 requirements are sessions, activeUsers, engagedSessions, engagementRate, Organic Search sessions, keyEvents, landing-page breakdown, and device-category breakdown, with current and previous periods queried under the same conditions.
- Periods support 7 and 28 days, are deterministic in `Asia/Tokyo`, use the previous completed Tokyo day as requested current end, and keep requested/effective ranges separate even when equal in T1.
- HTTP 401 and 403 map to `auth_error`; 429 and 5xx map to `api_error`; aborted deadline maps to `timeout`; malformed JSON/schema/metric values map to `invalid_response`.
- No live Google API call is part of T1. All Google calls use injected test doubles and repository fixtures.
- Complete only after focused tests, full repository tests, lint, typecheck, production build, `git diff --check`, package/lock diff zero, unrelated app diff zero, and a Secret/PII scan.
- Stage explicit Analytics T1 paths only, create one local commit, and do not push, merge, open a PR, deploy, or perform a production write.

---

### Task 1: GA4 server adapter foundation

**Files:**
- Create: `headless/lib/analytics/result.ts`
- Create: `headless/lib/analytics/period.ts`
- Create: `headless/lib/analytics/google-credentials.ts`
- Create: `headless/lib/analytics/ga4.ts`
- Create: `headless/tests/analytics/register-server-only.mjs`
- Create: `headless/tests/analytics/ga4.test.mjs`
- Create: `headless/tests/analytics/fixtures/ga4/*.json`
- Create: `docs/analytics/ga4-server-adapter-validation.md`
- Include in commit: `docs/analytics/2026-08-23-ga4-server-adapter-plan.md`

**Interfaces:**
- Produces a generic result contract shaped as:

```ts
export type AnalyticsSourceState =
  | "ok"
  | "partial"
  | "no_data"
  | "not_configured"
  | "auth_error"
  | "api_error"
  | "invalid_response"
  | "timeout";

export type AnalyticsSourceResult<T> =
  | { state: "ok" | "partial"; data: T; collectedAt: string; warnings: AnalyticsWarning[] }
  | { state: "no_data" | "not_configured" | "auth_error" | "api_error" | "invalid_response" | "timeout"; data: null; collectedAt: string; warnings: AnalyticsWarning[] };
```

- Produces `buildAnalyticsPeriod(days: 7 | 28, now?: Date): AnalyticsPeriod`, where `2026-08-23T00:30:00+09:00` yields current `2026-08-16..2026-08-22` and previous `2026-08-09..2026-08-15` for 7 days; requested and effective ranges are separate objects with equal values in T1.
- Produces `loadGoogleServiceAccount(options?)` which reads only the explicit `GOOGLE_APPLICATION_CREDENTIALS` path, validates a service-account JSON shape without logging it, and returns a typed result.
- Produces `getGoogleAccessToken(options?)` which signs an RS256 JWT with the read-only analytics scope, POSTs the JWT bearer grant to the credential `token_uri`, validates the token response, honors a finite timeout, and never places secrets in returned warnings/errors.
- Produces `collectGa4(options: { period: AnalyticsPeriod; propertyId?: string; fetchImpl?: typeof fetch; now?: () => Date; timeoutMs?: number }): Promise<AnalyticsSourceResult<Ga4AnalyticsData>>`.
- `Ga4AnalyticsData` preserves current and previous overview, Organic Search sessions, landing pages, and devices. Each period/breakdown result independently preserves real zero versus no rows; a mixed success/failure becomes `partial`, while a source-wide auth failure remains `auth_error`.
- GA4 request bodies use exact metric names `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, and `keyEvents`; Organic Search uses dimension `sessionDefaultChannelGroup` with exact value `Organic Search`; landing pages use `landingPagePlusQueryString`; devices use `deviceCategory`.

- [ ] **Step 1: Add failing period and result-contract tests**

Write Node tests that dynamically import the TypeScript modules after `register-server-only.mjs` registers an empty `server-only` test module. Assert hand-derived Tokyo boundaries across UTC/Tokyo date rollover, 7/28-day lengths, previous-range adjacency, requested/effective separation, and the exact source-state union behavior exposed by constructors/type guards.

- [ ] **Step 2: Run RED for period/result**

Run:

```bash
node --experimental-strip-types --no-warnings --test tests/analytics/ga4.test.mjs
```

Expected: FAIL because `lib/analytics/result.ts` and `lib/analytics/period.ts` do not exist.

- [ ] **Step 3: Implement the minimal period and result layer**

Use Tokyo calendar arithmetic, not host-local `setDate()`. Validate `days` as only `7 | 28`, format dates as `YYYY-MM-DD`, and allocate distinct requested/effective objects so T2 can shorten effective ranges without mutating requested ranges.

- [ ] **Step 4: Run GREEN for period/result**

Run the focused test command and confirm the period/result cases pass with pristine output.

- [ ] **Step 5: Add failing credential and OAuth tests**

Fixtures/tests must cover credential not configured, unreadable/invalid credential without value exposure, a structurally valid synthetic RSA service account, successful token exchange, malformed token response, token HTTP 401/403/429/5xx, and timeout. Use only generated/synthetic test keys and literal fake tokens; never read the real credential file.

- [ ] **Step 6: Run RED for credentials**

Run the focused test command. Expected: FAIL because `loadGoogleServiceAccount` / `getGoogleAccessToken` are absent.

- [ ] **Step 7: Implement the server-only credential and OAuth helper**

Start the module with `import "server-only"`. Build the JWT header `{ alg: "RS256", typ: "JWT" }`; claims use service-account email as `iss`, the read-only Analytics scope, credential `token_uri` as `aud`, injected epoch seconds as `iat`, and `exp = iat + 3600`. Sign with `RSA-SHA256`; send `application/x-www-form-urlencoded`; sanitize all failure messages to state/code/status only.

- [ ] **Step 8: Run GREEN for credentials**

Run the focused test command and confirm all credential/OAuth cases pass without printing fixture JSON, keys, tokens, or headers.

- [ ] **Step 9: Add fail-first GA4 fixtures and adapter tests**

Create fixture cases named for: normal, actual-zero, no-rows, missing-metric, non-numeric-metric, http-401, http-403, http-429, http-5xx, timeout, credential-not-configured, and malformed-response. Normal fixtures must independently cover overview, Organic Search, landing page, and device breakdown for current and previous exact dates. Tests assert request URL/property encoding, no-store headers/options, metric/dimension/filter bodies, same-condition current/previous pairs, strict header/value alignment, row-count/row-shape validation, no-data versus zero semantics, error mapping, and partial behavior when only one breakdown fails.

- [ ] **Step 10: Run RED for the GA4 adapter**

Run the focused test command. Expected: FAIL because `collectGa4` and GA4 parsing/request logic are absent.

- [ ] **Step 11: Implement the minimal GA4 adapter**

Start the module with `import "server-only"`. Resolve property ID fail-closed, obtain one access token per collection, build fixed allowlisted report definitions, send current and previous calls with identical metrics/dimensions/filters except dates, run independent report calls concurrently, validate complete response headers/rows before numeric conversion, and aggregate source state without inventing values. Limit breakdown rows deterministically and reject duplicate/missing headers or mismatched value counts.

- [ ] **Step 12: Run GREEN and refactor while green**

Run the focused test command, remove duplication only after it passes, then rerun it. Perform a mutation check: wrong metric, removed Organic filter, missing numeric validation, no-rows-to-zero conversion, and swallowed timeout must each break at least one test.

- [ ] **Step 13: Write validation documentation**

Document interfaces, environment variable names (names only), request matrix, status mapping, zero/no_data examples, deterministic period examples, exact focused command, RED/GREEN evidence, security boundaries, and explicit T1 non-scope. Do not include credential values, tokens, Authorization values, `.env` contents, or live data.

- [ ] **Step 14: Run task verification before commit**

Run:

```bash
node --experimental-strip-types --no-warnings --test tests/analytics/ga4.test.mjs
npm test
npm run lint
npm run typecheck
npm run build
git diff --check
git diff -- package.json package-lock.json
git diff --name-only
```

Run a targeted Secret/PII scan across only the new T1 files for private-key blocks, OAuth bearer values, Authorization header values, credential JSON fields containing real-looking values, email/IP/user identifiers, and forbidden `NEXT_PUBLIC_` credential names. Report `NOT_VERIFIED` for any command not actually run.

- [ ] **Step 15: Explicitly stage and create one local commit**

Stage only these paths; never use `git add -A`:

```bash
git add headless/lib/analytics headless/tests/analytics docs/analytics/2026-08-23-ga4-server-adapter-plan.md docs/analytics/ga4-server-adapter-validation.md
git commit -m "feat: rebuild GA4 analytics adapter foundation"
```

After commit, record starting/ending SHA, `git status --short --branch`, `git diff --stat <base>..HEAD`, package/lock diff zero, push/deploy/production-write zero, and stop before T2.
