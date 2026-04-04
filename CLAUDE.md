# mens-esthe-kuchikomi / CLAUDE.md

## プロジェクト概要
- WordPressポータルサイト（メンズエステ口コミ）
- テーマ: SWELL子テーマ
- 本番URL: https://mens-esthe-kuchikomi.com
- SEO目標: 「日本橋 メンズエステ」10位以内
- サーバー: Xserver（sv16727.xserver.jp）

## デプロイ
- mainブランチにpushで自動デプロイ（GitHub Actions / FTP）
- FTP先: /mens-esthe-kuchikomi.com/public_html/wp-content/themes/swell_child/

## 開発ルール
- 親テーマ(SWELL)は直接編集しない
- フックはfunctions.phpに集約
- CSSはcss/以下に分割管理
- AI自動更新スクリプトはai-site-monitor/以下

## ブランチ運用
- main: 本番反映（pushで即デプロイ）
- 大きな変更はブランチ切って動作確認後にmerge
