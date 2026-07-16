# Eskomi ロゴ・店舗画像fallback置換記録

## 旧参照

- 旧WordPressロゴURL: `http://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png`
- schemaで使っていた同一メディア: `https://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png`
- 旧店舗画像fallback: `/shop-default-image.webp`

## 旧参照の使用箇所

- `headless/components/SiteHeader.tsx`: 非表示の旧ロゴ`img`
- `headless/lib/seo.ts`: Organization schemaのlogo
- `front-page.php`: WordPress予備トップのヒーローロゴ
- `headless/lib/design-constants.ts`: 画像なし店舗の共通fallback

## サイト所有の新候補

- Headlessロゴ: `/images/eskomi-logo.svg`
- 画像なし店舗fallback: `/images/eskomi-shop-fallback.svg`
- WordPressテーマ内ロゴ: `/assets/img/eskomi-logo.svg`

新SVGは濃紺・金・生成りで構成し、正確な`Eskomi`文字を含む。script、外部画像、外部参照を持たない。店舗画像fallbackは4:3で、`Eskomi 店舗画像準備中`を読み上げ名と表示ラベルに使う。

## 今回変更していないもの

- 本番WordPressメディアは削除・差し替え・更新していない。
- 店舗の実写真URLと実写真表示は変更していない。
- push、deploy、本番反映は行っていない。
