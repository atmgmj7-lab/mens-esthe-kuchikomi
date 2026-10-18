# Area prerender repair and v1.1 fixture QA

## Goal

Make `/area/[slug]` compatible with Next static prerendering without changing the
area information-ordering meaning, then record the bounded pre-production QA
that can run without a production database or browser session.

## Constraints

- Keep the ordering freshness window at 180 days and preserve the existing
  area revalidation/cache policy.
- Do not deploy, migrate, write production data, or introduce credentials.
- Treat fixture results as fixture results; do not represent them as real
  Auth, Storage, email, or database verification.
- Keep `banner-library/` untracked and untouched.

## Implementation and verification

1. [x] Move the prerender-unstable clock read behind a cached server helper.
   Route and legacy area readers obtain one reference timestamp and pass it to
   the ordering resolver; no component reads the clock while being prerendered.
2. [x] Add deterministic ordering coverage and update source-loader fixtures
   for the injected timestamp and the current canonical/legacy identity
   contracts.
3. [x] Run a full static build (917 generated pages), typecheck, lint, and
   focused area contracts.
4. [x] Run an isolated Playwright fixture against the v1.1 entry components
   (including same-receipt replay and target-change error), plus the legacy
   Partner growth/POP, widget snippet, and listing confirmation/back/draft
   fixtures on PC and SP. The legacy review-growth fixture is retained as
   legacy-flow evidence only; it does not evidence v1.1.
5. [x] Record the exact environment boundary and remaining real-service and
   Mac-Chrome checks in the evidence note.

## Review focus

- The timestamp is obtained once in the cached request path and is supplied to
  every information-order evaluation, so all rows in a response use the same
  freshness reference.
- No fallback turns an unavailable WordPress origin into a successful runtime
  verification claim.
- The partner growth fixture only mocks canonical service responses and keeps
  cross-workspace denial assertions intact.
