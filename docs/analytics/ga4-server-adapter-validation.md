# GA4 server adapter validation (T1)

## Scope and interfaces

T1 adds server-only GA4 collection primitives only. It does not add GSC, Site Health, a content adapter, snapshots, routes, exports, dashboard UI, dependencies, production configuration, or live Google calls.

`AnalyticsSourceResult<T>` returns exactly one source state: `ok`, `partial`, `no_data`, `not_configured`, `auth_error`, `api_error`, `invalid_response`, or `timeout`. Successful (`ok`/`partial`) results carry data; all other states carry `null`. `AnalyticsWarning` contains only a state/code message.

`buildAnalyticsPeriod(7 | 28, now?)` uses `Asia/Tokyo` calendar days and keeps `requested` and `effective` ranges as distinct objects. For `2026-08-23T00:30:00+09:00`, the seven-day current range is `2026-08-16..2026-08-22` and the previous range is `2026-08-09..2026-08-15`.

`loadGoogleServiceAccount()` reads only the path named by `GOOGLE_APPLICATION_CREDENTIALS`. `collectGa4()` resolves its GA4 property from its explicit `propertyId` option or `GA4_PROPERTY_ID`; an absent value is `not_configured`.

## Request matrix

Every definition is sent once for current and once for previous effective dates, with `POST`, `cache: "no-store"`, the GA4 `properties.runReport` endpoint, and fixed allowlisted fields.

| Report | Metrics | Dimension / condition |
| --- | --- | --- |
| Overview | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | none |
| Organic Search | `sessions` | `sessionDefaultChannelGroup` equals `Organic Search` |
| Landing pages | `sessions`, `activeUsers`, `keyEvents` | `landingPagePlusQueryString`; sessions descending, then landing page ascending |
| Devices | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | `deviceCategory`; sessions descending, then device ascending |

Breakdowns are deterministically limited to 50 rows. The explicit `orderBys` values select sessions descending and the named dimension ascending as the tie-breaker, identically for current and previous ranges. Headers, row shapes, duplicate dimensions, metric count, and finite numeric metric strings are validated before values are used.

## State and data semantics

An explicit GA4 metric string `"0"` is retained as numeric zero. Empty `rows` are `no_data`; they are never converted to zeros. Any mix of usable `ok` reports with `no_data` or an error is source `partial` and preserves each report pair's own result; an error plus `no_data` is also `partial` so the nested states remain available. All-no-row is source `no_data`.

A credential/OAuth-wide 401 or 403 remains `auth_error`; GA4 report 401/403 map to `auth_error`, 429/5xx/network failures to `api_error`, aborted deadlines (including response-body aborts) to `timeout`, and JSON syntax/schema/metric values to `invalid_response`. For all-failure GA4 reports, `auth_error` is retained only if every report is authentication-related; a unanimous other state is retained; mixed failures use the documented deterministic precedence `timeout`, then `api_error`, then `invalid_response`, then `auth_error`. This avoids a position-dependent `auth_error` result.

OAuth accepts optional `expires_in` only when it is an integer from 1 through 86,400 seconds; a present value outside that safe range is `invalid_response`.

## Security boundaries

The service-account module and GA4 adapter begin with `import "server-only"`. OAuth uses an RS256 JWT with only the read-only Analytics scope and a form-encoded JWT bearer grant. Warnings contain state/code only: no credential path, credential JSON, private key, OAuth token, authorization value, environment content, user data, or live response is logged or persisted. Tests generate a temporary synthetic key at runtime and use injected fetch doubles only.

## Reproducible evidence

Focused command:

```bash
node --experimental-strip-types --no-warnings --test tests/analytics/ga4.test.mjs
```

RED evidence was recorded before each implementation layer: missing `period.ts`/`result.ts`, then missing `google-credentials.ts`, then missing `ga4.ts`; Fix Round 1 added RED evidence for expiry validation, response-body transport classification, deterministic `orderBys`, and mixed `no_data` aggregation. GREEN evidence covers Tokyo rollover, contract states, JWT header/signature, credential/OAuth errors, exact request pair bodies/dates/order, zero/no-row semantics, strict malformed-response guards, HTTP mapping, response-body transport failures, timeouts, credential/property absence, all-auth, and deterministic mixed-failure aggregation. Full pre-commit command outcomes and the targeted secret/PII scan are recorded in the task report.
