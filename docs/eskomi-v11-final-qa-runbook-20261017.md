# Eskomi v1.1 最終 QA・リリース手順（2026-10-17）

対象候補は `codex/wp-independent-prep-20261017` の最終 commit とする。本書の「DB PASS」は隔離 PostgreSQL 17 の試験であり、production DB の変更、main merge、production deploy を意味しない。正式要件は `eskomi-approved-design-v1.1-full-20261017.md`、詳細対応表は `eskomi-v11-preproduction-acceptance-matrix-20261017.md` を正本とする。

## 試験根拠と環境制約

### 2026-10-17 隔離 QA 実測

- `c734af1` で fresh PostgreSQL 17 acceptance、mutation race、typecheck、lint、JST境界/unit/static contract は PASS。追加 migration `20261017174000_eskomi_access_context_abuse_and_report_integrity.sql` を含む。
- host port 経路は `127.0.0.1:57001 connection refused` のまま。Docker host network、socket mount、OS/proxy設定変更は行わない。
- internal Docker network では Next→raw PostgREST の review-context 実 HTTP が 200（entry context と replay credential を返却）まで到達した。raw PostgREST の internal DNS 名で `/rest/v1` を誤用していた runner 実装は `ESKOMI_E2E_RAW_POSTGREST=1` により `/rpc` へ修正した。
- Chromium は同 network の CDP browser で試行したが、browser container が返す CDP address の環境 proxy 到達不能（`ENETUNREACH 172.31.0.189:8080`）および proxy connection failure で停止。ネットワーク制限の回避は行わない。review submit/replay、管理承認、widget、listing/coupon/access-report の browser E2E は未 PASS。

実行済みは `npm --prefix headless run typecheck`、`npm --prefix headless run lint`、`node headless/scripts/check-partner-access-report-contract.mjs`、`ESKOMI_SQL_ONLY=1 bash headless/scripts/run-eskomi-v11-replay-e2e.sh`（fresh PG17/mutation race）、`bash headless/scripts/run-eskomi-v11-populated-upgrade-e2e.sh`（`bf46aa1` からの additive upgrade）である。`npm --prefix headless run build` は compile/typecheck まで到達するが、`.env.local` を置かない隔離環境では WordPress reader が connection refused となり既存 fallback を使う。これは公開 HTTP PASS ではない。

- Docker の PG17/PostgREST16.4 は隔離 network で起動できるが、host `127.0.0.1:57001` は curl connection refused となる。よって replay E2E の Next/PostgREST HTTP 契約へ進めない。
- `/usr/bin/chromium` はあるが、既存 Playwright script の多くは標準 browser cache を前提とし、その cache はない。`check-eskomi-v11-replay-browser.mjs` は `ESKOMI_E2E_CHROMIUM=/usr/bin/chromium` を明示すればよい。
- ordering browser check は HTTP 到達性に加え確認済み `ORDERING_DATA_DIR` fixture が必要。host の `psql`、`postgres`、`postgrest`、`supabase` CLI はない。
- Docker socket mount、host network、権限変更、ネットワーク回避は許可範囲外である。

実 HTTP/Chromium は、対象 SHA を preview へ配備し、server 専用 Supabase 設定・read source flag を用意し、browser から preview と PostgREST に通常到達できる既存環境で実行する。永続テスト認証は新設せず、承認済みの既存 test account を使う。

## T01--T56 の現在地

`DB` は隔離 DB 試験済み、`HTTP/UI 未` は実環境未試験を表す。実装済みだけで画面 PASS を意味しない。

| ID | 現在地 | release 前の残作業 |
| --- | --- | --- |
| T01 | 実装済・DB | HTTP/UI 未 |
| T02 | 実装済・DB | HTTP/UI 未 |
| T03 | 実装済・DB | 実写真・同名確認、HTTP/UI 未 |
| T04 | 実装済・DB | Auth revoke HTTP/UI 未 |
| T05 | 実装済・DB | UI 未 |
| T06 | 実装済・DB | UI 未 |
| T07 | 実装済・DB | 実通信断 HTTP 未 |
| T08 | 実装済・DB | QR scan UI 未 |
| T09 | 実装済・DB | browser abort 未 |
| T10 | 実装済・DB | 管理 UI 未 |
| T11 | 実装済・DB | HTTP/JSON-LD 未 |
| T12 | 実装済・DB | 実担当者並列 UI 未 |
| T13 | 実装済・DB | 実時計境界未 |
| T14 | 実装済・DB | HTTP 再送未 |
| T15 | 実装済・DB | production log/analytics 監査待ち |
| T16 | 実装済・DB | UI 未 |
| T17 | 実装済・DB | production backfill 承認待ち |
| T18 | 実装済・DB | Auth revoke HTTP 未 |
| T19 | 実装済・DB | legacy read-only dry-run・本番承認待ち |
| T20 | 実装済・DB | service outage HTTP 未 |
| T21 | 実装済 | Chromium 320--1440px/a11y UI 未 |
| T22 | 実装済・DB | preview HTTP canonical/404/robots/sitemap/JSON-LD 未 |
| T23 | 実装済・DB | 管理 UI 未 |
| T24 | 実装済・DB | preview flag rollback 未 |
| T25 | 実装済 | production 非破壊 smoke 承認待ち |
| T26 | 実装済・DB | HTTP conflict 未 |
| T27 | 実装済・DB | production 既発行コード確認待ち |
| T28 | 実装済・DB | 実時計/HTTP 未 |
| T29 | 実装済・DB | 入力 UI 未 |
| T30 | 実装済・DB | 実写真権利・Chromium profile UI 未 |
| T31 | 実装済・DB | 公開 HTML/HTTP 未 |
| T32 | 実装済・DB | UI 未 |
| T33 | 実装済・DB | 文面 UI 未 |
| T34 | 実装済・DB | 実 session HTTP 未 |
| T35 | 実装済・DB | clipboard UI 未 |
| T36 | 実装済・DB | URL 再利用 HTTP 未 |
| T37 | 実装済・DB | 時系列 UI 未 |
| T38 | 実装済・DB | widget HTTP 未 |
| T39 | 実装済・DB | embed UI 未 |
| T40 | 実装済・DB | API/cache 障害 HTTP 未 |
| T41 | 実装済・DB | 全 surface HTTP 比較未 |
| T42 | 実装済・DB | third-party cookie UI 未 |
| T43 | 実装済・DB | partner HTTP/UI、日次 health job 稼働確認待ち |
| T44 | 実装済・DB | browser cookie lifecycle 未 |
| T45 | 実装済・DB | link-preview HTTP 未 |
| T46 | 実装済・DB | 複数匿名 session 負荷観測未 |
| T47 | 実装済・DB | production analytics/log 監査待ち |
| T48 | 実装済・DB | retention/key rotation 実運用待ち |
| T49 | 実装済・DB | UI/HTTP 未 |
| T50 | 実装済・DB | 管理 UI/HTTP 未 |
| T51 | 実装済・DB | UI/HTTP 未 |
| T52 | 実装済 | 権利・正規 ID・実画像確認待ち |
| T53 | 実装済・DB | hub/地域 HTTP 順序確認未 |
| T54 | 実装済 | Library 素材・提供条件・実在 URL 待ち |
| T55 | 実装済・DB | 写真/投稿 Chromium、legacy 差分確認待ち |
| T56 | 実装済・DB | production 非変更確認・管理 UI 未 |

正式設計との差分は T54 の未取得バナー素材で、非表示を維持する。legacy 3 workspace は WP ID + slug exact match が 0 件であり、名称類似による自動 mapping は禁止、明示的三 ID 確認が必要である。

## T43 匿名アクセス報告

- 表示は「計測できた閲覧/公式 LINE クリック」であり、広告ブロッカー等を含む全訪問の網羅、予約、来店、売上ではない。
- 任意 browser tag は廃止。server 発行・署名済みの短期 context は店舗/JST 日/event 種別/匿名 session に束縛する。同一 session の同一 event は 1 件、同一店舗・日・session は最大 2 event。cookie未発行の並行 request でも各 server 発行 session の context は有効であり、cookie の後着で先行 context を失効させない。保存 hash は店舗・日付 scope であり、店舗横断追跡子にはしない。
- context 発行は session ごとの短期上限と、信頼できるホスティング proxy から得た IP の HMAC を粗い短期 abuse signal として併用する。raw IP は保存せず、共有回線の既存 session を一律に拒否しない。個人本人確認や水増しの完全防止を意味しない。
- context/session/network scope hash は意図した有効期限後、`private.prune_partner_shop_access_short_lived_v11` が**成功した場合にのみ**削除する。finalizer が未実行・失敗なら行は残り得るため、期限超過行と前日 finalization の欠落を運用監視する。日別集計は保持する。IP、口コミ本文、編集控え、特典コードをイベント/URL/log に保存しない。
- 日次 collector health check が前 JST 日を `complete` と閉じた場合だけ、導入済み店舗の 0 を「計測できた 0」とする。`partial`、`missing`、`unknown` は比較不可。イベント 1 件や WordPress 更新 job の成功は complete の根拠にしない。
- `.github/workflows/daily_shop_update.yml` は access measurement を finalization しない。独立した計測 health collector が未設定の期間は unknown のままとし、今日の取得済み数値は暫定表示、7/28/90日比較は昨日までの確定期間だけを対象にする。自動 polling は追加しない。

production で必要だが本作業では変更していない設定は server の `ESKOMI_ACCESS_CONTEXT_SECRET` と、独立 access measurement collector 用の既存 `ESKOMI_ACCESS_OBSERVATION_SECRET` / URL である。値は secret manager のみへ置く。WordPress job とは別に、collector の実行根拠、internal route 204、`collection_runs` の前日 complete、期限超過行がないことを read-only 確認してから partner 画面の 0 を有効とする。

## preview 手順

1. `/dashboard/partners/` で published canonical shop を provision し、WP ID の無い新規店で workspace/owner が解決されることを確認する。
2. owner で `/partner/`、`/partner/listing/`、`/partner/growth/`、`/partner/therapists/` を確認する。manager は閲覧可、作成/変更不可。
3. active、写真権利確認済み、published managed shop の人物だけが `/therapists/{assignment UUID}/`、`/api/therapists/{assignment UUID}/photo/`、店舗詳細リンク、sitemap に出ることを確認する。終了/非公開/期限切れ/権利未確認/同名別 UUID は非表示/404。
4. public shop で `/api/analytics/shop-access/context/` と `/api/analytics/shop-access/` を確認し、no-store/noindex、URL に context/個人値がないこと、初回2並行 context と2タブの先行 context が cookie 競合後も 403 にならないことを確認する。翌日の独立 collector complete 後に `/api/partner/access-report/?days=7` を owner/manager で確認する。
5. manager/revoked/別店舗 session は各々 read 可/403/403、`days` 省略は 28 日で 200、7/28/90 以外は 400 とする。
6. `/dashboard/community/` で pending draft、公開済み、本人撤回、処理済み、前後 page、51 件超/1000 件超 history、hide/appeal/古い appeal の stale 拒否を確認する。

## migration/rollback

適用前に commit SHA、remote migration ledger、schema/RLS/grant、read-source flag、対象件数を read-only で保存する。timestamp 順に適用し、今回の追加は `20261017173000_eskomi_access_measurement_integrity.sql`。過去 migration は編集/再適用しない。適用後、service role 以外の private table/RPC execute がないこと、`measurement_state`、owner/manager read、revoked/他店 deny、公開人物 visibility を read-only で確認する。

rollback は DB down migration/履歴削除を行わない。アプリ/read flag を直前へ戻し、T43 job を停止して future day は unknown のまま残す。既存集計、拒否、hide、withdrawn、失効 context を復活させない。本番の短期 hash 削除は設定済み日次 job の通常処理のみで、本作業から既存データを手動削除しない。
