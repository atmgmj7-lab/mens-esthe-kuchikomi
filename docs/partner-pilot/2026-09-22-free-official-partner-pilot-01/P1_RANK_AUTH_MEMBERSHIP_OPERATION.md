# P1 Rank UP — Auth and membership operation

## Scope and invariants

- Target: Mrs.Rank UP（ミセスランクアップ） only.
- Canonical WordPress Shop ID: `768`.
- Canonical slug and URL must be read from WordPress immediately before each write. A display name, submitted URL, or browser-provided workspace ID is never authority.
- This document creates no Auth user, membership, workspace, campaign, token, or review.

The authorization chain is fixed:

```text
Supabase Auth user
  -> active private.partner_memberships row
  -> private.partner_workspaces row for WP Shop 768
  -> canonical WordPress Shop 768 identity
```

An access request may carry a workspace or shop identifier only as a candidate. `authorizePartnerAccess` denies a mismatch before it can project Partner data.

## Existing reusable path

| Phase | Existing capability | Authority | Current readiness |
| --- | --- | --- | --- |
| Store participation | `POST /api/partner/register/` | Store-controlled public form, server-side canonical Shop lookup | Reusable after consent; creates registration submission and moves only `normal_listing -> shop_confirmed`. |
| Workspace resolution | `api.provision_partner_workspace(...)` | Server service role through `api` wrapper | Reusable once the narrowly scoped Data API function exposure is enabled. |
| Auth sign-in | `/api/partner/auth/request-link/` | Supabase Auth OTP, `create_user: false` | Reusable only after an Auth user already exists. |
| Active membership lookup | `api.get_partner_auth_membership(uuid)` | Server service role | Reusable after membership is granted. |
| Workspace identity lookup | `api.get_partner_workspace_identity(uuid)` | Server service role | Reusable only for a Partner state. |

There is deliberately no browser route or client grant for membership creation. The current code also deliberately does not create Auth users: its magic-link request sets `create_user: false`.

## Required controlled operation after store consent

`P1-RANK-04` is not ready to execute yet. It requires an approved server-side operational method with these two actions in this order:

1. Provision or verify the consenting shop representative as a Supabase Auth user without exposing an Auth-admin credential to a browser.
2. Insert exactly one `private.partner_memberships` row through a service-only administrative operation:
   - `workspace_id`: read back from the canonical WP Shop 768 workspace.
   - `auth_user_id`: read back from the Auth operation, never typed from a browser value.
   - `role`: `owner` or `manager`, selected by the approved shop representative.
   - `status`: `active`; `accepted_at` set by the controlled operation.

The current schema has `auth_user_id UNIQUE`. Therefore the same Auth user cannot be assigned to a second workspace under the present Pilot contract. Do not silently reuse an Auth user from another shop.

## Preconditions

1. The store has consented and supplied a verified representative through the store-controlled registration path.
2. A fresh WordPress readback matches ID `768`, canonical slug, canonical URL, and published shop identity.
3. The workspace readback has the same `wp_shop_id`, slug, name, and canonical URL.
4. The Data API minimum exposure gate is approved and read back with service-role grants only.
5. No existing active or revoked membership uses the selected Auth user ID.

## Postcheck and rollback

Postcheck must prove all of the following without returning the user's email, token, or session:

- `api.get_partner_auth_membership(auth_user_id)` returns exactly one row for WP Shop `768`.
- `api.get_partner_workspace_identity(workspace_id)` returns the same canonical Shop 768 identity after Partner activation.
- A malformed, foreign, or missing workspace/shop candidate is denied.
- An unauthenticated request is denied.

Rollback is a separately approved service-only operation: mark the membership `revoked`, set `revoked_at`, and revoke active Auth sessions before any replacement membership is considered. Do not delete review, campaign, or workspace history to simulate rollback.

## Local proof

The local membership contract now inserts a synthetic revoked membership and verifies that `api.get_partner_auth_membership` returns no access row. It runs inside a transaction and rolls back all fixtures.

```text
npm run test:partner-auth-membership
npm run test:partner-auth-membership-local-supabase
```

This proves the existing membership model and revocation gate locally. It does not create or alter a Production Auth user.
