# ESKOMI Supabase Review Native Cutover T1 — DB Contract / M1

## Scope

Task T1 only. The application submission, moderation UI, public adapter, Vercel deployment, WordPress cleanup, Therapist relation, M2 cleanup, and Production migration are excluded.

## Implementation

1. Extend `app.reviews` with the optional rating dimensions, visit/revisit fields, and distinct reviewed/published timestamps while retaining the existing UUID and Shop FK.
2. Move submission PII, idempotency, HMAC abuse-window state, and append-only moderation history into RLS-enabled `private` tables.
3. Revoke browser-role access to `app.reviews` and the legacy `api.published_reviews` view.
4. Add service-role-only, security-invoker RPC contracts for atomic submit, moderation, sanitized published candidates, and shared metrics.
5. Extend Growth attribution with a nullable Supabase Review UUID while retaining the nullable legacy WordPress Review ID and old RPC.
6. Keep WordPress as the Shop/Area publication authority. The DB list RPC returns only Review-safe candidates; the future T5 adapter must perform the final WordPress Shop publication check.

## Transaction contract

`api.submit_review` resolves the canonical WordPress Shop mirror, serializes by the hashed idempotency key, and commits the following together:

- `app.reviews`
- `private.review_submission_details`
- `private.review_idempotency_keys`
- `private.review_abuse_rate_limits`
- optional `private.partner_review_campaign_submissions.review_id`

Invalid ratings, private-detail constraint failures, and invalid Campaign attribution roll back the entire call. Duplicate idempotency returns the original Review UUID without creating a second row.

## Security contract

- `anon` / `authenticated`: no direct Review table/view access and no Review RPC execution.
- `service_role`: intended RPC execution and minimum private-table privileges.
- All new private tables: RLS enabled and no browser policies.
- All new RPCs: `SECURITY INVOKER`, fixed `search_path`, fully qualified data objects, explicit PUBLIC/anon/authenticated revocation.
- No raw IP or secret is stored. Abuse storage accepts only a server-derived lowercase SHA-256/HMAC digest shape.
- Published candidate/metrics RPCs exclude nickname, email, moderation reason/actor, Campaign token, workspace, and abuse state.

## Verification and review packet

- Fail-first: the executable SQL contract failed with `Review Native M1 migration is not applied` before migration creation.
- Mutation check: dropping the local `rating_price` constraint made the contract fail with `invalid metric rating unexpectedly succeeded`; reset restored the migration and GREEN result.
- Local migration: initial apply and repeated `supabase db reset` succeeded without duplicate objects.
- Focused DB contract: native Review, Foundation, and Growth local SQL contracts passed.
- Related regressions: Foundation/Growth source contracts, Review rating, public Review, Review dashboard/boundary, schema output, TypeScript, and ESLint passed.
- DB lint: `app`, `private`, and `api` returned `No schema errors found`.
- Production Supabase, WordPress, Vercel, main, secrets, URLs, canonical, and sitemap were not changed.

## Independent review focus

Review the following independently before any T2 work:

1. Transaction rollback and concurrent idempotency behavior.
2. Function ACLs, schema grants, RLS, `SECURITY INVOKER`, and fixed search paths.
3. Public candidate/metrics predicate parity and absence of PII/internal fields.
4. Growth legacy compatibility and partial unique indexes.
5. Forward-only migration safety over the five applied Production migrations.
6. No accidental application, WordPress, SEO, or Production changes.
