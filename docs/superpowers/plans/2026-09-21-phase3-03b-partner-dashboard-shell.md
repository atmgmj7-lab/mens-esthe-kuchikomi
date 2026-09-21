# Phase 3 03B — Partner Dashboard Shell / Shop Identity

Task: `ESKOMI-PHASE3-03B-PARTNER-DASHBOARD-SHELL-SHOP-IDENTITY-01`

## Scope

- Reuse 03A server-side Auth → membership authorization for `/partner/`.
- Resolve the existing `private.partner_workspaces` canonical shop projection
  through a service-role-only API RPC, with no new workspace or status model.
- Render only the authenticated Partner's shop identity, existing Partner state,
  and navigation to the current dashboard and canonical public shop page.
- Protect Partner routes with `private, no-store` and `noindex, nofollow`.

## Fail-closed boundary

- The resolved workspace ID, WordPress shop ID, shop slug, canonical URL, and
  state must agree exactly with the 03A membership result.
- Any mismatch, unavailable RPC/configuration, anonymous session, invalid
  session, or no membership redirects to Partner login.
- `/dashboard/...` remains the separate operator Basic Auth boundary.

## Exclusions

- No QR, campaign, review metrics, review-content, widget, correction, AI, or
  public SEO/canonical/sitemap work.
- No production migration, configuration, secret, WordPress, push, or deploy.

## Verification

- RED/GREEN pure identity contract: own identity allowed; workspace, shop,
  canonical URL, and state mismatches denied.
- Local Supabase transaction verifies service-role-only identity RPC and
  canonical projection.
- Fresh production-mode local browser QA verifies authorization, A/B isolation,
  no-membership rejection, operator boundary, no-store/noindex headers, public
  route isolation, and 390px/320px overflow.
