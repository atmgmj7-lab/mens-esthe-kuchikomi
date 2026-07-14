# Supabase SEO安全移行 設計

作成日: 2026-07-14
対象: MIG-00 / SUPA-00 / MIG-01 / SUPA-02 / MIG-02の安全に先行できる部分

## 目的

現在の公開URL、canonical、サイトマップ、WordPress由来の表示内容を変えずに、SEOへ必要な確認済み店舗情報、地域本文、利用者口コミ、出典、確認日をSupabaseへ蓄積できる土台を作る。

今回の完了点はローカルmigration、移行元監査、参照先の安全装置までとする。本番Supabase作成、本番データ投入、Next.js公開参照先の切替、WordPress停止は行わない。

## 前提となる調査結果

- WordPress REST APIには店舗382件、地域34件、画像268件が登録されている。
- 店舗本文と抜粋は382件すべて空で、地域説明も34地域すべて空だった。
- 公開取得できる利用者口コミは確認できず、既存の件数欄やAI文は利用者口コミに数えられない。
- 料金、画像、公式URL、AI要約は一部店舗にしかなく、住所欄にはアクセス案内が混在する。
- 出典URLと情報確認日を項目ごとに保存できない。
- Next.jsには `ShopView` / `AreaView` があり、保存先変更時の表示境界として使える。

したがって、データベースを変えるだけではSEOは改善しない。確認済み情報と独自本文を増やし、その根拠を保つ構造が必要である。

## 採用する方式

### 1. WordPress既定の並行移行

公開ページは引き続きWordPressを読む。新しい設定は次の3段階を持つ。

| 設定 | 公開表示 | Supabase |
|---|---|---|
| `wordpress` | WordPress | 読まない |
| `shadow` | WordPress | 比較確認だけに使う |
| `supabase` | Supabase | 人間承認フラグがある場合だけ許可 |

既定値は必ず `wordpress` とする。今回、既存ページやサイトマップへこの設定を接続しないため、生成HTMLは変わらない。

### 2. SEOに必要な最小データ構成

`app` schemaには次を置く。

| テーブル | 役割 |
|---|---|
| `areas` | 地域名、slug、説明、WordPress term ID |
| `shops` | 店舗名、slug、正規パス、本文、公式URL、WordPress post ID |
| `shop_areas` | 店舗と地域の多対多関係 |
| `shop_prices` | 確認済み料金。0円と未確認を区別する |
| `shop_business_hours` | 曜日別営業時間、深夜営業、補足 |
| `shop_images` | 画像URL、alt、役割、並び順、WordPress media ID |
| `sources` | 一次情報URL、取得日、確認日、種別 |
| `shop_source_links` | 店舗のどの項目をどの出典で確認したか |
| `contents` | 店舗紹介、地域ガイド、FAQなどの本文と出自 |
| `content_revisions` | 本文変更履歴と確認者、出典 |
| `reviews` | 投稿、審査、公開状態を分けた利用者口コミ |

`private` schemaには `import_batches` と `import_records` を置き、生の移行記録、変換結果、失敗理由を保存する。出自不明文章は利用者口コミへ自動投入せず、取込記録に隔離する。

### 3. 公開APIの境界

- Supabase Data APIへ公開するschemaは `api` だけに限定する。
- `api` には `security_invoker` の読み取りviewだけを作る。
- `anon` / `authenticated` には公開済み行のSELECTだけを許可する。
- INSERT、UPDATE、DELETEはブラウザへ許可しない。
- 審査前口コミ、取込履歴、管理情報は公開viewへ含めない。
- `service_role` は将来のサーバー取込だけで使い、ブラウザ環境変数へ置かない。

### 4. WordPressデータの変換規則

- `wp_post_id`、`wp_term_id`、現在のslug、正規パスを保持する。
- 未確認料金、数値0、`0円`は金額として自動確定しない。
- 住所欄がアクセス文の場合は住所へ自動移し替えず、要確認として記録する。
- `shop_ai_summary` は利用者口コミへ移さず、`ai-generated` の本文候補として扱う。
- 公開取得できないreviewsは0件と断定せず、`unverified` として扱う。
- すべての取込行に元システム、元ID、取込batchを残す。
- 情報がない項目は推測せずnullにする。

### 5. エラー時と戻し方

- ローカルmigration失敗時は本番へ何も影響しない。
- 並行比較で差が出ても、公開表示はWordPressのまま維持する。
- 将来の切替後に問題が出た場合は `CONTENT_DATA_SOURCE=wordpress` へ戻す。
- URL、canonical、redirect、サイトマップはデータ一致と人間承認が揃うまで変更しない。

## 今回実装する範囲

1. Supabaseローカル設定とmigration。
2. schema、RLS、公開view、権限を検査する自動テスト。
3. WordPressの移行元データを件数・欠損・危険値で監査するツール。
4. WordPress既定、shadow比較、Supabase切替承認を判定する設定モジュール。
5. 移行項目表、運用手順、検証結果の文書化。

## 今回実装しない範囲

- Supabase本番プロジェクトの作成・接続。
- 本番WordPressまたはSupabaseへの書き込み。
- 382店舗の本番投入。
- 公開ページ、metadata、canonical、robots、schema、サイトマップの参照先変更。
- 口コミ管理画面、編集CMS、WordPress停止。
- push、pull request、本番deploy。

## 受入条件

- 変更前の11検査に加え、migration契約、移行監査、参照先安全装置の検査が成功する。
- lint、typecheck、buildが成功する。
- 既存のページroute、metadata、sitemap、表示コンポーネントに差分がない。
- `anon` / `authenticated` の書き込み権限がなく、審査前口コミとprivate取込記録が公開されない。
- 設定なしでは必ずWordPressが選ばれる。
- `supabase` は明示承認フラグなしに選択できない。
- Secret値、本番データ、生成した382店舗データをcommitしない。

## 将来の承認停止点

次の作業前に人間承認を取る。

1. Supabase本番プロジェクト作成または既存プロジェクト接続。
2. Secret登録と本番migration適用。
3. 数店舗を使った試験投入。
4. 382店舗の本番投入。
5. `shadow` の本番有効化。
6. `supabase` への公開参照先切替。
7. WordPress更新停止と公開停止。

