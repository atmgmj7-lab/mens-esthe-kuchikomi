# GA4 server adapter validation (T1)

## Scope and interfaces

T1 adds server-only GA4 collection primitives only. It does not add GSC, Site Health, a content adapter, snapshots, routes, exports, dashboard UI, dependencies, production configuration, or live Google calls.

`AnalyticsSourceResult<T>` returns exactly one source state: `ok`, `partial`, `no_data`, `not_configured`, `auth_error`, `api_error`, `invalid_response`, or `timeout`. Successful (`ok`/`partial`) results carry data; all other states carry `null`. `AnalyticsWarning` contains only a state/code message.

`buildAnalyticsPeriod(7 | 28, now?)` uses `Asia/Tokyo` calendar days and keeps `requested` and `effective` ranges as distinct objects. For `2026-08-23T00:30:00+09:00`, the seven-day current range is `2026-08-16..2026-08-22` and the previous range is `2026-08-09..2026-08-15`.

`loadGoogleServiceAccount()` first resolves the server-only `GOOGLE_SERVICE_ACCOUNT_JSON` value, then uses the path named by `GOOGLE_APPLICATION_CREDENTIALS` only when the inline value is absent. If the inline variable is present but empty, oversized, malformed, or invalid, the loader fails closed and does not mask that deployment error with the file fallback. When both sources are absent, the result is `not_configured`. `collectGa4()` resolves its GA4 property from its explicit `propertyId` option or `GA4_PROPERTY_ID`; an absent value is `not_configured`.

## Request matrix

Every definition is sent once for current and once for previous effective dates, with `POST`, `cache: "no-store"`, the GA4 `properties.runReport` endpoint, and fixed allowlisted fields.

| Report | Metrics | Dimension / condition |
| --- | --- | --- |
| Overview | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | none |
| Organic Search | `sessions` | `sessionDefaultChannelGroup` equals `Organic Search` |
| Landing pages | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | `landingPagePlusQueryString`; sessions descending, then landing page ascending |
| Organic landing pages | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | `landingPagePlusQueryString` where `sessionDefaultChannelGroup` equals `Organic Search`; sessions descending, then landing page ascending |
| Devices | `sessions`, `activeUsers`, `engagedSessions`, `engagementRate`, `keyEvents` | `deviceCategory`; sessions descending, then device ascending |

Breakdowns are deterministically limited to 50 rows. The explicit `orderBys` values select sessions descending and the named dimension ascending as the tie-breaker, identically for current and previous ranges. Headers, row shapes, duplicate dimensions, metric count, and finite numeric metric strings are validated before values are used. `sessions`, `activeUsers`, `engagedSessions`, and `keyEvents` must be non-negative; `engagementRate` must be between 0 and 1 inclusive.

## State and data semantics

An explicit GA4 metric string `"0"` is retained as numeric zero. A response with valid expected headers and either empty `rows`, omitted `rows` with an omitted `rowCount`, or omitted `rows` with `rowCount: 0` is `no_data`; it is never converted to zeros. Missing `rows` with a positive `rowCount`, non-array `rows`, invalid headers, or inconsistent row counts remain `invalid_response`. Any mix of usable `ok` reports with `no_data` or an error is source `partial` and preserves each report pair's own result; an error plus `no_data` is also `partial` so the nested states remain available. All-no-row is source `no_data`.

A credential/OAuth-wide 401 or 403 remains `auth_error`; GA4 report 401/403 map to `auth_error`, 429/5xx/network failures to `api_error`, aborted deadlines (including response-body aborts) to `timeout`, and JSON syntax/schema/metric values to `invalid_response`. For all-failure GA4 reports, `auth_error` is retained only if every report is authentication-related; a unanimous other state is retained; mixed failures use the documented deterministic precedence `timeout`, then `api_error`, then `invalid_response`, then `auth_error`. This avoids a position-dependent `auth_error` result.

OAuth accepts optional `expires_in` only when it is an integer from 1 through 86,400 seconds; a present value outside that safe range is `invalid_response`.

## Security boundaries

The service-account module and GA4 adapter begin with `import "server-only"`. `GOOGLE_SERVICE_ACCOUNT_JSON` is a server-only Sensitive Environment Variable contract and must never use a `NEXT_PUBLIC_` name. Inline input is limited to 16 KiB, parsed as plain JSON without an added Base64 variant, and requires a service-account type, non-empty client email, parseable RSA private key, and the canonical token endpoint. Literal escaped newlines in the private key are normalized after JSON parsing. The same schema, private-key, and endpoint validation is used by the file fallback.

OAuth uses an RS256 JWT with only the read-only Analytics scope and a form-encoded JWT bearer grant. The credential `token_uri` must exactly match `https://oauth2.googleapis.com/token`; any other scheme, hostname, port, userinfo, query, fragment, or path is rejected before fetch. Warnings contain source-specific state/code only: no credential path, credential JSON, private key, OAuth token, signed JWT, authorization value, environment content, user data, or live response is logged or persisted. Tests generate a temporary synthetic key at runtime and use injected fetch doubles only, including the file-free production-runtime simulation.

## Reproducible evidence

Focused command:

```bash
node --experimental-strip-types --no-warnings --test tests/analytics/ga4.test.mjs
```

RED evidence was recorded before each implementation layer: missing `period.ts`/`result.ts`, then missing `google-credentials.ts`, then missing `ga4.ts`; Fix Round 1 added RED evidence for expiry validation, response-body transport classification, deterministic `orderBys`, and mixed `no_data` aggregation. The production credential injection change separately recorded ten expected RED cases before implementation. GREEN evidence covers Tokyo rollover, contract states, inline priority and fail-closed behavior, filesystem fallback, RSA/JWT validation, credential/OAuth errors, exact request pair bodies/dates/order, zero/no-row semantics, strict malformed-response guards, HTTP mapping, response-body transport failures, timeouts, credential/property absence, all-auth, and deterministic mixed-failure aggregation. Full pre-commit command outcomes and the targeted secret/PII scan are recorded in the task report.
