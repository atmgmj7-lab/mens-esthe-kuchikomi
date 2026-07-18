# WordPress日次更新 認証情報ローテーション確認表

Status: `required`

この確認表の全項目が外部環境で確認されるまで、push・deploy・本番更新の準備完了とは判定しない。認証情報そのものは、この文書・issue・ログ・スクリーンショットへ記録しない。

| 完了 | 確認項目 | 実施者 | 確認時刻（JST） | 証跡URL |
|---|---|---|---|---|
| [ ] | 過去に追跡された`ai-site-monitor/.env`とGit履歴に含まれる全WordPress Application Password候補を、値を転記せず提供元で特定する |  |  |  |
| [ ] | 本実装中の端末出力へ表示されたWordPress Application Password候補を、値を転記せず失効対象へ含める |  |  |  |
| [ ] | 特定した全WordPress Application Password候補を失効する |  |  |  |
| [ ] | 過去に追跡された`ai-site-monitor/.env`とGit履歴に含まれるGemini API key候補を、値を転記せず提供元で特定して失効する |  |  |  |
| [ ] | Gemini API keyを再発行し、必要な実行環境だけへ登録する |  |  |  |
| [ ] | `ai-site-monitor/.env`がGit追跡外かつignore対象であることを確認する |  |  |  |
| [ ] | GitHubの旧`WP_USER` secretを削除する |  |  |  |
| [ ] | GitHubの旧`WP_APP_PASSWORD` secretを削除する |  |  |  |
| [ ] | 日次更新専用WordPress userを1名作成する |  |  |  |
| [ ] | 専用userだけへ`escomi_update_daily_shop_data`権限を付与する |  |  |  |
| [ ] | 専用user用の新Application Passwordを発行する |  |  |  |
| [ ] | Vercelへ日次更新専用のWordPress認証設定を登録する |  |  |  |
| [ ] | GitHubへ`DAILY_UPDATE_PROXY_SECRET`を登録する |  |  |  |
| [ ] | 1店舗だけを対象に日次更新の疎通試験を行う |  |  |  |

## 判定

- 現在: `required`（本番操作未実施）
- 完了条件: 全項目がチェック済みで、実施者・確認時刻・証跡URLが記入されていること
- 禁止事項: 完了前のpush、deploy、本番WordPress更新、本番Supabase更新
