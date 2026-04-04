# Cursor 現状調査プロンプト集

---

## 【起動時】プロジェクト全体把握

以下の順番でファイルを読んでプロジェクトの現状を把握してください。
1. CLAUDE.md
2. pm/PROGRESS.md
3. pm/BLOCKER.md
4. .github/workflows/deploy.yml

把握後、日本語で報告してください：
- 完了済みタスク
- 現在のブロッカー
- 今日取り組む優先タスク

---

## 【SEO調査】現状コード調査

以下を読んでSEO実装状況を調査してください。
1. functions.php
2. css/以下のファイル一覧
3. template-parts/以下のファイル一覧
4. ai-site-monitor/

調査後に報告：
- 現在のSEO施策
- 「日本橋 メンズエステ」に対して不足している実装
- 優先度順の改善提案3つ

---

## 【デプロイ確認】GitHub Actions状況確認

.github/workflows/deploy.ymlを読んで以下を確認：
1. 設定に問題がないか
2. 必要なSecrets変数が全て定義されているか
3. FTP_PATHが正しいか

問題があれば修正案を出してください。

---

## 【コンテンツ改善】日本橋ページ調査

以下を調査して改善点を洗い出してください。
1. 「日本橋」関連テンプレートファイルを探す
2. ACF-FIELDS-SETUP.mdを読む
3. COMPETITIVE-ANALYSIS-REPORT.mdを読む

競合（リフナビ・週刊エステ）と比較して不足要素を優先度順で5つ。

---

## 【AI自動更新】モニター状況確認

ai-site-monitor/フォルダを調査：
1. scraping_errors.logの直近エラー確認
2. ai_auto_updater.pyの現在設定確認
3. DEPLOY-AI-UPDATE.mdを読む

動いていない原因と再稼働手順を報告してください。

---

## 【ログ更新】進行管理ログに追記

pm/PROGRESS.md の「ログ」セクションに今日の作業内容を追記してください。
フォーマット：
### YYYY-MM-DD
#### 完了
- （作業内容）
#### 次のアクション
- [ ] （タスク）
