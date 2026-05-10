# ブロッカー管理

## 対応中

### [BLOCK-005] ai-site-monitor 本番運用・品質面の未整備
- **起票日**: 2026-04-05
- **影響**: 監視・店舗データ自動更新パイプラインの一部が未整理
- **場所**: 子テーマ `ai-site-monitor/` および `mens-esthe-seo-tools` リポジトリ
- **残タスク例**: 本番での `ai_auto_updater.py` 試験、`.env.example` の Gemini 追記、`crawl4ai` 未使用なら requirements 整理

---

## 解除済み（参考）

### ~~[BLOCK-004] REST APIエンドポイント権限未強化~~ → **緩和済み（Resolved）**（2026-05-10）
- **内容**: `/wp-json/escomi/v1/update` を **POST のみ**にし、`permission_callback` で `current_user_can('edit_posts')` を要求。自動更新ジョブは Application Password の HTTP Basic と組み合わせて認証。**任意の追加ハードニング**（IP 許可リスト・署名ヘッダー等）は要件に応じて別検討可。

### ~~[BLOCK-001] FTP / 自動デプロイの設定待ち~~ → **解決済み（Resolved）**（2026-05-09）
- **解決内容**: GitHub Repository Secrets（`FTP_HOST` / `FTP_USERNAME` / `FTP_PASSWORD` / `FTP_PATH`）の登録および `SamKirkland/FTP-Deploy-Action` によるワークフロー運用。dry-run での疎通確認後、`dry-run` を解除し本番へのファイル転送を有効化済み。

### ~~[BLOCK-002] area_map_nav ダミーURL~~ → Google Maps iframe 化済み（2026-04 頃）

### ~~[BLOCK-003] area-seo-hooks-optimized 未接続~~ → `functions.php` で `area-seo-hooks-optimized.php` を読込に変更済み
