# Supabase-primary public source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the public directory from Supabase only after a complete, reconciled migration while retaining WordPress as an explicit rollback mode.

**Architecture:** A single public RPC returns the approved shop, area, and article projection. A server-only adapter validates the payload and expected counts before converting it to existing public view models; existing route readers select that adapter first in primary mode.

**Tech Stack:** Next.js, TypeScript, Supabase PostgREST/RPC, PostgreSQL, Node contract checks.

**Spec:** `docs/superpowers/specs/2026-10-19-supabase-primary-public-source-design.md`

## Global Constraints

- Do not touch cloud/prod data, Secrets, DNS, authentication setup, billing, `main`, or existing volumes.
- Preserve public URLs/canonical paths, listing suspension semantics, moderation rules, and WordPress rollback readers.
- Treat missing migration data as a failure, never an empty successful public result.
- In primary mode, public route reads must make zero WordPress HTTP calls.

## Review Focus

- Missing expected-count env variables reject primary mode before a partial directory can render.
- A shop without a primary published area is excluded from every public projection, not shown with a fabricated location.
- A missing article corpus blocks primary mode instead of silently shrinking sitemap URLs.
- Suspended/draft rows remain absent from listing, detail, area, and sitemap output.
- Browser-facing credentials can execute only the shaped public RPC, never base-table or moderation writes.

### Task 1: Public projection contract

**Files:**
- Create: `supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql`
- Test: `headless/scripts/check-supabase-primary-public-directory.mjs`

**Interfaces:** Produces `api.get_public_site_directory_v1() -> jsonb` with `shops`, `areas`, `posts`, and `coverage`.

- [x] Write the failing contract check for the RPC, published-only filter, privilege boundary, and no base table grants.
- [x] Run the check and observe the missing-reader failure.
- [x] Implement the security-definer shaped public projection and grant only RPC execution to `anon, authenticated`.
- [x] Re-run the contract check.

### Task 2: Fail-closed primary adapter

**Files:**
- Create: `headless/lib/content-source/public-directory.ts`
- Test: `headless/scripts/check-supabase-primary-public-directory.mjs`

**Interfaces:** Produces `getSupabasePrimaryPublicDirectory()`, `publicDirectoryShops()`, `publicDirectoryAreas()`, `publicDirectoryPosts()`, and `ContentMigrationIncompleteError`.

- [x] Add failing checks for dedicated RPC use, no WordPress reader import, and explicit shop/area/article reconciliation values.
- [x] Implement strict payload parsing and coverage validation with a publishable-key, `no-store` RPC request.
- [x] Typecheck and re-run the contract check.

### Task 3: Route reader switchover

**Files:**
- Modify: `headless/lib/wp/shops.ts`, `headless/lib/wp/areas.ts`, `headless/lib/wp/posts.ts`
- Modify: `headless/app/area/[slug]/page.tsx`, `headless/components/area/AreaHubRouteContent.tsx`
- Test: `headless/scripts/check-supabase-primary-public-directory.mjs`

**Interfaces:** Existing `getShopBySlug`, `getAllShopsForListing`, `getShopsForSitemap`, area readers, and post readers select the canonical adapter before WordPress.

- [x] Add failing assertions for listing/detail/area/sitemap primary branches.
- [x] Implement primary branches and disable WordPress-only ranking/feature fetches in area render paths.
- [x] Prove the routes with a local HTTP fixture and a WordPress request-count proxy.

### Task 4: Migration rehearsal and release gate

**Files:**
- Modify: `headless/.env.example`, migration runbook, and local QA artifact README
- Create: an isolated primary-mode fixture/replay evidence artifact

- [x] Seed only an isolated local fixture with public, suspended, and private records.
- [x] Run list/detail/area/sitemap/review-submit HTTP assertions, including zero WordPress requests.
- [x] Record expected counts and the explicit production blocker: no production data import/reconciliation has been performed.
- [ ] Run full test suite, commit, and push the dedicated branch.
