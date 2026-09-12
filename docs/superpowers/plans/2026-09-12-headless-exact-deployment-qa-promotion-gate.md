# Headless Exact Deployment QA Promotion Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a staged Vercel production deployment, bind it to the exact Git SHA, run authenticated SSR/no-JS release checks against that exact deployment, and stop before custom-domain promotion.

**Architecture:** Keep platform transport separate from deterministic release validation. The workflow creates an unpromoted deployment and passes its URL, ID, and expected SHA to a dedicated CLI; the CLI uses Vercel authenticated commands to collect evidence and a pure validation module to enforce identity, SEO/data, and PPR/no-JS contracts. A separate contract test exercises failure fixtures and statically rejects workflow regressions such as aliasing, URL substitution, or promotion.

**Tech Stack:** GitHub Actions, Vercel CLI 54.13.0, Node.js ESM, Playwright contract fixtures, Next.js 16.3.3

**Spec:** `/Users/narikiyo/.codex/attachments/ef854c44-5fd0-4fce-b4ee-411016dc0ac0/pasted-text.txt`

## Global Constraints

- Base commit is `4c28a0c00629b37c3b0012e2cfb816037abef197`.
- Do not push, deploy, promote, change Vercel settings, or write WordPress/Supabase data.
- Pin Vercel CLI to `54.13.0`.
- Use `--prod --skip-domain`; never run `vercel promote` or alias assignment in this workflow.
- Exact deployment URL is the primary QA target; `HEADLESS_CI_CHECK_URL` may only remain as a separately named auxiliary public-domain check.
- Allow Vercel platform `X-Robots-Tag: noindex` only before promotion; reject HTML/application noindex.
- Prove application indexability separately on a production-mode local Next response; do not infer header provenance from `server: Vercel`.
- After promotion, require custom-domain HTTP 200, header/HTML noindex absence, 58/25 shop and ItemList counts, canonical/schema parity, JavaScript browser QA, and 100% no-JS completeness. Any failure leaves `RELEASE_CLOSED = NO` and requires a rollback decision.
- Runtime audit must remain Critical 0 / High 0 and dependency versions must not change.

---

### Task 1: RED exact-deployment release contract

**Files:**
- Create: `headless/scripts/check-exact-deployment-release-contract.mjs`
- Modify: `headless/package.json`

**Interfaces:**
- Consumes: `.github/workflows/deploy-headless.yml` and the future exact-deployment validator.
- Produces: `npm run test:exact-deployment-release`, a deterministic contract covering workflow and release-evidence failures.

- [ ] **Step 1: Write the failing contract**

  Add checks for CLI pinning, `--skip-domain`, exact URL precedence, SHA mismatch, each critical Area 404, HTML noindex, 58/25 mismatches, outside hidden PPR dependencies, promotion absence, and Xserver path isolation.

- [ ] **Step 2: Verify RED**

  Run: `npm run test:exact-deployment-release`

  Expected: FAIL because the current workflow uses `vercel@latest`, omits `--skip-domain`, substitutes `HEADLESS_CI_CHECK_URL`, and has no exact-deployment validator.

### Task 2: Pure identity and Area evidence validator

**Files:**
- Create: `headless/scripts/lib/exact-deployment-release-contract.mjs`
- Create: `headless/scripts/check-exact-deployment-release.mjs`

**Interfaces:**
- Consumes: deployment URL, deployment ID, expected SHA, Vercel deployment metadata, and authenticated Area response evidence.
- Produces: `validateExactDeploymentRelease(evidence)` and a CLI that returns a machine-readable PASS result or exits non-zero.

- [ ] **Step 1: Add failure fixtures to the RED contract**

  Exercise each required invalid state independently and assert the exact rejection message.

- [ ] **Step 2: Implement the minimum pure validator**

  Validate URL/ID/SHA identity, READY production target, absence of production-domain aliases, HTTP 200, title/H1/canonical, HTML robots, required schemas, 58/25 shops, absence of ranking section/cards/badges, disclosure containment, supporting tokens, internal links, and outside hidden-segment independence.

  Validate application robots separately against the production-mode local Next response. Staged exact deployments may carry only the supported `noindex` header directive and must not use the `Server` header as a provenance signal. Export the same header/HTML noindex rejection for the post-promotion custom-domain gate.

- [ ] **Step 3: Add the authenticated transport CLI**

  Use `vercel inspect --format=json`, `vercel api /v13/deployments/<id> --raw`, and `vercel curl <path> --deployment <exact-url>` without printing or persisting credentials.

- [ ] **Step 4: Verify fixture GREEN**

  Run: `npm run test:exact-deployment-release`

  Expected: PASS for valid evidence and PASS for every expected rejection fixture.

### Task 3: Stage-only workflow integration

**Files:**
- Modify: `.github/workflows/deploy-headless.yml`
- Modify: `headless/scripts/check-wp-critical-build-contract.mjs`

**Interfaces:**
- Consumes: `GITHUB_SHA`, `VERCEL_TOKEN`, linked project configuration, prebuilt Vercel output.
- Produces: exact deployment URL/ID, verified SHA, exact QA PASS, and `promotion=NOT_PROMOTED` in the workflow summary.

- [ ] **Step 1: Pin Vercel CLI and stage deployment**

  Replace `vercel@latest` with `vercel@54.13.0`; add `--skip-domain` and `--meta eskomiGitSha="$GITHUB_SHA"` while retaining prebuilt, production target, archive, and non-interactive options.

- [ ] **Step 2: Extract exact identity**

  Treat deploy stdout as the exact URL, use `vercel inspect --format=json` for the ID, and expose both as step outputs.

- [ ] **Step 3: Run primary exact QA and stop**

  Invoke the dedicated CLI with the exact URL/ID/SHA, write only non-secret identity and PASS status to the job summary, and do not call promote or alias commands. Persist the required post-promotion HTTP/robots/count/canonical/schema/JavaScript/no-JS checks and the `RELEASE_CLOSED = NO` rollback boundary in that summary.

- [ ] **Step 4: Isolate the legacy public-domain check**

  Run it only when configured, label it auxiliary, and remove all fallback from exact release acceptance.

- [ ] **Step 5: Verify workflow GREEN**

  Run: `npm run test:exact-deployment-release && npm run test:wp-critical-build && npm run test:xserver-ssh-deploy`

  Expected: PASS with required ordering and Xserver `SHOULD_TRIGGER=false` for the workflow-only diff.

### Task 4: Full verification and local commit

**Files:**
- Verify only; no additional implementation files.

- [ ] **Step 1: Run dependency and audit gates**

  Run: `npm ci`, both required `npm audit` commands, and confirm runtime Critical 0 / High 0.

- [ ] **Step 2: Run all regression gates**

  Run lint, typecheck, full tests, 850-page build, WordPress preflight/TLS/fail-closed tests, Xserver contract, Area SSR/PPR/no-JS tests, priority Area SEO, and Nodemailer security.

- [ ] **Step 3: Run production-equivalent build only**

  Run: `vercel build --prod --yes`

  Expected: local Vercel build PASS; no deployment is created.

- [ ] **Step 4: Commit exact scope**

  Run `git diff --check`, stage only the reviewed workflow/test/plan files, and commit `ci: gate headless promotion on exact deployment QA` without amend or push.
