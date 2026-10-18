# Eskomi v1.1 pre-production checklist — fixed SHA `e26498d`

## Release conclusion

This SHA is **not production-ready**. The normal store Auth/Storage path has
not completed a real GoTrue/Mailpit/Next fixture, and PC/SP browser QA has not
run. No production deployment, database migration, read-source switch, cron,
or secret change is authorized by this checklist.

## What the access-report state proves

The helper `headless/scripts/run-eskomi-v11-access-collection.mjs` is not an
independent collector. It records only `partial` for an explicit past JST day
through the existing authenticated finalizer endpoint. That proves only that an
operator observed uncertainty and recorded it. A missing helper run or failed
request writes nothing, so the day remains `unknown`. The route rejects
`complete`; neither a health 200 nor one received browser event can produce a
confirmed zero. An independently validated coverage manifest, health collector,
and monitoring are still unimplemented.

The helper rejects redirects rather than following them, so its existing
finalizer secret is never sent to a different-origin redirect target. This is
only a request-boundary safeguard; it does not observe traffic or detect an
outage.

This flag applies only to the Partner access report's confirmed comparison.
GA4 and GSC have different populations and may continue to be analyzed with
their own missing-data caveats; their availability cannot certify this report.

## T01--T56 status at this SHA

| Acceptance IDs | Status | Fixed-SHA evidence / remaining boundary |
| --- | --- | --- |
| T01--T20 | Implemented; isolated contracts/fixtures passed | Real WP/Auth/Storage/email, real clock/race and browser observations remain environment-blocked or production-gated as listed in the acceptance matrix. |
| T21 | Partially proven | Source/fixture responsive checks exist; 320--1440px, a11y and Chromium remain blocked. |
| T22 | Implemented, preview HTTP unproven | Canonical readers/SEO code exists; preview canonical/404/robots/sitemap/ProfilePage observation is pending. |
| T23--T24 | Implemented; isolated fixtures passed | Dashboard operation and flag rollback preview remain unproven. |
| T25 | Production-approval waiting | Non-destructive production smoke requires explicit approval. |
| T26--T42 | Implemented; isolated contracts/fixtures passed | Their documented real HTTP, browser, cache-failure, embed and revoke observations remain pending. |
| T43 | Partially implemented | Event/context/report integrity and partial-only finalizer helper are tested. Independent coverage/health collector and monitoring are **unimplemented**; complete comparison remains unavailable. |
| T44--T49 | Implemented; isolated contracts/fixtures passed | Real cookie lifecycle, preview HTTP and production/log checks remain pending. |
| T50 | Implemented; prior isolated PG evidence | Fresh-PG re-run and operational review remain pending in the blocked Docker environment. |
| T51 | Implemented; isolated fixture passed | UI/HTTP observation remains pending. |
| T52 | User-input/rights waiting | Real image rights and canonical-ID review are required; no data operation is authorized. |
| T53--T54 | Implemented; source/fixture passed | PC/SP Chrome and final links/frequency preview remain blocked. |
| T55--T56 | Implemented; isolated fixtures passed | Full photo/post Chromium lifecycle, production legacy diff, production non-change and dashboard screen traversal remain pending. |

## Verified locally at this SHA

- `npm run typecheck`, `npm run lint`, and `npm run build` passed. Build used
  existing WordPress-safe fallbacks because outbound origin reads were refused.
- Partner HTTP proxy path/query, partial-finalizer CLI and route, widget SSR
  empty/low-rating/unavailable behavior, Partner access report, launch readiness
  and POP QR independent decode passed.
- The QR check uses test-only `jsqr` to decode the existing generator's PNG and
  compare the exact `/r/{UUID}/` target. It is not a device-camera test.

## Environment blocks and minimal access request

No permission change was made. The following failures were observed:

| Exact destination | Attempted retrieval | Result | Minimum safe configuration requested |
| --- | --- | --- | --- |
| `https://public.ecr.aws/v2/` | Docker pull of pinned `public.ecr.aws/supabase/mailpit:v1.31.3` for the internal-only fixture | `Forbidden` | Read-only Docker-registry manifest/layer access for this exact pinned image; no registry credential, host network, published port, or socket mount. |
| `https://cdn.playwright.dev/builds/cft/149.0.7827.55/linux64/chrome-linux64.zip` | Official Playwright Chromium installer | `403 Domain forbidden` | Read-only download access to this exact Playwright-pinned archive (or preinstall the matching browser in the managed environment); no browser profile or external account. |
| `https://registry.npmjs.org/` | Normal workspace `npm ci` and test-only `jsqr` install | Succeeded with TLS verification enabled | No new access needed. |
| WordPress origin `85.131.213.108:443` | Static-build public reads | Connection refused / timed out; fallback build passed | Do not broaden access for this task; preview/public observation remains a separate approved check. |

When the two read-only fixture prerequisites are supplied, rerun the internal
partner HTTP fixture and browser QA. Do not call the result production-ready
until those real paths and the remaining acceptance boundaries are evidenced.
