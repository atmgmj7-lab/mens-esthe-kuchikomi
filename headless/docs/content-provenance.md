# Q-04 Content Provenance Specification

更新日: 2026-07-11
対象: Next.js App Router公開画面

## 目的

ユーザー投稿口コミ、掲載情報コメント、店舗紹介文、店舗提供情報、AI生成経路の文章、PR/広告文章、出自不明文章を混在させない。
出自を証明できない文章はユーザー口コミとして表示・集計・評価しない。

## コンテンツ種別

| source_type | 扱い | 口コミ件数 | 評価計算 | 公開表示 |
|---|---|---:|---:|---|
| user-review | 投稿経路、承認、公開、店舗紐付け、本文が確認できるユーザー投稿 | 対象 | 有効ratingのみ対象 | 口コミ欄 |
| editorial-comment | 編集部・運営が整理した掲載情報コメント | 対象外 | 対象外 | 別欄 |
| shop-provided | 店舗提供・公式情報 | 対象外 | 対象外 | 店舗情報欄 |
| shop-description | 店舗紹介文、本文、キャッチ、推しポイント | 対象外 | 対象外 | 店舗紹介欄 |
| ai-generated | AI生成経路が明示された文章 | 対象外 | 対象外 | 口コミ欄から除外。公開方針は人間確認 |
| promotion | PR/広告/スポンサー文章 | 対象外 | 対象外 | Q-05へ送る |
| unknown | 出自不明 | 対象外 | 対象外 | 口コミとして非表示 |

## 現在のデータフロー

| コンテンツ | WordPress投稿タイプ | ACFフィールド | Next.js取得関数 | 変換処理 | 表示コンポーネント | 現在の分類 |
|---|---|---|---|---|---|---|
| ユーザー口コミ候補 | reviews | user_reviews / reviews | 未接続。投稿は `/api/reviews/submit` 経由 | `content-provenance.ts` / `review-rating.ts` | `ShopDetail`, `AreaLatestReviews` | 明示条件を満たす場合のみ user-review |
| ACF手入力口コミ件数 | shop | review_count / shop_review_count | `getShopBySlug`, `getAreaRankingShops` | `parseReviewCount` は referenceCount のみ | 店舗カード/Hub統計 | 実口コミ件数には使わない |
| 掲載情報コメント | shop | shop_ai_summary | `getShopBySlug`, `getAreaRankingShops` | `normalizeShop` | `ShopDetail`, shop cards | ai-generated または掲載情報コメント扱い |
| 店舗紹介 | shop | content / shop_catch / recommend_text | `getShopBySlug`, `getAreaRankingShops` | `normalizeShop` | `ShopDetail` | shop-description |
| 店舗提供情報 | shop | shop_hours / shop_tel / shop_booking / official_url 等 | `getShopBySlug`, `getAreaRankingShops` | `normalizeShop` | 店舗詳細データ | shop-provided |
| PR文章 | shop | ranking/pr系ACF | `getAreaRankingShops` | `normalizeShopRanking` | Ranking UI | promotion候補。Q-05で最終整理 |
| 出自不明文章 | shop / unknown | 未確認 | 未確認 | `content-provenance.ts` | 口コミ欄から除外 | unknown |

## ユーザー口コミ判定条件

次のすべてを満たす場合のみ `canDisplayAsUserReview=true` とする。

- sourceType が `user-review`
- moderationStatus が `approved`
- publicationStatus が `published`
- isPublic が true
- shopId または shopSlug による店舗紐付けがある
- body が空でない
- editorial / ai-generated / promotion / unknown ではない

ACFの `review_count` と `shop_review_count` は、実体レコード一致が確認できない限り `referenceCount` としてのみ扱う。

## Q-03評価計算との接続

`review-rating.ts` は `content-provenance.ts` の判定を使用する。
AggregateRating条件は次のまま維持する。

- 表示可能なユーザー口コミ3件以上
- 有効rating3件以上
- 編集部コメント、AI生成文、PR文章、unknownを含めない
- `lib/seo.ts` では現時点でAggregateRatingを出力しない

## 投稿フォーム経路

| 項目 | 現状 |
|---|---|
| フォーム | `/reviews/submit?shop=...` |
| API | `/api/reviews/submit` |
| 保存先 | WordPress REST API `/wp/v2/reviews` |
| 投稿タイプ | reviews |
| 作成時ステータス | `pending` |
| meta | review_shop_id, review_shop_slug, reviewer_name, used_period, rating_total, approval_status など |
| スパム対策 | honeypot + IP rate limit |
| 公開取得 | 未接続。R-01で承認済み公開取得経路が必要 |

## WordPress側の対応

| 分類 | 内容 |
|---|---|
| 修正不要 | Next.js側でunknown除外、ACF手入力件数の実口コミ除外は対応済み |
| 修正推奨 | reviews CPTの公開取得API、approval_status、review_shop_id、投稿者種別、AI/PRフラグの明示 |
| 修正必須 | Next.js側で安全に除外できない混在データが公開表示に残る場合のみ |
| 人間確認 | 既存ACF本文を実口コミとして認定するか、AI生成文を公開するか、店舗提供情報の最終ラベル |

## Supabase移行要件

必要フィールド候補:

```text
id
shop_id
source_type
moderation_status
publication_status
body
rating
author_name
author_id
submitted_at
approved_at
approved_by
is_ai_generated
is_promotion
source_system
source_post_type
source_post_id
source_field
created_at
updated_at
```

出自不明データは移行前に `unknown` として隔離し、口コミテーブルへ自動投入しない。

## R-01へ送る内容

口コミ投稿、仮保存、スパム判定、承認、却下、非公開、削除、公開、店舗紐付け、投稿者情報、匿名化、評価値、通報、変更履歴、承認者、承認日時、AI生成判定、PR判定、個人情報保護。

## Q-05へ送る内容

PR文章の判定方法、sponsored / promotionフラグ、店舗提供情報とPR情報の違い、PR店舗の別枠表示、PRラベル、広告掲載の説明、ランキングとの分離、schema上の扱い、metadata上の扱い。
