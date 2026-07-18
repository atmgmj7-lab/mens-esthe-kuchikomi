# Eskomi AIコンテンツ管理・セラピスト連動基盤 設計書

作成日: 2026-07-18

対象: 管理画面、AI一括取込、外部ポータル順位、公式サイト確認項目、セラピスト、出勤、トップ連動

公開正本: WordPress

非公開作業領域: Supabase

停止条件: 各段階のローカル実装・検証・独立レビュー完了後、push・本番公開前で停止

## 1. 目的

管理者が店舗ごとに多数の項目を手入力しなくても、地域と店舗を選び、CodexまたはChatGPTへ渡す調査指示書を生成し、返されたJSONまたはCSVを一括取込できる管理基盤を作る。

AI出力はそのまま公開せず、WordPressの現在値との差分、出典URL、取得日、未確認項目を管理画面で確認する。承認した行だけWordPressへ反映し、店舗詳細、セラピスト詳細、トップページが同じ公開データを読む。

管理画面はWordPressに近い一覧・編集・状態管理を持ち、将来の無料店舗会員・有料店舗会員にも拡張できる構造にする。

## 2. Subsystemの分割

機能は次の4つへ分ける。

1. 公開店舗UI: 口コミ、確認状況、Eskomi順位、1カラム、二層menu。
2. 管理・AI取込: 指示書、JSON/CSV、検証、差分、承認、公開履歴。
3. セラピスト: 入力、店舗との関係、詳細ページ、年齢帯、在籍数。
4. 出勤・連動: 日別出勤、店舗詳細、セラピスト詳細、トップへの条件付き表示。

各subsystemは独立して検証できるが、公開時の主キーをWordPress IDへ統一する。管理画面だけSupabaseの行IDを正本にしたり、トップだけ別JSONを読む構成にはしない。

## 3. 現在利用できる既存機能

次の既存機能を再利用する。

- `/dashboard`の管理画面shell。既存Basic認証は未設定時に通すため、安全化後だけ再利用する。
- WordPress `shop`投稿とarea taxonomy。
- WordPress RESTとApplication Password方式。
- `shop_today_therapists`、`shop_today_analysis`、`shop_availability`。
- `age_18_19`から`age_45_plus`までの年齢帯field。
- `therapist_1_name`から`therapist_3_url`までのおすすめ枠。
- `shop_last_ai_check`。
- `ai_update_log`。
- `/wp-json/escomi/v1/update`。
- WordPress `reviews`投稿typeと評価field。
- Supabaseのserver-only service role保存方式。

既存`escomi/v1/update`は店舗metaを直接上書きするため、新しいAI一括取込には使わない。実装前に呼出元を一覧化し、日次処理が使っているfieldを移行する。移行確認後は直接更新できるfieldを日次の明示的なallowlistへ限定し、住所、料金、公式URL、年齢帯、紹介、portal順位は新しいstaging・承認経路以外から更新できないようにする。

`ai_update_log`は管理履歴であり公開contentではない。公開依存がないことを検査した後、`publicly_queryable=false`、`show_ui=true`、管理権限付きRESTだけへ変更する。

### 3.1 Phase 0: 既存経路の安全化

新しい管理画面やAI取込を接続する前に、次を完了条件付きの独立taskとして実装する。

1. `functions.php`にあるCloudSecureのREST拒否全体解除、MU pluginの`unlink`、匿名debug route、`opcache_reset()`、plugin一覧の公開を削除する。
2. Application Password互換はCloudSecureとXserverの正規設定で行い、匿名更新401、権限不足403、専用管理userだけ成功を検証する。
3. 既存`escomi/v1/update`を専用capability、`post_type=shop`、`current_user_can('edit_post', shopId)`、field型・長さ・URL・配列検証、日次field allowlist、request ID必須へ縮小する。
4. 住所、料金、公式URL、年齢帯、紹介、順位は既存更新routeで即時拒否し、新しい差分・承認経路だけから更新する。
5. 公開`wp-json` proxyで利用者の`Authorization`をWordPressへ転送せず、POST可能pathを明示allowlist化する。
6. cache再検証routeはsecret未設定時503、POSTとheader secretだけを許可し、timing-safe比較を行う。

このPhase 0が未完了の場合、新管理画面の書込route、Supabase staging、WordPress publishは本番へ接続しない。`ai_update_log`を非公開化する前に既存URLとREST呼出元を確認し、利用者向けrouteがあれば404または移行先を明示する。

## 4. 管理画面の情報構造

既存の分析ダッシュボードを管理画面全体の親とする。`/dashboard/`はGA4・Search Console・SEO状況を把握する概要画面のまま維持し、`/dashboard/analytics/`を詳細分析、`/dashboard/content/`配下を店舗情報の確認・入力・公開作業として同じ共通shellへ統合する。分析画面と管理画面を別製品のように分けず、同じheader、PC用side navigation、スマホ用drawer、状態表示、footerを使う。

共通navigationは次の3groupとする。

- 分析: 概要、詳細分析。
- コンテンツ: 店舗、口コミ、セラピスト、出勤、ポータル評価・順位。
- 運用: AI一括取込、公開待ち、公開履歴、公式サイト取得。

初期表示は分析概要だけを取得し、管理一覧、取込file、差分、履歴を同時取得しない。menu badgeは実在する公開待ち件数等だけに使い、未連携値や固定件数を表示しない。管理routeが未実装の期間は空のmenuを先行表示せず、そのrouteが読取可能になったtaskでnavigationへ登録する。

Dashboard IRは次のとおりとする。

```yaml
page_purpose: 分析結果から修正対象を判断し、同じ管理画面内で店舗情報の確認・承認・公開へ進む
users: 初期版は共有管理者。将来は管理者、審査担当、店舗責任者へ分離
decisions:
  - SEOで優先する地域・店舗を決める
  - 未確認情報と公開待ち変更を処理する
  - セラピスト・出勤情報の公開可否を判断する
filters:
  - 分析期間
  - 地域
  - 公開・確認・取込状態
kpi_cards:
  - GA4とSearch Consoleの既存指標
  - 実データがある場合だけ公開待ち件数・未確認店舗数
charts:
  - 既存分析chartを維持
tables:
  - 店舗・口コミ・セラピスト・出勤・取込差分・履歴
drilldowns:
  - 分析から店舗管理
  - 店舗管理から差分・出典・公開履歴
empty_states:
  - 未連携、データ不足、対象なしを0と区別
data_requirements:
  - 分析は既存GA4・Search Console接続
  - 公開情報はWordPress
  - 未承認取込はSupabase非公開staging
performance_notes:
  - 初期画面で管理一覧を取得しない
  - 重いtableはpagination、差分editorは操作時load
review_checklist:
  - 共通shellと権限が全routeで一致
  - 未確認値・mock値を本番表示しない
  - スマホで横切れせず1カラムへ変形
```

`/dashboard/content/`配下へ次のmenuを置く。

| menu | 役割 |
|---|---|
| 店舗 | 店舗一覧、確認状況、最終確認日、公開状態 |
| セラピスト | セラピスト一覧、所属店舗、公開状態 |
| 出勤 | 日付別の出勤入力・取込 |
| 口コミ | 承認待ち口コミと評価項目 |
| ポータル評価・順位 | 出典別の評価・順位・確認日 |
| AI一括取込 | 指示書生成、JSON/CSV upload、検証、差分 |
| 公開待ち | 承認可能な変更行 |
| 公開履歴 | 誰が、いつ、どの店舗の何を公開したか |
| 公式サイト取得 | URL、取得方式、最終実行、状態だけを管理 |

PCは左menuと主領域、スマホはmenuを上部drawerへ変形する。管理表はスマホで横へ切らず、1件ごとのcardへ変形する。

## 5. 店舗一覧と手入力

店舗一覧はWordPress RESTから取得し、次を表示する。

- WordPress ID。
- 店舗名。
- 地域。
- 公開状態。
- 料金、営業時間、アクセス、予約先、公式URL、画像の確認済み件数と最新確認日。
- ポータル順位件数。
- セラピスト件数。
- 本日出勤件数。
- 最終確認日。
- 公開待ち変更件数。

店舗編集画面では、既存WordPress値と新しい入力値を左右または上下で比較する。空欄保存で既存値を消さず、「変更なし」「値を更新」「値を削除」を別操作にする。

## 6. 調査指示書の生成

管理者は次を選ぶ。

- 地域。
- 対象店舗。地域全件または個別選択。
- 調査項目。
- 対象ポータル。
- 公式サイト項目。
- 出力形式。JSONを標準、CSVを簡易入力用とする。

管理画面は選択内容からCodexまたはChatGPTへ渡す指示書を生成する。指示書には次を含める。

- WordPress ID。
- WordPress slug。
- 登録店舗名。
- 登録公式URL。
- 調査対象地域。
- 採用可能な一次情報と外部ポータルの区別。
- 推測禁止。
- 同名店舗をIDや公式URLなしで統合しない条件。
- 出典URL、ページ名、観測日を必須にする条件。
- JSON schemaまたはCSV列。
- 確認できない値を`null`と理由で返す条件。

指示書の生成自体は外部AI APIを呼ばない。管理者がコピーまたはdownloadし、任意のCodex・ChatGPTへ渡せるようにする。

## 7. AI出力契約

標準JSONは次の単位を持つ。

```json
{
  "schemaVersion": "1.0",
  "batch": {
    "areaSlug": "sakaisujihonmachi",
    "generatedAt": "2026-07-18T00:00:00Z"
  },
  "shops": [
    {
      "wpShopId": 123,
      "shopSlug": "example-shop",
      "fields": {},
      "portalRankings": [],
      "therapists": [],
      "schedules": [],
      "sources": [],
      "unverified": []
    }
  ]
}
```

`wpShopId`と`shopSlug`は両方一致を必須にする。片方だけ一致、店舗名だけ一致、別地域の同名店舗は自動取込しない。取込後に店舗slugが変更された場合はIDを使って候補を示すが、自動承認せず再照合を要求する。

各recordは`operation: create | update | archive`、`targetType`、`clientRecordId`を必須にする。更新・非公開化は`wpTargetId`、`targetSlug`、`parentWpShopId`、対象fieldの`expectedValueHash`を必須にする。投稿本文等は`expectedWpModifiedGmt`と対象meta hashも併用するが、店舗meta更新を`modified_gmt`だけで競合判定しない。セラピストは所属店舗ID、出勤は`wpTherapistId`、日付、`Asia/Tokyo`を明示し、名前だけで対象を決めない。外部profileを根拠にする場合は`sourceProfileUrl`を持つ。

AIが公式サイトで見つけられなかったことを`archive`の根拠にしない。archiveは理由、出典、対象現在値hashを必須にし、店舗archiveは一括承認から除外して個別再確認する。AI fileからhard deleteやWordPress投稿statusを直接指定できない。createの取り消しもhard deleteではなくarchiveを標準にする。

各更新値は、値だけでなく次を持つ。

- `value`。
- `sourceUrl`。
- `sourceTitle`。
- `sourceType`。
- `observedAt`。
- `notes`。
- `confidence`はAI参考値として保存できるが、承認条件には使わない。

CSVはポータル順位や年齢帯など、1行1recordの単純形式だけを対象にする。複数出典、セラピスト、出勤を1セルのJSONへ詰め込まない。

JSON Schemaは`additionalProperties:false`とし、許可するfield key、content type、source typeをversionごとに固定する。UTF-8だけを許可し、NUL・禁止制御文字、重複JSON key、過深nest、CSV列名重複、危険なfilenameを拒否する。日付の未来値、順位が全体件数を超える値、評価範囲外、年齢帯の負数・小数もfield別validationで拒否する。

取込上限は1file 5MB、1batch 500店舗、10,000行、文字列1項目5,000文字とする。`Content-Length`だけでなく実際に読んだbyte数でも5MBを超えた時点で中止する。JSON以外の実行可能な値を評価せず、HTMLは文字として表示し、管理画面で`dangerouslySetInnerHTML`を使わない。CSVを再downloadする場合は`=`, `+`, `-`, `@`で始まるcellをformulaとして実行できない形式へescapeする。

## 8. ポータル評価・順位

各recordは次を持つ。

- WordPress店舗ID。
- portal key。
- portal表示名。
- source URL。
- 対象地域名。
- 順位。
- 全体件数。取得できる場合だけ。
- 評価点。存在する場合だけ。
- 評価件数。存在する場合だけ。
- 観測日。
- 有効期限。初期値は観測日の45日後。
- 管理者確認日。
- 状態: draft、reviewed、published、stale、rejected。

別portalの評価基準を平均して1つの点数にしない。店舗詳細では「他サイト評価・順位」として出典ごとに並べる。有効期限を過ぎたrecordは管理画面で`stale`とし、公開moduleから除外する。

Eskomi内順位は外部portal recordへ保存せず、WordPressの`areaSlug`、`rank`、`totalEligibleShops`、`basis`、`observedAt`、`isPr`を持つsnapshotを正本にする。画面上の配列位置を順位にしない。

月次自動取得connectorは今回作らない。管理画面とschemaには`source_adapter`、`last_attempt_at`、`next_due_at`、`status`、`error_message`を用意し、将来connectorを追加できるようにする。

## 9. 公式サイト取得

今回作るのは入力欄と状態管理であり、店舗横断crawlerではない。

管理項目は次とする。

- 公式URL。
- 料金URL。
- セラピスト一覧URL。
- 出勤URL。
- ブログURL。
- 取得方式: manual、AI file、connector。
- 最終実行日時。
- 最終成功日時。
- 次回確認日。
- 状態: 未実行、確認待ち、成功、一部成功、失敗。
- エラー概要。

取得できない場合に前回値を最新値として再承認しない。観測日と確認日を分離する。

## 10. Supabase非公開staging

imperative migrationで次のtableを`api`schemaへ追加する。

### `content_import_batches`

- batch ID。
- schema version。
- input type。
- 対象地域。
- 元filename。
- file hash。
- status。
- 取込件数、valid件数、error件数。
- 作成日時、確認日時、公開日時。
- actor。

### `content_import_rows`

- batch ID。
- WordPress店舗IDとslug。
- `operation`、`target_type`、`client_record_id`。
- nullableな`wp_target_id`、`target_slug`、`parent_wp_shop_id`。
- `expected_wp_modified_gmt`と`expected_value_hash`。
- content type。
- field key。
- current value。
- proposed value。
- canonical proposed valueのpayload hash。
- source情報。
- observed at。
- validation result。
- review status。
- published at。
- WordPress response ID。
- publish attempt UUID。
- publish status: approved、publishing、published、failed、conflict、published_cache_pending。

create対象は複数field rowを`client_record_id`で1つのobjectへ束ね、object単位の1 publish attemptとして実行する。作成結果のWordPress IDを`client_record_id`へ一意対応させ、fieldごとに同じCPTを複数作らない。出勤は`source_record_key`を必須にし、WordPress側でも`therapistId + shopId + date + start + end`の正規化値へ一意制約を置く。

### `content_import_events`

- batchまたはrow ID。
- event type。
- before status。
- after status。
- actor。
- timestamp。
- message。

3表はRLSを有効にし、表ごとにPUBLIC、anon、authenticatedを明示`REVOKE`する。server roleも必要最小限とし、batch・rowは`SELECT/INSERT/UPDATE`だけ、eventは`SELECT/INSERT`だけを許可する。`content_import_events`の`UPDATE/DELETE`はDB triggerでも拒否し、append-onlyにする。actorはAI fileから受け取らず、serverの認証結果から設定する。権限検査とevent更新・削除拒否をCIへ追加する。service role keyを`NEXT_PUBLIC_`へ入れず、browser requestへ返さない。

raw取込fileは永続保存せず、serverがraw byteから計算したSHA-256、sanitize済み表示filename、canonical rowだけを残す。差分batch・rowは1年後に保守jobで削除し、append-only監査eventは無期限保持する。email等の個人情報を取込対象にしない。法務・運用要件が確定した場合は保持期間をmigrationと管理画面表示の両方で更新する。

## 11. 認証と権限

### 初期管理者版

- 共通`requireContentAdmin()`を全管理画面、read API、mutation APIで直接実行し、middlewareだけを信用しない。
- 認証設定未設定は503、認証失敗は401、権限不足は403で拒否する。
- 当面のactorは共有Basic管理者IDと明示し、個人名の監査として扱わない。個人監査は将来Auth導入後に行う。
- mutationはsame-origin、Basic認証、署名付きCSRF cookieとheader、request size上限を必須にする。
- JSON/CSVは拡張子だけで信用せず、server側で解析・検証する。
- 外部URLはHTTP/HTTPSだけを許可する。
- mutationはPOST/PATCHだけ、GETは完全read-onlyとする。許可originを固定し、`Origin`と`Host`の一致、`Sec-Fetch-Site=same-origin`、`Content-Type`がJSONまたはmultipart、署名付きCSRF cookieと同値headerを検証する。
- 管理画面とAPIは`noindex, nofollow`および`X-Robots-Tag`を返す。
- 取込時はsource URLをserverから開かず、SSRFを起こさない。将来connectorは別processでprivate IP、localhost、metadata endpoint、redirect先を拒否する。
- WordPress Application Passwordは専用userと最小権限で発行し、server環境変数だけに保存する。
- 新管理書込は専用server-only WordPress clientへ分離し、browserから受けた`Authorization`を転送しない。
- WordPressへ送れるpost type、店舗ID、meta key、値型をserver allowlistで固定し、AI fileから任意metaやstatusを指定できない。
- Supabase secretまたはlegacy service role keyはserver-onlyとし、key形式に応じた公式のheader方式を使う。
- error responseとaudit messageへsecret、Authorization header、Application Password、raw request headerを保存しない。

### 将来の店舗会員版

- Supabase AuthまたはWordPress userを採用する前に、1つへ統一する。
- 権限はadmin、shop owner、shop staff、reviewerを分ける。
- authorizationはuser metadataではなくserver-side roleまたはapp metadataで判定する。
- 店舗会員は自分に割り当てられたWordPress店舗IDだけを編集できる。
- 無料・有料planの値だけで公開権限を自動付与しない。
- 表示は`visibility: public | unlisted | private`、入力権限は`authoringEntitlement: admin | owner-free | owner-paid`、審査は`moderationPolicy: review-required | trusted-publish`へ分離する。
- 無料・有料は書き込めるcontent typeの違いに使い、承認済み`visibility=public` contentは全利用者へ表示する。

店舗おすすめ、店舗blog、セラピストblog等の将来contentは、`contentType`、`wpShopId`、任意の`wpTherapistId`、`authorWpUserId`、`authoringEntitlement`、`moderationStatus`、`publicationStatus`、`sourceType=shop-provided`、`reviewedAt`、`publishedAt`を共通契約とする。

## 12. 差分確認と公開

取込後の流れは固定する。

1. file全体のschema検証。
2. WordPress IDとslugの再照合。
3. URLと日付の検証。
4. 現在のWordPress値を再取得。
5. field単位の差分生成。
6. 出典と未確認理由の表示。
7. 管理者が行単位または店舗単位で承認。
8. serverからWordPressへ更新。
9. 成功したfieldだけ`published`にする。
10. `shop_updated_at`へ承認日を保存。
11. `shop_last_ai_check`はAI処理日時として分離維持。
12. 公開履歴とresponseを保存。
13. 対象店舗、地域、トップのcacheを再検証する。

一部失敗時にbatch全体を成功扱いしない。WordPress更新に失敗したrowは再実行でき、成功済みrowを重複更新しない。

差分作成時にWordPress現在値のhashを保存し、承認直前に再取得する。hashが変わっていれば同時更新として公開を止め、新しい差分確認を要求する。nullable値を正規化した全識別子とcanonical proposed valueから`canonical_row_hash`をserver生成し、この1列へ一意制約を置く。手入力batchにもserver生成idempotency keyを付け、訂正版を別rowとして扱いながら同一再送を重複させない。

公開処理は`approved → publishing → published | failed | conflict`の状態遷移とする。publish attempt UUIDとclient record IDに一意制約を持つWordPress専用ledger tableで`received | applying | applied | failed`と作成済みWordPress IDを保持する。ledger確認、対象更新、結果記録は可能な限り同一DB transactionで行い、response喪失時はledger、request ID、現在値、作成済みIDを読戻して成功済みか確認してから再試行する。

公開前値と公開後値、WordPress response、actor、時刻をauditへ残す。取り消しは履歴削除ではなく、公開前値を新しい変更batchとして作り、同じ差分・承認経路で戻す。「未設定」「空文字」「null」「削除」を別操作として保存し、作成時と実行直前の両方で現在値hashを確認する。第三者更新があれば自動で戻さず`conflict`で停止する。

店舗fieldの公開値と対応する`shop_fact_provenance`は同じWordPress処理で更新し、どちらか一方だけ成功した場合は`failed`または`conflict`として公開成功にしない。

cacheは`shop:{id}`、`shop:{slug}`、`reviews:{shopId}`、`therapist:{id}`、`shop-therapists:{shopId}`、`area:{slug}`、`home`、`shops:sitemap`、`therapists:sitemap`を変更内容に応じて再検証する。WordPress更新成功後のcache失敗は`published_cache_pending`とし、cache処理だけを再実行してWordPress更新を重複させない。

## 13. WordPress公開データ

### 店舗meta

既存fieldを優先して再利用する。

- 料金、営業時間、アクセス、予約、公式URL、画像、特徴。
- `shop_updated_at`。
- `shop_fact_provenance`。料金、営業時間、アクセス、予約、公式URL、画像ごとに`sourceUrl`、`sourceType`、`observedAt`、`reviewedAt`、`reviewStatus`、`publishedValueHash`を持つ。
- 7つの年齢帯と`shop_today_therapists`は移行・互換入力だけに使う。
- `shop_availability`。
- `shop_portal_rankings`。
- 公式サイト取得状態。

新規metaは型、sanitize、REST read/write permissionを登録する。配列をPHP serialize文字列のまま公開せず、RESTで一貫したobject配列として返す。

`shop_updated_at`はページ全体の公開更新日であり、個別fieldの確認日には使わない。情報確認状況は現在の公開値hashとprovenanceの`publishedValueHash`が一致し、`reviewStatus=reviewed`のfieldだけを数える。

### 口コミ

口コミ公開正本はWordPress `reviews`投稿typeとし、Supabaseへ複製しない。専用読取RESTは公開済みかつ`approval_status=approved`、公開関係の正本である店舗IDが一致するrecordだけを返し、本文、投稿日、総合・料金・接客・清潔感の評価だけを公開する。slug不一致は管理警告にし、旧slugが当該店舗の履歴と確認できる場合だけ移行対象にする。別店舗へ自動で付け替えない。店舗詳細graph、最新3件、`/shops/{slug}/reviews/`のページ分割一覧、件数、AggregateRatingは同じserver adapterを使う。

### セラピストCPT

3枠固定のおすすめfieldだけでは店舗・トップ・詳細を連動できないため、`therapist`投稿typeを追加する。

- WordPress therapist ID。
- slug。
- 表示名。
- 所属店舗ID。
- 画像。
- 紹介文。
- 明示された年齢または年齢帯。生年月日は保存しない。
- 特徴tag。
- 公式profile URL。
- 公開状態。
- 確認日と出典。
- `featured_on_home: boolean`。
- `home_order: integer`。
- `home_featured_until: datetime | null`。

年齢を画像や文章から推測しない。店舗責任者または公式profileで明示された値だけを使う。

外部URLの画像は取込候補に留め、権利確認後にWordPress mediaへ登録した画像だけを公開する。hotlinkを公開正本にしない。

セラピストCPT公開後は、年齢層と在籍数を公開中therapist投稿から集計する。既存の店舗年齢帯metaは初回移行と比較用に限定し、CPT集計と手入力年齢帯を同時に公開正本にしない。公開routeは`/therapists/{slug}/`とし、公開状態、所属店舗、画像または確認済み紹介、確認日が揃う場合だけindex可能にする。canonical、ホーム→地域→店舗→セラピストのパンくず、sitemap、所属店舗との相互linkを必須とし、条件を満たさないrecordにはrouteを作らない。

年齢帯は公開対象が合計3名以上の場合だけ集計する。1区分が1〜2名なら隣接区分へまとめるか「その他」へ統合し、少人数から個人の年齢を推測できない表示にする。

### 出勤

出勤はWordPressの非公開管理CPT`therapist_schedule`で保持し、RESTで公開可能な当日・将来recordだけを返す。recordはセラピストID、店舗ID、Asia/Tokyoの日付、開始時刻、終了時刻、状態、出典、確認時刻を持つ。日記の投稿時刻を出勤時刻へ読み替えない。

`shop_today_therapists`は初回移行と既存日次処理の互換入力に限定する。新CPT稼働後は店舗詳細、セラピスト詳細、トップが`therapist_schedule`を共通正本として読み、同じ日の情報を別metaへ二重入力しない。

## 14. 公開画面の連動

全画面は共通のserver-side public adapterを使い、WordPress shop ID、therapist ID、公開状態、確認状態を同じ規則で解釈する。トップ、一覧、地域だけ別metaや別JSONを読む実装は禁止する。

### 店舗詳細

- 口コミdashboard。
- 情報確認状況。
- Eskomi順位。
- 他portal順位。公開済みrecordがある場合だけ。
- セラピスト一覧。
- 年齢層。
- 当日出勤。
- 店舗ブログ・セラピストブログの将来module。

### セラピスト詳細

- セラピスト名、画像、確認済み紹介。
- 所属店舗へのlink。
- 当日または直近出勤。
- 店舗の予約先。
- 出典と確認日。
- 関連する店舗口コミとセラピスト情報を混同しない表示。

### トップ

- 公開済みかつ所属店舗・確認日があり、画像または確認済み紹介があるセラピストだけを条件付き表示。
- 当日出勤は日付が一致し、確認時刻が有効なrecordだけ表示。
- 店舗詳細と同じWordPress therapist IDを使う。
- 管理者が`featured_on_home`を有効にしたセラピストだけを表示し、表示順も管理値を使う。
- dataがない場合は空sectionを出さない。

### 店舗一覧・地域

- 店舗detailへのlinkを維持。
- セラピスト数や本日出勤数は、公開済みrecordがある場合だけ補助情報として表示。
- 外部順位をEskomiランキングと混ぜない。

## 15. 実装順

0. 既存REST・debug・認証転送・cache再検証の安全化。
1. 共通公開contract、reviews adapter、field別provenance。既存値を読取監査し、出典URLと観測日を証明できるfieldだけprovenance移行候補にする。根拠のない既存値を確認済みにしない。
2. 口コミ評価dashboard、情報確認状況、Eskomi順位。
3. 1カラム店舗詳細、二層ページ内menu、全幅QA。
4. Supabase非公開staging migrationと権限検査。
5. 管理画面の店舗一覧・手入力・AI指示書・upload・差分。WordPress書込はまだ行わない。
6. WordPress publish、競合検査、冪等ledger、cache再検証。
7. セラピストCPT、入力基盤、店舗relationship、共通adapter。
8. セラピスト詳細、年齢層、在籍数。
9. 出勤入力と店舗詳細・セラピスト詳細への表示。既存日次・時間更新を`therapist_schedule`へ移し、shadow比較後に旧metaの公開読取を停止する。
10. トップ、店舗一覧、地域への条件付き連動。
11. ポータル評価・順位、公式サイト取得の管理項目。
12. 対象外温泉2店舗のdraft化と公開除外確認。これは本番WordPress操作なので、実行直前にユーザーの個別許可を得る。
13. 全幅QA、SEO、security、独立横断レビュー。

外部portalの月次connectorと公式サイトcrawlerはこの順序の後に別計画で実装する。

本番投入はWordPressへ後方互換のあるCPT・meta・専用RESTを先行反映し、読取検証後にHeadless adapterとUIを反映する。rollbackはHeadlessを先に戻す。endpoint未準備またはprovenance 0件の場合は推測fallbackや0点表示をせず、対象moduleだけを非表示にする。出勤切替は旧metaと新CPTを一定期間比較し、一意keyと戻し条件を確認してから新CPTだけを公開正本にする。

## 16. 検証

### 管理画面

- 匿名debug route、MU plugin削除、REST認証全体解除が存在しない。
- 既存更新routeは匿名401、権限不足403、専用userと日次allowlistだけ成功する。
- 認証設定未設定で全管理画面・read API・mutationが503になる。
- 認証未設定で書込画面とmutationが拒否される。
- 壊れたJSON、未知schema version、過大fileが拒否される。
- 未知key、重複JSON key、重複CSV列、制御文字、過深nest、実読込5MB超過が拒否される。
- WordPress IDとslug不一致が拒否される。
- create対象の複数field rowが1つのWordPress CPTだけを作り、再試行でも増えない。
- AI fileの未発見だけではarchiveできず、店舗archiveは個別再確認なしに実行できない。
- 出典なしのportal順位、年齢、出勤が公開承認できない。
- 同じfile hashの再取込が重複batchにならない。
- 変更なしrowをWordPressへ送らない。
- 一部失敗を正しく再実行できる。
- actorと日時が履歴へ残る。
- WordPressが差分確認後に変更された場合、古い差分の承認が拒否される。
- rollbackが新しいbatchとして記録され、元履歴が消えない。
- rollback実行直前に第三者更新があれば`conflict`で停止する。
- WordPress response喪失後の再試行でも、同じpublish attemptが二重適用されない。
- 公開値とprovenanceの片方だけ失敗した処理が`published`にならない。
- source URLの取込だけでserver-side fetchが発生しない。
- browserのAuthorizationがWordPressへ転送されない。

### データベース

- RLS有効。
- PUBLIC、anon、authenticated grant 0。
- service roleだけ必要操作が成功。
- `content_import_events`のUPDATE/DELETEがDB側で拒否される。
- 非公開stagingが公開viewへ混ざらない。
- migration再適用で重複しない。
- Security/Performance Advisorのerror 0、warning 0。

### 公開画面

- 未承認AI出力が0件表示。
- 店舗・セラピスト・トップが同じWordPress IDを参照。
- 同名セラピスト2名が別WordPress IDとして保持される。
- 店舗・セラピスト・トップ・一覧・地域が同じ公開状態を返す。
- 店舗slug変更後も店舗IDと確認済みslug履歴が一致する既存口コミだけが維持される。
- 年齢3名未満の集計は個人を推測できる表示にしない。
- 1〜2名の年齢帯を単独表示しない。
- 出勤の日付切替後に前日情報を「本日」と表示しない。
- 外部順位とEskomi順位が別labelで表示される。
- 有効期限を過ぎた外部順位が公開moduleから消える。
- 確認日とAI実行日が混ざらない。
- 料金更新で営業時間など他fieldのprovenanceが更新されない。
- provenance 0件の店舗では確認状況を0点表示せずmoduleを非表示にする。
- 口コミが2件から3件になった時、graphとAggregateRatingが同じ集計で同時に有効になる。
- 無料・有料で入力可能項目は異なっても、承認済みpublic contentの閲覧範囲は同じになる。
- cacheだけ再実行した時にWordPress更新と監査logが重複しない。
- shadow期間中の出勤が旧metaと新CPTで二重表示・二重作成されない。
- dataなしmoduleが非表示。

### 通常検査

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:portal-browser-layout`
- `npm audit --audit-level=high`
- Supabase migration lintとadvisor。
- WordPress REST read/writeのdry-runまたは検証環境確認。
- taskごとの実装担当と別担当レビュー。
- 全task後の独立横断レビュー。

## 17. 完了条件

- 管理者が地域・店舗・項目を選び、AI調査指示書を作れる。
- CodexまたはChatGPTのJSON/CSVを一括取込できる。
- 出典付き差分を確認し、承認したfieldだけWordPressへ反映できる。
- 承認日、AI処理日、観測日が分離保存される。
- 手入力とAI取込が同じ差分・承認経路を通る。
- 店舗詳細、セラピスト詳細、トップが共通WordPressデータで連動する。
- 年齢層、在籍数、出勤が実データのある店舗だけ表示される。
- 外部portalと公式サイト取得の管理項目があり、将来の月次connectorを追加できる。
- service roleと未承認dataがbrowserへ露出しない。
- 新しいpush・本番公開はユーザーの明示許可まで行わない。
