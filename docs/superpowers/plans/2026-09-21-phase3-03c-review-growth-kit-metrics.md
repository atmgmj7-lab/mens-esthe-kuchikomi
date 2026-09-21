# Phase 3 03C — Review Growth Kit / Metrics

Task: `ESKOMI-PHASE3-03C-REVIEW-GROWTH-KIT-METRICS-01`

## Scope

- Add the private Partner `/partner/` Growth Kit: canonical review URL, QR download, neutral LINE text, and fixed Website CTA snippet.
- Show existing Native Review `submitted` / `pending` / `published` counts and existing Phase 2 per-channel `open` / `conversion` counts.
- Reuse only `get_partner_review_growth_metrics`, the existing Campaign model, and the 03A Auth → membership / 03B identity boundary.

## Fail-closed data boundary

1. Validate auth and active membership first.
2. Resolve and exactly match the canonical workspace/shop identity.
3. Fetch metrics only for that authorized workspace via the existing server-only repository.
4. Reject workspace/shop mismatches. Project only URLs, fixed copy, and aggregate counts; do not return raw reviews, reviewer data, moderation material, or internal campaign data.
5. Mark missing metrics as unavailable; do not fabricate zero values.

## Exclusions

- No database migration, public endpoint, widget/iframe, review form redesign, AI, public SEO/canonical/sitemap change, WordPress write, push, deploy, or production operation.

## Verification

- RED/GREEN resolver contract covers own workspace, cross-workspace/shop rejection, canonical QR/URLs, neutral text, fixed safe CTA, existing metrics, no-data, and privacy projection.
- Fresh production-mode browser QA covers Partner A Growth Kit, copy actions, responsive widths, private headers, and Partner B workspace manipulation denial before metrics lookup.
- Run 03A, 03B, Phase 2 review/campaign, local Supabase, full suite, type, lint, build, diff, and security scans before acceptance.
