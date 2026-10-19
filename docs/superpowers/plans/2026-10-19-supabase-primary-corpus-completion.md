# Supabase-primary Corpus Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed-page projection, a fail-closed corpus dry run, and WP-blocked primary-mode HTTP evidence without applying production data.

**Architecture:** The existing public-directory RPC becomes the sole primary-mode content boundary and gains an allowlisted fixed-page projection. A read-only WordPress audit normalizes source routes into an ignored idempotent import candidate and reconciliation report; local fixtures exercise the same contract. A loopback WordPress sink records any forbidden primary-mode traffic during HTTP routes.

**Tech Stack:** PostgreSQL/Supabase functions, Next.js 16, TypeScript, Node test scripts, existing local Docker Supabase fixture.

**Spec:** `docs/superpowers/specs/2026-10-19-supabase-primary-corpus-completion-design.md`

## Global Constraints

- Do not write production data or commit corpus payloads.
- Exact coverage is required for public shops, areas, columns, and six fixed routes.
- Preserve canonical paths and fail closed in `CONTENT_DATA_SOURCE=supabase`.
- Existing WordPress uploads remain references until a separately approved object migration.

## Review Focus

- A missing fixed-page record must fail primary-mode metadata and page rendering rather than use a WordPress or presentational fallback.
- A source count drift (including the 394/382 gap) must stop the dry run before generated SQL can be used.
- Canonical paths, percent-encoded WordPress slugs, and duplicate routes must be rejected or retained exactly.
- Any WordPress URL used by a primary-mode route must be visible to the loopback sink and fail the HTTP test.
- A WordPress uploads image URL must remain classified as an unresolved dependency, not be presented as migrated media.

---

### Task 1: Fixed-page public projection

**Files:**
- Modify: `supabase/migrations/20261019090000_eskomi_supabase_primary_public_directory.sql`
- Modify: `headless/lib/content-source/public-directory.ts`
- Modify: `headless/lib/wp/pages.ts`
- Modify: `headless/.env.example`
- Test: `headless/scripts/check-supabase-primary-public-directory.mjs`
- Test: `supabase/tests/verify_eskomi_supabase_primary_public_directory.sql`

**Interfaces:**
- Produces `directory.pages` and `publicDirectoryPages(directory)`.
- Consumes `SUPABASE_CONTENT_EXPECTED_PAGES` and the exact six `STATIC_PAGE_SLUGS` routes.

- [ ] Write failing contract and SQL tests for published fixed pages, draft exclusion, unsupported route exclusion, and expected page count.
- [ ] Run the tests and verify the current page-less projection fails.
- [ ] Add an allowlisted `pages` RPC projection and strict parser/count validation; make `getPageBySlug` resolve it before any WP reader in primary mode.
- [ ] Run the contract and local transaction tests until they pass.
- [ ] Commit the focused change.

### Task 2: Corpus audit and idempotent dry-run generator

**Files:**
- Create: `headless/scripts/audit-supabase-primary-corpus.mjs`
- Create: `headless/scripts/lib/supabase-primary-corpus.mjs`
- Create: `headless/scripts/check-supabase-primary-corpus.mjs`
- Modify: `headless/package.json`
- Modify: `.gitignore` and runbook documentation as required

**Interfaces:**
- Consumes public REST `shop`, `area`, `pages`, taxonomy, and media endpoints plus a source snapshot manifest.
- Produces an ignored JSON reconciliation report and idempotent local SQL candidate; exits nonzero on a missing/extra/unmappable source object.

- [ ] Write a failing fixture test for source-count drift, duplicate canonical paths, unsupported pages, and WordPress-upload image classification.
- [ ] Run it and verify failure before implementation.
- [ ] Implement normalization and deterministic report/SQL rendering without applying it; include every source record or a blocking issue.
- [ ] Run source audit against the public API and retain only aggregate output in tracked evidence.
- [ ] Commit the focused change.

### Task 3: WordPress-blocked actual HTTP QA

**Files:**
- Create or modify: `headless/scripts/run-supabase-primary-no-wp-http-qa.sh`
- Create: `headless/scripts/check-supabase-primary-no-wp-http.mjs`
- Modify: fixture seed and local-QA README

**Interfaces:**
- Starts an isolated local Supabase fixture and Next server with `CONTENT_DATA_SOURCE=supabase`.
- Produces an HTTP report for `/shops/`, one shop detail, one area, one column, each fixed page, `/sitemap.xml`, and the review submit form.

- [ ] Write a failing test proving a recorded WordPress sink request or missing fixed route fails QA.
- [ ] Run it to observe failure before the implementation.
- [ ] Seed all six fixed routes and execute the complete HTTP suite with WordPress disabled.
- [ ] Run typecheck, lint, builds, focused SQL/Node tests, and the HTTP suite; request review and commit/push only after evidence is fresh.
