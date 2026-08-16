# Priority Area Capability Contracts Implementation Plan

> **For agentic workers:** This task is executed inline because the controller explicitly forbids subagents. Follow each checkbox in order with test-first evidence.

**Goal:** Make every priority-area link, filter, suggestion, and station label use the same validated data capabilities, while making the actual-component browser harness production-like and fail closed.

**Architecture:** Extend the priority-area pure helper into the single source for capability detection, filter predicates, relaxation suggestions, and station display text. Pass those results through the existing Area Hub server/client components. Rebuild the temporary browser harness from tracked allowlisted files, a minimal environment, a production build/start cycle, and independently guaranteed cleanup.

**Tech Stack:** Next.js 16, React, TypeScript, Node.js contract scripts, Playwright.

**Spec:** Controller task `UX-PROD-T3A final re-review correction`, received 2026-08-16.

## Global Constraints

- Do not change dependencies or `package-lock.json`.
- Do not add a permanent QA route.
- Do not perform production writes, Primary backfill, T3-B, T4, push, or deploy.
- Do not spawn subagents.
- Commit only named paths with `fix: align priority area capability contracts`.

---

### Task 1: Shared priority capability and filter contract

**Files:**
- Modify: `headless/lib/priority-area-precision.ts`
- Modify: `headless/lib/area-shop-list-controls.ts`
- Modify: `headless/components/area/hub/AreaShopList.tsx`
- Test: `headless/scripts/check-priority-area-precision-contract.mjs`

**Interfaces:**
- Produces a complete `PriorityAreaCapabilities` value and priority filter predicate/resolver.
- Keeps the non-priority default predicate unchanged.

- [x] Add a failing contract where station plus another filter yields zero results and each relaxation count equals the result after selecting it.
- [x] Run `npm run test:priority-area-precision` and record the intended failure.
- [x] Implement one shared priority predicate/resolver and connect filtering plus relaxation suggestions.
- [x] Re-run the focused contract and confirm it passes.

### Task 2: Capability-safe guide links and station display

**Files:**
- Modify: `headless/components/area/AreaHubPageTemplate.tsx`
- Modify: `headless/components/area/hub/AreaHubDecisionGuide.tsx`
- Modify: `headless/components/area/area-hub-content.tsx`
- Modify: `headless/components/area/hub/RankingSpecialtyCards.tsx`
- Modify: `headless/components/area/hub/RankingSpecialtyPagedList.tsx`
- Modify: `headless/lib/priority-area-precision.ts`
- Test: `headless/scripts/check-priority-area-precision-contract.mjs`
- Test: `headless/scripts/check-priority-area-precision-browser.mjs`

**Interfaces:**
- Consumes the complete priority capability object.
- Produces no link to an absent `price-table`, `late-night`, `station`, or `beginner` target.
- Produces a dedicated station-plus-walk display string that ignores generic `shop_access`.

- [x] Add failing rendered/browser assertions for dangling fragments and mixed dedicated/generic station fixtures.
- [x] Run focused and fixture browser tests and record the intended failures.
- [x] Filter decision/local guide items by the same capability source and pass priority station formatter through paged cards.
- [x] Re-run focused and fixture browser tests and confirm they pass.

### Task 3: Fail-closed production browser harness

**Files:**
- Modify: `headless/scripts/check-priority-area-precision-browser.mjs`
- Test: `headless/scripts/check-priority-area-precision-browser.mjs`

**Interfaces:**
- Copies only tracked project files plus explicit runtime allowlist.
- Rejects tracked symlinks and launches child processes with a minimal environment.
- Builds and starts the temporary fixture as production and removes root/process state after every failure.

- [x] Add failure-injection modes that assert no temporary directory, server process, secret environment inheritance, or development issue UI remains.
- [x] Run the injected modes and record the intended failures.
- [x] Implement tracked-file copying, symlink rejection, minimal child environment, production build/start, and independent `Promise.allSettled` cleanup.
- [x] Re-run injected and actual-component browser tests and confirm all pass.

### Task 4: Verification and handoff

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`
- Modify: `.superpowers/sdd/2026-08-16-eskomi-ux-production-t3a-primary-aware/task-1-implementer-report.md` (ignored evidence only)

- [x] Run focused, related, full test, lint, typecheck, fresh build, audit, browser QA, and diff checks.
- [x] Inspect representative 320px and 1440px fixture/live screenshots.
- [x] Review changed TSX for hooks, accessibility, SSR, bundle, and render regressions; require Critical 0 / Important 0.
- [x] Update evidence documents, stage named paths only, and commit `fix: align priority area capability contracts`.

## Plan self-review

- Spec coverage: all seven controller requirements map to Tasks 1–4.
- Placeholder scan: no deferred implementation or unspecified test step remains.
- Type consistency: capability, predicate, and station formatter flow from the pure helper through both server and client consumers.
