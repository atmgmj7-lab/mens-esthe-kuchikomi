# Public review read RPC plan — 2026-10-20

## Observed production state (read-only)

- `app.reviews` has zero rows; therefore there are no legacy review records
  waiting for a visibility-only migration.
- The v1.1 tables `private.review_experiences`,
  `private.review_experience_revisions`, and
  `app.review_experience_publications` do not exist. This is an unapplied
  schema/migration chain, not a set of private or pending v1.1 reviews.
- None of the four v1.1 public read RPCs exists in the production catalog.
- `api.published_reviews` also returns zero rows and intentionally grants no
  `anon` or `authenticated` `SELECT`; it is not a replacement public API.
- `api.get_public_site_directory_v1()` is a distinct, working public directory
  contract. Its `anon` execute grant does not grant access to review data.

## Proposed, unapplied public contract

`20261020030000_eskomi_public_review_read_rpc.sql` recreates only these four
existing v1.1 projection signatures as `SECURITY DEFINER` readers and grants
only their `EXECUTE` privilege to `anon` and `authenticated`:

1. `api.list_public_review_experience_publications_global(integer,integer,text)`
2. `api.count_public_review_experience_publications_global(text)`
3. `api.list_public_shop_detail_reviews_v11(text,integer,integer)`
4. `api.get_public_shop_detail_review_summary_v11(text)`

The return surface is limited to public handle, optional rating, public body,
optional display names, published times, approved reply text/times, and the
public shop/area directory fields needed by the existing UI. It excludes email,
receipts, session or edit material, identifiers for replay/idempotency/device
or IP data, moderation actor/reason, and every private base-table column. No
table grant is added. The reader filters to an approved active revision,
published review projection, published shop/area, and published managed shop
where the global directory requires it. Size guards preserve the application
parser's public limits.

## Preconditions and operator action

This new migration is deliberately not runnable against the current production
database: its v1.1 dependencies are absent. A separately reviewed production
migration operation must first apply the existing ordered v1.1 chain through
`20261017156000_eskomi_v11_global_review_projection.sql` (beginning at
`20261017120000_eskomi_canonical_shop_foundation.sql`), verify every migration
result, and only then apply `20261020030000_eskomi_public_review_read_rpc.sql`.
No historical review row migration is required by current evidence because
both the legacy source and v1.1 target contain no review rows/schema.

After that DB operation, the minimal Worker configuration is the already
approved public reader pair `SUPABASE_CONTENT_URL` and
`SUPABASE_CONTENT_PUBLISHABLE_KEY`, plus the existing Supabase-primary count
configuration. Do not add `SUPABASE_SECRET_KEY`, legacy service role keys, or
new direct table grants for public review reads.

## Verification and rollback constraints

The local test transaction applies the proposed migration, uses `SET LOCAL
ROLE anon` to call every reader, asserts that `anon` has no direct private
review-table access, and rolls back. Production verification must repeat those
privilege and public-output assertions with a seeded approved review and a
non-public/pending review before any preview deployment. The change does not
alter review writes, moderation, or the deliberately private legacy view.
