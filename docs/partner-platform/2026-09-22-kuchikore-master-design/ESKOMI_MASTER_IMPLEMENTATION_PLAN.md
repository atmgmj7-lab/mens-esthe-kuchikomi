# Eskomi Partner Platform — Master Implementation Plan

状態: design-only。各taskは別の明示実行指示、local validation、review、local commitを必要とする。Production write / push / deploy / invitation / campaign creationはこの計画では行わない。

## Dependency map

```text
GROWTH-01 Action model + Home IA
  ├─ GROWTH-02 Growth Center readiness
  ├─ GROWTH-03 Operator Inbox separation
  └─ GROWTH-04 Widget Studio
GROWTH-02 + real Pilot events → GROWTH-05 Analytics Action Center
GROWTH-01 → GROWTH-06 Onboarding
GROWTH-05 + Pilot evidence → GROWTH-07 Reports
GROWTH-07 + approved tenancy model → GROWTH-08 Multi-shop / roles
GROWTH-08 + separate source contracts → GROWTH-09 Therapist extensions
```

## GROWTH-01 — Action-first Partner Home (P0_NOW)

- **Dependency:** existing Partner Dashboard v1, workspace authorization, Growth Kit projection.
- **Candidate files:** `headless/app/partner/page.tsx`, `headless/lib/partner/partner-dashboard.ts`, `headless/lib/partner/partner-review-growth-kit.ts`, `headless/scripts/check-partner-dashboard-shell*.mjs`.
- **RED test:** state/campaign combinations produce exactly one safe action; unauthorized workspace returns no projection; unavailable asset is never rendered as a URL or zero KPI.
- **Implementation:** reorder existing data into Context → Action Required → Performance → Collect Reviews → Recent Activity. Do not add a new schema or CMS editor.
- **Validation:** focused contracts, protected-route browser QA at desktop/mobile, typecheck, lint, build.
- **Review:** product contract, A/B isolation, public SEO unaffected, accessibility/empty-state review.
- **Commit:** one local commit after Critical 0 / Important 0.

## GROWTH-02 — Review Growth Center readiness (P0_NOW)

- **Dependency:** GROWTH-01; existing four campaign channels and canonical routes.
- **Candidate files:** `headless/app/partner/page.tsx` or a new protected route, `headless/lib/partner/partner-review-growth-kit.ts`, `headless/components/partner/*`, focused browser contracts.
- **RED test:** QR, LINE, Website CTA, and Widget resolve only their intended active canonical campaign; cross-workspace asset never appears; unavailable state names one prerequisite.
- **Implementation:** asset cards, preview/copy/download states, neutral copy, explanatory lifecycle funnel. Reuse existing generated values.
- **Validation:** Growth Kit source/browser tests, local Supabase privilege contract, no-secret/PII scan.
- **Review:** neutral-review policy, no incentives, no partner-private data in markup.
- **Commit:** one local commit.

## GROWTH-03 — Operator Review Inbox (P1_AFTER_P1)

- **Dependency:** actual P1 moderation evidence; Native Review moderation APIs.
- **Candidate files:** `headless/app/dashboard/*`, `headless/components/dashboard/DashboardReviewModeration.tsx`, `headless/lib/supabase/review-native.ts`, focused moderation tests.
- **RED test:** only authorized operator sees queue/detail; every decision writes the existing audit event; Partner route cannot access review body/identity or decision controls.
- **Implementation:** pagination-first queue, status/date filters, read-only detail context, explicit audited decision rail. No AI auto-publish.
- **Validation:** repository/migration local contract, route authorization tests, browser QA, PII/log scan.
- **Review:** authorization, retention, moderation authority, mobile table strategy.
- **Commit:** one local commit.

## GROWTH-04 — Widget Studio (P1_AFTER_P1)

- **Dependency:** existing Widget v1 and actual install feedback.
- **Candidate files:** protected partner Widget route/UI, `headless/lib/partner/partner-review-widget.ts`, `headless/app/partner/widget/[token]/page.tsx`, widget tests/docs.
- **RED test:** preview/snippet ownership, noindex, no credential/private field, threshold behavior, unavailable/mismatch fail closed, mobile no overflow.
- **Implementation:** preview + snippet + optional install checklist; diagnostic wording only. Do not crawl a merchant site or claim install success without a separate approved verification design.
- **Validation:** Widget source/local-Supabase/browser tests, public Shop SEO regression.
- **Review:** public adapter reuse, token exposure, cache/revalidation, creative replacement point.
- **Commit:** one local commit.

## GROWTH-05 — Analytics Action Center (P1_AFTER_P1)

- **Dependency:** real event volume and metric definitions; GROWTH-01/02.
- **Candidate files:** new protected analytics projection/service and page; `partner-review-growth-kit` metrics types; test fixtures.
- **RED test:** metric source/grain/period are explicit; denominator-zero is not displayed as 0%; own workspace only; chart unavailable without data.
- **Implementation:** action rules and small funnel/campaign comparison. No charts in initial payload if summary can answer the decision.
- **Validation:** fixture calculations, authorization, loading/error/empty state browser QA, performance budget.
- **Review:** KPI dictionary, no MEO data, N+1/lazy load, accessibility.
- **Commit:** one local commit.

## GROWTH-06 — Guided Onboarding (P0_NOW)

- **Dependency:** GROWTH-01 and existing identity/login/membership flow.
- **Candidate files:** `headless/app/partner/login/*`, `headless/app/partner/page.tsx`, `headless/lib/partner/provisioning-service.ts`, onboarding contracts/docs.
- **RED test:** correct shop confirmation before asset use; wrong-shop route stops; inactive workspace has no public asset; no public data re-entry requirement.
- **Implementation:** first-run checklist and lifecycle explanation using existing state. No invite sending or state transition in this task.
- **Validation:** auth/membership/browser contract, copy/security review.
- **Review:** identity clarity, no data leakage, keyboard/mobile.
- **Commit:** one local commit.

## GROWTH-07 — Partner Reports (P2_AFTER_PILOT)

- **Dependency:** GROWTH-05 plus agreed reporting cadence and sufficient Pilot data.
- **Candidate files:** new protected report route/components/service projection/tests.
- **RED test:** month/timezone/period boundaries; missing data is not zero; aggregate only; export disabled until privacy requirements exist.
- **Implementation:** monthly review/campaign report with definitions and deltas.
- **Validation / review / commit:** focused calculations, accessibility, privacy, performance, then one local commit.

## GROWTH-08 — Multi-shop and roles (P2_AFTER_PILOT)

- **Dependency:** demonstrated multi-shop use case; separate membership/tenant design approval.
- **Candidate files:** Partner session, membership service/repository, protected UI, migrations only if approved.
- **RED test:** switcher cannot leak assets/metrics; role revocation immediately denies; audit records scope switch and role change.
- **Implementation:** explicit workspace switcher and scoped projection. Retain server-side authorization; do not rely on client-selected IDs.
- **Validation / review / commit:** local security/RLS contract, browser isolation matrix, migration review, one local commit.

## GROWTH-09 — Therapist and operational extensions (FUTURE)

- **Dependency:** separate canonical sources, consent/privacy, public-display contract, and Pilot evidence.
- **Candidate files:** to be designed; no reuse assumption across Shop Review and Therapist Review domains.
- **RED test:** separate identity and ownership model, no misleading aggregation, no cross-therapist leakage.
- **Implementation:** only after a distinct approved product contract.
- **Validation / review / commit:** dedicated plan required before code.

## Cross-cutting release gate

Every implementation unit runs focused RED/GREEN, relevant regression, typecheck, lint, build, changed-flow browser QA, `git diff --check`, secret/PII scan, SPEC review, and QUALITY/SECURITY review. `Critical = 0` and `Important = 0` are required. Push, production DB write, deploy, promotion, outreach, invitation, membership change, state transition, campaign creation, and secret change remain separately approved.
