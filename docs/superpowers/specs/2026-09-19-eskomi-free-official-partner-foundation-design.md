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

## Manual-first, Automation-later

Manual-first: a human or store representative creates a normalized Partner workspace, passes validation, then waits for review and an explicitly approved publish action.

Automation-later: an official-source collector can create a normalized candidate/diff against that same workspace, then pass the same validation and review/publish workflow. It must not create a parallel automation-only entity model. Crawler work, auto-publication, QR, therapists, schedules, analytics, billing, ranking, and SEO changes remain out of scope.

## Verification contract

`npm run test:free-partner-foundation` is the fast source contract owner. After this project's `supabase start` or `supabase db reset` has applied migrations, `npm run test:free-partner-local-supabase` resolves the exact project container from `supabase/config.toml`, requires the Partner migration objects, and verifies anon/authenticated denial, service-role-only grants, append-only history, denied adapter execution, and both failed-registration rollback and successful atomic registration transition. Typecheck, lint, build, changed-flow browser QA, diff/secret/PII checks, and independent specification plus quality/security review are required before local acceptance.
