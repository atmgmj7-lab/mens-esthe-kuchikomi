# Local QA implementation plan — Supabase canonical public reviews

## Scope

This local-only fixture proof uses its disposable internal Docker network and
database. It does not access Cloudflare, WordPress production, DNS, secrets,
or any remote database.

## Steps

1. Seed one pending private review, one approved v1.1 publication, and one
   separate shop with zero public reviews.
2. Validate the four canonical read RPCs against the isolated schema before
   starting the application runtime.
3. Exercise `/reviews/`, the canonical shop detail, and the public partner
   widget over HTTP; require the approved marker and reject the private marker.
4. Capture PostgREST request metrics around public routes and require each of
   the global and shop-detail review RPCs to appear. These are HTTP-call counts,
   not SQL-query counts.
5. Keep the existing unlisting assertions after the public-review evidence:
   detail 404 plus listing and sitemap omission.

## Acceptance criteria

- Public content appears only from `app.review_experience_publications` with an
  approved active revision.
- The private marker never appears in public HTML or sitemap output.
- The zero-review shop has a zero summary in the isolated canonical read model.
- The metric artifact is retained only after a fully successful fixture run.
