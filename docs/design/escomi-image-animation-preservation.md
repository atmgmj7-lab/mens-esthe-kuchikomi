# Escomi 画像・アニメーション維持資料

作成日: 2026-07-12

| 画像・アニメーション | 現在位置 | 実装ファイル | 維持方法 | Mobile対応 | データ元 |
|---|---|---|---|---|---|
| 大阪画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | `KANSAI_TILE_IMAGES.osaka` を背景画像として維持 | 画像付きカードとして縦並び | 既存URL |
| 京都画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | `KANSAI_TILE_IMAGES.kyoto` を維持 | 画像付きカードとして縦並び | 既存URL |
| 兵庫画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | `KANSAI_TILE_IMAGES.hyogo` を維持 | 画像付きカードとして縦並び | 既存URL |
| 奈良画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | `KANSAI_TILE_IMAGES.nara` を維持 | 画像付きカードとして縦並び | 既存WP画像 |
| 滋賀画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | `KANSAI_TILE_IMAGES.shiga` を維持 | 画像付きカードとして縦並び | 既存WP画像 |
| 和歌山画像パネル | トップ「人気エリアから探す」 | `KansaiAreaGrid.tsx`, `design-constants.ts` | 0件でも画像を残し、掲載準備中表示 | 画像付きカードとして縦並び | 既存WP画像 |
| 画像アコーディオンhover | トップ都道府県 | `globals.css` | flex比率を250〜450ms範囲で変更 | hover依存にしない | CSS |
| 画像アコーディオンfocus | トップ都道府県 | `KansaiAreaGrid.tsx`, `globals.css` | `onFocus` と `focus-visible` で展開・輪郭表示 | タップ領域44px以上 | Client Component局所化 |
| reduced motion | トップ都道府県 | `globals.css` | `prefers-reduced-motion` でtransition停止 | 同一 | CSS |
| 日本橋画像付き特集 | トップ重点エリア | `AreaFeatureSection.tsx`, `design-constants.ts` | `AREA_FEATURES` 配列の画像として維持 | 1カラム表示 | 既存WP画像 |
| 店舗カード画像 | 新着店舗・一覧・店舗詳細 | `ShopCard`, `ShopCardLuxury`, `ShopDetail` | 今回変更しない。No Image化しない | 既存レスポンシブ維持 | WP featured media / ACF |

## 今回の維持判断

- 白カードグリッドだけへの置換はしない。
- 既存画像URLは削除しない。
- トップ画像アコーディオンのみ小さなClient Component化し、ページ全体のClient Component化はしない。
- デザインHTML内のDB注記は公開画面に出さない。
