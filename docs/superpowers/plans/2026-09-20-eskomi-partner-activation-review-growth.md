# Eskomi Partner Activation Review Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the accepted Free Official Partner foundation with an audited operator decision, private review campaigns, and low-friction acquisition links that reuse the existing review flow.

**Architecture:** A second ordered Supabase migration extends the existing private Partner control plane. A single service-role decision RPC changes a reviewed submission and, on approval, ensures the four campaign channels in the same transaction. Server-only adapters feed the protected operator dashboard; a noindex public route resolves a token and redirects to the existing prefilled review form, whose submit API independently validates campaign/shop identity before recording a successful WordPress-backed submission.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/PostgreSQL private schema with `api` service-role-only adapters, WordPress review submission, small server-side SVG QR dependency.

**Spec:** `docs/superpowers/specs/2026-09-19-eskomi-free-official-partner-foundation-design.md` (extended in Task 3)

## Global Constraints

- Preserve WordPress as public canonical data source; do not change shop URLs, SEO metadata/schema, sitemap, public shop pages, review moderation, or public data stores.
- Apply no remote migration, write, secret/environment change, push, deploy, promotion, or other production action.
- Keep Partner data in `private`; `anon`, `authenticated`, and public callers receive no table/RPC privileges. Service-role access remains server-only.
- Use existing Partner states only: `normal_listing -> shop_confirmed -> free_official_partner -> active_partner`.
- Approval/rejection is retry-safe and audited. Approval must atomically ensure `counter_qr`, `line_after_visit`, `shop_website`, and `eskomi_shop_page` campaigns without duplicate state history or campaigns.
- Campaign tokens are opaque and stable; public campaign routes are noindex and only reach `/reviews/submit/` with its canonical shop prefilled.
- Neutral public copy only: `率直な口コミにご協力ください`. Never request ratings, positive reviews, or incentives.
- QR rendering must be server-side/admin-only; do not add a normal-public-shop-page bundle dependency.

---

### Task 1: Private approval and campaign transaction

**Files:**
- Create: `supabase/migrations/20260920000000_partner_review_growth.sql`
- Create: `supabase/tests/verify_partner_review_growth.sql`
- Modify: `headless/lib/partner/provisioning-service.ts`
- Modify: `headless/lib/supabase/partner-workspace.ts`
- Create: `headless/scripts/check-partner-review-growth.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Produces `PartnerReviewCampaign`, `PartnerRegistrationReview`, and server-only methods to list reviews, decide a submission, resolve/open an active campaign, and record one WordPress review conversion.
- Produces `api.review_partner_registration`, `api.list_partner_registration_reviews`, `api.open_partner_review_campaign`, and `api.record_partner_review_campaign_submission`; all are service-role-only adapters over `private` data.

- [ ] **Step 1: Write the source and local-Supabase contract tests** for denied browser privileges, valid transitions, same-decision retries, reject no-activation, four one-per-channel campaign rows, inactive resolution denial, no duplicate conversion, and no PII event payload.
- [ ] **Step 2: Run the new source contract** and confirm it fails because the growth migration/service functions are absent.
- [ ] **Step 3: Implement the migration and server-only repository/service types** with one transaction per decision and public token resolution that returns only canonical shop data.
- [ ] **Step 4: Re-run the focused contract**, then start/reset only local Supabase and run its SQL contract. Confirm both pass.
- [ ] **Step 5: Commit Task 1** with its test evidence.

### Task 2: Protected operator decision and Growth Kit

**Files:**
- Create: `headless/app/api/dashboard/partners/review/route.ts`
- Create: `headless/app/api/dashboard/partners/qr/route.ts`
- Modify: `headless/app/dashboard/partners/page.tsx`
- Modify: `headless/components/dashboard/DashboardPartnerWorkspace.tsx`
- Modify: `headless/app/globals.css`
- Modify: `headless/scripts/check-partner-review-growth.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes Task 1 review list/decision result and active campaigns.
- Produces an authenticated operator review endpoint and a protected SVG QR endpoint. The dashboard supplies an explicit Approve as Free Official Partner or Reject action and only shows the kit for approved workspaces.

- [ ] **Step 1: Add focused source-contract assertions** for route-level Dashboard authorization, pending submission display, explicit approved/rejected actions, neutral banner/share copy, private QR response, and no service role/browser PII leakage.
- [ ] **Step 2: Run the contract** and confirm it fails before the operator routes/UI exist.
- [ ] **Step 3: Implement the two protected handlers and compact dashboard review/kit UI**, using a small server-side QR SVG dependency and copy-safe browser interactions.
- [ ] **Step 4: Run the focused contract and TypeScript check**; confirm dashboard client code has no secrets and all four campaign URL artifacts are available only after approval.
- [ ] **Step 5: Commit Task 2** with its test evidence.

### Task 3: Public campaign entry, existing-form attribution, docs and verification

**Files:**
- Create: `headless/app/r/[token]/route.ts`
- Modify: `headless/app/reviews/submit/page.tsx`
- Modify: `headless/components/reviews/ReviewSubmitForm.tsx`
- Modify: `headless/app/api/reviews/submit/route.ts`
- Modify: `docs/superpowers/specs/2026-09-19-eskomi-free-official-partner-foundation-design.md`
- Modify: `pm/PROGRESS.md`
- Modify: `headless/scripts/check-partner-review-growth.mjs`
- Create/Modify: focused changed-flow browser QA script and package command as required by the existing test harness

**Interfaces:**
- Consumes Task 1 token resolution/conversion methods and Task 2 public campaign artifacts.
- Produces `/r/{opaque-token}/`, a noindex 307 redirect to the canonical existing review form, optional form campaign token transport, server-side campaign/shop validation, and post-success conversion recording without exposing review body/PII to Partner analytics.

- [ ] **Step 1: Add focused assertions/tests** for noindex campaign routing, invalid/inactive behavior, exact prefill, campaign/shop mismatch rejection, normal non-campaign regression, submission conversion call only after WordPress success, QR/banner/LINE targets, and anonymous dashboard denial.
- [ ] **Step 2: Run the focused tests** and confirm the new route/integration cases fail before implementation.
- [ ] **Step 3: Implement the route and attribution extension**, preserving existing review payload validation, WordPress pending moderation, and normal form behavior.
- [ ] **Step 4: Update the existing Foundation spec and project progress pointer** with activation, kit, attribution, migration order/rollback/production verification, and PARTNER-03 boundary.
- [ ] **Step 5: Run focused tests, local Supabase verification, lint, typecheck, build, changed-flow headless browser QA, diff check, and secret/PII scan. Commit Task 3.**

### Task 4: Whole-change review and acceptance evidence

**Files:**
- Review-only: full range from `484caee958942b26f12628212d95bfd01f8e6be8` through the local implementation commits.

- [ ] **Step 1: Run an independent spec review** of the complete diff and test evidence.
- [ ] **Step 2: Run an independent quality/security review** of the complete diff, private privilege model, idempotency, and existing-review-flow compatibility.
- [ ] **Step 3: Address all Critical/Important findings, re-run focused verification and one scoped re-review if needed.**
- [ ] **Step 4: Record the final local evidence packet and make one local-only commit if documentation/review fixes changed files.**
