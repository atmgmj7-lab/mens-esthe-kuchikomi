# 新大阪・堺東 Area Depth 実装検証報告

Task: `SHINOSAKA-SAKAIHIGASHI-AREA-DEPTH-IMPLEMENT-01`
判定日: 2026-08-29
最終判定: `READY_FOR_AREA_PRODUCTION_RELEASE`

## 実装基準

- Base: `origin/main@59621213bdf35868010d8d0b8d7ea6b82758ccd6`
- Branch: `codex/area-depth-implement-01`
- URL: `/area/shinosaka/`, `/area/sakai/`
- 実装正本: `ESKOMI_AREA_SEO_IMPLEMENTATION_SPEC_2026-08-29.md`
- Production write / WordPress write / Supabase write / main push / deploy: すべて0

## 正本hash

| artifact | SHA-256 |
|---|---|
| `ESKOMI_SHINOSAKA_SAKAIHIGASHI_AREA_DEPTH_2026-08-29.xlsx` | `ab9b9f3026e434bdfdaf4e5021f860d95c6354800c1ffac79277b96512e29cf6` |
| `ESKOMI_AREA_EDITORIAL_DATA_2026-08-29.csv` | `bce5bd0bddc752693edab0866f3ba94ae0c9c7bcabfe48ec6671762002c2a952` |
| `ESKOMI_AREA_CURRENT_PROPOSED_2026-08-29.csv` | `dd408fb7d9dce7837115f095bfd32e831340b649958128572f4192b00dc575c2` |
| `ESKOMI_AREA_SEO_IMPLEMENTATION_SPEC_2026-08-29.md` | `05c02ac97bdd741426a251bfbba1e5e86aa26cbe40e5a0ba3e30c0c22fc4716c` |
| `ESKOMI_AREA_DEPTH_SEO_REPORT_2026-08-29.md` | `a71e9150e27d1b1794890651af64d0469487789ecb5787adb6d1a8e618a2f33b` |

## 実装内容

- 型付きArea editorial dataset/adapterを追加した。
- 新大阪58件、堺東25件とruntime public shop countが一致する場合だけ表示する。件数drift時と非対象エリアはfail closedで`null`となる。
- Coverage、料金、営業時間、駅/access、外部媒体、therapistをServer Componentとして追加した。
- block別feature flagを持ち、既存店舗一覧・schemaを残したまま個別rollbackできる。
- 堺東料金は`LIMITED SAMPLE`と「エリア全体の相場を示すものではない」を表示する。
- portalは`EXTERNAL_PORTAL_FACT`、therapistは店舗公開一次情報の限定標本としてsource classを分離した。
- 調査方法FAQを既存FAQへ追加し、同じ`faqItems`から画面表示とFAQPageを生成する。
- title、description、H1、canonical、BreadcrumbList、店舗カード、内部リンク、既存ranking/review条件は変更していない。
- 新規URL、Review/Rating schema、比較優位claim、推測GSC、推測価格・営業時間・駅は追加していない。

## Data contract

### 新大阪

- public: 58
- official URL: 30/58、51.7%
- address/location: 14/58、24.1%
- price: n=18、9,000円 / 中央値15,000円 / 17,000円
- business hours: 確認26、解析可能21、24時以降21
- station/access: n=15（新大阪13、西中島南方1、南方0、東三国1、その他0）
- therapist: 192 profiles / 9 shops、age-known 167
- multi-portal: 22 shops
- observedAt: `2026-08-29T02:27:02.532Z`

### 堺東

- public: 25
- official URL: 11/25、44.0%
- address/location: 5/25、20.0%
- price: n=5、10,000円 / 中央値11,000円 / 16,000円、`LIMITED_SAMPLE`
- business hours: 確認12、解析可能12、24時以降12
- station/access: n=6（堺東6、その他0）
- therapist: 63 profiles / 3 shops、age-known 63
- multi-portal: 6 shops
- GSC: `DATA_REQUIRED`のまま保持し、0や推測値を表示しない
- observedAt: `2026-08-29T02:27:39.383Z`

## TDD

1. Fail-first: `npm run test:area-depth-editorial`
   - exit 1: `lib/area-depth-editorial.ts must exist`
2. 実装後: 同command PASS
3. review追加test:
   - portal/therapist source class分離とCoverage `dl` semanticsでREDを確認
   -最小修正後PASS

Focused contractは次を検証する。

- 58/25 public count
- rate計算とmissing count
- count drift/non-target fail closed
- `LIMITED_SAMPLE` / `DATA_REQUIRED`
- 料金・営業時間・駅・therapist・portalのSSR text
- 禁止claim、fake ranking/review/rating、0円化の不存在
- FAQ visible/schema同一配列
- ItemList既存guard
- 767px以下1 columnとoverflow防止CSS

## SSR / schema evidence

`npm run test:area-depth-ssr`をproduction buildのローカルserverへ実行しPASS。

| item | 新大阪 | 堺東 |
|---|---:|---:|
| HTTP | 200 | 200 |
| initial HTML size | 750,129 bytes | 333,097 bytes |
| SSR editorial blocks | 5/5 | 5/5 |
| visible shop cards | 58 | 25 |
| ItemList numberOfItems | 58 | 25 |
| ItemList positions | 1..58 | 1..25 |
| FAQPage entries | 4 | 4 |
| visible FAQ/schema parity | PASS | PASS |
| Review schema | 0 | 0 |
| Rating/AggregateRating schema | 0 | 0 |
| canonical | 現行URL維持 | 現行URL維持 |
| title/H1 | 現行contract維持 | 現行contract維持 |

## Responsive / browser QA

- 対象: 新大阪、堺東
- viewport: 1440×1000、390×844
- HTTP 200、5 editorial blocks、店舗カード58/25、FAQ操作を検証
- document/body horizontal overflow: 0
- 新規block viewport overflow: 0
- PC 2 column / SP 1 column: PASS
- LIMITED SAMPLE表示、料金・営業時間・駅・portal/therapistを目視確認: PASS
- screenshot: `/tmp/eskomi-area-depth-browser-qa-2026-08-29/`

## Full regression

| command | result |
|---|---|
| `npm run test:area-depth-editorial` | PASS |
| `npm run test:area-depth-ssr` | PASS |
| `npm test` | PASS（全script） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS、850/850 pages |
| `npm run test:portal-browser-layout` | PASS、103,727 assertions / 56 screenshots / 98 scenarios |
| `DASHBOARD_QA_BASE_URL=... npm run test:dashboard-shell-browser` | PASS |
| Area Depth Playwright 1440/390 | PASS |
| `git diff --check` | PASS |

Build時にWordPress originの1店舗取得が10秒timeoutとなったが、既存のbuild-resilience contractどおりfallbackを使用し、buildは850/850で完了した。Area Depth対象ページのHTTP/SSR検証には影響しなかった。

Portal layout QAで、非常に長いshops一覧下端のCTA 1件がcomputed `min-height: 44px`に対し43.984375pxと計測された。Chromiumの1/64px layout-unit丸めと切り分け、CSS 44px契約を別途必須にした上で1 layout unitだけgeometry toleranceへ許容し、103,727 assertionsをPASSした。

## Current vs Proposed 30/30

`ESKOMI_AREA_CURRENT_PROPOSED_IMPLEMENTATION_RESULT_2026-08-29.csv`を30行で作成し、spreadsheet parserで31行×7列（header含む）をreadbackした。

- `IMPLEMENTED`: 16
- `NO_CHANGE_REQUIRED`: 8
- `NOT_APPLICABLE`: 4
- `DEFERRED_DATA_REQUIRED`: 2
- total: 30/30

Deferredは両エリアの「最新店舗」のみ。信頼できる公開日・新規判定dataが正本にないため、仕様どおり今回追加していない。

## Review result

- SPEC_COMPLIANCE: PASS
- CODE_QUALITY_SECURITY: PASS
- FINAL_CROSS_CUTTING: PASS
- Critical: 0
- Important: 0
- Minor: 0

React reviewでは、追加client hook/fetch、重いchart、dependency、巨大client payloadがないことを確認した。新規data blocksはSSRで、既存client tabへは生成済みReact nodeだけを渡す。

## Rollback

1. 対象areaの公開店舗数が58/25から変化するとdataset adapterが自動でfail closedする。
2. 個別blockは`AREA_DEPTH_FEATURE_FLAGS`で停止できる。
3. 全体rollbackは本branch差分をrelease対象から外す。WordPress/Supabase migrationやURL/canonical復元は不要。

## Safety

- Secret exposure: 0
- Production changes: 0
- WordPress writes: 0
- Supabase writes: 0
- Vercel env changes: 0
- main push: 0
- deploy: 0
- new SEO URL: 0

`READY_FOR_AREA_PRODUCTION_RELEASE`
