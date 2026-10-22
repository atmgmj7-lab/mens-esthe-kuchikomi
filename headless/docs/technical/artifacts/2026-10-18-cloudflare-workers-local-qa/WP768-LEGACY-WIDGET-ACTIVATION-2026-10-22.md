# WP768 Mrs.Rank UP limited activation — 2026-10-22

## Scope

Only the existing Mrs.Rank UP legacy identity was enabled:

- WP ID `768`
- app shop ID `626dc77d-bcd3-495d-9ee3-3590e52253ac`
- existing workspace `39a6aa44-deef-4667-8a04-1ccf23696b43`

No membership, administrator, review, Auth, Storage, Mail, collector, DNS,
custom-domain, or Worker-secret change was made.  No Worker deployment was
needed; the already-deployed workers.dev preview reads the newly active widget
through the anonymous public reader.

## Applied database record

- Source migration: `20261022032437_eskomi_wp768_legacy_widget_activation.sql`
- Source SHA-256: `192c95278f9944410ac2d463bd77e0b2b39e0ba03f54f90bc37faf9792a3b472`
- Remote migration history: `20261022032701 eskomi_wp768_legacy_widget_activation`

The migration locks the exact shop/workspace, refuses partial or conflicting
state, and uses this order:

1. create the legacy managed projection while it remains unlisted;
2. bind it to the exact app shop through the audited legacy RPC;
3. publish its reviewed legacy revision without invoking canonical app sync;
4. map the existing workspace and retain its legacy alias;
5. let the single existing owner create the one active widget setting.

Publishing after the unlisted bind is deliberate: canonical sync would update
the established `app.shops` projection.  The migration compares the app public
record and all area relations before/after, and aborts the transaction if they
change.

## Post-apply checks

- Target managed projection/revision/publication/approval audit: `1/1/1/1`.
- Legacy alias: `1`; workspace is canonical with its original app UUID and no
  remaining WP ID.
- Widget: one active revision-1 handle for the target; published reviews: `0`.
- Published shops remain `379`; the other managed projection remains unbound.
- Target `app.shops` name/status/path and its two non-primary area relations are
  unchanged.
- Anonymous role can execute only `api.get_public_review_widget_v11`; it cannot
  select widget-settings or review-publication tables.  The API remains
  `SECURITY DEFINER` with safe search path.

## Verification

- `docker exec -i eskomi-v11-partner-db-22359-18192 psql ... < supabase/tests/verify_eskomi_wp768_legacy_widget_activation.sql`
  passed and rolled back its synthetic fixture.  It proves the exact ordering
  preserves existing app content and area relations while yielding a zero-review
  widget.
- `npm run test:eskomi-public-widget-reader` passed.
- `https://eskomi-workers-prep.eskomi.workers.dev/partner/widget/363f6c05-0349-4c7c-b481-aba32040bdfe/`
  returned HTTP `200`, `X-Robots-Tag: noindex, nofollow`, the expected store
  name, and the zero-public-review message.  No fixture marker or privileged
  role marker was present.
- The existing preview store detail also returned HTTP `200`, `noindex`, and
  the same public store name.

The Worker runtime validation is workers.dev-preview-only.  Existing production
domain routing and the remaining Auth/Storage/Mail/collector/therapist/
other-store onboarding gates are unchanged.
