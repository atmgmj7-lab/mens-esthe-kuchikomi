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
