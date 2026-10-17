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

Observed result: **PASS**.

```text
PostgREST named reserve and stable event calls: PASS
PostgREST access dedupe view=1 line=1: PASS
Next-to-PostgREST review context HTTP: PASS
Customer submit and same-payload replay: PASS
Fixture dashboard Basic Auth + CSRF approval: PASS
Public reader and widget show approved review: PASS
Guest withdrawal hides reader and widget: PASS
Eskomi v1.1 Docker-network Next-to-PostgREST API acceptance: PASS
```

The lifecycle uses real HTTP in this order:

1. `POST /api/reviews/v2/context/`, then two identical
   `POST /api/reviews/v2/submit/` calls; the second is required to return the
   same experience and receipt as a replay.
2. Basic-authenticated `GET` and CSRF-protected `POST`
   `/api/dashboard/reviews/v11` approve that exact submitted experience.
3. `GET /reviews/entry/{entryHandle}/` and
   `GET /api/public/review-widget/{handle}` both expose the approved fixture
   review. The runner also checks the raw PostgREST public-reader RPC at
   `/rpc/list_public_review_experience_publications`.
4. `POST /api/reviews/v2/edit-session/`, then authenticated
   `DELETE /api/reviews/v2/edit/` with the returned credential, target, and
   revision. The same reader and widget requests are then required to omit the
   review and report a zero widget count.

This is HTTP/API evidence, not Chromium/UI evidence. It does not test a real
user login, production Supabase, production deployment, or browser rendering.
