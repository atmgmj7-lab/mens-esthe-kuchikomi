# WordPress日次更新 認証情報ローテーション確認表

Status: `in_progress`（SSHデプロイ移行・初回デプロイ・1店舗疎通試験待ち）

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
| [x] | 特定した旧Xserver SFTP/FTP password候補が提供元で拒否され、無効であることを確認する | 外部確認 | 2026-07-19 | Xserver提供元の認証拒否（値は非表示） |
| [x] | 無効な旧password候補は再発行せず、FTP方式を廃止する方針を確定する | 外部確認 | 2026-07-19 | SSH移行方針（旧password候補は再発行しない） |
| [x] | `.vscode/sftp.json`がGit追跡外かつignore対象であることを確認する | Codex | 2026-07-18 18:51 | `.gitignore`と`git ls-files`で確認 |
| [x] | デプロイ専用SSH keyを外部環境へ設定する | 外部確認 | 2026-07-19 | 外部設定完了（秘密鍵・値は非表示） |
| [ ] | GitHub Actionsのデプロイ処理をFTPからSSHへ移行する |  |  |  |
| [ ] | SSHへ移行した処理で初回デプロイを行い、成功を確認する |  |  |  |
| [x] | GitHubの旧`WP_USER` secretを削除する | Codex | 2026-07-18 18:47 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [x] | GitHubの旧`WP_APP_PASSWORD` secretを削除する | Codex | 2026-07-18 18:47 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [x] | 日次更新専用WordPress userを1名作成する | Codex | 2026-07-18 18:44 | Xserver WP-CLI |
| [x] | 専用userだけへ`escomi_update_daily_shop_data`権限を付与する | Codex | 2026-07-18 18:44 | Xserver WP-CLI（保持者1名） |
| [x] | 専用user用の新Application Passwordを発行する | Codex | 2026-07-18 18:46 | Xserver WP-CLI（値は非表示） |
| [x] | Vercelへ日次更新専用のWordPress認証設定を登録する | Codex | 2026-07-18 18:46 | https://vercel.com/narikiyos-projects/escomi-headless/settings/environment-variables |
| [x] | GitHubへ`DAILY_UPDATE_PROXY_SECRET`を登録する | Codex | 2026-07-18 18:21 | https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/settings/secrets/actions |
| [ ] | 1店舗だけを対象に日次更新の疎通試験を行う |  |  |  |

## 判定

- 現在: `in_progress`（専用SSH keyの外部設定は完了。デプロイ処理のSSH移行・初回デプロイ・1店舗疎通試験は未完了）
- 完了条件: 全項目がチェック済みで、実施者・確認時刻・証跡URLが記入されていること
- 禁止事項: 明示確認のないpush、deploy、本番WordPress更新、本番Supabase更新

## 2026-07-18 補足

- Geminiの現行GitHub secretは、Gemini API専用サービスアカウントへ紐付けた認証キーへ交換し、API 200を確認した。
- 過去キーのうちGoogle Cloud管理下のキーは削除済み。別の公開検出キーはAI Studioの削除処理が失敗したが、Google APIが`reported as leaked`として403拒否することを確認し、実利用不能になっている。
- WordPressは日次更新専用userへ分離し、専用Application PasswordのHTTPS認証200を確認した。管理者userの旧Application Passwordは残数0。
- Supabaseで端末出力候補に挙がったproject refはEskomiではなく別プロジェクトのものだった。Eskomiの公開データ元・本番Supabase設定は変更していない。

## 2026-07-19 補足

- 旧Xserver SFTP/FTP password候補は提供元で拒否され、無効である。旧候補は再発行せず、FTP方式を廃止する。
- デプロイ専用SSH keyの外部設定は完了している。鍵の値はこの文書・ログへ記録しない。
- GitHub ActionsのSSH移行、移行後の初回デプロイ、1店舗だけの日次更新疎通試験は未完了である。
