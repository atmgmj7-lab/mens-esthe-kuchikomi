# Public review read implementation status — 2026-10-20

## Result

The public-read proposal is four `api` RPCs only.  It has **no** independent
projection table, writer, trigger, backfill, write RPC, or table grant.  The
earlier `private.public_review_read_projection_v1` proposal was removed after
review because nothing populated or hid its rows; an empty second store is not
an implementation of the review-publication workflow.

The readers use the canonical v1.1 model:

```
review submission -> private.review_experience_revisions (pending)
                  -> operator approval via private.moderate_review_experience_v11
                  -> app.review_experience_publications (published)
                  -> four public read RPCs

withdrawal/edit -> revision state / publication_state = hidden -> readers omit it
shop unlisting  -> managed_shops.publication_state != published -> readers omit it
```

The source transition is implemented in
`20261017146000_eskomi_moderation_and_membership_race_fix.sql`; it creates or
updates a canonical publication on approval and hides one on withdrawal.
Later guest-edit/withdrawal migrations also hide published records.  No source
row is copied into a new read store.

## Exact proposed production change (not applied)

`20261020030000_eskomi_public_review_read_rpc.sql` changes four existing API
function bodies and their ACLs:

- `list_public_review_experience_publications_global(integer,integer,text)`
- `count_public_review_experience_publications_global(text)`
- `list_public_shop_detail_reviews_v11(text,integer,integer)`
- `get_public_shop_detail_review_summary_v11(text)`

It makes no table/index/type/view/trigger change and performs no data mutation.
Each function is `SECURITY DEFINER SET search_path = ''`, uses fully qualified
canonical source relations, revokes default/public execution, and grants only
these four `EXECUTE` privileges to `anon` and `authenticated`.  It grants no
direct table rights.

Public fields are: public handle, nullable 1–5 rating, body (400 chars),
display name (30), therapist display name (120), published timestamp, approved
reply (2,000) for shop detail, global directory/shop/area labels, and aggregate
counts/timestamps.  Excluded: receipt/session/idempotency/replay/IP/device
data, e-mail/auth identity, private IDs, moderation notes/actors, benefits,
and unapproved replies.

## Preconditions and forward compatibility

The four readers require the v1.1 canonical source model already installed:
`app.review_experience_publications`,
`private.review_experience_revisions`,
`private.review_experience_reply_revisions`, `app.shops`, `app.areas`,
`app.shop_areas`, `private.managed_shops`, and
`private.managed_shop_publications`.

The current production catalog lacks the review-experience relations, so this
read migration alone cannot be applied there.  Applying only selected v1.1
table definitions is not compatible: the historical chain creates those same
relations/constraints without `IF NOT EXISTS` and requires its submission,
moderation, partner, and directory dependencies.  The valid sequence is: a
separately approved full v1.1 source-model/data release, then this final
read-ACL migration.  The historical `171540`/`171560` migrations replace the
same reader functions with service-role-only versions, so this migration must
run after them.

## Local verification

The retained `eskomi-v11-partner-db-22359-18192` fixture ran the read migration
and test records inside one transaction and rolled everything back.  The test
creates canonical managed shops and uses the real moderation function to
exercise the actual publication path:

- empty shop: zero count and null aggregates;
- approval: one visible global/detail/summary record;
- withdrawal: the formerly approved record is hidden;
- pending revision: no publication and no public result;
- unlisted managed shop: approved review is absent from both global and detail.

The `anon` role can execute only the four readers and cannot select canonical
review tables.  Passed commands:

```sh
npm run test:eskomi-public-review-read
ESKOMI_V11_PUBLIC_REVIEW_DB=eskomi-v11-partner-db-22359-18192 \
  npm run test:eskomi-public-review-read-local
```

The app transport contract also proves it uses only
`SUPABASE_CONTENT_URL` and `SUPABASE_CONTENT_PUBLISHABLE_KEY`, posts only to
the four `/rest/v1/rpc/` names, and never reads a service secret.

## HTTP rehearsal status

A read-only HTTP request to the existing retained local PostgREST fixture
returned `401 / 42501 permission denied for function
list_public_review_experience_publications_global`.  This is expected: the
proposal is transaction-rolled-back in the local test and has not been
persisted into that retained fixture.  A fresh isolated fixture rehearsal was
blocked by the execution environment's reuse-only/no-duplicate policy; no
production or local persistent DDL/GRANT was attempted.

## Next approval needed

Approve a production source-model release (full v1.1 chain plus provenance and
data/retention decision), then DDL/ACL for these four functions, followed by a
committed disposable local PostgREST rehearsal with a real local anonymous JWT.
The release must verify function owner, `prosecdef`, empty search path, exact
ACLs, direct-table denial, approval/withdrawal/unlisting behavior, and that
only the listed public fields cross the API boundary.  Do not enable the app
flag or deploy until those checks pass.
