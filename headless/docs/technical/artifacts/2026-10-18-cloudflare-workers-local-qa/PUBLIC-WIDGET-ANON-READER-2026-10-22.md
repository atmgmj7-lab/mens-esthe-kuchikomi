# Public widget anonymous reader — 2026-10-22

## Scope applied

- Source migration:
  `supabase/migrations/20261022023612_eskomi_public_widget_anon_reader.sql`
- Source SHA-256:
  `72b45dda7e86beaed2b9ad764caecc8a0045792a31cc58854544c47944341b80`
- Remote migration history record:
  `20261022024432 / eskomi_public_widget_anon_reader`
- Preview Worker version:
  `fbd88aba-7d49-40f5-9a9f-a7a271f1ad65`
- Target only: Eskomi account `0641c11bf1431e5ee5cd3fca94c417e2`,
  `eskomi-workers-prep` workers.dev preview.

The migration replaces only
`api.get_public_review_widget_v11(uuid,integer,integer)`.  It is now a
`SECURITY DEFINER` function with an empty fixed search path and grants EXECUTE
to `anon` only.  It directly encodes the established public predicate rather
than invoking a private function by name, so browser roles receive neither
`USAGE` on `private` nor EXECUTE on the private reader.

It returns only an active widget for a published canonical shop; a linked
managed shop must be published.  Reviews require both a published publication
and an approved active revision, and replies require approved state.  Limits
remain clamped to 1..7 and offsets to zero or greater.

## Explicitly unchanged

- No `private` or `app` table SELECT was granted to browser roles.
- No private function grant was added.
- No service-role/admin key was deployed to Cloudflare.
- No therapist RPC, photo route, Auth, Storage, Mail, collector, mapping, DNS,
  custom domain, real shop, real review, or widget row was changed.

The Worker widget reader now uses only `SUPABASE_CONTENT_URL` and the existing
publishable key.  It rejects invalid handles before fetching and keeps the
existing noindex 503 unavailable response for no matching public widget.

## Local proof

The retained PostgreSQL fixture applied the migration and a synthetic mixed
fixture inside one transaction and then rolled back.  It proved:

- one active public widget with eight approved publications returns at most
  seven rows;
- pending and withdrawn reviews do not appear;
- only an approved reply appears;
- disabled widget and unlisted managed-shop states return no row;
- invalid/null handle, limit, and offset boundaries fail closed; and
- anonymous callers cannot select widget settings, publications, revisions, or
  reply tables directly.

The local test completed with `ROLLBACK`; no fixture schema or data persisted.

## Remote post-apply verification

- API wrapper: security definer, fixed empty search path, `anon EXECUTE=true`.
- `authenticated EXECUTE=false`, `PUBLIC EXECUTE=false`, private reader
  `anon EXECUTE=false`.
- All four underlying canonical tables remain anonymous-read denied and RLS
  enabled.
- An actual `SET ROLE anon` call to a valid nonexistent handle returned zero
  rows.  The direct anonymous REST table request was non-success (`406`).

## Preview QA

The deployment used the dynamic-bundle verifier and guarded wrapper with the
existing public content transport only.  workers.dev returned 200 with
`X-Robots-Tag: noindex, nofollow` for root, reviews, a canonical published shop,
area, sitemap, and robots.  The widget API returned noindex 503 for both a
valid nonexistent handle and malformed handle.

Production currently has zero widget settings (zero active), so a real preview
success response cannot be exercised without creating a prohibited widget row.
The successful path is verified only by the rollback fixture above.
