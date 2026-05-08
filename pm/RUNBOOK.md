# 運用 Runbook（実行手順）

**目的:** 手順を迷わず再現する。Claude Code / Cursor のエージェントは、**ここに書いたコマンドをそのまま実行**し、**「手動のみ」と明記した項目以外**は人に任せない。

---

## 作業の種類（先に分類する）

| 区分 | 意味 | 誰がやるか |
|------|------|------------|
| **A. エージェント自動** | ターミナル・Git・GitHub CLI・curl だけで完結 | **Cursor / Claude に実行させる** |
| **B. 秘密情報が要る自動** | `.env` や GitHub Secrets がローカル／CI に既にある前提 | 秘密が揃っていれば **エージェント実行可**。無ければ先に **人がファイル登録** |
| **C. 手動のみ** | WordPress 管理画面のクリック操作・口頭でしか渡せない情報 | **人**（エージェントは手順書とチェックリストだけ出す） |

---

## A. エージェントにそのまま実行させるコマンド

### 1. 子テーマ `mens-esthe-kuchikomi` をデプロイ（本番反映）

**原則:** `main` へ `push` すると GitHub Actions（FTP）が動く。エージェントは **commit まで一気に**やる。

```bash
cd ~/Desktop/dev/swell_child
git status
git add -A
git commit -m "feat: 変更内容を一言で"
git push origin main
```

**確認（自動）:**

```bash
curl -sS -o /dev/null -w "%{http_code}" "https://mens-esthe-kuchikomi.com/"
```

### 2. 本番 HTML の一部確認（例: 地図 iframe）

```bash
curl -sS "https://mens-esthe-kuchikomi.com/area/osaka/" | grep -E 'lux-map-iframe|MAP SEARCH' | head -5
```

### 3. REST `ai-engine` の生存確認

```bash
curl -sS "https://mens-esthe-kuchikomi.com/wp-json/ai-engine/v1/update"
```

200 かつ JSON に `status` が含まれればよい。

### 4. `mens-esthe-seo-tools` — リポジトリ更新＆サイト監視ワークフロー手動起動

**前提:** マシンに `gh`（GitHub CLI）が入り、`gh auth login` 済み。

#### ステップバイステップ（エージェントは上から順に実行）

| Step | 内容 | コマンド |
|------|------|----------|
| **A-4.1** | 監視リポジトリへ移動し、リモートを取り込む | `cd ~/Desktop/dev/mens-esthe-seo-tools && git pull origin main` |
| **A-4.2** | Daily Site Monitor を手動起動 | `gh workflow run "Daily Site Monitor" --ref main` |
| **A-4.3** | 直近の run ID を取得 | `gh run list --workflow="Daily Site Monitor" -L 1 --json databaseId,status` |
| **A-4.4** | 完了まで待つ（`<RUN_ID>` は A-4.3 の `databaseId`） | `gh run watch <RUN_ID> --exit-status` |
| **A-4.5** | Actions が push した成果物を取り込む | `cd ~/Desktop/dev/mens-esthe-seo-tools && git pull origin main` |
| **A-4.6** | 監視対象とハッシュを表示 | `cat ai-site-monitor/sites.json` と `cat ai-site-monitor/data/hashes.json` |
| **A-4.7** | 最新の変更レポートを確認 | `ls -t ai-site-monitor/results/changes_*.json \| head -1 \| xargs cat` |

**一括用（起動まで）:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools
git pull origin main
gh workflow run "Daily Site Monitor" --ref main
```

**実行完了待ち:**

```bash
gh run list --workflow="Daily Site Monitor" -L 3
gh run watch <RUN_ID> --exit-status
```

**結果ファイル取得:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools
git pull origin main
cat ai-site-monitor/sites.json
cat ai-site-monitor/data/hashes.json
ls -la ai-site-monitor/results/
```

**合格条件（実装確認）:**

1. `sites.json` 内の URL 本数 = `data/hashes.json` のオブジェクトキー数。
2. 最新の `results/changes_*.json` の `total_sites` が 1 と同じ数。
3. `gh run watch` が exit code 0（ワークフロー成功）。

---

## B. 秘密情報あり — 揃えばエージェント実行、無ければ人が先に準備

### 1. `ai-site-monitor` の `main.py`（監視のみ）をローカルで試す

**準備（人）:** `ai-site-monitor/.env` に `GEMINI_API_KEY`（任意: `DISCORD_WEBHOOK_URL`）。

**実行（エージェント可）:**

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="（.env の値を使う場合は source ではなく dotenv）"
# または: set -a && source .env && set +a
python main.py
```

### 2. `ai_auto_updater.py`（Playwright + WordPress 更新）

**準備（人）:** 同じく `ai-site-monitor/.env` に  
`WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`。  
初回のみ Playwright ブラウザ。

```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
source .venv/bin/activate
playwright install chromium
set -a && source .env && set +a
python ai_auto_updater.py
```

**注意:** スクリプト内 `CRAWL_LIMIT` はテスト用に小さめ。本番前に値の確認を。

**GitHub Actions について:** エックスサーバー等では、外向きの `/wp-json` がWordPress に届く前に **エッジの 403**（ホスト固有 HTML、`Copyright XSERVER Inc.` 等）になることがあります。その場合は **サーバー内の cron** でこのスクリプトを実行する（サーバー内からの `curl`/Python は通ることが多い）、またはサーバーパネル・サポートで **ブロック／許可 IP（GitHub Actions は出口 IP が変わる）** を確認してください。

---

## C. 手動のみ（エージェントは「指示・チェックリスト」まで）

- **WordPress 管理画面:** エリアタームの ACF（導入文・ランキング・コラム・FAQ 等）  
  → 手順の参照: **`pm/ACF-FIELDS-SETUP.md`（正本）**、索引はルート `ACF-FIELDS-SETUP.md`、競合視点は `SEO-OPTIMIZATION-GUIDE.md`
- **GitHub の Repository secrets**（FTP / GEMINI 等）の**初回登録**（ブラウザ）
- **Xserver パネル・ドメイン・メール**などホスティング固有の操作

**エージェント向け指示例（コピペ用）:**

> 「`pm/RUNBOOK.md` の **C** に該当する。コード変更は不要。人が WP の **エリア → 日本橋** のターム編集で ACF を入力する。フィールド名は `pm/ACF-FIELDS-SETUP.md` に従う。」

---

## エージェントへの依頼の書き方（テンプレ）

**悪い例:** 「デプロイして」（曖昧）  
**良い例:**  
「`~/Desktop/dev/swell_child` で変更をコミットし、`main` に push。続けて RUNBOOK **A-2** の curl で `/area/osaka/` を確認。」

**悪い例:** 「監視を確認して」（手動前提になりがち）  
**良い例:**  
「`mens-esthe-seo-tools` で `git pull` し、RUNBOOK **A-4** の `gh workflow run` で Daily Site Monitor を実行。終わったら `git pull` して `changes_*.json` の `total_sites` を読み取って報告。」

---

## 関連ファイル

| ファイル | 内容 |
|----------|------|
| `pm/PROGRESS.md` | 日付ログ・次タスク |
| `pm/BLOCKER.md` | ブロッカー |
| `pm/ARCHITECTURE.md` | 技術構成 |
| `CLAUDE.md` | 作業前に読む順序 |
