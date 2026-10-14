# Approved listing production release plan

## Scope and authority

- Release the approved listing application, review, Partner edit, and public projection changes on `codex/rankup-ui-language-qa-fixes-20261014`.
- Apply only the reviewed, currently unapplied listing migrations to Supabase project `goeagrxjsjcbbatpotbu`.
- Deploy through the existing GitHub-to-Vercel production path for `escomi-headless` after CI succeeds.
- Do not create accounts, bind existing shops to Partner workspaces, create production applications, change pricing, or delete existing data.

## Safety gates

1. Re-fetch `origin/main`, merge it only if the merge tree is clean, and re-run the affected verification suite.
2. Reject global `storage.objects` grants or revokes. The new `listing-application-private` bucket stays private; no browser Storage policy is added.
3. Compare remote Supabase migration history and apply the ordered listing migrations that are absent. Run security advisors and read-only access checks afterward.
4. Push the reviewed branch, open a PR, wait for required CI, then merge only the reviewed PR.
5. Confirm the exact Vercel deployment identity and production custom-domain HTTP responses. Do not create a live test application or use private contact data for public QA.

## Evidence to retain

- Branch SHA, PR URL, CI run, merge SHA, and Vercel deployment ID/URL.
- Applied migration versions and advisor/read-only access outcomes (without credentials or private payloads).
- Production HTTP/SEO checks for public routes and unauthenticated admin protection.
- A short handoff containing the existing entry-point URLs and the ownership-verification requirement for Partner editing.
