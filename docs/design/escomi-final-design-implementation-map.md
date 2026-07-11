# Escomi完成形デザイン 実装対応表

作成日: 2026-07-12
対象: `headless/` 公開画面
禁止範囲: WordPress更新、Supabase接続、DB変更、本番デプロイ、Secret操作

## 実装方針

完成形HTMLは、公開4ページの理想UIと状態仕様を示す資料として扱う。灰色・モノスペースの `DB:` / `実装:` / `状態:` 注記は実装仕様であり、公開画面には表示しない。

今回は段階実装のPhase 1/2として、共通トークンとトップページの画像アコーディオン・画像付き重点エリアを実装する。都道府県ページ、地域詳細ページ、店舗詳細ページは既存機能を維持し、次フェーズで段階的に移行する。

## 対応表

| デザインセクション | 現在の実装 | 使用データ | 対応方針 | 画像維持 | アニメーション維持 |
|---|---|---|---|---|---|
| 1a トップFV | `headless/components/HomePageContent.tsx` | `getShopCount`, `getLatestShops`, `getAreas`, `getLatestPosts` | コピーと配色を完成形へ寄せる。取得不能な口コミ総数・料金確認済み総数は表示しない | 既存ロゴ画像を維持 | 既存フェードを維持 |
| 1a 都道府県画像アコーディオン | `headless/components/KansaiAreaGrid.tsx` | `areas.count`, `KANSAI_AREAS`, `KANSAI_TILE_IMAGES` | 白カードへ置換せず、写真アコーディオンを完成形データ表示付きに更新 | 大阪・京都・兵庫・奈良・滋賀・和歌山の既存画像を維持 | hover/focus展開、mobileカード表示、reduced motion対応 |
| 1a 重点エリア | `headless/components/AreaFeatureSection.tsx` | `AREA_FEATURES`, `areas.count` | 日本橋専用固定から配列ベースへ変更し、画像付き重点エリアとして再利用可能化 | 日本橋画像を維持 | 既存カードhoverを維持 |
| 1a 条件から探す | `HomePageContent.tsx` のチップ | 既存リンク | 今回は維持。次フェーズで集計値付きカード化 | 画像なし | 既存hover維持 |
| 1a 新着店舗 | `ShopCard` | `getLatestShops(6)` | 今回は維持。Q-02/Q-03の料金・評価ルールを維持 | 店舗画像を維持 | 既存カードhover維持 |
| 1b 都道府県エリア | `AreaPageView` または `AreaHubPageTemplate` | `getAreaBySlug`, `getChildAreas`, `getAreaShops` | 次フェーズ。大量羅列を主要エリア・詳細エリア・近隣導線へ整理 | エリア画像を維持 | 既存hover維持 |
| 1c 地域詳細 | `AreaHubPageTemplate`, `area-hub-content`, `AreaShopList` | `getAreaRankingShops`, Q-01〜Q-05 helper | 次フェーズ。フィルター/URL同期/PR分離/ランキング/店舗一覧を完成形へ寄せる | 店舗画像を維持 | `AreaShopList` Client範囲を維持 |
| 1d 店舗詳細 | `ShopDetail`, `ShopContactCta` | `getShopBySlug`, `price-normalization`, `review-rating`, `content-provenance` | 次フェーズ。FV、CTA、料金表、出自別セクション、画像ギャラリーを整理 | 店舗メイン画像を維持 | mobile固定CTAを維持 |
| 1e/1f ダッシュボード | `headless/app/dashboard/*`, `dashboard/` | GA4/Search Console/Supabase予定 | ZIP内に実画面デザインがないため今回実装しない | 対象外 | 対象外 |

## 再利用できる既存コンポーネント

| コンポーネント | 用途 | 方針 |
|---|---|---|
| `KansaiAreaGrid` | 都道府県画像アコーディオン | Phase 1/2で更新済み |
| `AreaFeatureSection` | 画像付き重点エリア | Phase 1/2で配列ベースへ更新済み |
| `ShopCard` | 新着店舗 | 維持 |
| `AreaShopList` | 地域詳細の店舗一覧・フィルター | 次フェーズでUI調整 |
| `AreaPromotionSection` | PR/広告枠 | Q-05維持 |
| `PriceLabel` | 料金表示 | Q-02維持 |
| `RatingBadge` | 評価表示 | Q-03維持 |
| `ShopContactCta` | 店舗CTA | Q-05 rel制御維持 |

## 新規作成が必要なコンポーネント候補

| 候補 | 目的 | 実装タイミング |
|---|---|---|
| `PrefectureAreaOverview` | 1b 都道府県ページの主要エリア/詳細エリア整理 | Phase 3 |
| `AreaFilterDrawer` | 1c mobileフィルター下部シート | Phase 4 |
| `ShopDetailGallery` | 1d 店舗画像ギャラリー | Phase 5 |
| `ShopSourceSections` | ユーザー口コミ/編集部/店舗提供/AI要約の出自別表示 | Phase 5 |

## データ取得元

| データ | 現在の取得元 | 現在の扱い | Supabase移行時の想定 |
|---|---|---|---|
| 店舗数 | WordPress REST `shop` total / `area.count` | 表示可 | `shops` + `shop_area_relations` 集計 |
| 口コミ総数 | 未接続または不完全 | 架空表示しない | `reviews(status=approved)` 集計 |
| 料金確認済み件数 | 店舗ごとの正規化は可能、全体集計未整備 | 全体数は表示しない | `shop_prices(status=confirmed)` 集計 |
| 画像 | WP featured media / ACF / 既存定数 | 維持 | storage URLまたはimage table |
| PR | `promotion-disclosure.ts` | 自然順位から分離 | `promotions(status=active)` |

## 表示条件

| 項目 | 表示条件 | 非表示/代替 |
|---|---|---|
| 店舗数 | `count > 0` | 0件は掲載準備中 |
| 口コミ数 | 承認済み件数が取得できる場合のみ | 口コミは承認制で掲載 |
| 料金確認済み総数 | 全体集計が取得できる場合のみ | 各店舗詳細で確認 |
| PR枠 | Q-05でPR対象がある場合のみ | 0件はセクション非表示 |
| 画像 | URLがある場合 | 既存No Image |

## 未確認事項

| 項目 | 状態 | 対応 |
|---|---|---|
| 承認済み口コミの全体集計 | 未整備 | Supabase移行またはWP側集計追加時に対応 |
| 料金確認済みの全体集計 | 未整備 | `price-normalization` を集計処理へ接続 |
| 店舗ギャラリー複数画像 | ACFキー未確定 | Phase 5で調査 |
| ダッシュボード完成形デザイン | 不足 | `DASH-DESIGN-00` BLOCKER |

## 実装順

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 共通デザイントークン・トップ基盤 | 実施 |
| 2 | トップページ画像アコーディオン・重点エリア | 実施 |
| 3 | 都道府県エリアページ | 次回 |
| 4 | 地域詳細ページ | 次回以降 |
| 5 | 店舗詳細ページ | 次回以降 |
| 6 | 総合ブラウザー検証 | Phase 3以降で実施 |

## 影響範囲

- 公開トップページ `/`
- 既存CSS `headless/app/globals.css`
- 既存画像定数 `headless/lib/design-constants.ts`
- Q-01〜Q-05の品質ヘルパーは変更しない

## 2026-07-12 Phase 2: エリア詳細ページUI移行

| 対象 | 実装状況 | 備考 |
|---|---|---|
| `AreaHubPageTemplate` | 実装済み | SEOハブ型エリアページの上部を完成形の画像+本文カードへ移行 |
| `AreaPageView` | 実装済み | 通常エリアページにも完成形サマリーを追加 |
| 口コミ/編集部/PRの区別 | 維持 | 上部に情報ソース分離の注記を表示 |
| 店舗数 | 維持 | WordPress由来の `area.count` を表示。0件は掲載準備中 |
| 料金・口コミの安全表示 | 維持 | 既存Q-01〜Q-05のロジックを変更しない |
| ダッシュボード | 未実装 | 完成デザイン素材不足のためBLOCKER継続 |

## 2026-07-12 Phase 3: 店舗詳細ページUI移行

| 対象 | 実装状況 | 備考 |
|---|---|---|
| `ShopDetail` | 実装済み | 店舗詳細ファーストビューを完成形の画像・本文・統計・CTA構成へ移行 |
| `ShopContactCta` | 実装済み | 店舗詳細内ナビから予約・問い合わせへ移動できるアンカーを追加 |
| 料金表示 | 維持 | `price-normalization` の正規化済み表示のみ使用。未確認は問い合わせ文言 |
| 口コミ/編集部/店舗提供/PRの区別 | 維持 | 店舗詳細上部にも出自分離の注記を表示 |
| JSON-LD | 変更なし | 既存 `shopLocalBusinessJsonLd` のまま |
| ダッシュボード | 未実装 | 完成デザイン素材不足のためBLOCKER継続 |

## 2026-07-12 Phase 4: 共通ヘッダー/フッター/細部整合

| 対象 | 実装状況 | 備考 |
|---|---|---|
| `SiteHeader` | 実装済み | 完成形デザインに合わせて `Escomi.` ブランド、主要導線、検索導線へ整理 |
| `SiteFooter` | 実装済み | 運営説明、主要導線、口コミ/編集部/店舗提供/PR分離ポリシーを追加 |
| 共通CSS | 実装済み | トップ、エリア、店舗詳細と同じクリーム/ネイビー/金/ティールのトーンへ統一 |
| ダッシュボード | 未実装 | 公開サイト共通部品からは除外。完成デザイン素材不足のためBLOCKER継続 |
| データ取得/DB | 変更なし | 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし |

## 2026-07-12 Phase 5: 最終横断確認とデプロイ前整理

| 対象 | 結果 | 備考 |
|---|---|---|
| `npm run lint` | 成功 | ESLint通過 |
| `npm run typecheck` | 成功 | TypeScript通過 |
| `npm test` | 成功 | Q-01〜Q-05と完成形UI保全テスト通過 |
| `npm run build` | 成功 | 440/440ページ生成 |
| `/` | 成功 | 1440/1024/390/360px確認 |
| `/area/osaka/` | 成功 | 1440/1024/390/360px確認 |
| `/area/nihonbashi/` | 成功 | 1440/1024/390/360px確認 |
| `/shops/zenith-spa.../` | 成功 | 1440/1024/390/360px確認 |
| `/dashboard` | 成功 | 公開サイト用ヘッダー/フッターが出ないことを確認 |
| 公開DB注記 | 成功 | `DB:` の公開露出なし |
| 横スクロール | 成功 | 主要幅で横スクロールなし |

### 本番反映前の残確認

- GitHub Actions/Vercelの本番反映は未実行。
- 本番反映前に、既存の未コミット変更が今回UI移行以外も含む点を確認する必要がある。
- サーバー停止時の `useSearchParams()` bailoutログは継続。今回UIの検証は成功しているが、別タスクで原因整理する。
