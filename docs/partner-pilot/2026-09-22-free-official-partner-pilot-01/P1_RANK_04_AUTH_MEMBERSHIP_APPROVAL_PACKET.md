# P1-RANK-04 — Auth and Membership approval packet

## Target and scope lock

- Target: Mrs.Rank UP（ミセスランクアップ） only.
- Canonical WordPress Shop ID: `768`.
- Mrs.L'Amant, BAMBI SPA, and every other workspace, Auth user, membership, campaign, and review are unchanged.
- This packet does not send outreach or an invitation. P1-RANK-01 is already complete.

## Preconditions

1. Store participation consent is confirmed by the authorized representative.
2. A fresh WordPress readback confirms Shop ID `768`, its slug, and its canonical URL.
3. P1-RANK-03 readback supplies an existing workspace ID whose identity matches that same Shop `768` record.
4. The intended contact email and representative identity are confirmed by the operator outside the browser flow.
5. A service-only Auth Admin lookup has no ambiguous exact-email result and no membership for that Auth user in another workspace.
6. P1-RANK-02 has exposed only the approved minimum `api` wrapper set, including `api.grant_partner_membership`, with `service_role` execute only.

## Exact operation

Method: `headless/scripts/p1-rank-auth-membership-operator.mjs` in a trusted operator/server process. It is not a Next route, has no browser request shape, and is not callable by a Partner session.

The protected runner receives only secure runtime input:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the server environment;
- the P1-RANK-03 workspace ID;
- confirmed representative email and role (`owner` or `manager`);
- an explicit identity-confirmation flag; and
- an explicit create-if-missing flag only when creation is approved.

It independently reads WordPress Shop `768`, lists exact email matches through Supabase Auth Admin, fails on zero results unless create-if-missing is explicit, fails on multiple results, then calls `api.grant_partner_membership(...)` with the resolved canonical identity. The RPC locks and compares workspace ID, WP Shop ID, slug, and canonical URL before it writes.

## Writes and safe readback

When an exact Auth user already exists, the only write is one active `private.partner_memberships` row through the service-only wrapper. An exact active binding is returned as `already_present` without change.

When explicit creation is authorized and no exact user exists, the runner creates one passwordless, unconfirmed `auth.users` identity (`email_confirm=false`) and then grants one active membership with `accepted_at`. It sends no invite, stores no password, and returns only masked Auth/workspace identifiers, Shop ID, role, status, and `created` or `already_present`.

If the new Auth user is created but the membership write fails, the runner deletes only that just-created unbound user as compensation and returns `membership-grant-rolled-back`. Existing Auth users are never deleted by this operation.

## Expected result and postcheck

```text
one intended Auth identity
  -> one active Partner membership
  -> one existing Mrs.Rank UP / WP Shop 768 workspace
```

Postcheck without PII or secrets:

1. The service-only grant readback resolves exactly one active membership for the Shop 768 workspace.
2. Before P1-RANK-05, the workspace-state gate correctly keeps Partner login unavailable; the membership grant does not bypass lifecycle approval.
3. After the separately approved P1-RANK-05 transition, Partner magic-link login may access its own workspace only.
4. A foreign workspace candidate, no membership, revoked membership, anonymous browser, and Partner-to-Operator access are denied.
5. No other workspace, membership, campaign, lifecycle state, review, WordPress record, or public page changes.

## Rollback

Before a successful result, automatic compensation applies only to a newly created and unbound Auth identity. After a successful result, a separately approved service-only rollback marks the exact membership `revoked`, sets `revoked_at`, and revokes active Auth sessions. It does not delete workspace, registration, campaign, review, moderation, or history records.

## Approval boundary

Production execution remains prohibited until P1-RANK-04 is separately approved. This packet does not authorize P1-RANK-02 API exposure, P1-RANK-03 workspace creation, lifecycle approval, campaign creation, contact, invite, review, moderation, deployment, or push.
