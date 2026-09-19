# Eskomi Free Official Partner foundation design

Task: `ESKOMI-FREE-PARTNER-FOUNDATION-01`
Base: `03bbdd604f8c75292dbf1cbf3db8e83b95ca2a6f`
Boundary: local implementation and local commit only. No push, deploy, production WordPress/Supabase write, secret/environment change, or SEO change is authorized.

## Purpose

This foundation creates one private control-plane for a shop's future official workflow. It supports a manual intake now and a verified-source automation later without creating separate data models. WordPress remains the public CMS and canonical public authority; the existing restricted WordPress Writer remains the future approved-publication adapter.

## Routes and trust boundaries

| Route | Audience | Boundary |
| --- | --- | --- |
| `/dashboard/partners/` | Eskomi operators | Existing Dashboard Basic Auth, proxy protection, and route-level authorization. It may initialize an idempotent workspace for a canonical WordPress shop. |
| `/partner/register/` | Store representative | Public registration intake only. It cannot access `/dashboard` or invoke an operator transition. |
| `/r/{opaque-token}/` | Public campaign recipient | Server-only active-campaign resolution. It is `noindex, nofollow` and `no-store`, and can only issue a 307 redirect to the existing canonical `/reviews/submit/?shop={canonical-slug}&campaign={token}` form. |
| `/shops/{slug}/` | Public | Existing canonical shop page is unchanged. |

`/api/dashboard/partners/provision/` repeats the Basic Auth decision in the route; the proxy continues to protect both `/dashboard/*` and `/api/dashboard/*`. `/api/partner/register/` accepts only the minimum private intake and does not expose a private reader or state-change endpoint.

## Private data model

All Partner workflow data is stored in Supabase `private`, not `api`:

| Object | Role |
| --- | --- |
| `private.partner_workspaces` | One normalized workspace per canonical WordPress shop ID. It stores the current state and canonical identity projection. |
| `private.partner_state_history` | Append-only state/provisioning history, including source, actor label, reason, and time. |
| `private.partner_registration_submissions` | Private contact, confirmation, consent, and review status for each self-registration. |

State sequence: `normal_listing` → `shop_confirmed` → `free_official_partner` → `active_partner`. `shop_confirmed` means only that the selected canonical shop identity was verified server-side; the representative submission remains `received` and requires operator review. A self-registration moves only `normal_listing` to `shop_confirmed`. No registration makes a public change. Future state moves use the server-only `set_partner_workspace_state` function, which records the history row and rejects unsupported transitions. History grants are insert/select only, never update/delete.

The migration enables RLS and revokes schema, table, sequence, and function privileges from `public`, `anon`, and `authenticated`. Only `service_role` is granted private-schema access. Because Supabase REST commonly exposes `api` but not `private`, the repository sends `Content-Profile: api` only to two service-role-only `SECURITY INVOKER` RPC adapters. Those adapters write/read `private` tables and call private functions; they do not store Partner data in `api`. No client component includes Supabase configuration or credentials.

## Provisioning and intake flow

```text
operator selection OR partner registration
  -> WordPress canonical shop lookup
  -> provisionPartnerWorkspace(shop)
  -> private.partner_workspaces (idempotent by wp_shop_id)
  -> registration only: private submission + audited shop_confirmed transition
  -> operator review / approved future publication adapter
```

The operator route and self-registration service call the same `provisionPartnerWorkspace` service. The service derives ID, slug, title, and public target URL from WordPress rather than trusting browser-submitted shop identity. Registration also reuses the existing trusted-IP/HMAC rate-limit claim. The public form asks only for contact/relationship, confirmation information, and consent; it never asks the representative to retype known shop data.

## PARTNER-03: Review-growth entry and attribution boundary

An approved `free_official_partner` workspace has one opaque UUID campaign per approved channel (`counter_qr`, `line_after_visit`, `shop_website`, and `eskomi_shop_page`). The protected Growth Kit's QR, copy-link, banner, and LINE targets all use only `/r/{token}/`; they never carry a shop ID, review text, contact value, or Partner credential in a public URL.

`/r/{token}/` calls only `openPartnerReviewCampaign(token, partnerReviewGrowthRepository)` server-side. An inactive, malformed, unknown, or repository-unavailable token returns a no-store/noindex 404 and does not disclose a shop. A resolved token redirects with HTTP 307 to exactly the existing `/reviews/submit/` route and supplies the canonical WordPress-derived slug plus the token.

The existing review page independently resolves the campaign server-side before rendering an attributed prefill. It obtains the canonical public shop from WordPress and requires equal canonical shop ID and normalized slug. A valid campaign combined with another shop renders a denial state with no form, so it cannot create a WordPress submission. An invalid/inactive campaign is not attributed and may continue through the pre-existing non-campaign form flow. The browser may transport only the opaque campaign token with the existing review payload; contact values and review body never enter Partner analytics.

The review submit API repeats the active-token lookup after normal payload and canonical-shop validation. A resolved campaign whose WordPress shop ID differs is rejected before `submitReviewToWordPress`. It preserves the existing pending WordPress moderation payload and normal non-campaign behavior. Only after WordPress returns successful JSON with a positive review ID does it call `recordPartnerReviewCampaignSubmission({ token, shopId, wordpressReviewId })`. Conversion failure is non-blocking for the already successful WordPress submission, and the private conversion record is limited to those identifiers and time; no review text, nickname/contact data, source URL, or raw request payload is copied to Partner tables.

## PARTNER-03 migration, rollback, and verification runbook

**Current status: production migrations and production application release are NOT performed.** Task 3 adds no schema migration; it consumes the ordered Foundation and review-growth migrations already in the repository. Do not run any remote command without separate, SHA-specific approval.

Local order, against this repository's isolated local Supabase only:

1. `supabase start`.
2. `supabase db reset` so `20260919000000_free_partner_foundation.sql` applies before `20260920000000_partner_review_growth.sql`.
3. From `headless`, run `npm run test:free-partner-local-supabase`, `npm run test:partner-review-growth-local-supabase`, `npm run test:partner-review-growth`, and `npm run qa:partner-review-growth`.
4. Run typecheck, lint, build, the changed-flow headless QA, and diff/secret/PII scans before accepting a local candidate.

Future production order, only after explicit approval for the exact commit and deployment:

1. Capture the applied migration ledger and the counts below; stop if either required migration is absent or unexpectedly different.
2. Apply `20260919000000_free_partner_foundation.sql` if and only if it is absent, then apply `20260920000000_partner_review_growth.sql` once. Verify the latter before releasing any Task 2/3 application code.
3. Verify service-role RPC behavior and browser-role denial, then release the approved application SHA. The public entry route must be checked with an active test campaign and an inactive token before distributing a kit URL.
4. Perform one controlled WordPress pending-review submission only under a separately approved test plan; use its resulting WordPress review ID to check a single conversion record. Do not use review text or contact data in verification SQL or reports.

Read-only post-production verification queries (parameters are supplied by the approved runbook, never committed):

```sql
select version from supabase_migrations.schema_migrations
where version in ('20260919000000', '20260920000000') order by version;

select channel, count(*)
from private.partner_review_campaigns
group by channel order by channel;

select count(*) as conversions,
       count(distinct wp_review_id) as distinct_wordpress_review_ids
from private.partner_review_campaign_submissions;

select grantee, routine_name, privilege_type
from information_schema.routine_privileges
where routine_schema = 'api'
  and routine_name in ('open_partner_review_campaign', 'record_partner_review_campaign_submission')
order by routine_name, grantee, privilege_type;
```

Failure and rollback rule: no down migration, private-table deletion, WordPress deletion, or conversion replay is authorized. If migration verification fails, stop before application release and retain the evidence. If a released public route or attribution check fails, first remove the Task 3 application exposure by deploying the last approved application SHA (separate approval); existing `/reviews/submit/` continues as the normal unattributed flow. Retain private campaigns/conversions for audit, disable further kit distribution, and investigate with the read-only queries above. Releasing a rollback, changing a campaign's active state, or creating a compensating WordPress item each requires new explicit approval.

## Manual-first, Automation-later

Manual-first: a human or store representative creates a normalized Partner workspace, passes validation, then waits for review and an explicitly approved publish action.

Automation-later: an official-source collector can create a normalized candidate/diff against that same workspace, then pass the same validation and review/publish workflow. It must not create a parallel automation-only entity model. Crawler work, auto-publication, QR, therapists, schedules, analytics, billing, ranking, and SEO changes remain out of scope.

## Verification contract

`npm run test:free-partner-foundation` is the fast Foundation source contract owner. `npm run test:partner-review-growth` covers the review-growth source contract, and `npm run qa:partner-review-growth` executes the changed public-entry/form/API flow in a headless-only local harness. After this project's `supabase start` or `supabase db reset` has applied migrations, `npm run test:free-partner-local-supabase` resolves the exact project container from `supabase/config.toml`, requires the Partner migration objects, and verifies anon/authenticated denial, service-role-only grants, append-only history, denied adapter execution, and both failed-registration rollback and successful atomic registration transition. Typecheck, lint, build, changed-flow browser QA, diff/secret/PII checks, and independent specification plus quality/security review are required before local acceptance.
