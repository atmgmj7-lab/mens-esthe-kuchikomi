# mens-esthe-kuchikomi

作業前に以下を順番に読むこと：
1. pm/PROGRESS.md    - 現在の進行状況・今日のタスク
2. pm/BLOCKER.md     - ブロッカー確認
3. pm/ARCHITECTURE.md - 技術構成（実装時のみ）
4. pm/RUNBOOK.md     - **運用手順・自動実行コマンド・手動/エージェントの境界**
5. pm/CONTENT-IMPLEMENTATION-GUIDE.md - **エリア・店舗の WP コンテンツ入力・AI 分担**（ACF 作業時）

## 鉄則
- 親テーマ(SWELL)直接編集禁止
- mainへpush = 本番反映（GitHub Actions）
- 作業終了時は pm/PROGRESS.md を更新して git push
- **実行指示は RUNBOOK に沿う:** 自動化できる作業は「手動で」と書かず、**コマンドを実行**する（WP管理画面・Secrets初回登録など **RUNBOOK の C** だけ人手）

## エージェント向け
- デプロイ・git pull・`gh workflow run`・`curl` 検証は **エージェントがターミナル実行**する。
- ユーザーに「ターミナルでこれを実行」とだけ渡すのではなく、**自分で実行して結果を報告**する。
