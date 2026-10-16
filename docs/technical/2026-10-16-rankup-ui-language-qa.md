# RANKUP-UI-LANGUAGE-QA-01

## Purpose

Keep Eskomi's existing ivory dashboard treatment while making analytics text legible. This change is limited to the Analytics Dashboard's existing CSS module; it does not alter data, routes, cards, logos, typography scale, column counts, WordPress, Supabase, authentication, plans, or pricing.

## Root cause

`headless/app/dashboard/analytics/AnalyticsDashboardView.module.css` was written for a dark shell but is rendered inside the ivory Dashboard Shell (`#f7f4ee`). Its page text, eyebrow, explanatory text, non-selected filter links, section headings, and details disclosure therefore used pale blue values on a light surface.

## Implementation

- Use the established dashboard ink and navy palette for page text, headings, explanatory copy, filter links, and the details disclosure.
- Preserve selected tabs as white text on navy; add distinct hover, visible keyboard focus, and disabled appearances for filter links.
- Keep editorial headings in the existing serif treatment while rendering dashboard dates, KPI values, table numbers, and comparison values in the dashboard sans-serif stack with tabular figures and stable line height. KPI figures do not wrap mid-number.
- Keep metric inputs as decimal ratios and label percentage deltas in percentage points (`pt`), without changing collection or calculations.
- Leave KPI card and table layout unchanged.
- Lock the sRGB contrast rule in `headless/tests/analytics/dashboard-ui.test.mjs`: ordinary text and state labels are at least 4.5:1, and the focus indicator is at least 3:1.

## Evidence

- Production desktop inspection showed the pre-change Analytics Snapshot label (`#91bfc2`), non-selected tabs (`#cbd8e3`), GA4 section heading (`#dbe6ee`), and notice disclosure (`#b8c9d6`) on the ivory surface.
- Production desktop inspection of the public top page, dashboard shop list, and dashboard shop detail found the established dark ink/navy treatment rather than this residual dark-theme module palette.
- A dedicated in-memory fixture rendered the production `AnalyticsDashboardView` and its CSS module (not a loading/503 route) at 1440px and 390px. The resulting visual evidence is saved at `headless/docs/technical/artifacts/analytics-qa-desktop-1440.png` and `headless/docs/technical/artifacts/analytics-qa-mobile-390.png`.

## Latest release-gate record

- **Target SHA:** `dafc7a99b81801480042531a056bdc2f034b7f57` (`fix(analytics): improve numeric readability`), prior to the documentation-only correction in this artifact.
- **Started:** `2026-10-16T14:00:53Z` (UTC).
- **Command:** `npm run lint && npm run typecheck && npm run build && npm test` from `headless/`.
- **Result:** exit `0`. ESLint, TypeScript checking, the complete `npm test` serial gate (including `test:wp-origin-tls`), and `next build` passed. The production build generated **889/889** static pages.
- **Configuration diagnostic:** the prebuild-only local Supabase RPC diagnostic reported `NOT_READY` because `.env.local` is absent. It neither injected secrets nor failed the build/test gates.
- **Focused analytics evidence:** at `2026-10-16T14:02:29Z`, `node --test tests/analytics/dashboard-ui.test.mjs tests/analytics/dashboard-ui-render.test.mjs` exited `0` with **11/11** passing. They cover zero, grouped large counts, decimal percentages, negative values, and percentage-point deltas; independent review approved the same target SHA.

## Historical observations (not release-gate results)

- An earlier local build record that reported `72/72` routes was superseded by the current 889-page build above.
- An earlier browser-layout experiment used network-isolated fallback fixtures and reported unrelated public card/review mismatches. It is not a failure of the current release gate and is not used to claim public production QA.

## Post-merge release and same-SHA QA procedure

1. The parent reviewer records the final `main` SHA after merging PR #27. Do not substitute the feature-branch SHA when the merge creates a new commit.
2. Because this change is under `headless/`, verify the `Deploy Headless to Vercel` GitHub Actions run triggered by that `main` SHA. The WordPress/XServer workflow ignores `headless/**`, so it is not expected to deploy for this change.
3. The workflow performs its own lint, critical WordPress-origin preflight, build, remote Vercel deployment, and exact-deployment QA. Confirm its `expected Git SHA` and `verified deployment SHA` both equal the recorded `main` SHA, with `exact QA: PASS`.
4. The workflow deliberately uses `--skip-domain` and records `promotion: NOT_PROMOTED`. It does not change the public custom-domain/DNS mapping. Treat any later promotion or domain action as a separate approved operation.
5. Only after an approved promotion, run public QA against the promoted target: Analytics Dashboard desktop and 390px layout; non-selected/selected/hover/focus/disabled filter states; 200 response; no accidental `noindex`; and unchanged public shop/area routes. Record the tested URL, timestamp, and exact deployed SHA.
6. If exact SHA verification, public QA, or accessibility contrast fails, stop promotion and require a rollback decision; do not deploy a different commit as a substitute.

## Known verification limits

- The browser environment blocks localhost (`ERR_BLOCKED_BY_CLIENT`), and local analytics lacks its data configuration, returning 503. A changed local-browser screenshot cannot be captured here.
- The controlled browser viewport override did not take effect in the connected desktop browser; the headless run above supplies mobile-width coverage instead.
- No production deployment or production data change has been performed. This artifact accompanies the reviewable branch change only.
