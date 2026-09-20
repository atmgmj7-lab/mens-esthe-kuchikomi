# Task 3 report: Public campaign entry, existing-form attribution, docs and verification

## Scope and boundary

- Base: `19938b5 feat(partner): add protected review growth kit`.
- Added only the public campaign entry and optional attribution extension that consumes Task 1's existing `openPartnerReviewCampaign` and `recordPartnerReviewCampaignSubmission` service/repository interfaces.
- No direct database/client query was added. No new migration was added.
- No remote/prod Supabase action, WordPress write, environment/secret change, push, deploy, or production QA was performed.

## Implemented behavior

- `GET /r/{token}/` performs active-token resolution only on the server and emits either a no-store/noindex 404 or a no-store/noindex HTTP 307 to the existing exact `/reviews/submit/?shop={canonical-slug}&campaign={opaque-token}` form route.
- The review page repeats active-token resolution and verifies the canonical WordPress shop ID and normalized slug before it renders an attributed prefill. A valid token combined with another shop renders a denial state with no form. An invalid/inactive token falls back to the ordinary, unattributed review form behavior.
- The existing client form sends only an optional opaque `campaignToken` with its normal payload. The submit API repeats campaign/shop validation before WordPress submission; mismatch returns 400 before the WordPress adapter is invoked.
- WordPress submission remains pending moderation. A private conversion is attempted only after a successful WordPress result contains a positive ID. Its input is only token, shop ID, and WordPress review ID; no review body, nickname/contact data, source URL, or raw payload is copied into Partner analytics. Conversion-record failure does not change an already successful WordPress result.
- The Foundation specification now contains the `PARTNER-03` trust boundary, exact local/future-production migration sequence, read-only verification SQL, and rollback/failure policy. `pm/PROGRESS.md` records that all production steps remain **NOT performed**.

## TDD evidence

- RED: after adding the Task 3 source contract, `npm run test:partner-review-growth` failed because `headless/app/r/[token]/route.ts` did not exist.
- GREEN: after the route/form/API implementation, the source contract passed.
- A focused, headless-only QA harness executes the real transpiled public route and review submit route with server-only dependency fakes. It checks active 307 exact target/prefill, noindex/no-store invalid entry, normal unattributed form path, campaign/shop denial before WordPress, failed WordPress without conversion, successful-ID conversion, and invalid-token unattributed fallback.
- A TypeScript narrowing correction was also done RED→GREEN: the source contract first required a concrete positive WordPress ID before recording, then the route bound/narrowed that optional value.

## Local verification

All commands passed locally:

```text
cd headless && npm run test:partner-review-growth
cd headless && npm run qa:partner-review-growth
cd headless && npm run test:review-submit-prefill
cd headless && npm run test:review-experience-boundary
cd headless && npm run test:public-reviews
cd headless && npm run typecheck
cd headless && npm run lint -- --quiet
cd headless && npm run build

supabase start --yes
supabase db reset --local --no-seed
cd headless && npm run test:free-partner-local-supabase
cd headless && npm run test:partner-review-growth-local-supabase
supabase db lint --local
supabase stop --project-id mens-esthe-kuchikomi

git diff --check
git diff | secret-pattern scan
```

The local reset applied Foundation migration `20260919000000_free_partner_foundation.sql` before Growth migration `20260920000000_partner_review_growth.sql`; both SQL contracts passed. The local containers were stopped after verification. The production build completed with `/r/[token]`, `/reviews/submit`, and `/api/reviews/submit` dynamic routes present.

## Remaining boundary

Installed production migration state, service-role configuration, active campaign data, Dashboard Basic Auth, QR scans, actual WordPress response IDs, deployment, and live browser verification are **NOT_VERIFIED**. Production migration, rollback deployment, campaign-state change, controlled WordPress test submission, and conversion verification each require separate explicit approval for the exact target SHA/deployment.

## Review fix round: real existing-form browser QA

- Important review finding fixed: the initial changed-flow browser check used a handwritten `/reviews/submit/` HTML response after testing transpiled route/API modules. It has been replaced with an actual local `next start` server serving the built review page and its real `ReviewSubmitForm` client component.
- The QA generates a temporary localhost-only CA-trusted certificate, then starts only local HTTPS WordPress and local HTTP Supabase RPC stubs. It injects those local endpoints into the child Next process; no external WordPress/Supabase host, production data, credential, or persistent environment file is used. Temporary certificate files and all child servers are removed/stopped in `finally`.
- The headless browser now follows real `/r/{token}` 307 routing into the actual existing form, fills/submits that form, and proves through the local RPC capture that the client transported the token. It verifies WordPress receives `pending` with the canonical shop ID and that the conversion RPC receives only token/shop/WordPress IDs. It also submits the real non-campaign form, renders the actual page's campaign/shop denial with no form, and makes an actual Next API mismatch request that reaches neither mocked WordPress nor conversion recording. Direct route-module API checks still retain the WordPress-failure/no-conversion case.
- RED: the strengthened source contract required a `next start` child process and the real `form.hl-review-form`; it failed against the handwritten-form QA. GREEN: focused source contract, real changed-flow headless QA, typecheck, lint, and diff check all passed after replacement.

## Final whole-branch review fix wave

- Important: campaign conversion now has a 750 ms, `AbortController`-backed deadline. The server-only repository accepts an optional `AbortSignal` and passes it to the conversion RPC fetch. The successful WordPress response therefore returns a bounded 200 even if private conversion recording stalls; conversion remains best-effort and cannot invite a duplicate WordPress retry.
- Regression: the focused harness executes the real review route with the real provisioning service and a never-resolving conversion repository. It proves exactly one WordPress call, a response under two seconds, HTTP 200, and a conversion input limited to token/shop ID/WordPress review ID (no review body or contact data).
- Minor 1: dashboard review JSON is now treated as `unknown` until non-null object/array validation succeeds. The focused route regression supplies `null` and verifies the existing private/noindex 400 path without invoking the review service.
- Minor 2: `PARTNER-03` now distinguishes an expected unapplied Foundation/Growth migration (absent ledger and absent owned objects) from unexpected existing-object drift (any ledger/object/grant inconsistency), which must stop without repair. The local verification order now runs build before `qa:partner-review-growth`.
- Final local verification: `npm run test:partner-review-growth`, `npm run typecheck`, `npm run lint -- --quiet`, `npm run build`, `npm run qa:partner-review-growth`, and `git diff --check` passed. No remote, production, secret, environment-file, push, or deploy action was performed.
