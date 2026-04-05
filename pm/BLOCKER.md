# ブロッカー管理

## 対応中

### [BLOCK-001] FTPパスワード未取得
- **起票日**: 2026-04-05
- **影響**: GitHub Actions自動デプロイが完成しない
- **解除条件**: FTPパスワード取得 → GitHub Secrets登録完了

### [BLOCK-004] REST APIエンドポイント権限未強化
- **起票日**: 2026-04-05
- **影響**: セキュリティリスク（`ai-engine/v1/update` への不正 POST 等）
- **場所**: `ai-update-log.php`（子テーマ）
- **解除条件**: Application Password 以外の認可強化（署名・カスタムヘッダー・IP 制限等）を設計し実装・本番確認

### [BLOCK-005] ai-site-monitor 本番運用・品質面の未整備
- **起票日**: 2026-04-05
- **影響**: 監視・店舗データ自動更新パイプラインの一部が未整理
- **場所**: 子テーマ `ai-site-monitor/` および `mens-esthe-seo-tools` リポジトリ
- **残タスク例**: 本番での `ai_auto_updater.py` 試験、`.env.example` の Gemini 追記、`crawl4ai` 未使用なら requirements 整理

---

## 解除済み（参考）

### ~~[BLOCK-002] area_map_nav ダミーURL~~ → Google Maps iframe 化済み（2026-04 頃）

### ~~[BLOCK-003] area-seo-hooks-optimized 未接続~~ → `functions.php` で `area-seo-hooks-optimized.php` を読込に変更済み
