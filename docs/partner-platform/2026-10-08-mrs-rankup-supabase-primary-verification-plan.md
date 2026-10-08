# Mrs.Rank UP — Supabase 正本・非公開検証計画

対象は WordPress Shop ID `768`（Mrs.Rank UP）のみである。これは非公開ローカル
Supabase環境での完成・E2E検証計画であり、WordPress、production Supabase、公開URL、
canonical、既存構造化データを変更しない。

## 目的

1. WordPress writer を呼ばず、Supabaseを店舗管理factsの正本として、読込・差分保存・
   再読込を完成させる。
2. 既存のnative review基盤で、投稿→審査→公開→Supabase read adapterによる公開反映を
   隔離fixtureでE2E検証する。
3. Partner/browserには他店舗facts、監査、審査権限、service secretを公開しない。

## 最小設計

- 追加するのは `private.partner_shop_fact_snapshots` と
  `private.partner_shop_fact_audits` のみ。どちらも Data API/browser roleには公開しない。
- snapshotはWP ID、slug、10項目allowlist、revision、更新actorと時刻を持つ。保存は
  expected revision のcompare-and-swapで、空欄・allowlist外・数値不正・他店舗を拒否する。
- `api.get_partner_shop_fact_snapshot` と
  `api.save_partner_shop_fact_snapshot` はservice roleだけに実行を限定する。新しい
  anon/authenticated GRANT、RLS緩和、public RPCは追加しない。
- Next.jsはserver-only adapter経由だけでRPCを呼ぶ。検証モード
  `SHOP_MANAGEMENT_SOURCE=supabase` のときだけWP768の編集画面/保存routeがこれを使用する。
  通常環境は既存のWordPress読取+fail-closed保存を維持する。
- 同じ検証モードでは、公開用のserver-side projectionも既存snapshotをoverlayして同じ10項目を
  読む。WP768についてWordPressが非公開なら通常の404対象にし、snapshot未作成、WP ID/slug不一致、
  取得失敗は一時的な5xxとしてfail-closedにする。通常環境と他店舗はWordPress projectionを維持する。
  公開リクエストは初回importや書込みを絶対に行わない。

## 検証範囲

隔離local fixtureで、実WP768と同じpercent-encoded slug/canonical identity、Partner
workspace/membership相当、4チャネル相当のcampaignをセットアップし、以下を確認する。

1. facts初期読込→1項目差分保存→revision/readback→NOOP→古いrevisionのconflict→空欄拒否。
2. 別店舗・browser roleからfacts/auditが読めないこと。
3. native reviewの投稿→approve→publish→Supabase public adapterとwidgetの反映。
4. Partner projectionが自店舗だけを返し、operator moderationがWP768だけを返すこと。
5. 公開用projectionが保存済みsnapshotの変更だけを反映し、別店舗・null未観測値・identity不一致を
   WordPress値のままにすること。

実際のworkspace・Partner account・campaignのUUIDを使う次段階では、productionを複製した
非公開Supabase検証環境へ既存行を読み取り専用でseedし、同じcanonicalを保ったままmigrationと
`SHOP_MANAGEMENT_SOURCE=supabase`をその環境だけに設定する。production接続、既存行の更新、
campaign再発行はこの計画に含めない。

## 停止条件

- migrationのremote適用、production Supabaseへの書込み、WordPress書込み、公開参照先の
  切替、実口コミ投稿・審査・公開、実アカウントへのログインメール発行は行わない。
- private dataの権限・RLS・CAS・E2Eに失敗があれば、次の公開判断には進まない。
