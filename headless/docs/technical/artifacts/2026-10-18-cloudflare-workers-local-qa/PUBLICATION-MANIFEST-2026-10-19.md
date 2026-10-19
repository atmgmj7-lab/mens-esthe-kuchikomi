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

For isolated QA only, the repository can construct an in-memory
`approved-local-fixture` document. It must exactly match the proposal ID and
SHA-256 and requires three transaction-local settings (fixture mode, approval
ID, and proposal hash). Without them it fails closed. The fixture rehearsal
then proves initial application, a no-op re-run, conditional restore, and an
outer `ROLLBACK`; it never creates an approved production manifest.

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

- The 14 WordPress-only shop IDs pending a publication decision remain outside
  `app.shops`; they are not "review" records.
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
