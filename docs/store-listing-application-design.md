# 掲載申請・承認編集フロー（ローカル設計案）

この設計は migration 適用前の提案であり、本番DB・Storage・RLSは変更しない。

## 既存機構との境界

- `api.shop_owner_requests` は既存WP店舗の修正申請だけに残す。
- `private.partner_shop_fact_*` はWP768限定の限定項目snapshot/CASであり、本フローの公開反映には使わない。
- 新設レコードは非公開申請・改訂・運営判断を保持するだけで、公開店舗表示を直接更新しない。

## migration案（追加のみ）

`private.listing_applications`

- `id`, `dedupe_key`, `kind` (`new_listing` / `existing_change`), `existing_wp_shop_id nullable`, `existing_shop_slug nullable`
- 公開候補: `shop_name`, `area`, `website_url`, `introduction`, `banner_asset_id nullable`
- 非公開: `contact_name`, `contact_email`, `contact_role`, `editing_preference` (`operator` / `shop`), 同意日時
- `state` (`received`, `identity_review`, `content_review`, `changes_requested`, `approved_candidate`, `rejected`), `revision`, timestamps

`private.listing_application_revisions`

- application id、整数revision、公開候補JSON、非公開連絡先JSON、差分hash、submission idempotency key、申請者表示名、作成時刻。
- approved revisionはimmutable。再送は同一idempotency keyで同じreceiptを返す。

`private.listing_application_reviews`

- revision id、運営actor id/label、decision、差戻し理由、expected revision、作成時刻。
- 承認前は公開版を更新しない。競合はexpected revision不一致でfail-closed。

`private.listing_media_assets`

- asset id、application id、storage object key、sha256、content type、byte size、width/height、検査結果、権利同意時刻。
- public URL、外部URL、任意リモート取得は保存しない。許可MIME/サイズ/実バイト検査後に隔離bucketへ保存し、承認後のみ派生公開objectを作る。

## 権限案

- すべてprivate schema・RLS有効。`anon`/`authenticated`へのtable/function grantはしない。
- 公開フォームはserver routeのみ。service_roleが形式検査・レート制限・idempotency後にinsertする。
- 運営UIもserver routeで既存運営認可を確認する。既存店舗の選択は編集権限を付与せず、担当者紐付けは運営確認後にだけ作る。
- Storageはprivate bucket。アップロードは短命署名・MIME/サイズ/magic bytes検査・画像再エンコードを別承認工程で導入する。

## 段階的完了条件

1. 新規/既存双方の申請UI、公開/非公開の表示分離、URLのみの入力検証、画像は未受付表示。
2. 上記migrationをローカル適用し、重複/競合/他店アクセス/未承認非公開をfixtureで検証。
3. 運営一覧・詳細・差分・承認/差戻し/却下を内部認可に接続。
4. 承認済みrevisionのみを別途定義した公開projectionへ反映。WordPress反映や本番適用は別承認。
