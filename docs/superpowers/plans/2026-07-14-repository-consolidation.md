# Escomi Repository Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 元フォルダの未コミット内容を失わず、現在のproductionコードを `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` の `main` へ戻し、作業フォルダを安全に1つへ統合する。

**Architecture:** production側の `9b66731` を公開コードの基準とし、元フォルダの非ignored作業内容は一時indexから作るバックアップブランチへ固定する。バックアップ作成時は元フォルダのindexと実ファイルを変更せず、必要な差分だけをproduction側へ選択的に移す。統合検査と明示承認の後だけ、元フォルダの `main` を進めて追加作業ツリーを削除する。

**Tech Stack:** Git worktree、Git一時index、Next.js 16 App Router、npm

## Global Constraints

- `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` の実ファイルと通常indexは、最終統合の明示承認まで変更しない。
- 本番デプロイと `git push` は行わない。
- 公開コードの基準は `codex/production-baseline-20260713` の `9b66731` とする。
- npmコマンドは必ず `headless/` で実行する。
- 元フォルダからproduction側へファイルを一括コピーしない。
- `git reset --hard`、`git clean`、作業ツリー削除は、バックアップ検証とユーザーの明示承認前に実行しない。

---

### Task 1: 元フォルダの作業内容を変更なしでバックアップ参照へ固定する

**Files:**
- Read: `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi/**`
- Create Git ref: `refs/heads/backup/original-dirty-20260714`
- Temporary index: `/private/tmp/escomi-original-dirty-20260714.index`
- Verify: `docs/technical/repository-consolidation-inventory-2026-07-14.md`

**Interfaces:**
- Consumes: 元フォルダの `main` と非ignored作業内容
- Produces: 元フォルダの通常indexを変えずに全作業内容を参照できる `backup/original-dirty-20260714`

- [x] **Step 1: 作業前の状態を記録する**

Run:

```bash
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi status --short --branch
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production status --short --branch
```

Expected: 元フォルダは `main...origin/main [behind 26]` と既存差分を表示し、production側は `codex/production-baseline-20260713...origin/main [ahead 2]` でクリーン。

- [x] **Step 2: 一時indexへ元フォルダの全非ignored内容を登録する**

Run:

```bash
rm -f /private/tmp/escomi-original-dirty-20260714.index
GIT_INDEX_FILE=/private/tmp/escomi-original-dirty-20260714.index git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi read-tree main
GIT_INDEX_FILE=/private/tmp/escomi-original-dirty-20260714.index git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi add -A
GIT_INDEX_FILE=/private/tmp/escomi-original-dirty-20260714.index git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi add -f dashboard/.env.example
```

Expected: 終了コード0。元フォルダの通常 `git status` は変化しない。

- [x] **Step 3: 一時indexからバックアップコミットと参照を作る**

Run:

```bash
SNAPSHOT_TREE=$(GIT_INDEX_FILE=/private/tmp/escomi-original-dirty-20260714.index git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi write-tree)
SNAPSHOT_PARENT=$(git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi rev-parse HEAD)
SNAPSHOT_COMMIT=$(printf '%s\n' 'backup: preserve original dirty worktree 2026-07-14' | git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production commit-tree "$SNAPSHOT_TREE" -p "$SNAPSHOT_PARENT")
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production update-ref refs/heads/backup/original-dirty-20260714 "$SNAPSHOT_COMMIT"
```

Expected: `backup/original-dirty-20260714` が作成され、元フォルダのブランチと通常indexは変化しない。

- [x] **Step 4: バックアップtreeと一時indexの一致を検証する**

Run:

```bash
GIT_INDEX_FILE=/private/tmp/escomi-original-dirty-20260714.index git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi diff --cached --exit-code backup/original-dirty-20260714
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production show --stat --oneline backup/original-dirty-20260714
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi status --short --branch
```

Expected: `diff --cached --exit-code` が終了コード0。元フォルダの `git status` がStep 1と同一。

- [x] **Step 5: バックアップ参照作成をコミット履歴ではなく進行ログへ記録する**

Add this exact result to the current consolidation section in `pm/PROGRESS.md`:

```markdown
- `backup/original-dirty-20260714` を一時indexから作成した。
- 一時indexとバックアップrefのtree一致を `git diff --cached --exit-code` で確認した。
- 元フォルダの通常index、実ファイル、`main` は変更していない。
```

- [x] **Step 6: 統合台帳、実行計画、進行ログをコミットする**

Run:

```bash
git add docs/technical/repository-consolidation-inventory-2026-07-14.md docs/superpowers/plans/2026-07-14-repository-consolidation.md pm/PROGRESS.md
git commit -m "Document repository consolidation and backup"
```

Expected: 上記3ファイルだけがcurrent branchへコミットされ、バックアップrefは別のcommitを指す。

### Task 2: 履歴未保存の公開UI差分5件を採否判定する

**Files:**
- Compare: `headless/app/reviews/submit/page.tsx`
- Compare: `headless/components/area/AreaLatestReviews.tsx`
- Compare: `headless/components/area/area-hub-content.tsx`
- Compare: `headless/components/area/hub/AreaShopList.tsx`
- Compare: `headless/components/area/hub/RankingHeroCards.tsx`
- Test: `headless/scripts/check-review-rating.mjs`
- Test: `headless/scripts/check-promotion-disclosure.mjs`
- Test: `headless/scripts/check-q06-seo-metadata.mjs`
- Test: `headless/scripts/check-schema-output-conditions.mjs`

**Interfaces:**
- Consumes: `backup/original-dirty-20260714` と `codex/production-baseline-20260713` の5ファイル差分
- Produces: 5ファイルを今回の統合では採用せず、バックアップrefに保留したことを示す検証記録

- [x] **Step 1: 5ファイルの差分を個別に確認する**

Run:

```bash
git diff codex/production-baseline-20260713..backup/original-dirty-20260714 -- headless/app/reviews/submit/page.tsx headless/components/area/AreaLatestReviews.tsx headless/components/area/area-hub-content.tsx headless/components/area/hub/AreaShopList.tsx headless/components/area/hub/RankingHeroCards.tsx
```

Expected: 口コミ、PR、ランキング、Hub表示に関する差分だけを確認できる。差分はバックアップrefに残し、公開コードへは適用しない。

- [x] **Step 2: 現在の公開コードの品質検査を確認する**

Run in `headless/`:

```bash
npm run test:review-rating
npm run test:promotion-disclosure
npm run test:q06-seo-metadata
npm run test:schema-output
```

Expected: すべて終了コード0。現在のQ-04からQ-07の表示条件を維持する。

- [x] **Step 3: 今回は公開コードへ適用しない判断を記録する**

Add this exact result to the current consolidation section in `pm/PROGRESS.md`:

```markdown
- 履歴未保存の口コミ・エリア表示5ファイルは `backup/original-dirty-20260714` に保存した。
- 現在のQ-04からQ-07、S-10実装と競合するため、今回の作業ツリー統合では公開コードへ適用しない。
- 必要性が確認された場合だけ、フォルダ統合後の別タスクで個別に再評価する。
```

Expected: 5ファイルの現在版は変更されず、バックアップrefと進行ログだけで追跡できる。

- [x] **Step 4: 公開UI差分の保留判断をコミットする**

Run:

```bash
git add pm/PROGRESS.md
git commit -m "Record preserved public UI decision"
```

Expected: `pm/PROGRESS.md` だけがコミットされ、`headless/` は変更されない。

### Task 3: ダッシュボード差分10件を公開コードから分離して保留する

**Files:**
- Preserve only in backup ref: `.github/workflows/deploy.yml`
- Preserve only in backup ref: `dashboard/.env.example`
- Preserve only in backup ref: `dashboard/README.md`
- Preserve only in backup ref: `dashboard/app/analytics/page.tsx`
- Preserve only in backup ref: `dashboard/components/WPQuickLinks.tsx`
- Preserve only in backup ref: `dashboard/next.config.ts`
- Preserve only in backup ref: `dashboard/public/api/ga-proxy.php`
- Preserve only in backup ref: `headless/app/dashboard/analytics/page.tsx`
- Preserve only in backup ref: `headless/app/dashboard/layout.tsx`
- Preserve only in backup ref: `headless/app/dashboard/page.tsx`
- Modify: `pm/PROGRESS.md`

**Interfaces:**
- Consumes: 履歴未保存のダッシュボード差分10件
- Produces: 公開コードへ混ぜず、後続ダッシュボードタスクから参照できるバックアップrefと採否メモ

- [x] **Step 1: バックアップrefに10ファイルが存在することを確認する**

Run:

```bash
git ls-tree -r --name-only backup/original-dirty-20260714 -- .github/workflows/deploy.yml dashboard headless/app/dashboard
```

Expected: 上記10ファイルを含む一覧が出る。

- [x] **Step 2: 現在のBlockerを確認する**

Run:

```bash
rg -n "DASH-DESIGN-00|BLK-SECRET|BLK-SUPA-00" pm/BLOCKERS.md
```

Expected: 完成デザイン不足、Secret未確認、Supabase未確認が表示される。

- [x] **Step 3: 公開コードへ統合しない判断を記録する**

Add this exact result to the current consolidation section in `pm/PROGRESS.md`:

```markdown
- 履歴未保存のダッシュボード・配信設定10ファイルは `backup/original-dirty-20260714` に保存した。
- `DASH-DESIGN-00`、`BLK-SECRET`、`BLK-SUPA-00` が残るため、今回の作業ツリー統合では公開コードへ適用しない。
```

- [x] **Step 4: ダッシュボード差分の保留判断をコミットする**

Run:

```bash
git add pm/PROGRESS.md
git commit -m "Record preserved dashboard decision"
```

Expected: `pm/PROGRESS.md` だけがコミットされ、ダッシュボード実装ファイルは変更されない。

### Task 4: production側の統合済みコードを最終検証する

**Files:**
- Verify: `headless/**`
- Verify: `pm/PROGRESS.md`
- Verify: `docs/technical/repository-consolidation-inventory-2026-07-14.md`

**Interfaces:**
- Consumes: Task 1からTask 3の結果
- Produces: 元フォルダへ進められる検証済みコミット

- [x] **Step 1: production側のGit状態を確認する**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: 意図した変更だけが表示され、空白エラーがない。

- [x] **Step 2: 全品質検査を実行する**

Run in `headless/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: すべて終了コード0。

- [x] **Step 3: 最終検証結果を進行ログへ記録する**

Add this exact result to the current consolidation section in `pm/PROGRESS.md`:

```markdown
- production側で `git diff --check`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` が成功した。
- 元フォルダを正本へ戻すTask 5は、ユーザーの明示承認待ちとして未実施。
```

- [x] **Step 4: 最終検証結果をコミットする**

Run:

```bash
git add pm/PROGRESS.md
git commit -m "Verify repository consolidation baseline"
```

Expected: `pm/PROGRESS.md` だけがコミットされ、Task 5は未実施のまま残る。

### Task 5: 明示承認後に元フォルダを正本へ戻す

**Files:**
- Modify worktree state: `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi`
- Remove worktree after verification: `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production`
- Preserve Git ref: `backup/original-dirty-20260714`

**Interfaces:**
- Consumes: Task 4で検証済みのproductionブランチとTask 1のバックアップref
- Produces: 元フォルダだけを正本として使う単一作業ツリー構成

- [x] **Step 1: 削除対象とバックアップコミットをユーザーへ提示する**

Run:

```bash
PRODUCTION_HEAD=$(git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production rev-parse HEAD)
BACKUP_HEAD=$(git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production rev-parse backup/original-dirty-20260714)
printf 'production HEAD: %s\nbackup HEAD: %s\ncleanup target: /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi\nremove after verification: /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production\n' "$PRODUCTION_HEAD" "$BACKUP_HEAD"
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi status --short --branch
```

Expected: 2つのcommit ID、元フォルダの既存差分、整理対象の2パスが表示される。ユーザーが元フォルダ整理を明示承認するまでStep 2へ進まない。

- [x] **Step 2: 承認後、元フォルダをクリーンにして `main` をfast-forwardする**

Run only after explicit approval:

```bash
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi reset --hard HEAD
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi clean -fd
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi merge --ff-only codex/production-baseline-20260713
```

Expected: 元フォルダの `main` がproduction側の検証済みHEADと一致し、作業ツリーがクリーン。

- [x] **Step 3: 元フォルダの `headless/` で再検証する**

Run:

```bash
cd /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi/headless
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: すべて終了コード0。

- [x] **Step 4: production作業ツリーをGit経由で削除する**

Run from the parent repository, not from inside the worktree being removed:

```bash
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi worktree remove /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi worktree prune
```

Expected: production作業ツリーの登録とフォルダがなくなり、元フォルダと `backup/original-dirty-20260714` は残る。

- [x] **Step 5: 最終状態を確認する**

Run:

```bash
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi status --short --branch
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi worktree list
git -C /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi branch --list backup/original-dirty-20260714
```

Expected: 元フォルダがクリーンな `main`、production作業ツリーなし、バックアップrefあり。
