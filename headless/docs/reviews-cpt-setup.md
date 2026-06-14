# 口コミ投稿（reviews CPT）セットアップ

## 概要

ヘッドレス Next.js から WordPress `reviews` CPT へ **pending（承認待ち）** で保存する。

- フロント: `/reviews/submit?shop={shopSlug}`
- API: `POST /api/reviews/submit`
- WP REST: `POST /wp-json/wp/v2/reviews`（Application Password）

## WordPress 側（本番反映前に実施）

1. `swell_child/reviews-cpt.php` をデプロイ（`functions.php` から require 済み）
2. WP 管理画面 → ユーザー → Application Passwords で専用ユーザーを作成
3. 権限: `edit_posts` 以上（投稿作成可能、公開は管理者が手動）

### 確認

```bash
curl -s "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/types" | jq '.reviews'
curl -s -o /dev/null -w "%{http_code}" "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/reviews"
# 401 or 200 (not 404) after CPT deploy
```

## Next.js 環境変数

| 変数 | 説明 |
|------|------|
| `WP_REVIEW_SUBMIT_USER` | Application Password ユーザー |
| `WP_REVIEW_SUBMIT_APP_PASSWORD` | Application Password（スペース含む可） |
| `REVIEW_SUBMIT_DRY_RUN` | `true` 時は WP へ POST しない |

ローカル開発は `REVIEW_SUBMIT_DRY_RUN=true` 推奨。

## フィールド（post meta）

| meta key | 型 | 説明 |
|----------|-----|------|
| review_shop_id | integer | shop 投稿 ID |
| review_shop_slug | string | shop slug |
| reviewer_name | string | ニックネーム |
| used_period | string | 利用時期 |
| rating_total | integer | 総合評価 1-5 |
| rating_price | integer | 料金満足度（任意） |
| rating_service | integer | 接客満足度（任意） |
| rating_cleanliness | integer | 清潔感（任意） |
| revisit_intent | string | 再訪意向（任意） |
| approval_status | string | `pending` / 将来 `approved` |
| moderation_note | string | 管理者メモ |
| approved_at | string | 承認日時 |

`post_status`: **pending**（即時公開しない）

## 将来の表示

- 公開済み（`publish` + `approval_status=approved`）のみ店舗詳細・エリアに表示
- 口コミ 0 件の AggregateRating は出力しない（現状維持）
- 編集部レビューはユーザー口コミとしてカウントしない

## ロールバック

- `functions.php` の `reviews-cpt.php` require をコメントアウト
- Next.js: CTA を contact に戻す（git revert）
