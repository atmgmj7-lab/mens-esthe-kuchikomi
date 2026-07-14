# WordPressからSupabaseへの項目対応表

作成日: 2026-07-14
対象: 公開APIで確認できた店舗382件、地域34件

## 基本方針

- 元のWordPress ID、slug、現在の公開パスを保持する。
- 値がない項目は推測せずnullまたは空の下書きにする。
- 住所、料金、営業時間、口コミは自動で「確認済み」にしない。
- 出典URLと確認日が揃うまで、新しい値を公開viewへ出さない。
- AI要約、編集部文、店舗提供情報、利用者口コミを分ける。
- 生データと変換時の警告は `private.import_records` に残す。

## 店舗

| WordPress | Supabase | 現在値 | 変換規則 | 公開条件 |
|---|---|---:|---|---|
| `id` | `app.shops.wp_post_id` | 382/382 | 数値をそのまま保持 | 必須 |
| `slug` | `app.shops.slug` | 382/382 | decodeや改名をせず保持 | 必須 |
| `/shops/{slug}/` | `app.shops.canonical_path` | 382/382 | 現在の正規パスを保存 | 必須 |
| `title.rendered` | `app.shops.name` | 382/382 | HTMLを除去 | 空なら取込失敗 |
| `content.rendered` | `app.shops.description_html` | 0/382 | 空のまま移し、創作しない | 空でも店舗自体は移行可 |
| `excerpt.rendered` | `app.shops.excerpt` | 0/382 | 空のまま移す | 空でも可 |
| `official_url` / ACF | `app.shops.official_url` | 333/382 | URL形式を確認 | 公式URLとして確認できた場合 |
| `shop_tel` | `app.shops.phone` | 382/382 | 表示文字を保持し、形式警告を別記録 | 店舗提供情報として扱う |
| `shop_address`等 | `address_text` / `access_text` | 要確認 | 番地住所と駅・徒歩案内を分離。自動判定だけで確定しない | 人間確認後 |
| `shop_booking`等 | `app.shops.booking_url` | 要確認 | URLまたは予約説明を分ける | URL確認後 |
| その他ACF | `legacy_payload` | 382/382 | 移行期間だけ原文を保持 | 公開APIには直接出さない |

## 地域と店舗の関係

| WordPress | Supabase | 現在値 | 変換規則 | 公開条件 |
|---|---|---:|---|---|
| area term | `app.areas` | 34件 | term ID、slug、親子、名前を保持 | 地域公開後 |
| `description` / ACF | `app.areas.description` / `app.contents` | 0/34 | 空を創作しない。地域ガイドは別contentとして作る | 編集・出典確認後 |
| shopのarea配列 | `app.shop_areas` | 地域なし75、複数地域230 | 多対多をそのまま保持 | 店舗と地域が両方公開済み |
| primary area | `is_primary` | 未確定 | 現在の配列順から推測しない | 人間または明示ルールで確定 |

## 料金

対象候補: `shop_price_60min`、`price_50`、`price_60`、`price_70`、`price_80`、`price_90`、`price_120`、`price_150`、`basic_price`

| 元値 | Supabase | 変換規則 |
|---|---|---|
| 正の整数または正の円表記 | `shop_prices.amount_yen` | コース名、分数と組み合わせ、出典と確認日が揃うまで `is_public=false` |
| `0` / `0円` / `無料` | 金額へ入れない | `private.import_records.issues` に `zero-price-unverified` を残す |
| 空、不明、問合せ | 金額へ入れない | null相当として扱う |
| 負数、小数、解析不能 | 金額へ入れない | 取込失敗または要確認 |

現在、確認可能な正の料金候補は252/382。料金がない130店舗は推測しない。

## 営業時間

| WordPress | Supabase | 変換規則 |
|---|---|---|
| `shop_hours`等 | `app.shop_business_hours` | 曜日別に機械分解できない場合はnotesへ仮保存し、公開しない |
| 翌日表記 | `is_overnight` | 閉店時刻だけで推測せず、明示表記を確認 |
| 24時間、休業日 | time / notes | 専用表現として人間確認 |

## 画像

| WordPress | Supabase | 現在値 | 変換規則 |
|---|---|---:|---|
| featured media | `app.shop_images` | 241/382 | media ID、URL、alt、featured役割を保持 |
| 画像なし | 行を作らない | 141/382 | ダミー画像を実画像として登録しない |

## 出典と確認日

| WordPress | Supabase | 現在値 | 変換規則 |
|---|---|---:|---|
| 専用出典URL | `app.sources.source_url` | 0/382 | 一次情報URLを新規確認して登録 |
| 専用確認日 | `app.sources.verified_at` | 0/382 | 実際に確認した時刻だけ登録 |
| 項目との関係 | `app.shop_source_links.field_name` | なし | 住所、料金、営業時間など項目単位で結ぶ |

公式URLがあるだけでは、全項目の確認済み根拠とは扱わない。

## 本文と口コミ

| WordPress | Supabase | 現在値 | 変換規則 | 公開条件 |
|---|---|---:|---|---|
| `shop_ai_summary` | `app.contents` | 76/382 | `source_type=ai-generated`、`is_ai_generated=true` | 利用者口コミにはしない |
| 店舗紹介文 | `app.contents` | 本文0/382 | `shop-description`として作成 | 出典・編集確認後 |
| 地域ガイド | `app.contents` | 地域説明0/34 | `area-guide`として作成 | 独自情報と根拠確認後 |
| reviews CPT | `app.reviews` | 公開API未接続 | 公開取得不能データを0件と断定せず、自動移行しない | user-review、approved、published、is_publicのみ |
| ACF口コミ件数 | 移行しない | 実体未確認 | 参考値としてprivate取込記録に残す場合のみ | 評価・件数に使わない |

## 移行順

1. 地域と店舗のID・slug・正規パスを下書きで入れる。
2. 多対多の地域関係を入れ、地域なし・複数地域を人間確認する。
3. 画像、公式URL、電話など現状値を非公開で入れる。
4. 住所とアクセス、料金、営業時間を出典単位で確認する。
5. 地域ガイドと店舗本文を作り、変更履歴を残す。
6. 口コミは保存経路・審査基準・公開取得が揃ってから別に移す。
7. WordPressとSupabaseの件数・slug・HTML差分が一致してからshadow比較へ進む。
