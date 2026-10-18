# Local Supabase isolation readiness — 2026-10-18

## Read-only findings

- Supabase CLI `2.101.0` and Docker `29.5.3` / Compose `5.1.4` are installed.
- `supabase/config.toml` enables local Auth, limits redirects to loopback URLs,
  and has no SMTP configuration. It can support local Auth capture once the
  existing local stack is running; it cannot deliver real email without an
  explicitly configured local mail catcher.
- Existing v1.1 runners create fresh fixture-only JWT/replay values and use
  Docker `--internal` networks. They do not read production secrets and clean
  up only resources they created.
- Those runners emulate Postgres/PostgREST and a minimal Storage schema; they
  do not start the Supabase Auth or Storage services and therefore are not a
  real Auth/Storage/email verification path.

## Current blocker

`supabase status` and `docker ps` could not inspect the local Docker daemon:
`operation not permitted` for the Docker socket. No retry, configuration,
network, or security change was attempted.

## Safe next path

The user must make the existing Docker daemon available to this task, then the
operator may run only `supabase status` and inspect the local stack. If it is
not already running, explicit approval is required before `supabase start`.
For email capture, use a local-only mail catcher configured in the existing
Supabase stack; do not add an external SMTP credential or third-party service.
