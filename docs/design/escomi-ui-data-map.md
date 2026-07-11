# Escomi UIデータマップ

作成日: 2026-07-12

| UI | ViewModel | 現在の取得元 | 取得不能時 | 品質ルール |
|---|---|---|---|---|
| トップ掲載店舗数 | `shopCount` | `getShopCount()` | `shops.length` fallback | サンプル値を使わない |
| 都道府県店舗数 | `AreaView.count` | `getAreas()` | 掲載準備中 | 0件を店舗ありに見せない |
| 都道府県代表地域 | `KANSAI_AREAS.sub` | 既存定数 | 非表示なし | 地名流用に注意 |
| 都道府県画像 | `KANSAI_TILE_IMAGES` | 既存定数/既存WP画像 | 既存画像がない場合のみNo Image検討 | 画像削除禁止 |
| 重点エリア店舗数 | `AreaView.count` | `getAreas()` | 集計準備中 | サンプル数値禁止 |
| 新着店舗 | `ShopView[]` | `getLatestShops(6)` | セクション空状態 | 料金・評価・PRルール維持 |
| 地域詳細フィルター | `ShopListFilterId[]` | Client state + URL `filter` | 条件解除導線 | URL同期維持 |
| 自然ランキング | `selectRankingTopShops` | `shop-ranking.ts` | 対象不足時は順位番号停止検討 | PR混入禁止 |
| PR枠 | `AreaPromotionSection` | `promotion-disclosure.ts` | 0件は非表示 | rel=sponsored/nofollow |
| 料金 | `PriceLabel` / `price-normalization.ts` | ACF料金 | 店舗へ問い合わせ | 0円表示禁止 |
| 評価 | `RatingBadge` / `review-rating.ts` | 承認済み実口コミ | 口コミ募集中 | 3件未満は総合評価非表示 |
| コンテンツ出自 | `content-provenance.ts` | ACF/本文/口コミ | unknownは口コミ扱いしない | Q-04維持 |
| 店舗画像 | `shop.imageUrl` | WP featured media / ACF | 既存No Image | 画像あり店舗をNo Imageにしない |

## Supabase移行に備える境界

- コンポーネントは可能な限り `AreaView` / `ShopView` / 表示用定数を参照する。
- WordPress固有ACFの直接参照は既存コンポーネント内に限定し、今後ViewModelへ移す。
- 今回はDB・Supabase・WordPress管理画面を変更しない。
