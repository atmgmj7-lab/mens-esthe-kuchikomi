# Conservative publication manifest — 2026-10-19

## Purpose and current decision

This is a **zero-target, read-only preflight** for a future Supabase-primary
cutover. It is not a data import, a publish operation, or an authorization to
make any row public. The generated manifest records that there are currently
no approved public targets for shops, areas, fixed pages, or image rows.

The checked-in generator is:

```text
headless/scripts/prepare-supabase-publication-manifest.mjs
```

Generated payloads live under the ignored
`supabase/imports/publication-manifest/` directory because they contain a
time-specific operational inventory. They are deliberately not committed.

## Reconciled scope

| Category | Current action | Reason |
| --- | ---: | --- |
| 379 matched WordPress/App shop IDs | retain as drafts | A WordPress-public URL is not a Supabase-publication approval. |
| 14 WordPress-only IDs (`5070`, `5074`, `5079`, `5082`, `5129`, `5135`, `5137`, `5175`, `5177`, `5181`, `5183`, `5185`, `5187`, `5189`) | exclude | `review-required`; no corresponding App row is created. |
| App ID `1272` | retain as draft | Managed listing is explicitly `unlisted`. |
| App IDs `1255`, `1259` | retain as drafts | App-only draft records. |
| Areas | retain unchanged | The 44 primary-area rows are optional metadata, not a pre-cutover gate. Existing zero/multiple memberships are untouched. |
| Six fixed pages | retain unchanged | Canonical body/content projection has not been approved. |
| 241 App image rows / WordPress fixed-page media (357 source media) | retain unchanged | Object/media reconciliation and an image-publication target are not approved. |

The output's before/after public target count is therefore `0/0` for shops,
areas, pages, and images. Existing WordPress public routes remain the serving
source until a separately approved cutover has a reconciled explicit target
list.

## Safe execution plan

1. Generate a label-specific manifest, for example:

   ```sh
   PUBLICATION_MANIFEST_OUTPUT_LABEL=20261019-publication-manifest-v2 \
     npm --prefix headless run supabase:prepare-publication-manifest
   ```

2. Run the generated `*.preflight.sql` only against the intended, approved
   environment. It starts `BEGIN READ ONLY`, asserts the retained drafts and
   exclusions, and commits without DML.
3. If a later publication is approved, create a new manifest with an explicit
   reviewed target list and a separately reviewed apply migration. Do not edit
   the zero-target manifest into an apply script.
4. Run the generated `*.restore.sql` after any future operation as a
   non-destructive verification of the retained exclusions. It is deliberately
   read-only; no broad rollback, storage deletion, or restoration command is
   present here.

## Local verification

`test:supabase-publication-manifest-local-rehearsal` seeds only a transaction
in the existing local fixture, runs the caller-mode preflight and restore
verification, and rolls the entire transaction back. It verifies the exact
379 candidate drafts, the 14 absent review-required rows, the unlisted and
App-only drafts, and the 241-row image inventory. It never applies the
generated script to a cloud database.

The manifest intentionally makes no assertion about global public counts in a
shared local fixture; its contract is scoped to the reconciled future
cutover-target inventory. This prevents unrelated fixture content from being
misrepresented as production publication evidence.
