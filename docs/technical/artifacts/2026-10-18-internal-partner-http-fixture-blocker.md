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

Resume from `headless/` after the focused test-first change with:

```bash
npm run test:eskomi-v11-internal-partner-http-runner
npm run qa:eskomi-v11-internal-partner-http
```
