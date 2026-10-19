# Proposed publication manifest — 2026-10-19

## Status

This is a **proposal**, not an approved migration or an apply instruction.
It describes the concrete current public URL corpus recovered from the reviewed
WordPress public-read-only snapshot (`394` shops, response date 2026-10-19).
The generator records `state: proposed` and `approval: not-approved`.

The generated `*.proposed.apply-blocked.sql` cannot mutate data: it requires
an exact operator approval token and then raises an intentional exception.  A
separately reviewed, component-specific approved manifest is required before
any future `UPDATE`, content import, or image state change can exist.

## Proposed public targets

| Component | Concrete target source | Count | Proposed action | Apply status |
| --- | --- | ---: | --- | --- |
| Shops | Exact `candidateWpIds` from `20261019-primary-area-delta.plan.json` | 379 | `draft` → candidate for published projection | blocked |
| Areas | Exact 34 `wp_term_id` values in the reviewed corpus dry-run | 34 | candidate for `is_published=true` | blocked |
| Fixed pages | `/contact/`, `/about/`, `/sitemap/`, `/storelisting/`, `/advertise/`, `/osaka-nihonbashi/` | 6 | require a separately reconciled page-content projection | blocked |
| Shop images | Exact 241 `wp_media_id` values in the approved image dry-run manifest | 241 | candidate for `is_public=true` only after row/URL reconciliation | blocked |

The generator intentionally reads these reviewed artifacts rather than using a
numeric range. It fails if the snapshot no longer has 379 shops, 34 areas, or
241 image targets.

## Strict exclusions

- The 14 review-required WordPress-only shop IDs remain outside `app.shops`.
- Managed-unlisted WordPress ID `1272` remains draft and is excluded.
- Supabase-only hot-spring draft IDs `1255` and `1259` remain draft.
- Fixed-page media ID `357` is never treated as a shop image.
- The public directory RPC continues to exclude every managed shop whose
  operator state is not `published`, so deleted/unlisted identities cannot be
  reintroduced by a broad candidate list.

## Verification boundary

The generated preflight is read-only and verifies the exact shop, area, and
image target IDs plus the exclusions. It does **not** publish pages or infer a
primary area. A local rollback-only rehearsal passed; no production database,
Storage, DNS, or Cloudflare resource was accessed.

Run the proposal generator only to create a new local artifact label:

```bash
cd headless
PUBLICATION_MANIFEST_OUTPUT_LABEL=20261019-publication-manifest-v3 \
  node scripts/prepare-supabase-publication-manifest.mjs
```
