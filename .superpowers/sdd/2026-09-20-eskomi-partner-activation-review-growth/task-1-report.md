# Task 1 report: Private approval and campaign transaction

## Scope and boundary

- Base release reviewed: `484caee958942b26f12628212d95bfd01f8e6be8`.
- The existing Foundation migration `20260919000000_free_partner_foundation.sql` is unchanged.
- New ordered migration: `20260920000000_partner_review_growth.sql`.
- No remote Supabase action, production write, environment/secret change, push, deploy, public review route, or dashboard UI change was performed.

## Implemented contract

- Added an audited operator decision transaction for received/under-review registrations. Approval moves only `shop_confirmed` to `free_official_partner`, creates exactly one campaign for each required channel, and records exactly one state-history transition. Rejected registrations remain `shop_confirmed` and create no campaigns. Repeating the same decision is idempotent.
- Added `private.partner_review_campaigns` and immutable `private.partner_review_campaign_submissions`. Campaign tokens are opaque UUIDs. Conversion events contain only the campaign relation, WordPress review ID, and timestamp; they hold no contact, review-body, or payload field. A WordPress review ID can be converted once only.
- Added service-role-only `api.review_partner_registration`, `api.list_partner_registration_reviews`, `api.open_partner_review_campaign`, and `api.record_partner_review_campaign_submission` adapters. Browser roles have no private-schema/table/RPC privilege. Active token resolution returns only canonical shop identity fields; conversion additionally checks the canonical WordPress shop ID.
- Added server-only repository/service types and methods: `PartnerRegistrationReview`, `PartnerReviewCampaign`, list/decision, active token resolution, and conversion recording.

## TDD evidence

- RED: `npm run test:partner-review-growth` exited 1 before implementation because `supabase/migrations/20260920000000_partner_review_growth.sql` did not exist.
- GREEN: the same source contract passes after implementation.
- The local SQL contract executes inside one rolled-back transaction and checks browser denial, valid approval, same-decision retry, rejection without activation, four unique channels, inactive resolution denial, duplicate conversion denial, and the no-PII event shape.

## Local verification

All commands below passed after a local-only `supabase start` followed by `supabase db reset`:

```text
cd headless && npm run test:partner-review-growth
cd headless && npm run test:partner-review-growth-local-supabase
cd headless && npm run test:free-partner-foundation
cd headless && npm run test:free-partner-local-supabase
cd headless && npm run typecheck
cd headless && npm run lint -- --quiet
supabase db lint --local
git diff --check
```

`npm ci --ignore-scripts` was needed only because the local `node_modules` directory was absent; it did not change tracked dependency files. Its advisory output reported pre-existing package audit findings (1 moderate, 2 high); no dependency upgrade was made in this task.

## Remaining verification boundary

Local migration application and local Supabase behavior are verified. Installed production Supabase migration state, remote privileges, WordPress review creation/identity, public campaign routing, dashboard authorization/UI, QR rendering, deployment, and production behavior are **NOT_VERIFIED** and remain outside Task 1.
