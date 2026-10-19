# Source-grounded primary-area delta rehearsal — 2026-10-19

## Result

The production-facing plan was built from a read-only WordPress REST snapshot
of all 394 published `shop` records. It does not infer an area from ordering,
slug, or single-area membership.

| Plan outcome | Count | Meaning |
| --- | ---: | --- |
| candidate source rows | 379 | 394 source rows minus 14 `review_required` rows and managed-unlisted ID 1272 |
| executable `is_primary` assignments | 44 | only rows with `acf.shop_primary_area_term_id` that is already an existing source area relation |
| deferred: no area relation | 74 | no allocation is possible |
| deferred: missing field, multiple relations | 187 | requires an explicit editor/owner primary-area selection |
| deferred: missing field, single relation | 74 | still requires explicit source data; no single-area inference is allowed |
| exclusions | 15 | 14 review-required source-only rows plus ID 1272 managed-unlisted |

The ignored, non-overwriting local deliverables are:

- `supabase/imports/primary-area-delta/20261019-primary-area-delta.plan.json`
- `supabase/imports/primary-area-delta/20261019-primary-area-delta.apply.sql`
- `supabase/imports/primary-area-delta/20261019-primary-area-delta.rollback.sql`

They were generated with a caller-supplied UUID batch ID and must be regenerated
from a fresh read-only snapshot if execution is ever approved. They are not an
authorization to execute DML in production.

## Actual production read-only applicability check

The generated 44 assignment pairs were checked against the connected
production database without mutation:

| Check | Result |
| --- | ---: |
| generated assignments | 44 |
| existing matching shop/area relations | 44 |
| draft shop + unpublished area + `is_primary = false` | 44 |
| blockers (missing relation, public state, or prior primary) | 0 |

This confirms the narrow SQL has an exact current target set. It does not make
those rows public: after a successful apply all shops remain `draft`, all areas
remain unpublished, and the primary public RPC continues to return zero shops
until a separate publication manifest is approved.

## What the apply and rollback SQL can change

The apply script:

1. validates every target shop, area, and existing relation;
2. refuses an already different primary relation;
3. updates only `app.shop_areas.is_primary`; and
4. creates/upserts a bounded audit batch and one `private.import_records` row
   per source decision.

It does not insert, update, or delete `app.shops`, `app.areas`,
`app.shop_images`, or Storage objects. Thus the existing 241 image URLs and
their UUIDs are outside its write set.

The rollback script first requires the completed matching audit batch and the
unchanged draft/unpublished boundary, then changes those same 44 primary flags
back to `false` and marks the batch `rolled-back`. It deletes neither audit rows
nor Storage objects. This is a bounded logical restore for this delta—not a
substitute for a database-wide PITR or logical export.

## Local application evidence

`npm --prefix headless run test:supabase-primary-area-delta-local-rehearsal`
passed on the retained local Supabase Docker fixture. In one outer transaction
that ends in `ROLLBACK`, it:

1. applies the exact public-directory migration;
2. seeds a draft/unpublished primary-area fixture and 241 nonpublic image rows;
3. applies the generated delta logic, reapplies it, and verifies no duplicate
   audit record or extra primary relation;
4. compares every image UUID, shop UUID, URL, and public flag before and after;
5. rolls the primary flag back;
6. locally promotes only the fixture to verify the `anon` public RPC's
   listing/detail canonical-path/sitemap projection and managed-unlisted
   suppression; and
7. restores the fixture state and rolls back the entire transaction.

The established real-HTTP fixture evidence remains separate: it covers the
existing Next/PostgREST routes and management unlisting behavior. This
rehearsal validates the new primary-area data delta and RPC projection without
starting or deleting another Docker fixture.

## Remaining production gates

Production remains at zero publicly readable directory rows. Before any write,
an authorized executor needs a fresh preflight, an immutable regenerated plan,
and a scoped backup/PITR or approved logical export according to the operation's
recovery objective. The connected interface permits the reads above but does
not expose `pg_dump`, provider PITR creation, or Storage export/restore; that is
the specific capability gap for a full-data recovery proof.
