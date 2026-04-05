# 技術構成

## サイト
- URL: https://mens-esthe-kuchikomi.com
- テーマ: WordPress SWELL子テーマ
- サーバー: Xserver sv16727.xserver.jp（xs454693）
- リポジトリ: https://github.com/atmgmj7-lab/mens-esthe-kuchikomi

## 主要ファイル
- functions.php               : メイン機能（約840行）
- area-seo-hooks.php          : エリアSEOフック（稼働中）
- area-seo-hooks-optimized.php: 最適化版（未接続）
- ai-update-log.php           : AI更新ログ・REST
- single-shop.php             : 店舗単体テンプレ（子テーマ）

## よく使うコマンド
詳細は **pm/RUNBOOK.md**。最短デプロイ:

```bash
git add -A && git commit -m "変更内容" && git push origin main
```
