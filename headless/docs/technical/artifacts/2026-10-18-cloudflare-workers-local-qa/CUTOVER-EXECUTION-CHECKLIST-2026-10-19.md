# Cloudflare / Supabase primary cutover execution checklist

## Fixed boundary

- No production database, Storage, DNS, Cloudflare deployment, secret, OAuth,
  role, or billing change has been made by this QA work.
- The local Workers-primary HTTP transport remains unresolved **in this test
  composition**. A Workerd-resolvable non-production HTTPS hostname is one
  candidate way to test it; it is not asserted to be the only solution.
- Do not retry or expand the current local transport fixture without a new,
  explicit test-design decision.

## Before any Cloudflare deployment

- [ ] Obtain explicit approval for the named public-directory RPC migration and
  its production execution. The current repository work is only local QA.
- [ ] Create a production backup limited to the rows/files in the approved
  change set; record batch ID, row counts, checksums, and restore predicates.
- [ ] Verify the backup/restore rehearsal changes only the approved shops,
  areas, fixed-page content/media mapping, and image rows. No broad restore,
  schema reset, bucket deletion, or WordPress source deletion is allowed.
- [ ] Confirm which already-authorized Cloudflare account/authentication may be
  used. Do not request or create a new API token, DNS record, secret, or role
  without user approval.
- [ ] If a runtime secret is needed, have the user enter it directly in the
  approved Cloudflare/Supabase UI or secret mechanism. Do not paste it into
  chat, source control, logs, or a fixture command.

## Publication proposal versus approval

- [ ] Treat proposal v4 as an inventory, not approval:
  `20261019-publication-manifest-v4`, SHA-256
  `b0ff37c97d707221b706796ed75c813233831b19ca772d704c4958dfe56f1955`.
- [ ] Its target inventory is 379 shops, 34 areas, 6 fixed routes, and 241
  shop-image media IDs. It remains `not-approved` / `blocked`.
- [ ] The local-fixture approval implementation is test-only; do not promote
  its approval ID or SQL to production.
- [ ] Keep 14 WordPress-only shops outside `app.shops` until a publication
  decision is approved. They are not review records.
- [ ] Preserve managed-unlisted `1272` and draft `1255`/`1259` exclusions.

## Fixed-page media 357

- [ ] Retain the preserved source object and SHA-256 from the fixed-page media
  preparation record.
- [ ] Confirm public-image copy authorization specifically includes media 357.
- [ ] Upload with no overwrite, then verify public readback status, PNG MIME,
  byte count, and SHA-256 before changing a page reference.
- [ ] Record a dedicated fixed-page import batch and make the page-reference
  update conditional on the original WordPress URL still being present.
- [ ] Do not treat 357 as one of the 241 `app.shop_images` rows.

## Required post-RPC, real-Cloudflare-host QA

- [ ] Deploy only after explicit deployment approval; record deployed commit
  SHA and Worker version.
- [ ] From the intended Cloudflare hostname, verify `/`, `/shops/`, published
  shop detail, area list, `/column/`, all six fixed routes, and `/sitemap.xml`.
- [ ] Verify the primary directory uses the approved RPC and has no WordPress
  fallback in primary mode; capture request-level API counts separately from
  SQL counts.
- [ ] Confirm public reviews render only approved content in `/reviews/`, shop
  detail, and partner widget; private markers must not appear.
- [ ] After a controlled listing withdrawal, verify detail `404`, listing
  omission, and sitemap omission.
- [ ] Verify media 357’s fixed-page rendering only after its dedicated mapping
  batch/readback check succeeds.
- [ ] Preserve a redacted HTTP/Worker log, sitemap snapshot, RPC/API metrics,
  and restore-verification report as release evidence.

## Current completion / remaining work

Completed locally: proposal inventory, local-fixture-only fail-closed apply
rehearsal, idempotence/conditional restore/rollback proof, ordinary Workers
review and unlisting HTTP evidence, and static/type/lint checks.

Remaining: explicit production RPC approval, bounded backup/restore approval,
fixed-page media 357 copy/mapping approval, publication approval, any required
user-entered runtime secrets, Cloudflare deployment approval, and real-host
post-deploy QA. None is authorized by this checklist.
