# Cloudflare dynamic preview deploy guard — 2026-10-22

## Purpose

The canonical Next source keeps Cache Components for the Node/Vercel runtime.  A
Cloudflare preview must instead use the generated dynamic public-read tree.  The
guard makes that distinction an executable precondition: a canonical build, a
stale derived tree, or an output changed after its build cannot reach Wrangler.

## Implemented local plan

1. `build-cloudflare-dynamic-public-read.mjs` generates a source manifest with
   the canonical source-entry digest and canonical preview-config digest.
2. A successful derived build records the manifest, preview config, worker, and
   assets SHA-256 digests in `dynamic-build-result.json`.
3. `verify-cloudflare-dynamic-deploy-input.mjs` accepts only a direct
   `.eskomi-cloudflare-dynamic-builds/run-*` root and verifies all of those
   digests against the current canonical source and generated output.
4. `deploy-cloudflare-dynamic-preview.mjs` runs that verifier before Wrangler,
   fixes the approved named profile/account, enables `--strict`, and accepts
   only one release message plus the six public runtime variables.  It rejects
   route/domain/secret/config/name overrides by rejecting every other flag.
5. The regression test rebuilds a fresh derived root, verifies it, and proves
   that the canonical source root is rejected.

The wrapper was added locally only.  It was not used for a deployment in this
verification pass; the active preview remains the previously verified release.

## Sitemap runtime correction

The dynamic generator now emits `app/sitemap.ts` with
`export const dynamic = "force-dynamic";`.  This keeps the Cloudflare preview
sitemap on the runtime public-directory binding instead of generating a stale
build-time snapshot.  The canonical source is unchanged.

## Validation record

All of the following completed with exit code 0 on the fixed `ba3be46` worktree:

- `npm run test:cloudflare-dynamic-deploy-guard`
- `npm run test:cloudflare-dynamic-public-read`
- `npm run test:cloudflare-noindex-preview`
- `npm run test:cloudflare-workers-contract`
- `npm run lint`
- `npm run typecheck`
- `npm run test:eskomi-public-review-read`
- `npm run test:partner-review-widget`
- `npm run build`
- `ESKOMI_V11_PUBLIC_REVIEW_DB=eskomi-v11-partner-db-22359-18192 npm run test:eskomi-public-review-read-local`

The final test reuses the retained fixture and runs its migration, public
review cases, and `ROLLBACK` in one transaction.  It verified one public review
is visible while pending, withdrawn/hidden, stopped-shop, and draft-shop
reviews are excluded; an empty shop summary stays empty; and anonymous callers
cannot select canonical review tables directly.

The ordinary Next build completed.  Its WordPress-fetch warnings are the
existing sandbox-network fallback (`EPERM`), not a compilation or type failure.

## Widget and therapist access decision boundary

At the time of this record, the production database grants the public widget
and therapist API RPCs only to `service_role`; `anon` and `authenticated` have
no EXECUTE.  Their supporting `private`/`app` tables have RLS enabled and no
anonymous SELECT.  The existing Worker intentionally obtains the server-only
secret and returns `WIDGET_UNAVAILABLE` when it is absent.

Do not place a service-role key in the public Worker to solve this.  The
minimum alternative, if public widget/therapist delivery is approved, is a
separate migration that exposes only the existing read-only API wrappers to
`anon` after a dedicated mixed-state contract test covers their exact
predicates.  This remains unimplemented and requires its own ACL approval.
