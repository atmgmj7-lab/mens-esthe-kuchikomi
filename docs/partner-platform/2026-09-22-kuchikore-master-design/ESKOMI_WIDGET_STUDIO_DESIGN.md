# Eskomi Widget Studio Design

## Purpose

An optional installation workspace for a Partner’s own website. It is a diagnostic and guidance layer over the existing Widget, not a new review database or public ranking module.

## P1_AFTER_P1 layout

```text
Desktop: preview (left) | installation status and snippet (right)
Mobile: status → preview → copy → install checklist
```

| Element | Source | Behavior |
|---|---|---|
| Eligibility status | existing widget resolver | only active `shop_website` + eligible Partner state |
| Preview | existing noindex iframe route | public read-only, no credentials |
| Snippet | existing safe builder | correct Widget URL, shop title, lazy loading, responsive inline minimum style |
| Install checklist | documentation / client-safe state | correct shop → copy → place → mobile confirmation |
| Review summary | existing public adapter | `<3`: count only; `>=3`: permitted average + count |
| Diagnostics | future event model | never infer installed from an external page without an explicit safe verification design |

## Non-negotiable guardrails

- Widget must not expose private workspace ID, membership, contact information, service credentials, or review bodies.
- Pending, rejected, and spam reviews never appear.
- Do not choose only high ratings. Aggregate threshold remains the same as normal public review contract.
- Badge uses the approved asset when available; the present text fallback is not a reason to invent an asset path.

## Error states

Invalid or inactive campaign, wrong canonical shop, unavailable public review data, or malformed token resolve as unavailable / not found without a diagnostic data leak.
