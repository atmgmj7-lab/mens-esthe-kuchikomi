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

## 2026-10-18 operator update

- With the user's explicit pre-production authorization, a read-only Docker and
  Supabase status check confirmed that the existing local Supabase stack is
  healthy. It was not modified.
- Its API, database, Studio, and mail-catcher ports are already allocated.
  The existing database has no v1.1 fixture schema, shop rows, or required
  v1.1 RPCs, so it is not a valid substitute for an isolated verification.
- A disposable project directory was initialized under `/tmp` only. Its first
  `supabase start` stopped before a stack was created because its default
  database port (`54322`) was already allocated by another existing project.
  A follow-up read-only Docker inspection found no fixture containers or
  fixture networks left behind.
- The standard Supabase CLI start path publishes its service ports on all host
  interfaces. Retrying it on different ports would violate the approved
  constraint of no new network exposure, so it was not retried. No existing
  project was stopped, reconfigured, reset, or migrated.

## Current blocker

The requested real local Auth/Storage/Mailpit/API/DB verification needs an
isolated service topology that remains internal to Docker (with any test client
in that same network). The standard Supabase CLI stack cannot provide that
topology here without host port publishing. Building an explicit internal-only
compose fixture is the remaining implementation path; it must keep all
credentials ephemeral and must not alter the existing local stack.

## Safe next path

Implement a disposable, internal-only Docker fixture with database, Auth,
Storage, API, and a local mail catcher, then run its client from the same
network. Do not publish ports, add external SMTP credentials, use a third-party
service, or change the existing Supabase project.
