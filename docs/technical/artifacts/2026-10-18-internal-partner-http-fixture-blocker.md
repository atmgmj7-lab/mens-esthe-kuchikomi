# Internal Partner HTTP fixture — execution record

## Intended scope

The disposable runner at `headless/scripts/run-eskomi-v11-internal-partner-http-e2e.sh` creates a fresh PostgreSQL/Auth/Storage/Mailpit/PostgREST/Next set on one Docker `--internal` network. It has no published ports, host network, Docker socket mount, production connection, or reuse of the existing local Supabase stack.

It is designed to use normal Next routes for partner magic-link login, canonical listing draft/submission, dashboard approval, therapist-photo upload and validation, therapist creation, review-link issuance, and a separate Auth user for cross-store denial. Its static safety contract passes.

## Executed results

- `npm run test:eskomi-v11-internal-auth-storage-runner` — PASS
- `npm run qa:eskomi-v11-internal-auth-storage` — PASS
- `npm run test:eskomi-v11-internal-partner-http-runner` — PASS
- Partner fixture setup: real GoTrue, Mailpit, Storage API, PostgREST, migrations, actual Auth admin seed users, and Next all started on the isolated network.

The first configuration attempt returned `503` before it could send an email. After the loopback-only adapter follow-up, the normal Next login request returned `202` and real GoTrue recorded the magic-link request. This is deliberately **not** recorded as a complete partner-flow pass: the fixture's confirmation redirect did not expose an extractable `access_token` fragment to its internal HTTP client.

## Blocking evidence

`createPartnerMagicLinkClient()` accepts HTTP Supabase URLs only when their hostname is `localhost` or `127.0.0.1`. The isolated service needs an internal Docker hostname (`http://api:8000`) to reach the real Auth/REST/Storage prefix router. The initial configuration consequently rejected the route before calling GoTrue:

```text
POST /api/partner/auth/request-link/ 503
{"ok":false,"message":"現在ログインを開始できません。"}
```

Changing the partner redirect origin to `http://localhost:57000` is valid, but does not resolve the separate `SUPABASE_URL=http://api:8000` allow-list rejection. Adding a Docker hostname to that production safety boundary would be an application security-policy change, so it was not made implicitly.

## Follow-up configuration

The production hostname validator remains unchanged. The follow-up run starts a test-only proxy bound to `127.0.0.1:8000` **inside the disposable Next container**, forwarding only its own Auth/REST/Storage paths to the internal `api:8000` router. This preserves the existing localhost validator while keeping all traffic off the host network. It reached the normal request-link endpoint and real GoTrue email issuance; current evidence shows the fixture needs to diagnose a non-redirect verify response before it can consume the callback fragment. The diagnostic records only HTTP status, content type, and response key names—never a link token. Browser QA remains separate and is not counted as a pass.

The runner also distinguishes a runtime volume it creates from an explicitly marked borrowed prepared volume. Cleanup removes only the former.

The earlier removal of `eskomi-v11-partner-prep-112-26641` was verified from the task's own Docker commands: it was a disposable volume created by this task for Linux dependency installation, not an existing or user-supplied volume. No existing volume was passed as `ESKOMI_E2E_RUNTIME_VOLUME` during those runs.

## 2026-10-18 handoff snapshot — root cause isolated, fix not applied

The runner was repeated at commit `6c6a5c000ca4ebe94dacc77c187ef7fe3dc7e531`.
The normal Next request-link route again returned `202`; GoTrue recorded the
corresponding `/otp` request as `200`. Consuming the real Mailpit link then
returned the existing safe diagnostic:

```text
magic link verification did not redirect; status=404 contentType=none responseKeys=non-json
```

The 404 is now attributable to the disposable **gateway** proxy, not the
production hostname validator, the Next loopback adapter, or GoTrue's
verification handler. GoTrue is configured with `API_EXTERNAL_URL=http://api:8000`,
so its generated confirmation link targets `api:8000/verify`. The Mailpit
consumer runs in a separate fixture client container and therefore reaches the
network `api` proxy directly. That proxy currently forwards only `/auth/v1`,
`/rest/v1`, and `/storage/v1`; it has no `/verify` entry and deliberately
returns its bare 404 for unmatched paths. The previous `/verify` entry was
added only to the Next container's loopback adapter, which this confirmation
request never traverses.

The minimal follow-up is to add the same `/verify` → `http://auth:9999`
forwarding entry to the disposable `proxy_container` route map, and to add a
behavioral regression assertion that verifies the real Mailpit URL is consumed
through that proxy and produces the normal callback redirect. Do not weaken the
application's hostname validator or add a Docker hostname to application
configuration.

No further run was started after this diagnosis. The runner's EXIT cleanup
completed; a read-only Docker listing found no containers, networks, or volumes
matching the runner's `eskomi-v11-partner-http-` prefix. The untracked
`banner-library/` and fixture screenshots were left untouched.

## 2026-10-18 cloud follow-up — gateway fix applied; runtime dependency boundary

The disposable `proxy_container` now includes `/verify` → `http://auth:9999`,
matching the GoTrue verification path already exposed by the Next container's
loopback-only adapter. The application-level `SUPABASE_URL` hostname validator
was not changed. The HTTP client now asserts, without logging a token, that the
real URL extracted from Mailpit has the disposable `http://api:8000/verify`
origin/path, that consuming it through the gateway returns a 3xx response, and
that this redirects to the normal `/partner/auth/callback/` origin/path before
the existing session-fragment and one-use completion checks run.

`npm run test:eskomi-v11-internal-partner-http-runner` passed after the change,
and `bash -n scripts/run-eskomi-v11-internal-partner-http-e2e.sh` passed.

The requested real fixture command was then started in the cloud:

```bash
npm run qa:eskomi-v11-internal-partner-http
```

It could not reach the application checks because the runner's fresh,
fixture-owned volume failed at its isolated `npm ci --ignore-scripts` step:

```text
npm error code SELF_SIGNED_CERT_IN_CHAIN
npm error request to https://registry.npmjs.org/... failed, reason: self-signed certificate in certificate chain
```

The Docker daemon itself was usable (the Node image was pulled and the command
entered the runner), but this environment cannot currently establish the
verified npm registry chain inside the disposable container. No `strict-ssl`
or certificate-bypass setting was added. The runner cleanup was checked after
the attempt: no `eskomi-v11-partner-*` containers, networks, or runtime volumes
remained. Full real GoTrue/Mailpit/Next pass therefore remains **blocked**, not
passed. A separate source-level partner-auth contract test is also unavailable
in this workspace because `headless/node_modules` is absent and its checker
requires the `typescript` package; this was not treated as a substitute for
the real fixture.

## 2026-10-18 cloud continuation — safe dependency reuse probe

No existing `headless/node_modules`, lockfile-matching npm cache, or Docker
runtime volume was present in the cloud workspace. The only lockfiles found
were the repository's `headless/package-lock.json` and unrelated dashboard
lockfile. No `.env`, authentication file, or user-supplied volume was read,
copied, or reused.

To distinguish an unavailable registry from a reusable approved cache, a new
volume owned solely by this check received only `package.json` and
`package-lock.json` as read-only-source copies. `npm ci --offline
--ignore-scripts` ran with Docker `--network none` and failed before installation
with `ENOTCACHED` for the lockfile's `zod-validation-error` tarball. The probe
volume, container, and network were then verified absent. This confirms that
there is no safe offline dependency source in the workspace or pinned Node 24
image. TLS verification was not disabled and no CA was added.

Independent checks that do not need the missing dependency tree passed:

```text
npm run test:partner-launch-readiness                 PASS
npm run test:eskomi-v11-internal-auth-storage-runner PASS
npm run test:eskomi-v11-internal-partner-http-runner PASS
bash -n both internal fixture runners                 PASS
```

The POP source still creates its private SVG QR with the pinned `qrcode`
package and the public widget remains covered by source contracts, but actual
QR decoding, widget HTTP/browser behavior, and the fixed partner HTTP flow
cannot be claimed in this cloud workspace until a platform-provided,
certificate-valid dependency source is available. These remain blocked rather
than converted to static-only PASS results.

## 2026-10-18 cloud continuation — host dependency path and remaining platform blocks

The cloud workspace's ordinary npm path was then tested with the repository
lockfile and normal TLS verification intact. `npm ci` completed successfully
(`381` packages); no lifecycle script was configured. Host Node was `v24.19.0`
and the pinned Node 24 fixture image was `v24.22.0`; both report ABI `137`.
The installed, lockfile-resolved Linux dependency tree was copied to one
fixture-owned volume after excluding `.env*`, `.npmrc`, and `.next`, then used
with the runner's explicit prepared-volume opt-in.

That real fixture advanced past the former `npm ci` boundary and completed
fresh PostgreSQL initialization. It then stopped before application startup
because Docker was denied the pinned official Mailpit pull:

```text
Get "https://public.ecr.aws/v2/": Forbidden
```

No alternate registry, image, network route, or authentication setting was
used. The runner and outer prepared-volume cleanup were checked afterward; no
fixture container, network, or volume remained.

With the safe host dependency tree available, the following passed:

```text
npm run typecheck                              PASS
npm run lint                                   PASS
npm run build                                  PASS (WordPress reads used existing safe fallbacks)
npm run test:partner-auth-membership           PASS
npm run test:partner-listing-editor            PASS
npm run test:partner-listing-editor-ui         PASS
npm run test:partner-review-growth-kit         PASS
npm run test:partner-review-growth-center      PASS
npm run test:partner-access-report             PASS
npm run test:partner-review-widget             PASS
```

The broad `npm test` command began normally but its first legacy PHP check
could not run because this cloud image has no `php` executable; this is a
platform prerequisite, not a test pass. The standard Playwright browser QA
also cannot be started: the browser binary is absent and the official
`npx playwright install chromium` download returns `403 Domain forbidden`.
The partial temporary browser directory was removed. Thus the acceptance
matrix still has no new real Chromium, QR decode, widget HTTP, or complete
GoTrue/Mailpit/Storage pass; those entries remain explicitly blocked.

## 2026-10-18 correction — collector is not an environment-only gap

The earlier wording that described the access-measurement health collector as
only an environment setting was incorrect. `app/api/internal/access-observation`
authenticates a caller and forwards that caller's supplied `complete` or
`partial` state to `finalize_partner_shop_access_collection_day_v11`; it does
not independently observe collector health, detect missing coverage, or decide
whether a day is complete. No job invoking it exists in the repository.

The independent health/coverage collector is therefore **not implemented**.
No unconditional-complete cron was added. The existing report continues to
show partial/missing/unknown days as comparison-unavailable, and the acceptance
matrix and store launch pack now state that a zero or complete comparison may
not be claimed until this limited collector and its operational monitoring are
separately implemented and verified.

## 2026-10-18 follow-up — proxy path regression and local widget HTTP evidence

Independent review found that the first gateway fix still stripped `/verify`
from the upstream request (`/verify?token=…` became `/?token=…`). Both
disposable adapters now use one tested prefix-proxy script whose verification
route base is `http://auth:9999/verify`. A local HTTP fixture with the fake
query `token=fixture-token&type=magiclink` proves that the upstream receives
the exact `/verify` path and query and that its redirect is returned unchanged.
This does not require Mailpit, Docker registry access, or a real token.

The same dependency-enabled workspace also ran a real local Next production
server against a local fixture-only RPC endpoint for the v1.1 widget. It
verified SSR output for (1) empty reviews, (2) two ratings with a 4.9 aggregate,
and (3) an unavailable backend. The test exposed and fixed a v1.1-only issue:
two ratings had rendered `4.9 / 5` although the existing widget rule requires
count-only below three ratings. It now renders `有効な評価 2件`. The unavailable
case resolves through Next partial prerendering's embedded 404 fallback (the
initial streamed shell is HTTP 200, while the widget segment is not rendered);
it is recorded as an SSR fallback observation, not as an HTTP-404 assertion.

At that point no installed QR decoder existed in the lockfile or host image
(`qrcode` is an encoder only; no `zbarimg`, `qrencode`, or QR-decoder package
was present). The next follow-up records the approved test-only decoder used
for a generated-image URL check; a camera/device scan remains unverified.

## 2026-10-18 follow-up — partial-only access finalizer helper and POP QR decode

The smallest safe **finalizer helper** is now implemented without a cron, new
credential, or production run. `scripts/run-eskomi-v11-access-collection.mjs
--observed-on YYYY-MM-DD` requires the existing observation endpoint URL and
existing observation secret, accepts only a past JST date, and sends only
`{ observedOn, state: "partial" }`. A successful call is recorded by the
existing collection-run/finalizer; a missing run or unreachable endpoint writes
nothing and therefore remains `unknown` in the report. The internal route
rejects caller-supplied `complete` with HTTP 400 and always forwards `partial`.
The helper sets `redirect: "error"`: 307/308 responses are rejected rather
than followed, so its observation secret is not forwarded to a redirect target
on another origin. This is a request-boundary safeguard, not observation or
failure detection.
This establishes failure/partial evidence without treating a health response or
a single event as complete coverage.

The runner and route were verified with local HTTP fixtures. The route sent one
partial finalizer call and refused a complete request before the finalizer.
Complete remains reserved for a future independently validated coverage manifest
and its monitoring; it is not implemented here.

For POP, `jsqr@1.4.0` was added as a test-only dev dependency using the normal
TLS-verified npm path. The test generates the same 720px/error-correction-M PNG
configuration as the POP route and independently decodes it, requiring an
exact match to the expected `/r/{UUID}/` URL. This is an encoder/decoder URL
contract, not a camera/device scan or an authenticated POP download pass.

Resume from `headless/` after the focused test-first change with:

```bash
npm run test:eskomi-v11-internal-partner-http-runner
npm run qa:eskomi-v11-internal-partner-http
```

## 2026-10-18 Mac continuation — complete internal Partner HTTP fixture

The disposable fixture was rerun with the pinned images already available on
the Mac and completed successfully. It remains one fresh internal-only Docker
network with no published ports, host networking, Docker socket mount,
production connection, or change to an existing local Supabase resource.

The initial red runs found three fixture/data-flow defects rather than a
production hostname-validator issue:

1. Canonical fixture shops were still draft when their workspaces were seeded;
   the real authorization RPC correctly rejected them. The fixture now marks
   both fake canonical shops and their managed rows published before login.
2. Saving the listing advances its revision. The fixture now reads the returned
   revision before submitting, as the production editor already does.
3. The canonical approval path is `/api/dashboard/managed-shops/`, not the
   legacy listing-revision dashboard route. The fixture now supplies its own
   managed-shop UUID only to that normal dashboard endpoint.

A header-valid but decoder-invalid PNG fixture also failed the actual `sharp`
inspection in the photo route. It was replaced with a locally generated,
decoder-verified one-pixel PNG; this changes only test bytes, not image policy.

The final command completed all normal HTTP checks:

```text
npm run qa:eskomi-v11-internal-partner-http
  Next login, canonical draft, dashboard approval, and reflected listing: PASS
  Invalid image must be rejected: PASS
  Oversized image must be rejected: PASS
  Next therapist real image save, assignment, and individual review link: PASS
  Foreign partner access to the primary store asset must be denied: PASS
  Canonical public projection after dashboard approval: PASS
  Eskomi v1.1 internal partner HTTP fixture: PASS
```

Related fresh checks also passed: the internal Auth/Mailpit/Storage fixture,
the tested proxy regression contract, POP QR independent decode, widget SSR
HTTP (empty, fewer-than-three ratings, unavailable backend), and Partner
membership/return-to/login-email/listing/growth/widget source contracts.

This is real internal Next HTTP evidence, not a PC/SP browser result. The Mac
Chrome control extension is not connected to this execution environment, so no
interactive desktop/mobile traversal, screenshots, device-camera QR scan, or
production/preview check is claimed. No production action is authorized by
this result.

## 2026-10-18 Mac continuation — source-copy hardening and temporary-profile Chrome evidence

The fresh-runtime source copy in
`run-eskomi-v11-internal-partner-http-e2e.sh` now excludes `.env`, `.env.*`,
and `.npmrc`, in addition to the existing `node_modules` and `.next`
exclusions. Its static runner contract asserts all five exclusions. This is a
fixture-only protection; it does not change any application authentication,
hostname validation, or production configuration. A name-only inspection of
this current `headless/` working tree found the committed `.env.example`
template, but no active `.env`, `.env.local`, `.env.production`, or `.npmrc`.
The prior Mac fresh-source run used the older copy command, so this new
exclusion must not be presented as retrospective proof about that old runtime.
The earlier prepared-volume route had its own documented exclusions; no secret
value was inspected, committed, or deliberately logged here.

The same fresh internal HTTP fixture was rerun after the hardening. Its
ephemeral Next container alone receives `SHOP_DIRECTORY_SOURCE=supabase`, so
the published canonical shop route can be exercised against its fixture data;
no production setting is changed. It passed the existing normal login,
listing-edit/approval, valid/invalid/oversized photo, therapist, review-link,
and foreign-store denial checks, plus an actual `GET /shops/fixture-partner-store/`
and actual public therapist photo proxy bytes (`200`, `image/jpeg`, JPEG
magic). The runner safety contract, `bash -n`, and prefix-proxy regression all
passed.

Chrome 155 was launched through Playwright in headless mode with its own
temporary profile against loopback-only mock fixtures. It did not read the
normal Chrome profile, publish a port, access production, or retain the
temporary screenshots. The following **browser** scopes passed and their
screenshots were visually inspected at 390px and/or 1280px:

- Partner login request and explicit repeated request (resend), provider
  failure, state/cookie lifecycle, cross-user token rejection, successful
  callback, unknown membership, foreign workspace denial, and separate
  dashboard Basic-Auth boundary (390px and 1280px).
- Partner listing editor input, confirmation, return-to-edit persistence, and
  save (390px and 1280px). The obsolete legacy dashboard-review branch of that
  browser harness still fails because current approval uses the canonical
  managed-shop endpoint; it is not counted as a browser approval pass. The
  canonical admin approval is instead covered by the internal HTTP fixture.
- Review-growth/review-link flow, copy controls, local QR, responsive
  320/390/768/1280 layouts, POP and print layout, public-token rejection, and
  foreign-workspace denial. The normal dashboard contains the designated
  promotion banner; the inspected listing confirmation UI contained no banner
  or advertising field.

The temporary-profile browser scope does not yet include an interactive
therapist-photo error UI, an interactive login-email management UI, a real
device-camera QR scan, preview/production pages, or a live external email
delivery check. Image error handling is proven by real internal HTTP only.

## 2026-10-18 continuation — retained evidence and browser UI completion

The previously missing browser fixtures for login-email management and
therapist-photo errors now pass. The latter sends a bad text file and a
5MB+1-byte file through the real Next photo route from the file input; both
return the expected visible 400 error. The partner session fixture uses `/`,
matching the real complete-link cookie scope so that same-origin
`/api/partner/*` requests receive it.

The canonical dashboard had a server review route but no explicit submitted
Partner approval action in its current UI. A minimal `承認して公開` / `差し戻し`
control now calls that normal route. A browser fixture verifies the approval
button produces the canonical review RPC request; the separate fresh internal
HTTP fixture remains the actual disposable PostgreSQL evidence.

All replacement screenshots are retained locally under
`headless/docs/technical/artifacts/v11-fixture-qa/2026-10-18-continuation/`.
An earlier cleanup removed only this task's `/tmp/eskomi-v11-browser-qa.Lhoate`
temporary Chrome output, before the preservation instruction; it did not alter
the existing untracked `banner-library/` or prior fixture QA artifacts. The
new images are not staged or uploaded. See
`2026-10-18-partner-browser-qa-continuation.md` for the exact scopes and
remaining production boundaries.
