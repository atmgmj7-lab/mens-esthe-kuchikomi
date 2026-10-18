# Internal Partner HTTP fixture — execution record

## Intended scope

The disposable runner at `headless/scripts/run-eskomi-v11-internal-partner-http-e2e.sh` creates a fresh PostgreSQL/Auth/Storage/Mailpit/PostgREST/Next set on one Docker `--internal` network. It has no published ports, host network, Docker socket mount, production connection, or reuse of the existing local Supabase stack.

It is designed to use normal Next routes for partner magic-link login, canonical listing draft/submission, dashboard approval, therapist-photo upload and validation, therapist creation, review-link issuance, and a separate Auth user for cross-store denial. Its static safety contract passes.

## Executed results

- `npm run test:eskomi-v11-internal-auth-storage-runner` — PASS
- `npm run qa:eskomi-v11-internal-auth-storage` — PASS
- `npm run test:eskomi-v11-internal-partner-http-runner` — PASS
- Partner fixture setup: real GoTrue, Mailpit, Storage API, PostgREST, migrations, actual Auth admin seed users, and Next all started on the isolated network.

The normal Next login request returned `503` before it could send an email. This is deliberately **not** recorded as a partner-flow pass.

## Blocking evidence

`createPartnerMagicLinkClient()` accepts HTTP Supabase URLs only when their hostname is `localhost` or `127.0.0.1`. The isolated service needs an internal Docker hostname (`http://api:8000`) to reach the real Auth/REST/Storage prefix router. Consequently the route rejects configuration before calling GoTrue:

```text
POST /api/partner/auth/request-link/ 503
{"ok":false,"message":"現在ログインを開始できません。"}
```

Changing the partner redirect origin to `http://localhost:57000` is valid, but does not resolve the separate `SUPABASE_URL=http://api:8000` allow-list rejection. Adding a Docker hostname to that production safety boundary would be an application security-policy change, so it was not made implicitly.

## Next decision needed

Approve a narrowly scoped, test-only internal Supabase-base override (or provide an approved TLS/internal DNS arrangement compatible with the current validator). Then rerun the fixture and record HTTP and browser results separately. Browser QA has not been counted or attempted as a pass.
