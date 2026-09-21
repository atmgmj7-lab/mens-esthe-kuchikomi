# Phase 3 03A — Partner Auth / Membership

Task: `ESKOMI-PHASE3-03A-PARTNER-AUTH-MEMBERSHIP-01`

## Scope

- Keep the existing `private.partner_workspaces` control plane and add one private, service-role-only membership mapping.
- Verify a Supabase Auth access token server-side, then resolve only the active membership's workspace and shop.
- Provide a minimal magic-link login, callback, protected `/partner/` access gate, and a workspace-ID gate used only to prove isolation.
- Preserve the separate `/dashboard/...` Basic Auth trust boundary.

## Exclusions

- No Partner Dashboard content, Growth Kit, metrics, widget, correction UI, Review UX, or AI Assist.
- No public-content, canonical, sitemap, review-submission, WordPress, or ranking changes.
- No production migration, secret/environment change, push, deployment, or external write.

## Verification

- RED/GREEN partner access contract: anonymous, invalid session, no membership, own workspace, altered workspace/shop IDs, and missing configuration.
- Local-only Supabase transaction verifies migration replay, browser-role private-schema denial, service-role RPC path, and A/B isolation.
- Browser mock verifies anonymous, Partner A, no-membership, cross-workspace, and operator-Basic-Auth boundaries.
- Relevant Phase 2 Review/Partner/Operator regressions, typecheck, lint, full test suite, and diff check.

## Production Gate

Production Supabase migration and auth redirect/environment configuration require separate explicit approval. This task creates no production change.
