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
Its target is deliberately only a proposed `fixed-page-media` object; it has
not been uploaded, exposed, or verified. The generated bundle proposal hash is
`1c2962bab01a2e87e56d0049183504faa81c1607584a388c3de4ba419d00c699`.

Read-only capture and generation (writes only ignored local files):

```sh
PUBLICATION_EXECUTION_PAGE_CAPTURE="$PWD/supabase/imports/publication-execution/20261020-fixed-pages.private.json" \
node headless/scripts/capture-publication-fixed-pages.mjs
PUBLICATION_EXECUTION_OUTPUT_LABEL=20261020-publication-execution-v1 \
PUBLICATION_EXECUTION_PAGE_CAPTURE="$PWD/supabase/imports/publication-execution/20261020-fixed-pages.private.json" \
node headless/scripts/prepare-supabase-publication-execution-plan.mjs
```

The generated SQL requires four transaction-local values and only accepts the
literal `local-fixture` mode. It includes an image-357 checksum receipt gate;
it cannot copy or upload the image. No production apply artifact is generated.
