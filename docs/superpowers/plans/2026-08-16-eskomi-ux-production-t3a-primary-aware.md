# UX-PROD-T3A Primary-aware Area Precision P0 Implementation Plan

> Task ID: UX-PROD-T3A-RESUME-PRIMARY-AWARE-01
> Base: `2bc9fb07de4830bb266d246ccae20b4273a563a8`
> Stop gate: T3-B、WordPress Primary backfill、push、deploy、本番変更へ進まない。

## Goal

重点5Area Hubだけを明示的な`ShopView.primaryArea.id`で分類し、EXACTを主一覧、RELATED/UNCLASSIFIEDを意味の異なる補助一覧としてSSR表示する。Primary未反映の現行dataでは推測せずfail closedし、空module、根拠のない駅表示、配列順の偽rankingを除去する。

## Runtime contract

- Primary source: `ShopView.primaryArea`のみ。
- 対象Area ID: 堺東17、新大阪13、大阪日本橋7、堺筋本町46、梅田4。
- EXACT: `primaryArea?.id === area.id`。
- RELATED: legacy Area relationにcurrent Areaがあり、Primaryが別ID。
- UNCLASSIFIED: legacy Area relationにcurrent Areaがあり、Primaryがnull。
- 名前、住所、slug、term順、preview成果物を判定へ使用しない。
- canonical WP IDで重複を拒否し、同名でも別IDは保持する。
- 正式ranking recordがない場合はranking moduleを表示しない。順位を詰め直さない。
- beginner/stationは有効data 0ならsection、filter、説明、count、schemaを出さない。
- stationは正式な専用fieldと徒歩情報が揃う場合だけ有効。汎用`shop_access`だけでは有効にしない。

## Task 1: Implement and verify the complete P0 slice

### Files and boundaries

Expected production paths are limited to the priority Area page/template and reusable Area classification/list/ranking helpers. Expected test paths are focused Node contract tests and browser QA fixture support. `headless/package.json` may change only to register tests; `package-lock.json` and dependencies must not change.

### Step 1: Baseline

Run `npm ci` and existing `npm test` in `headless/`. Record Node/npm versions and exit codes. Stop if the clean base is not green for a task-relevant reason.

### Step 2: Fail-first contracts

Add focused tests that fail because the feature does not exist yet:

1. EXACT/RELATED/UNCLASSIFIED classify only by canonical IDs.
2. Primary null, same display name, slug/address/term order cannot create EXACT.
3. Duplicate WP ID is rejected; same name with different IDs remains distinct.
4. Precision gate accepts only IDs 17/13/7/46/4.
5. Runtime source files do not import preview JSON/static mapping.
6. Test-only 44-record fixture reproduces exact counts 6/3/12/18/5.
7. Zero valid beginner/station data removes all associated DOM/filter/count/copy/schema.
8. Formal ranking only, explicit gaps retained, no automatic rank.
9. SSR page keeps one H1 and existing URL/canonical/robots behavior.

Run the focused test and record the expected RED before production changes.

### Step 3: Minimal implementation

Create a pure, typed classifier/deduper. Integrate it only when the current Area is one of the five canonical IDs. Render EXACT as the main shop section and RELATED/UNCLASSIFIED in a compact secondary section with honest labels. Keep important shop links/content in SSR HTML. Do not import preview data into runtime code.

Change filter/tab availability from static options to validated data availability. Use dedicated station fields plus explicit walk information; do not promote generic access copy. Replace priority5 ranking output with a strict formal-record join that preserves recorded ranks and hides when unavailable. Keep non-priority routes on the existing behavior.

### Step 4: Verification

Run the focused suite, Primary contract/preview tests, Area integrity/route/card tests, public review, T1/T2, provenance, promotion, internal links, SEO metadata, schema, then `npm test`, lint, typecheck, build, audit high, and `git diff --check`.

Browser QA has two modes:

- Fixture: five Areas at 320,375,390,760,761,900,901,1024,1025,1280,1440px. Assert fixture exact counts, separation, H1=1, overflow=0, duplicate=0, same-name preservation, empty beginner/station=0, contradictory station=0, fake rank=0.
- Current live-data fail-safe: render/build without Primary backfill; assert crash=0, false EXACT=0, inference fallback=0, overflow=0. Do not label unclassified counts as formal Area counts.

### Step 5: Review and commit

Review the complete diff for scope, canonical identity, fail-closed behavior, SSR/cache consistency, XSS, no N+1, strict ranking, and visible layout. Require Critical 0 / Important 0 for specification, code quality/security, and visible QA. Stage named paths only and commit `fix: separate exact and related priority area shops`.

### Completion evidence

Return command-by-command exits, RED/GREEN evidence, changed files/stat, build page count, browser scenario/assertion/screenshot/failure summary, audit totals, independent review packets, commit SHA, clean/remaining status, and confirmation of zero production/backfill/push/deploy changes.
