# Local-only public directory execution bundle

This directory intentionally ignores generated JSON and SQL. Those files contain
the five public WordPress page bodies and must not enter Git history. The source
code generates a **proposed, not-approved** plan plus local-fixture-only apply
and rollback SQL; it is not a production migration and must never be used as one.

The scope is fixed: 379 shop records, 34 areas, 241 shop-image flags, six
`app.contents` records, and the separate checksum-gated media-357 reference.
The five WordPress sources are IDs 316, 323, 321, 319, and 343. Four currently
have empty WordPress bodies and retain the existing application fallback; ID 343
retains its WordPress body and its WordPress featured-media-357 mapping is
recorded separately for the proposed fixed-media object URL. `/advertise/` is
the existing application fallback, not a WordPress page.

The read-only capture completed on 2026-10-20 and is intentionally ignored.
Its non-content evidence is: page IDs 316/323/321/319 had empty rendered bodies
(`e3b0…b855`) and preserve their current application fallbacks; page 343 had
19,494 rendered HTML bytes (`bfc01d6e…27b6c7d`) and keeps its WordPress body.
Media 357 is the 6,487,809-byte PNG with SHA-256
`96f59d37e745108178e23c1ba2533328b7ffb615c079e43228f449d28dd5486c`.
Its target is deliberately only a `shop-images` object. The independently
verified upload receipt is a prerequisite for the production-only gate; media
357 remains outside the 241 shop-image target set. Any earlier ignored local
bundle that used a different bucket is superseded and must be regenerated
before approval.

Read-only capture and generation (writes only ignored local files):

```sh
PUBLICATION_EXECUTION_PAGE_CAPTURE="$PWD/supabase/imports/publication-execution/20261020-fixed-pages.private.json" \
node headless/scripts/capture-publication-fixed-pages.mjs
PUBLICATION_EXECUTION_OUTPUT_LABEL=20261020-publication-execution-v1 \
PUBLICATION_EXECUTION_PAGE_CAPTURE="$PWD/supabase/imports/publication-execution/20261020-fixed-pages.private.json" \
node headless/scripts/prepare-supabase-publication-execution-plan.mjs
```

The generated SQL requires four transaction-local values. Local rehearsal
artifacts accept only `local-fixture`; a separately approved production record
also emits SQL-Editor-ready production apply and conditional rollback files.
The apply file starts one transaction,
sets the four values, runs the full proposed-scope preflight and the production
apply guards, then commits. It includes an image-357 checksum receipt gate; it
cannot copy or upload the image. The adjacent production rollback file remains
conditional: it refuses a partial or drifted target set before changing data.

When an approved production bundle exists, use the generated
`*.production.sql-editor.apply.sql` file as one complete SQL Editor batch; do
not copy individual fragments or modify IDs. If it succeeds, run the generated
`*.production.readback.sql` file, which is read-only and proves the published
counts, exact page identities, and all exclusions. Use only the generated
`*.production.sql-editor.rollback.sql` batch for a later rollback; it retains
the same transaction-local gates and refuses partial or drifted state. No
database credential, service-role credential, or storage key is written into
any generated file.
