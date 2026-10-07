# Mrs.Rank UP — 修正申請から公式Facts Writerへの最小接続案

対象は WordPress Shop ID `768`（Mrs.Rank UP）のみ。この文書はローカル設計
記録であり、WordPress/Supabaseの本番書込みを承認しない。

## 結論

既存の `api.shop_owner_requests` を「店舗からの修正申請」としてそのまま受け、
運営が別途確認した公式根拠を付けて Writer に渡す方向は維持できる。ただし、現在の
申請レコードだけでは既存 `official-facts-rest.php` が要求する
`provenance` / `canonical` / `audit` を再現できないため、申請をそのまま
`reviewed` 扱いにして Writer へ接続することは不可である。

ブラウザの自由入力・申請文・申請者メールは根拠ではない。Writer payload は常に
運営確認済みのサーバー側recordからだけ組み立てる。

## 既存で再利用できるもの

| 要素 | 既存状態 | 接続時の役割 |
| --- | --- | --- |
| `api.shop_owner_requests` | canonical shop ID/slug、申請分類、変更説明、任意の根拠URL、同意、`received`〜`approved-candidate` | 店舗からの原申請。公開データへ自動反映しない。 |
| Partner の「掲載情報の修正を申請」導線 | 認可済み店舗のcanonical ID/slugだけを渡す | 他店舗を指定できない申請開始点。 |
| `official-facts-rest.php` | 10項目allowlist、完全snapshot CAS、transaction、readback、NOOP、signed receipt、WP cache hook | 唯一の本番WP書込み先。契約は変更しない。 |
| `scripts/area_official_sync_v2/provenance.mjs` | `price_90` と `shop_booking_url` のカテゴリ集約・監査情報・writer payload組立をfail-closedで実装済み | 最初に再利用できるpayload builder。対象外の8項目は同じ根拠契約を明文化するまで保存不可。 |
| Headless `OfficialFactsWriter` | preflight GET、1回のPOST、readback、cache invalidation handoff | 承認済みrecordだけを実行するserver-only transport。 |

## 最小サーバー状態と承認者

1. 申請は既存 `api.shop_owner_requests` に `received` として保存する。
2. 運営レビュー担当者が、公式サイト等の実在する根拠を確認する。ここでは値・
   source URL・観測日・確認日・対象項目を構造化して保存する。申請者の本文を
   コピーして根拠にしてはならない。
3. Writer対応項目についてのみ、二次承認者（または明示された同一担当者の承認
   ポリシー）が`approved_for_write`へ進める。少なくとも reviewer label、日時、
   対象WP ID/slug、全差分、完全snapshot hashを固定する。
4. server-only job が直前に Writer GET snapshot を再取得し、承認recordの
   expected snapshotと一致する場合だけ一度POSTする。不一致なら`conflict`で停止し、
   再レビューが必要である。
5. `APPLIED`後のGET readbackとpublic cache revalidationを成功条件にする。receipt、
   readback hash、実行者、結果を記録する。失敗や応答不明は再POSTせず、人による
   read-only reconciliationに移す。

## 新規schemaが必要な理由

`api.shop_owner_requests` には、項目ごとの正規化値、複数項目で共有するcanonical、
source host、観測/確認日、price/booking固有監査、reviewer、immutable payload、
Writer receiptがない。`status` と `review_note` だけで10項目のWriter payloadを
安全に復元することはできない。

従って、本番接続前にprivate schemaへ例えば
`private.official_fact_change_reviews`（名称は要決定）を追加する必要がある。最低限の
列は次の通り。

| 種別 | 必須内容 |
| --- | --- |
| 対象・申請参照 | `shop_owner_request_id`、`wp_shop_id`、`shop_slug`、request hash |
| 値と競合防止 | allowlist限定 `updates`、Writerの完全`expected_snapshot`、snapshot hash |
| 確認済み根拠 | field/category別 evidence、`provenance`、`canonical`、`audit`、source archive/hash |
| 承認 | `state`（draft/reviewing/approved_for_write/committed/conflict/failed）、reviewer/approver label、各timestamp、非公開review note |
| 実行結果 | batch ID、signed receipt、writer response/readback hash、cache reflection状態 |

このtableはpublic schema/APIへ公開せず、service roleと専用server workflowだけが読む。
申請者PIIは既存申請recordから必要時に参照するだけで、Writer payload・公開REST・
Partner画面へ複製しない。

## 現時点で安全に接続できる範囲

- `price_90` と `shop_booking_url` は既存provenance builderを再利用できる。ただし
  根拠が同一カテゴリの全公開構成要素を満たす場合だけであり、公式根拠recordと
  承認recordの新規schemaはなお必要である。
- `official_url`、`shop_hours`、`shop_address`、`shop_tel`、`shop_line`、
  `shop_booking`、`shop_holiday`、`basic_price` はWriter allowlistにはあるが、
  現在の申請recordだけではカテゴリ別canonical/provenanceを安全に作れない。
  保存を可能に見せず、review schemaと項目別根拠契約を決めるまで停止する。
- タイトル、taxonomy、エリア、公開状態、新規作成は既存Writerの範囲外であり、
  この接続案にも含めない。

## 隔離テストと本番境界

- local writer fixture: snapshot preflight、NOOP、競合前POST抑止、apply/readback、
  cache revalidation handoffを確認済み。
- local Supabase fixture: 合成口コミだけで submit → moderate → publish → Supabase
  public adapter → 店舗表示/widget を確認済み。fixture cleanupは別project IDの一時DB
  内だけで行った。
- 本番Supabase/WP、実口コミ、実campaign、公開URL、production
  `REVIEW_READ_SOURCE` は未操作・未確認である。
