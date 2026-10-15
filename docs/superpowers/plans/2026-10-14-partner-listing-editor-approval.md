# Partner Listing Editor and Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated Partner edit only its own stable shop listing, submit changes for review, and publish approved changes to the same `/shops/[slug]/` URL.

**Architecture:** Add a private stable listing identity bound one-to-one to a partner workspace, with an immutable revision history and a single approved projection per stable listing. The Partner and operator APIs remain server/service-role boundaries; public shop rendering reads only the approved projection and never applicant contact data.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase/PostgreSQL private schema and PostgREST service-role RPCs, Playwright, local Supabase fixtures.

**Spec:** `docs/store-listing-application-design.md`, delegated task request of 2026-10-14.

## Global Constraints

- Local Supabase fixtures only; do not change production DB, Storage, RLS, WordPress, authentication users, memberships, or credentials.
- Do not push, merge, deploy, upload assets to Library, or alter payments/pricing.
- Existing-store applications never create ownership; a Partner may edit only an already active membership's workspace.
- Draft or returned revisions must never affect the public page; operator approval is CAS-protected and idempotence-safe.
- Preserve existing Partner pilot, POP, and review-widget behaviour and canonical `/shops/[slug]/` routes.

## Review Focus

- A Partner supplied workspace/shop identifier must not select another shop's listing.
- A stale Partner draft or stale operator approval must fail without replacing the published revision.
- Returned revisions must retain the operator reason yet remain non-public until resubmitted and approved.
- New listings must allocate one stable slug and retain it across further approved revisions.
- Public API/page data must not contain contact fields, reviewer notes, private object keys, or raw assets.

### Task 1: Stable listing database contracts

**Files:** migration under `supabase/migrations/`, `supabase/tests/verify_listing_partner_editor.sql`.

- [ ] Write local fixture assertions for stable new/existing listings, workspace binding only after operator confirmation, stale conflict rejection, and public projection isolation.
- [ ] Run the fixture and confirm it fails because the stable listing contract is absent.
- [ ] Add narrow private/API RPCs for listing identities, Partner drafts/submissions, operator review, and public projection lookup.
- [ ] Re-run the fixture and confirm it passes.

### Task 2: Partner/editor and operator API contracts

**Files:** Partner listing service/auth adapter, Partner and dashboard route handlers, API contract tests.

- [ ] Write failing contract tests for own-workspace-only reads/writes, draft versus submit, returned-revision display, and no-contact public projection.
- [ ] Run the tests and confirm the routes/services are absent.
- [ ] Implement server-only service-role adapters and route validation using the resolved session membership.
- [ ] Re-run the tests and confirm they pass.

### Task 3: Partner UI and stable public shop rendering

**Files:** Partner listing editor component/page/styles, Partner navigation, shop page approved overlay, browser QA.

- [ ] Write failing source/browser contract tests for the editor workflow, status/reason UI, same canonical URL, and PC/SP overflow checks.
- [ ] Run the tests and confirm the editor link/UI is absent.
- [ ] Implement the editor and render approved Partner-controlled introduction/banner on `/shops/[slug]/` without changing unapproved content.
- [ ] Re-run contract/browser tests and confirm they pass.

### Task 4: Regression and completion evidence

**Files:** test scripts, local fixture evidence, implementation report.

- [ ] Extend local E2E through draft → submit → return → resubmit → approve and cross-shop denial.
- [ ] Run targeted fixtures, existing Partner pilot/POP/widget contracts, lint, typecheck, build, and browser captures.
- [ ] Commit the implementation after fresh evidence.

## Coverage Self-review

Tasks 1–4 cover all six delegated requirements. The explicit no-production boundary and immutable approved projection avoid ownership escalation and accidental publication. Shop presentation is limited to operator-approved fields and preserves the existing WordPress-backed page for listings without a projection.
