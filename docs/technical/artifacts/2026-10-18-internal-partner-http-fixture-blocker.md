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
