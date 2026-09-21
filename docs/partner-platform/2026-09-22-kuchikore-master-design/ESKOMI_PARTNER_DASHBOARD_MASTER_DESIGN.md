# Eskomi Partner Dashboard — Master Design

## Purpose

Within five seconds, the current workspace understands: (1) what is happening, (2) what to do next, and (3) how to collect a neutral review. This is not a second CMS.

## Dashboard IR

```yaml
page_purpose: guide the signed-in Partner to the highest-value safe next action
users: [owner, manager]
decisions: [share QR or LINE URL, install optional Widget, wait for moderation, request information correction]
filters: [workspace only; future date range after metrics definition]
kpi_cards: [published reviews, pending moderation, active acquisition assets]
charts: [none in P0; campaign funnel after enough events]
tables: [compact asset status; future campaign trend]
drilldowns: [Growth Center, Widget Studio, public Shop page]
empty_states: [no active campaign, no published review, no data in period]
data_requirements: [identity, workspace state, canonical campaign metrics, public review aggregate]
performance_notes: server projection; no private-table client access; lazy load future charts
review_checklist: [workspace isolation, no PII, no auto-publish, no SEO changes, keyboard/mobile]
```

## P0 layout

1. **Context bar:** shop name, Partner status, canonical public Shop link.
2. **Action Required:** one primary safe action based on current state; unavailable actions explain why.
3. **Review Performance:** submitted / pending / published, with pending explicitly not public.
4. **Collect Reviews:** QR, LINE, Website CTA, Widget; one click to preview/copy/install guide.
5. **Recent activity:** only workspace-safe aggregate events; no review body or customer identity.

Use a small Bento layout on desktop and a linear stack on mobile. The P0 page has no charts, ranking, configuration panels, or report builder.

## KPI definitions

| KPI | Definition | Source | Missing / zero behavior |
|---|---|---|---|
| Submitted | accepted review submissions for own workspace campaigns | Native Review attribution | `未準備` if campaign unavailable |
| Pending | submitted reviews not published | Native Review lifecycle | show as moderation wait, not failure |
| Published | approved public reviews | public adapter aggregate | 0 is valid only after active campaign confirmation |
| Active assets | canonical active QR / LINE / Website campaign availability | campaign metrics | unavailable is not 0 |

## States

- `normal_listing` / `shop_confirmed`: explain activation gate; do not show public assets.
- `free_official_partner` / `active_partner` without campaign: explain campaign readiness, never fabricate URL.
- active campaign with no reviews: show acquisition guidance, not a failed score.
- pending reviews: show neutral moderation wait; never promise publication.
