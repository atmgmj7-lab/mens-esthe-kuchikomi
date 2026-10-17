# Eskomi v1.1 isolated Docker-network HTTP lifecycle evidence — 2026-10-17

Candidate before this QA change: `c2777db2af4580a92dc768f5b8c8d04f0c9d0a48`.

Command run from the repository root:

```bash
npm --prefix headless run qa:eskomi-v11-docker-network
```

The runner creates a disposable internal Docker network with PostgreSQL 17,
PostgREST 16.4, Next, and a caller container. It publishes no host port, uses
no host network or Docker socket mount, and removes the containers on exit.
All fixture credentials, shop/workspace data, JWT, and replay key exist only in
that disposable network. The fixture `service_role` has `BYPASSRLS`, matching
the server-only Supabase service role used by the application; it is not an
application user credential.

Observed result: **PASS** (expanded isolated HTTP QA).

```text
PostgREST named reserve and stable event calls: PASS
PostgREST access dedupe view=1 line=1: PASS
Next-to-PostgREST review context HTTP: PASS
Customer submit and same-payload replay: PASS
Fixture dashboard Basic Auth + CSRF approval: PASS
Published store registration, approval, workspace linkage: PASS
Unlisted store application, operator approval, public projection: PASS
Existing store binds stable target without duplicate ownership: PASS
Partner change stays private until dashboard approval: PASS
Operator direct edit publishes without a partner request: PASS
Therapist rights, dedicated link, name/photo projection, and retirement fallback: PASS
Benefit issue, shop-bound redemption, and double-redemption rejection: PASS
Public reader and widget show approved review: PASS
Guest withdrawal hides reader and widget: PASS
Analytics Next context GET and event POST: PASS
Analytics Next HTTP dedupe view=1 line=1: PASS
Eskomi v1.1 Docker-network Next-to-PostgREST API acceptance: PASS
```

The lifecycle uses real HTTP in this order:

1. `POST /api/reviews/v2/context/`, then two identical
   `POST /api/reviews/v2/submit/` calls; the second is required to return the
   same experience and receipt as a replay.
2. The runner first identifies the isolated Next request's exact
   scheme/host/port using a no-op, CSRF-protected invalid request (only an
   HTTP 400 is accepted), then uses that same origin for a
   Basic-authenticated `GET` and CSRF-protected `POST`
   `/api/dashboard/reviews/v11` to approve that exact submitted experience.
   Invalid Basic authentication, absent CSRF, a different scheme, and a
   different origin must all return 401/403 before that approval is sent.
3. `GET /reviews/entry/{entryHandle}/` and
   `GET /api/public/review-widget/{handle}` both expose the approved fixture
   review. The runner also checks the raw PostgREST public-reader RPC at
   `/rpc/list_public_review_experience_publications`.
4. `POST /api/reviews/v2/edit-session/`, then authenticated
   `DELETE /api/reviews/v2/edit/` with the returned credential, target, and
   revision. The same reader and widget requests are then required to omit the
   review and report a zero widget count. The credential is also required to
   reject access to a separately-created guest review.

5. A local active benefit program is set up before submission. The returned
   opaque code is issued once, rejected for a different shop workspace,
   redeemed exactly once by its owning workspace, and then returns
   `already_used` on the second redemption. All redemption requests use named
   raw PostgREST `/rpc` calls in the internal network.

6. `GET /api/analytics/shop-access/context/` issues contexts for `shop_view`
   and `official_line_click`; `POST /api/analytics/shop-access/` records the
   view twice and the LINE click once under the same cookie. The fixture DB is
   required to contain `shop_view_count=1` and `official_line_click_count=1`.

7. The store-operation portion creates and publishes a canonical fixture store
   through the CSRF-protected dashboard endpoint, submits
   `POST /api/partner/register`, and approves it through
   `POST /api/dashboard/partners/review`. It then submits a previously
   unlisted listing through `POST /api/listing-applications`, confirms that it
   is absent from `GET /api/listing-applications/public/` before approval, and
   confirms the public projection after dashboard approval.

8. Two `existing_change` applications for the same local legacy identity are
   approved through the dashboard. Their dashboard details must reference the
   same stable listing-store id, and the second approved content must update
   that one public store. The fixture never attaches a workspace ownership
   claim to this existing-store flow.

9. A fixture Partner workspace submits a listing revision over named raw
   PostgREST `/rpc`; the dashboard review endpoint is the HTTP approval step.
   The public projection is required to remain at its prior value until that
   approval. A dashboard `save_and_publish` then proves a direct operator edit
   is public without a Partner request.

10. A rights-confirmed fixture therapist photo asset, therapist assignment,
    and dedicated LINE review link are created through the service-only RPC
    boundary. The test verifies the dedicated link keeps selection fixed, the
    review context contains the target name, the public profile projection
    contains the target name and photo asset id, and retirement changes the
    dedicated context to store-only with `therapist_unavailable=true`.

This is HTTP/API evidence, not Chromium/UI evidence. It does not test real
Supabase Auth session issuance, email delivery, an actual Storage object byte
read for the therapist photo, production Supabase, production deployment, or
browser rendering. The Partner-session routes remain intentionally untested
here rather than being passed off as real Auth; their authorized mutation
contracts are exercised only with disposable fixture memberships and actual
isolated PostgREST HTTP.
