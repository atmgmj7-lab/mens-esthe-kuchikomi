# Eskomi v1.1 final pre-production preparation — 2026-10-18

## Safety and branch boundary

This packet records branch-local, disposable-fixture, and read-only checks.
It does not authorize a main merge, Vercel promotion, XServer deploy,
production database change, paid-plan change, or network-security change.

- Branch checked: `codex/wp-independent-prep-20261017` at
  `72ffddf2116c3739bc326fa7d9104d8617e0fe50` before this packet's final
  commit.
- Remote `main` checked read-only:
  `78d7e06046953b493ec690231fede121cba0211a`.
- GitHub history shows the latest successful headless deployment for that main
  SHA on 2026-10-16; it is not evidence of production database contents.
- This task did not merge, deploy, dispatch a workflow, or write production.

## Preview assessment

The checkout has no `.vercel` project mapping. The repository workflow only
push-triggers on `main`; non-preflight dispatch uses `vercel deploy --prod`.
No Vercel deployment was attempted. A safe preview needs an existing
non-production project/environment, its verified mapping, and non-production
server-side Supabase/Auth configuration.

## Evidence

| Evidence | Result | Scope |
| --- | --- | --- |
| Canonical review cancellation/repeat | PASS | Loopback Next + mock RPC + Chrome: PC/SP approval and return; cancelled/empty writes blocked. The mock RPC response is held open while repeat clicks occur; exactly one write is asserted. |
| Returned listing lifecycle | PASS | Loopback fixture preserves the display workflow at 390px/1280px. Separately, the real canonical HTTP fixture proves the matching canonical reason → correction → resubmission → re-approval → public-projection RPC path. |
| Partner HTTP lifecycle | PASS | Fresh PostgreSQL, GoTrue, Mailpit, Storage, and Next on one disposable Docker `--internal` network: real email change confirmation, old-email rejection, canonical return/correction lifecycle, therapist/review-link flow, and cross-store denial. |

Screenshots remain locally under
`headless/docs/technical/artifacts/v11-fixture-qa/2026-10-18-continuation/`.
They are intentionally untracked and not production proof.

## Changes and remaining blockers

- Canonical review cancellation now makes no write, and in-flight review
  buttons are disabled.
- `20261018100000_partner_login_email_canonical_audit.sql` records one of
  legacy `wp_shop_id` or canonical `app_shop_id`; production remains unapplied.
- Remaining: device-camera QR; unimplemented independent T43 coverage
  collector/health manifest; three legacy mappings needing explicit WP-ID+slug
  confirmation; production migration/DB evidence; main merge/deploy; and
  production browser traversal.
