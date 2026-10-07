# Mrs.Rank UP Stage 1/2 — local result

Target: WordPress Shop ID `768` (Mrs.Rank UP) only. This record describes a
local implementation and fixture verification; it authorizes no production
operation.

## Implemented

- Operator edit now reads a WordPress REST snapshot and exposes only the ten
  fields supported by the existing `official-facts-rest.php` writer allowlist.
  Title, area, taxonomy, publication state, and create are explicitly
  unavailable for saving.
- The edit UI performs a local dry-run: it shows only changed fields, treats an
  unchanged edit as `NOOP`, rejects an attempt to replace an existing value
  with a blank, and requires a local confirmation. A stale snapshot is a
  fail-closed conflict in the fixture contract.
- Stage 2 adds a server-only official-facts writer adapter. It reads the exact
  writer snapshot immediately before one POST, requires a reviewed
  `provenance` / `canonical` / `audit` evidence envelope, reads back the writer
  snapshot after `APPLIED`, and has a public-cache revalidation hook. The
  browser can only ask whether its save conditions are met: because no reviewed
  evidence service is connected yet, that route always stops before a writer
  request. It never fabricates evidence from form input.
- The operator moderation queue reads every actionable page server-side before
  projecting only WP Shop ID 768 to the browser. It has explicit filters for
  `pending` and `approved + draft` records, so unrelated first-page records do
  not hide Rank UP records. Approval and publication remain separate actions.
- The authenticated Partner home links only its already-authorized canonical
  shop to the existing public correction-request flow. It does not expose
  Operator moderation or other-shop data.
- Operator and Partner screens now reuse the existing public site palette and
  typography tokens (`--mep-navy`, `--es-gold`, luxury card/background tokens,
  and the existing serif heading family); no alternate visual brand was added.

## Local verification

- `npm run test:operator-shop-fact-dry-run`
- `npm run test:official-facts-writer-fixture` (loopback WordPress-writer
  fixture: preflight, apply, `NOOP`, conflict-before-POST, readback and cache
  handoff)
- `php tests/php/check-official-facts.php` and
  `php tests/php/check-price-booking-writer.php` (actual PHP writer fixtures)
- `npm run test:operator-shop-control-center`
- `npm run test:operator-shop-projection`
- `npm run test:operator-shop-write-contract`
- `npm run test:review-native-repository`
- `npm run test:review-native-submit-api`
- `npm run test:review-native-moderation`
- `npm run test:review-public-adapter`
- `npm run test:review-public-ui`
- `npm run test:partner-dashboard-shell`
- `npm run test:partner-action-first-home`
- `npm run test:partner-guided-onboarding`
- `npm run test:partner-review-growth`
- `npm run test:partner-review-growth-center`
- `npm run test:partner-review-widget`
- `npm run test:dashboard-shell`
- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm run qa:rankup-operator-fixture` at 390px and 1280px against isolated
  WordPress/Supabase fixtures, including a synthetic unrelated first queue page.
- `npm run qa:partner-auth-membership` at 390px and 1280px against an isolated
  Rank UP Partner-session fixture.
- These browser checks used headless Chromium on the user's Mac local execution
  environment only. No ordinary browser tab, production URL, or campaign link
  was opened.
- `E2E_SUPABASE_WORKDIR=<temporary isolated project> npm run
  test:review-native-isolated-e2e`: a newly created local Supabase project on
  separate `583xx` ports completed synthetic submit → moderate → publish →
  Supabase public adapter → shop/widget verification. It also exercised
  duplicate/parallel idempotency, cross-shop campaign rejection, rejected and
  spam paths, and 390px/1280px public rendering. The fixture reported
  `productionWrite: 0` and cleaned only its own synthetic rows.

## Deliberate boundaries and next decisions

- No WordPress, Supabase, lifecycle, campaign, review, moderation, publication,
  deploy, or configuration write occurred.
- Before any writer can be enabled, a reviewed-evidence service must be chosen
  and connected server-side. It must supply the required evidence/provenance
  envelope and an operator/production approval policy; the current route is
  intentionally fail-closed until then.
- The queue is an actionable queue, not a complete review archive: it omits
  published, rejected, and spam records. Full per-shop history needs a
  separately designed RPC/read API with pagination.
- `REVIEW_READ_SOURCE` remains environment-dependent and defaults to
  `wordpress`; production value and end-to-end public reflection were not
  checked here. The isolated E2E exercised only `REVIEW_READ_SOURCE=supabase`;
  no production Supabase fallback or production public-reader check was used.
- The concrete writer connection proposal and required private review schema
  are documented in `2026-10-07-mrs-rankup-official-facts-review-connection-proposal.md`.
- The fixture proves the Shop 768 contract but not a live authenticated Partner
  session or a production writer readback.
