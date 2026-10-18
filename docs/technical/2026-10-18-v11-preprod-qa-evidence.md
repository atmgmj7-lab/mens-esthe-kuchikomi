# v1.1 pre-production QA evidence — 2026-10-18

## Area static prerender repair

The full build previously stopped while prerendering `/area/sakaisujihonmachi`
because `lib/area-shop-ordering.ts` read `Date.now()` inside the static render.
The 180-day information freshness decision now receives one cached server
reference timestamp from the route/data readers. This retains the same
comparison and ordering inputs while making the clock read compatible with the
Next cached render boundary.

Evidence:

- `npm run build`: PASS; static generation completed `917/917`, including
  `/area/[slug]`.
- `npm run typecheck`, `npm run lint`, `git diff --check`: PASS.
- `node scripts/check-area-shop-ordering-v1.mjs`,
  `node scripts/check-area-editorial-featured.mjs`, and
  `node scripts/check-area-verified-line-comparison-contract.mjs`: PASS.
- The read-only WordPress origin TLS preflight passed with normal network
  access. This is not evidence of production data mutation or a production
  deploy.

## Isolated browser fixtures

All items below use local mock/fixture services and headless Playwright, not
the user Mac Google Chrome and not the real database/Auth/Storage/email stack.

| Check | Result | Boundary |
| --- | --- | --- |
| v1.1 entry route: input → confirm → back; A→delayed B blocks stale person rating; B→C response inversion retains C, then sends only C's newly entered rating; shop-only omits person rating; committed-response loss → UI retry restores the same receipt; target-change rejection; PC/SP layout | PASS | `npm run qa:eskomi-review-entry-v11` fixture; actual `/r/[token] → /reviews/entry/[entryHandle]` components and v1.1 API routes. The replay assertion clicks the rendered retry button; it does not inject headers with `page.evaluate`. |
| Legacy Partner review-growth flow | PASS — legacy only | `check-partner-review-growth-browser.mjs` fixture, which targets `/reviews/submit/`; it is not v1.1 entry-route evidence |
| Partner review link, QR image, POP/print, canonical widget snippet, ready/unavailable partner states | PASS | `check-partner-review-growth-kit-browser.mjs` fixture |
| Listing editor confirmation → back → changed input → confirmation → draft save; public value unchanged | PASS | `check-partner-listing-editor-browser.mjs` fixture |
| Review-widget public/empty/count-only security contract | PASS | `check-partner-review-widget.mjs` contract |
| Therapist manager UI against real service | NOT RUN | no existing isolated browser scenario; real service remains out of scope |

Local fixture screenshots, where generated, remain under
`headless/docs/technical/artifacts/v11-fixture-qa/` and were not uploaded.

## Confirmed code checks

- B01–B10 use the ten committed `/images/eskomi-banners/*-eskomi-functional-v2.png`
  files; B10 links to `/advertise/`, whose page includes the advertising
  consultation form. The previous claim that real banner images were not
  integrated is incorrect.
- `partner-login-return-to.ts` permits the approved Partner growth and
  therapist hashes, keeps only an allowlisted internal route, and its callback
  consumes the short-lived HTTP-only return cookie. External URLs, protocol
  relative URLs, arbitrary queries, and unknown hashes are rejected.
- `npm run test:eskomi-banner-v2` and
  `npm run test:partner-login-return-to`: PASS.

## Explicitly not verified

- Real Supabase database/Auth/Storage/email and collector/retention operation.
- Docker real-DB replay path; the existing isolated-network host-loopback
  restriction remains unresolved and was not bypassed.
- User Mac Google Chrome verification; the required Chrome control interface
  was unavailable in this session, so headless fixture results are not a
  substitute.
- Production deploy, migration, main push, and any production write.

## Disposable real-service HTTP fixture continuation

The following is separate from the browser mocks above. It uses newly created
PostgreSQL, GoTrue, Mailpit, Storage, PostgREST, gateway, and application
containers on one Docker `--internal` network with no published host ports.
It never contacts production services. The GoTrue email link is consumed from
Mailpit through the disposable gateway and its identity/session result is
checked without logging the link token.

| Check | Node Next | Local OpenNext Worker | Evidence boundary |
| --- | --- | --- | --- |
| Request-link → Mailpit `/verify` → callback/session | PASS | PASS | Real GoTrue and Mailpit; the Worker result covers normal auth API routing, not a production redirect allow-list. |
| Canonical listing edit → changes requested → correction → dashboard approval | PASS | PASS | Real Partner/dashboard HTTP routes, then a fixture-DB projection assertion. |
| Published public shop page | PASS | BLOCKED | Node renders the corrected canonical public content. Workerd returns 500 from the Next 16.3.8 Cache Components scheduling boundary. |
| Invalid/oversized photo rejection; real PNG → Storage → public JPEG/profile | PASS | BLOCKED | The Worker invalid-image request returns 500 because the shared inspector imports Node-native `sharp`; no Worker image workaround was introduced. |
| Individual review-link issuance | PASS | Not reached after image blocker | Link issuance is not review submission/moderation proof. |
| Confirmed login-email change and old-email rejection; foreign-store asset denial | PASS | Not reached after image blocker | Node result uses real GoTrue confirmation and real RLS/RPC boundaries. |

The Worker run intentionally remains failing for these blockers. No missing
feature is recorded as PASS and no account, cache binding, deployment, DNS,
or production Auth/DB change is implied.

## Derived dynamic-public-read build follow-up

This is build evidence only; it is not fixture HTTP evidence. A fresh ignored
derived source tree now disables Cache Components, removes every selected
public-reader cache directive and every existing `instant = false` export, and
uses a derived-only invalidation no-op. The canonical Node/Vercel source and
its Turbopack command are unchanged.

| Boundary | Result | Interpretation |
| --- | --- | --- |
| Minimal metadata app, copied nested `node_modules`, Next 16.3.8 | FAIL: `Expected workStore to be initialized` | Reproduces the earlier unrelated-route prerender failure without Eskomi code. |
| Minimal app, read-only `node_modules` symlink inside a valid workspace root | PASS (Cache Components both on and off) | The failure is the copied dependency tree, not metadata, cache mode, or the app routes. |
| Full derived app, Webpack + self-rooted standalone trace | PASS through 84-route Next build and OpenNext Node-middleware bundle | Solves the workStore and missing standalone-trace boundaries without modifying normal source. |
| Full derived OpenNext server bundle | BLOCKED: native `sharp` `.node` cannot be resolved for workerd | Image validation/conversion remains incompatible; no pass-through or validation relaxation was introduced. |

The failed and passing build trees remain in ignored timestamped directories.
No Workers HTTP assertion was rerun after this build-only advance, so the
existing worker public-page/image/review-link entries remain BLOCKED or NOT
REACHED as listed above.

## Cloudflare Worker completion — 2026-10-18

The explicit `workers:dynamic-build` now completes with Next 16.3.8,
OpenNext Cloudflare 1.20.9, and 84 discovered routes. It uses a physical
derived `next` package only; the normal Node/Vercel source and native `sharp`
path are unchanged. The four Worker upload routes use a pure-JavaScript
PNG/JPEG/WebP normalizer that validates 5 MiB/4096px limits, applies EXIF
orientation, removes metadata through JPEG re-encoding, and emits a SHA-256
of the stored JPEG. The resulting Worker bundle contains no native sharp
binding reference.

Focused checks passed:

- `npm run test:cloudflare-worker-listing-image`
- `npm run test:cloudflare-dynamic-public-read`
- `npm run test:eskomi-v11-internal-partner-http-runner`
- `npm run workers:dynamic-build`

The isolated internal-network Worker fixture also passed with real GoTrue,
Mailpit, Storage API, PostgREST, and PostgreSQL. It verified normal Partner
magic-link login, correction/re-submission/dashboard approval/public display,
invalid and oversized image rejection, real PNG-to-JPEG asset retrieval and
therapist profile, review-link issuance, confirmed login-email change plus
old-email rejection, foreign-store asset denial, and dashboard unlisting
removing the public shop route. These are disposable fixture results only:
they do not deploy, write production data, or configure Cloudflare.

Follow-up local minimal reproductions confirmed that the Cache Components
failure is independent of the Eskomi proxy and fixture services: direct,
Suspense-wrapped, and static `"use cache"` pages all return the same local
workerd hang `500`; a no-cache plain page returns `200`. A Worker-only
jSquash/WASM image micro-test can re-encode PNG to JPEG, but the actual
Next 16.3.8/Turbopack build cannot bundle its Wasm imports, so it is not a
safe replacement for `sharp`. The full analysis and explicit non-adoption are
recorded in the Cloudflare offline migration plan artifact.
