# Eskomi REUSE / EXTEND / NEW / SKIP

| Capability | Eskomi current | Classification | Decision / boundary |
|---|---|---|---|
| Partner Auth | magic-link/session with protected `/partner/` | REUSE | Do not replace with competitor-style account system |
| Membership / workspace isolation | private membership, owner/manager, server authorization | REUSE | A/B isolation remains mandatory |
| Partner Dashboard v1 | identity, status, Growth Kit, metrics | EXTEND | Reorder for action-first Home; no CMS rewrite |
| Native Review | Supabase record of review lifecycle | REUSE | Remains system of record |
| Moderation | pending → approved / published authority | REUSE | No Partner auto-publish, reply or deletion rights |
| Growth Kit | QR, URL, LINE copy, Web CTA, Widget | EXTEND | Group assets and progress, retain campaign canonical validation |
| Campaign attribution | opaque token and per-channel metrics | REUSE | Never emit campaign credential beyond intended public URL |
| iframe Widget | noindex public summary / CTA | EXTEND | Add Studio diagnostics only after Pilot evidence |
| Review metrics | submitted/pending/published + campaign count | EXTEND | Define funnel and date axes; do not invent conversion rate if denominator unavailable |
| AI Review Assist | PII prefilter, structured output, HUMAN_REVIEW, fallback | REUSE | Customer-facing only; no rating/tag/fact modification |
| AI telemetry | token/cost telemetry, service-only RPC | REUSE | Aggregate operational telemetry only |
| Review Inbox | operator moderation exists; Partner aggregate only | EXTEND | Operator queue P1-after-Pilot; Partner read-only summary P0 |
| Action Center | no current first-class component | NEW | P0 minimal cards computed from existing state, no new schema initially |
| Reports | metrics exist but no Partner report page | NEW | P2 after data definitions and actual cadence evidence |
| Multi-shop switcher | single workspace session | NEW | P2; scope switch and membership audit mandatory |
| Roles beyond owner/manager | only owner/manager contract | SKIP for Pilot | Evaluate only after real multi-shop need |
| Customer email / LINE lists | not in Eskomi model | SKIP | PII and sending are out of scope |
| Survey builder / rating-steered incentives | not in Eskomi model | SKIP | No survey builder or rating/content-dependent reward; the neutral-review contract rejects steering |
| Review Coupon / Repeat Visit | no current Coupon domain | NEW later | `GROWTH-07`, only after initial Pilot; eligible review submission only, never rating/content/sentiment dependent |
| Coupon Campaign / Issuance / Redemption | no current private domain | NEW later | Separate private, server-authorized model; opaque token, one-time redemption, no customer account v1 |
| Native Reservation / Coupon wallet / SMS | not in Eskomi model | SKIP v1 | Reuse LINE/Web booking; Customer UUID, SMS, wallet, and reservation history need separate approval |
| GBP / ranks / Maps / MEO | deliberately absent | SKIP | Out of product scope |
| Therapist / schedule / newcomer | not yet in Partner model | FUTURE | Keep service boundaries independent of Review system |

## P0 / P1 / P2 / Future

- **P0_NOW:** action-first Home, asset grouping, campaign readiness / empty states, explicit onboarding checklist, safe aggregate review status.
- **P1_AFTER_INITIAL_PILOT:** `GROWTH-07` neutral Review Coupon / Repeat Visit design-to-implementation gate; Pilot evidence and separate approval required.
- **P1_AFTER_P1:** operator Review Inbox polish, Widget Studio diagnostics, Campaign performance trend only when data exists.
- **P2_AFTER_PILOT:** reports, multi-shop, role expansion, notification preferences.
- **FUTURE:** therapist, schedule, newcomer, shop/therapist performance; each needs separate source-of-truth and authority design.
