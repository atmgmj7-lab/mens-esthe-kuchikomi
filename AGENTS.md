# Escomi (mens-esthe-kuchikomi.com) — AGENTS.md

## プロジェクト概要
関西メンズエステ専門の口コミ・店舗情報ポータル「エスコミ」。
WordPress + SWELL子テーマ構成。エリアSEO・店舗詳細・AI編集部コンテンツを含む掲載型ポータル。

## サーバー情報
- サーバー: エックスサーバー (xs454693@sv16727.xserver.ne.jp)
- WordPressパス: /home/xs454693/mens-esthe-kuchikomi.com/public_html/
- テーマパス: /home/xs454693/mens-esthe-kuchikomi.com/public_html/wp-content/themes/swell_child/
- 本番URL: https://mens-esthe-kuchikomi.com

## 技術スタック
- WordPress + SWELL親テーマ (v2.16.0) + swell_childテーマ
- カスタム投稿タイプ: shop（店舗情報）
- タクソノミー: area（エリア）、shop_category、shop_feature
- プラグイン: ACF、WP All Import、CloudSecure
- デプロイ: GitHub Actions（mainへのpush = 本番自動反映）

## 鉄則
- 親テーマ(SWELL)直接編集禁止
- mainへpush = 本番反映（必ずレビュー後）
- ACFフィールド取得は必ず get_field('field_name', 'term_' . $term_id) 形式
- SWELLフックを優先: swell_before_post_list / swell_after_post_list

## 主要ファイル
- front-page.php: トップページ
- single-shop.php: 店舗詳細ページ
- area-seo-hooks.php: エリアSEOコンテンツ挿入
- functions.php: カスタム機能登録
- shop-ai-display.php: AI編集部コメント表示
- css/base.css / front-page.css / single.css: スタイル

## Antigravityエージェントへの指示
- 作業前に pm/PROGRESS.md と pm/BLOCKER.md を必ず確認する
- コード生成後は必ずArtifactとして実装計画を出力する
- 本番反映前にユーザー確認を取る
- git pushは明示的な指示があった場合のみ実行する
# deploy test 2026年  4月 29日 水曜日 21:19:08 JST
