# Operator Direct Publish and Reversible Unlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to publish, unlist, and restore stores directly while preserving Partner approval-only edits.

**Architecture:** Extend the private managed-shop workflow with service-role-only direct-publication RPCs. Keep the existing publication-state projection for reversible removal, and expose it only through the authenticated dashboard route.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres private schema, PostgREST service-role RPC, local Supabase, Chromium.

**Spec:** `docs/superpowers/specs/2026-10-15-operator-direct-publish-and-unlist-design.md`

## Global Constraints

- Never physically delete WordPress records, managed records, reviews, or private image objects.
- Preserve revision history and reject stale expected revisions.
- Do not grant tables or write RPCs to `anon` or `authenticated`.
- Do not change Partner authorization or allow Partner access to dashboard write routes.
- Preserve area-card layout and the 58/25/394 public baseline.
- Do not apply a migration, push, merge, or deploy in this task.

## Review Focus

- Unlisted legacy identity must be suppressed from public list/detail/sitemap yet stay restorable with its original ID and slug.
- Direct publish must require the dashboard route and cannot be invoked by a Partner session.
- A stale revision must return 409 rather than overwrite a newer operator or Partner change.
- An unlist confirmation must reject a mismatched store name server-side.
- Partner drafts/submissions must not become public until the existing operator review approves them.

---

### Task 1: Direct publication database workflow

**Files:**
- Create: `supabase/migrations/<timestamp>_operator_direct_publish_and_unlist.sql`
- Modify: `supabase/tests/verify_operator_managed_shop_directory.sql`
- Modify: `headless/scripts/check-operator-managed-shop-directory-contract.mjs`

**Interfaces:**
- Produces private/API service-role RPCs for direct create/import/save-and-publish.
- Produces retained publication-state transitions for reversible unlist/restore.

- [ ] Write local SQL assertions for direct create, direct legacy import/edit, unlist/restore, history, identity preservation, stale revision rejection, and forbidden public roles.
- [ ] Run the SQL fixture first and verify it fails because direct RPCs are missing.
- [ ] Implement the smallest private functions and API wrappers; revoke PUBLIC/anon/authenticated and grant only service_role.
- [ ] Run the SQL fixture and source contract; verify PASS.

### Task 2: Dashboard direct API and conflict checks

**Files:**
- Modify: `headless/lib/supabase/managed-shop-directory.ts`
- Modify: `headless/app/api/dashboard/managed-shops/route.ts`
- Modify: `headless/scripts/check-operator-managed-shop-directory-contract.mjs`
- Create/modify: focused managed-directory API contract test

**Interfaces:**
- Consumes direct RPCs from Task 1.
- Produces dashboard actions `create_and_publish`, `import_and_publish`, `save_and_publish`, and confirmed `unlist`/`restore`.

- [ ] Write a failing contract test for dashboard-only direct actions, exact-name confirmation, 409 handling, and no Partner route access.
- [ ] Implement repository RPC adapters and route validation/revalidation.
- [ ] Run focused contracts and verify PASS.

### Task 3: Operator dashboard controls

**Files:**
- Modify: `headless/components/dashboard/OperatorShops.tsx`
- Modify: `headless/components/dashboard/ManagedShopForms.tsx`
- Modify: `headless/app/dashboard/shops/new/page.tsx`
- Modify/create: focused dashboard UI contract test

**Interfaces:**
- Consumes Task 2 action names and response errors.
- Produces direct-publication controls and an exact-name reversible-unlist confirmation.

- [ ] Write a failing UI contract asserting clear new/add, direct save-and-publish, unlist/restore, and no operator approval workflow copy.
- [ ] Implement controls without changing Partner pages.
- [ ] Run focused UI tests and verify PASS.

### Task 4: Local end-to-end verification

**Files:**
- Modify: `headless/scripts/check-operator-managed-shop-local-supabase-browser.mjs`
- Modify: package scripts if needed

- [ ] Extend the local browser flow with operator direct publish/edit/unlist/restore and Partner rejected/unauthorized/concurrent-change cases.
- [ ] Run it red against the pre-change behavior, then green after Tasks 1-3.
- [ ] Run lint, typecheck, build, `npm test`, the managed-directory build check, and public card baseline checks.
- [ ] Commit only the verified source, migration, tests, spec, and plan; open a draft PR.
