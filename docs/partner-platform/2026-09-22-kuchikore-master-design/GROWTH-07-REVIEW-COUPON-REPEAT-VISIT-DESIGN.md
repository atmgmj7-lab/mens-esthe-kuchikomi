# GROWTH-07 — Review Coupon / Repeat Visit Design

## Status and priority

`GROWTH-07` is a **design-only** future extension, classified as `P1_AFTER_INITIAL_PILOT`. It does not change the current Mrs.Rank UP Pilot, Auth/Membership technical unblock, P1 activation, or existing Review Growth implementation.

| Field | Decision |
| --- | --- |
| GROWTH_07_REGISTERED | `YES` |
| PRIORITY | `P1_AFTER_INITIAL_PILOT` |
| PILOT_BLOCKED_BY_COUPON | `NO` |
| GOOGLE_REVIEW_INTEGRATION | `0` |
| CUSTOMER_ACCOUNT_V1 | `NO` |
| NATIVE_RESERVATION_V1 | `NO` |
| TENANT_MODEL_REUSED | `YES` |
| PRODUCTION_CHANGE | `0` |

## Product classification

| Classification | Decision |
| --- | --- |
| REUSE | Partner Workspace, Partner Auth, Membership, Supabase Native Review, Review Campaign / Attribution, QR, LINE URL, Website CTA, Widget, AI Assist, and human Moderation |
| EXTEND | campaign concepts, Partner Dashboard, Operator Control Center, and deterministic analytics/events |
| NEW later | Coupon Campaign, Coupon Issuance, Coupon Redemption |
| SKIP v1 | Native Reservation, Customer Account, SMS authentication, Coupon Wallet, and complex CRM |
| permanently out of scope | Google Review, Google Maps Review, GBP, MEO, Google Review induction, and Google Review coupons |

## Neutral-review incentive contract

Coupon eligibility has one permitted condition only: an eligible Eskomi review was submitted. It must not accept rating, tag, sentiment, wording, or a favorable/negative classification as an input.

| Scenario | Eligibility |
| --- | --- |
| ★1 review | same eligible outcome as every other eligible review |
| ★5 review | same eligible outcome as every other eligible review |
| negative review | eligible |
| positive review | eligible |
| `★5で500円OFF` | reject |
| `良い口コミで1000円OFF` | reject |
| `満足した人だけCoupon` | reject |
| `高評価の場合だけ発行` | reject |

The future configuration/service boundary must make rating-dependent discounting structurally impossible: the eligibility evaluator receives a review eligibility state, never review rating/body/tags/sentiment. Moderation remains Eskomi-controlled; a Partner cannot suppress only low-rated reviews.

Allowed customer-facing concept: 「Eskomiへ率直な口コミを投稿すると、次回来店で使える500円OFFクーポン」. Any future UI/terms must make the neutral condition and data-use limits clear.

## Future flow and tenant boundary

```text
eligible Eskomi Review
  → Coupon Issuance
  → opaque coupon token
  → /c/{opaque-token}/
  → LINE / Web booking click or in-store presentation
  → one Redemption
```

- A public coupon URL never contains a phone number, email, customer ID, raw review ID, or private workspace ID.
- The server resolves the opaque token and validates the owning Partner Workspace. Partner A cannot read, redeem, or manage Partner B's coupon or issuance.
- Coupon v1 does not require a customer account, phone number, SMS, native reservation engine, or wallet.
- Booking reuses the existing `shop_line` and `shop_booking_url` paths. At most, future metrics record an attributed booking click; they do not create a reservation.

## Future data and service contract

All Coupon operational data remains in Supabase `private` and is accessed through server-side authorization and membership validation. No Coupon, Customer, Issuance, or Redemption table becomes a direct authenticated-browser data source.

```text
Partner Workspace
├─ Review Campaign                 (existing)
├─ Coupon Campaign                 (new later)
├─ Coupon Issuance                 (new later)
└─ Coupon Redemption               (new later)
```

| Concept | Future minimum fields | Boundary |
| --- | --- | --- |
| Coupon Campaign | `workspace_id`, title, discount type/value, visit type, course rule, minimum amount/duration, expiry rule, combinable, per-customer and issuance limits, status | immutable workspace ownership; never has a rating rule |
| Coupon Issuance | ID, coupon campaign ID, review ID, opaque token, issued/expiry timestamps, status | review reference remains private; public route accepts only opaque token |
| Coupon Redemption | issuance ID, redeemed timestamp, optional course reference, status | one controlled status transition; duplicate redemption denies |
| Future customer | `customer_id` UUID as canonical identity | phone is optional personal-data attribute, never primary key |

Course v1 is deliberately narrow: all courses, a named course, minimum minutes, or minimum amount. A formal Course entity waits for an independent course-normalization contract.

## Partner and Operator projections

Future Partner route: `/partner/coupons/` or an equivalent protected route. It may project only the signed-in workspace's coupon name, neutral conditions, status, issuance limit, aggregate issuance/display/booking-click/redemption metrics, and safe asset guidance.

Operators may audit campaigns, status, issuance, redemption, abuse, and revocation across workspaces through a separate authorized Operator projection. The Partner route must never receive another workspace's issuance, redemption, customer, review body, moderation, or audit detail.

### Future Dashboard IR

```yaml
page_purpose: configure and understand a neutral repeat-visit Coupon after Pilot evidence exists
users: [partner owner, partner manager]
decisions: [activate, pause, revoke, share booking path, investigate deterministic availability state]
filters: [own workspace, coupon campaign, explicit period only after its metric definition]
kpi_cards: [issued, displayed, attributed booking clicks, redeemed]
charts: [none until data volume and period definitions are approved]
tables: [own coupon campaign status and aggregate activity]
drilldowns: [coupon conditions, safe public preview, Operator support path]
empty_states: [no active coupon, no eligible review, no data in period, expired, revoked]
data_requirements: [workspace membership, coupon state, issuance/redemption status, attributed click events]
performance_notes: server projection, aggregate-first, no customer rows in initial Partner payload
review_checklist: [neutral eligibility, tenant isolation, opaque token, privacy, accessibility]
```

| Future metric | Definition | Missing-data behavior |
| --- | --- | --- |
| issued | count of successful Coupon Issuances in an explicit period/workspace | `対象期間に発行なし`; never substitute an undefined period with zero |
| displayed | count of safe coupon-page display events, if an approved event definition exists | `未連携` until event contract exists |
| booking click | count of attributed LINE/Web booking clicks, if recorded | `未連携` until attribution contract exists |
| redeemed | count of valid one-time Redemptions in an explicit period/workspace | `対象期間に利用なし`; do not infer repeat visits |

## Privacy and terms contract

Future Coupon terms/UI must state that conditions never depend on review rating or content; customer data is used only for displayed purposes; unauthorized third-party sharing and marketing-list reuse are forbidden; staff access is minimal; unnecessary personal data is deleted appropriately; and moderation remains Eskomi-controlled.

If later collected, phone, email, or any other customer data is personal data. Hashing/HMAC does not remove that classification. Future collection requires purpose limitation, minimal access, retention/deletion support, no raw phone in analytics, and a separate security/privacy approval.

`incentive_context` may later preserve a trace value such as `none` or `coupon` for review traceability. It must not automatically change public review text, rating, tags, ranking, or review-score logic.

## Future acceptance contract

When implementation is separately approved, focused RED/GREEN and relevant regression must prove:

1. ★1, ★5, negative, and positive eligible reviews receive identical coupon eligibility.
2. Rating-dependent discount configuration is impossible at the service boundary.
3. Duplicate redemption, expired token, and revoked coupon are denied.
4. Partner A access to Partner B Coupon/Issuance/Redemption is denied.
5. Opaque coupon URLs and pages expose zero PII/private IDs; analytics contains zero raw phone data.
6. Google Review/Maps/GBP/MEO integration count remains zero.
7. Existing review body/rating/tag, moderation, public SEO, and Partner isolation contracts remain unchanged.

No schema migration, coupon table, coupon issuance, customer-data collection, Partner enablement, deploy, or Production change is performed by this design addendum.
