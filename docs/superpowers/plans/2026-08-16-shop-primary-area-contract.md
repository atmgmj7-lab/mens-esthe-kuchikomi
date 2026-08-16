# Shop Primary Area Contract Implementation Plan

> **For Codex:** REQUIRED SKILL: Use superpowers:test-driven-development to execute this plan task-by-task.

**Goal:** WordPressの各Shopへ明示Primary Areaを0または1つ保存できる契約を追加し、Next readerへ安全な`primaryArea`を公開し、全Shopのread-only移行候補を生成する。

**Architecture:** WordPressの単一post meta `shop_primary_area_term_id`を正本にし、PHP readerでtaxonomyとShop relationを検証する。Nextは検証済みIDを埋込みArea termと再照合してobject/nullへ正規化する。移行候補は公開RESTのShop-Area relationとArea親子graphだけで決定し、書込み処理を持たない。

**Tech Stack:** WordPress PHP, Next.js 16 TypeScript, Node.js ESM contract scripts, public WordPress REST, npm scripts.

---

## Task 1: Baseline and fail-first contract tests

**Files:**

- Create: `tests/php/check-shop-primary-area-contract.php`
- Create: `headless/scripts/check-shop-primary-area-contract.mjs`
- Modify: `headless/package.json`

1. `headless/npm ci`と変更前`npm test`を実行しbaselineを固定する。
2. PHP fixtureへWordPressの最小stubを用意し、明示ID、関係外、別taxonomy、不正値、relation順変更、read-only公開を検査する。
3. Node contract testへNext normalizerと候補分類の期待を追加する。
4. `test:shop-primary-area` scriptを登録する。dependency versionとlockfileは変えない。
5. `npm run test:shop-primary-area`を実行し、未実装による意図したREDを記録する。

## Task 2: WordPress storage and read validation

**Files:**

- Modify: `shop-public-meta.php`
- Test: `tests/php/check-shop-primary-area-contract.php`

1. positive integerまたは空を扱う保存値sanitizerを追加する。
2. Shop ID、term taxonomy、現在のArea relationを同時に検証するpure helperを追加する。
3. `shop_primary_area_term_id`をsingle integer post metaとして登録するが、匿名REST writerへは公開しない。
4. 既存`rest_prepare_shop`で検証済みIDだけを`acf.shop_primary_area_term_id`へ追加し、無効時は`null`にする。
5. PHP fixtureを再実行しGREENを確認する。

## Task 3: Next public reader mapping

**Files:**

- Modify: `headless/lib/wp/types.ts`
- Modify: `headless/lib/wp/normalize.ts`
- Test: `headless/scripts/check-shop-primary-area-contract.mjs`

1. `WpTerm.taxonomy`、raw meta、`ShopPrimaryAreaView`、`ShopView.primaryArea`の型を追加する。
2. 明示IDを正の安全な整数として読み、`taxonomy=area`かつ埋込みrelationに一致するtermだけobjectへする。
3. taxonomy情報が欠ける入力では、Shopのtop-level `area` ID配列との一致も必要にしてfail closedを維持する。
4. `terms[]`とlegacy `areaSlug`を変更しない。
5. explicit only、順序非依存、関係外null、未設定null、同名別IDをGREENにする。

## Task 4: Deterministic migration classifier

**Files:**

- Create: `headless/scripts/lib/shop-primary-area-candidates.mjs`
- Test: `headless/scripts/check-shop-primary-area-contract.mjs`

1. Area一覧をID mapへ正規化し、欠損・重複・cycleを検知する。
2. 0 relationをUNCLASSIFIEDへ分類する。
3. 1 relation、または一意leafとその祖先だけのrelationをAUTO_SAFEへ分類する。
4. 複数leaf、無関係relation、graph不整合をNEEDS_REVIEWへ分類する。
5. 入力順、店舗名、住所、slug、legacy `area_slug`を変更しても結果が変わらない検査をGREENにする。

## Task 5: Read-only all-shop candidate generation

**Files:**

- Create: `headless/scripts/prepare-shop-primary-area-candidates.mjs`
- Create: `docs/data/shop-primary-area-candidates-2026-08-16.json`
- Modify: `headless/package.json`

1. 公開WordPress RESTから全Shopと全AreaをGETだけでページ取得する。
2. page欠落、HTTP failure、重複Shop ID、件数不一致時は成果物を書かず失敗する。
3. Shopごとに指定field、分類、reasonを生成し、WP ID順で安定化する。
4. summaryへtotal、AUTO_SAFE、NEEDS_REVIEW、UNCLASSIFIED、multi-area、no-areaを記録する。
5. `prepare:shop-primary-area-candidates`を実行し、成果物を生成する。
6. candidateにSecret/PII、認証値、書込みendpointがないことを検査する。

## Task 6: Focused and full verification

**Files:**

- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

Run and record exit code for:

1. `php -l ../shop-public-meta.php`
2. `php ../tests/php/check-shop-primary-area-contract.php`
3. `npm run test:shop-primary-area`
4. `npm run test:area-integrity`
5. `npm run test:area-list-route-contract`
6. `npm run test:ux-production-data-contract`
7. `npm test`
8. `npm run lint`
9. `npm run typecheck`
10. `git diff --check`

Confirm:

- application UI/CSS変更0
- dependency/lockfile変更0
- WordPress/Supabase write 0
- URL/canonical/sitemap変更0
- T3-A変更0

## Task 7: Independent reviews and commit

1. SPEC_COMPLIANCE reviewでexplicit-only、order dependency 0、string inference 0、legacy relation破壊0を確認する。
2. CODE_QUALITY_SECURITY reviewでread-only generator、fail-closed reader、Secret/PII 0、mass reassignment 0を確認する。
3. Critical/Important 0の場合だけ対象pathを明示stageする。`git add -A`は禁止。
4. `feat: define canonical shop primary area contract`でcommitする。
5. final SHAとclean statusを記録し、T3-A、本番write、push、deploy前で停止する。
