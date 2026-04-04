# ブロッカー管理

## 対応中

### [BLOCK-001] FTPパスワード未取得
- **起票日**: 2026-04-05
- **影響**: GitHub Actions自動デプロイが完成しない
- **解除条件**: FTPパスワード取得 → GitHub Secrets登録完了

### [BLOCK-002] area_map_navダミーURL未設定
- **起票日**: 2026-04-05
- **影響**: エリアページの地図コンテンツが欠損
- **場所**: functions.php内 area_map_nav ショートコード
- **解除条件**: 実際の地図画像URLに差し替え

### [BLOCK-003] area-seo-hooks-optimized.php 未接続
- **起票日**: 2026-04-05
- **影響**: SEO最適化版が使われていない
- **場所**: functions.phpのrequire_once
- **解除条件**: 現行フックと差し替えて動作確認

### [BLOCK-004] REST APIエンドポイント権限未強化
- **起票日**: 2026-04-05
- **影響**: セキュリティリスク
- **場所**: ai-update-log.php
- **解除条件**: 適ubリポジトリ作成 ✅
- GitHub Actions deploy.yml作成 ✅
