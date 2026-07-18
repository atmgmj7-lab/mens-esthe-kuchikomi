# WordPress日次更新 認証情報ローテーション確認表

Status: `in_progress`（Xserver password再発行と1店舗疎通試験待ち）

この確認表の全項目が外部環境で確認されるまで、push・deploy・本番更新の準備完了とは判定しない。認証情報そのものは、この文書・issue・ログ・スクリーンショットへ記録しない。

| 完了 | 確認項目 | 実施者 | 確認時刻（JST） | 証跡URL |
|---|---|---|---|---|
| [x] | 過去に追跡された`ai-site-monitor/.env`とGit履歴に含まれる全WordPress Application Password候補を、値を転記せず提供元で特定する | Codex | 2026-07-18 18:45 | Xserver WP-CLI（値は非表示） |
| [x] | 本実装中の端末出力へ表示されたWordPress Application Password候補を、値を転記せず失効対象へ含める | Codex | 2026-07-18 18:45 | Xserver WP-CLI（値は非表示） |
| [x] | 特定した全WordPress Application Password候補を失効する | Codex | 2026-07-18 18:47 | Xserver WP-CLI（管理者Application Password残数0） |
| [x] | 過去に追跡された`ai-site-monitor/.env`とGit履歴に含まれるGemini API key候補を、値を転記せず提供元で特定して失効する | Codex | 2026-07-18 18:43 | https://aistudio.google.com/app/api-keys |
| [x] | Gemini API keyを再発行し、必要な実行環境だけへ登録する | Codex | 2026-07-18 18:37 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [x] | `ai-site-monitor/.env`がGit追跡外かつignore対象であることを確認する | Codex | 2026-07-18 18:51 | `.gitignore`と`git ls-files`で確認 |
| [x] | 過去に追跡された`.vscode/sftp.json`・Git履歴・端末出力に含まれる全Xserver SFTP/FTP password候補を、値を転記せず提供元で特定する | Codex | 2026-07-18 18:51 | Git履歴監査（値は非表示） |
| [ ] | 特定した全Xserver SFTP/FTP password候補を失効し、新しいpasswordを再発行する |  |  |  |
| [ ] | 再発行したXserver SFTP/FTP passwordを必要な実行環境だけへ再設定する |  |  |  |
| [x] | `.vscode/sftp.json`がGit追跡外かつignore対象であることを確認する | Codex | 2026-07-18 18:51 | `.gitignore`と`git ls-files`で確認 |
| [x] | GitHubの旧`WP_USER` secretを削除する | Codex | 2026-07-18 18:47 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [x] | GitHubの旧`WP_APP_PASSWORD` secretを削除する | Codex | 2026-07-18 18:47 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [x] | 日次更新専用WordPress userを1名作成する | Codex | 2026-07-18 18:44 | Xserver WP-CLI |
| [x] | 専用userだけへ`escomi_update_daily_shop_data`権限を付与する | Codex | 2026-07-18 18:44 | Xserver WP-CLI（保持者1名） |
| [x] | 専用user用の新Application Passwordを発行する | Codex | 2026-07-18 18:46 | Xserver WP-CLI（値は非表示） |
| [x] | Vercelへ日次更新専用のWordPress認証設定を登録する | Codex | 2026-07-18 18:46 | https://vercel.com/narikiyos-projects/escomi-headless/settings/environment-variables |
| [x] | GitHubへ`DAILY_UPDATE_PROXY_SECRET`を登録する | Codex | 2026-07-18 18:21 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [ ] | 1店舗だけを対象に日次更新の疎通試験を行う |  |  |  |

## 判定

- 現在: `in_progress`（Xserver password再発行・実行環境再設定・1店舗疎通試験待ち）
- 完了条件: 全項目がチェック済みで、実施者・確認時刻・証跡URLが記入されていること
- 禁止事項: 完了前のpush、deploy、本番WordPress更新、本番Supabase更新

## 2026-07-18 補足

- Geminiの現行GitHub secretは、Gemini API専用サービスアカウントへ紐付けた認証キーへ交換し、API 200を確認した。
- 過去キーのうちGoogle Cloud管理下のキーは削除済み。別の公開検出キーはAI Studioの削除処理が失敗したが、Google APIが`reported as leaked`として403拒否することを確認し、実利用不能になっている。
- WordPressは日次更新専用userへ分離し、専用Application PasswordのHTTPS認証200を確認した。管理者userの旧Application Passwordは残数0。
- Supabaseで端末出力候補に挙がったproject refはEskomiではなく別プロジェクトのものだった。Eskomiの公開データ元・本番Supabase設定は変更していない。
