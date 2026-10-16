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
- Focused analytics test: 6/6 passed after the change.
- Numeric-display regression tests cover zero, grouped large counts, decimal percentages, negative values, and percentage-point deltas; Analytics UI tests and render tests pass 11/11.
- `npm run lint`, `npm run typecheck`, and `npm run build` passed. The build generated 72/72 routes; network-isolated WordPress reads used their existing fallbacks.
- The existing headless browser layout run visited Analytics Dashboard at 1440, 1280, 1024, 768, 500, 390, 375, 320, responsive boundaries, and phone landscape. Its aggregate result is not a pass: network-isolated WordPress fallback data causes unrelated public card/review fixture mismatches (6,001 assertions).
- A dedicated in-memory fixture rendered the production `AnalyticsDashboardView` and its CSS module (not a loading/503 route) at 1440px and 390px. The resulting visual evidence is saved at `headless/docs/technical/artifacts/analytics-qa-desktop-1440.png` and `headless/docs/technical/artifacts/analytics-qa-mobile-390.png`.

## Known verification limits

- The browser environment blocks localhost (`ERR_BLOCKED_BY_CLIENT`), and local analytics lacks its data configuration, returning 503. A changed local-browser screenshot cannot be captured here.
- The broad `npm test` suite stops in the pre-existing external `test:wp-origin-tls` preflight with `UNCLASSIFIED`; it does not reach a CSS regression failure. No retry is appropriate without the required TLS environment.
- The controlled browser viewport override did not take effect in the connected desktop browser; the headless run above supplies mobile-width coverage instead.
- No production deployment or production data change has been performed. This artifact accompanies the reviewable branch change only.
