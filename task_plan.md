# Task Plan: SEOを守るSupabase段階移行

## Goal

公開中のURL・検索向け設定・WordPress表示を変えずに、承認済みの本番SupabaseへWordPress全382店舗・34地域を非公開で移し、検証後にSEOと視認性改善の次実装へ進む。

## Current Phase

UX-PROD-T2-RESUME Phase 7（結果記録・T3前で停止）

## UX-PROD-T2-RESUME

### Goal

最新base `b785315a2a3cd490772fd70cd18bb1f8b21f2f75` から、既存Top資産を保持したまま口コミを上位化し、正式global approved review readerを使う `/reviews/` Hubを追加する。T3/T4・dependency・本番は変更しない。

### Phases

- [x] Phase 1: 専用worktree、正本、現行Top/review/SEO/data sourceを確認する
- [x] Phase 2: T2専用contract testを追加し、意図したREDを記録する
- [x] Phase 3: Top flow・新着口コミ・Updates・priority Area導線を最小実装する
- [x] Phase 4: `/reviews/` Hub・metadata・canonical・breadcrumb・SSRを最小実装する
- [x] Phase 5: focused/full test・build・audit・browser QAを実行する
- [x] Phase 6: 独立reviewでCritical/Important 0を確認し、対象pathだけcommitする
- [x] Phase 7: `progress.md`を更新し、T3へ進まず停止する

### Stop Conditions

- T3 Area本文またはT4 Shop本体の変更が必要
- ranking/new storage/therapist ID/dependency変更が必要
- sitemap/canonical全体方針変更が必要
- Secretまたは本番接続が必要
- 同一原因で3回失敗

### Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| 初回計画更新patchが古いCurrent Phase文言を期待して失敗 | 1 | 現在行を再確認し、小さいpatchへ分割した |
| render contract helperが`react/jsx-runtime`を解決できずfeature assertion前に停止 | 1 | test helperへ実React JSX runtimeを追加し、mock assertionは増やさない |
| Home順序testの`掲載店舗`がHeroの`掲載店舗数`へ先に一致 | 1 | H2のid付きmarkerへ絞り、利用者向け順序を正しく測る |
| 参考動画の抽出で`ffprobe`/`ffmpeg`が存在しない | 1 | 同じ失敗を繰り返さず、macOS AVFoundationで安全な一時frameを抽出して確認した |
| 複数語検索が連続文字列一致のため`梅田 接客`を落とした | 1 | 正規化した空白区切り語をすべて含むAND検索へ修正した |
| focused確認を`headless/`からroot相対pathで始めて対象ファイルを読めなかった | 1 | 現在の作業directory基準の`components/...`へ直し、lint/typecheckまで成功した |
| `test:content-provenance`が既存の0店舗地域表示契約で失敗 | 1 | T2範囲外の`KansaiAreaGrid`状態表示変更だけを戻し、既存契約を維持した |
| 再実行した同testがHeader/Footerの既存label保持契約で失敗 | 1 | 行先はReviews Hubへ更新しつつ、既存の「口コミについて」「口コミ投稿」labelを保持した |
| 全testが既存の料金条件link保持契約で失敗 | 1 | 実data filterを使う既存条件sectionを「その他content」としてTop下段へ復元した |
| T2 focused testが既存Area状態表示までfictional扱いした | 1 | Area状態表示は既存契約として維持し、承認済みplanが明示する未検証`初心者向け`filterは禁止のままにした |
| production buildが`/reviews`のruntime `searchParams`をSuspense外で検出 | 1 | 既存`/shops/`等と同じCache Components契約をREDで固定し、route contentだけをSuspense境界へ移した |
| 初回browser QAがUpdates見出し誤認・global endpoint未公開時の検索0件期待・`networkidle` timeoutで停止 | 1 | 実H2を測り、取得不能は正直な空状態として許可し、main表示を条件待機する。fixtureで実data時の検索0件は別途固定済み |
| H1/QA画像修正patchを3ファイル一括で適用し、hunk区切り不備で失敗 | 1 | 同じ内容を正しい小さいhunkへ分け、対象行だけ変更する |
| 代表画像でPC 1440px H1が「体／験談」に不自然改行し、Top全画面がfade途中で白く見えた | 1 | H1の最大幅だけを1100pxへ調整し、QA撮影時だけanimationを無効化して最終表示を記録する |
| reduced-motion browser REDでTop discovery animationが`0.6s`のまま | 1 | T2 Topの`hl-fade-in`だけをreduced motion時に無効化し、既存全体animationへ範囲を広げない |
| 独立VISIBLE QAがSuspense fallbackを撮るraceと複数Area口コミの先頭link限定を検出 | 1 | settled main/visible H1/fallback消滅を条件待機し、ReviewCardは重複除外した全canonical Area relationを表示するRED→GREENへ修正した |
| 独立SPEC reviewが未検証`初心者向け`filterの復元をplan不一致と指摘 | 1 | 料金filter保持testと混同せず、条件sectionから初心者cardだけを削除してfocused testで禁止を再固定した |
| 独立security reviewが新規teal/gold/focusのcontrast不足、実card browser分岐skip、tabpanel名欠落を検出 | 1 | AA配色・不透明focus・active tab関連を修正し、production ReviewCard/CSS fixtureを全11幅で必須検査する |

## Phases

### Phase 1: 現状復元と安全確認
- [x] ユーザーの移行条件とSEO調査結果を整理する
- [x] 正式作業場所、Git状態、本番変更禁止を確認する
- [x] 現行テストが通ることを確認する
- **Status:** complete

### Phase 2: 設計と実装計画
- [x] 最小データ構成と安全な切替方式を設計する
- [x] 実装手順と検査条件を文書化する
- [x] 現行コードの接続点を確定する
- **Status:** complete

### Phase 3: Supabaseローカル基盤
- [x] テストを先に追加し、意図した失敗を確認する
- [x] ローカルmigrationとAPI公開範囲を実装する
- [x] WordPress移行元データの監査ツールを実装する
- **Status:** complete

### Phase 4: WordPress既定の移行接続点
- [x] テストを先に追加し、意図した失敗を確認する
- [x] WordPressを既定値にした参照先設定を実装する
- [x] Supabase単独切替に承認ゲートを設ける
- **Status:** complete

### Phase 5: 検証と引き継ぎ
- [x] Supabase契約、lint、型、既存テスト、buildを検証する
- [x] SEO非変更、本番非変更、戻し方を確認する
- [x] pm/PROGRESS.mdと計画ファイルを更新する
- **Status:** complete

### Phase 6: 本番projectの健康確認
- [x] 公式statusとchangelogを確認する
- [x] CLIの認証状態と対象projectへのアクセスを確認する
- [x] Chromeから対象project URLを開き、現在のログイン先では組織一覧へ戻されることを確認する
- [x] スクリーンショットの対象アカウントでprojectが開かれたことを確認する
- [x] 状態「健康」と直近HTTP 200への回復を確認する
- [x] 対象Chrome profileへChatGPT Chrome Extensionを追加し、projectタブへ接続する
- **Status:** complete

### Phase 7: 本番schema適用
- [x] 対象projectのSQL Editorでschema・migration履歴が未作成と確認する
- [x] 検証済みmigrationをtransaction内で本番適用する
- [x] migrationを本番DBへ適用する
- [x] migration履歴、schema、RLS、advisorを検証する
- [x] Advisorの出典FK index不足3件をテスト先行で追加migrationする
- [x] 追加migrationと履歴を本番へtransaction適用する
- **Status:** complete

### Phase 8: 3店舗の非公開試験投入
- [x] 堺筋本町の3店舗と地域1件を安全条件で選ぶ
- [x] テスト先行で試験投入・検証手順を実装する
- [x] private/draft状態で投入し、公開APIへ出ないことを確認する
- [x] 結果を記録し、30店舗拡大前で停止する
- **Status:** complete

### Phase 9: 30店舗の非公開試験投入
- [x] ユーザーから30店舗拡大の承認を得る
- [x] 既存3店舗、料金欠損、画像欠損、公式URL欠損、複数地域所属を含む30店舗を固定する
- [x] テスト先行で生成処理、投入SQL、検証SQLを実装する
- [x] local DBへ3店舗→30店舗→30店舗再実行の順で適用し、重複なしと公開view 0件を確認する
- [x] 正しいChromeアカウントで対象projectへ再接続し、本番事前件数を確認する
- [x] 本番へ30店舗SQLを適用し、保存件数、公開漏えい、Advisorを検証する
- [x] 382店舗投入前で停止し、結果を記録する
- **Status:** complete

### Phase 10: 382店舗・34地域の非公開移行
- [x] ユーザーから全382店舗への拡大承認を得る
- [x] WordPressを再監査し、店舗382・地域34と欠損件数を確認する
- [x] テスト先行で全地域・複数地域・地域なし店舗を扱う生成処理を実装する
- [x] local DBで初回適用・再実行・公開漏えいを検証する
- [x] 本番へ非公開で適用し、件数・重複・公開漏えい・Advisorを検証する
- [x] 結果を記録し、公開参照先切替前で停止する
- **Status:** complete

### Phase 11: SEO・視認性改善の次実装
- [x] 現在の不足情報と既存のSEO/UI検査を確認する
- [x] 改善の主目的と成功条件をユーザーへ1問ずつ確認する
- [x] 2〜3案を比較し、C案「データ先行・編集型」の承認を得る
- [x] 承認済み設計書と実装計画2本を作成する
- [x] テスト先行で実装し、PC/SP・SEO・buildを検証する
- [x] 代表3店舗をPC 1440/1280/1024、スマホ390/375/320で確認し、全18条件を合格させる
- [x] 予約・公式・店舗責任者の計測を分離し、電話番号とgeneric重複がないことを確認する
- [x] 全11タスクの実装と最終横断レビュー修正を完了し、push・deploy・本番操作前で停止する
- [x] canonical encoded slug、正本照合、分散rate limit、口コミ店舗一致、production 18条件をローカル検証する
- [x] 独立再レビューでCritical / Important 0を確認し、11/11の最終承認を確定する
- **Status:** complete

### Phase 12: SEO実行プロンプト Phase 4「堺筋本町の実データ強化」
- [x] 正式作業場所、既存差分、停止条件、WordPress既定を再確認する
- [x] 対象30店舗の選定規則とデータ項目を確定する
- [x] WordPress公開データから対象30店舗を固定し、一次情報を店舗ごとに調査する
- [x] 調査データの契約検査を先に失敗させ、検証器を実装する
- [x] 料金・営業時間・駅出口・予約方法・出典・確認日を根拠付きで記録する
- [x] 確認済みデータだけで料金分布・営業時間傾向・駅出口別・初心者向け・深夜利用を集計する
- [x] Supabase非公開draft previewを生成し、lint・typecheck・全test・build・QAレビューを行う
- [x] `pm/PROGRESS.md` と `pm/NEXT_ACTIONS.md` を更新し、Supabase投入・push・本番公開前で停止する
- **Status:** complete

### Phase 13: 堺筋本町 Phase 4のSupabase非公開投入準備
- [x] WordPressを公開データ元として維持し、本番Supabase・push・公開切替前で止める範囲を再確認する
- [x] 既存schemaと取込履歴の契約に合わせ、26店舗・料金89行・営業時間23行・出典71行・項目別出典189行の投入SQLと検証SQLをテスト先行で生成する
- [x] 既存382店舗の非公開データをローカルDBへ復元し、Phase 4 SQLを初回と再実行の2回適用する
- [x] 再実行後も件数不変、料金・営業時間の重複0、匿名公開view全9種0件を確認する
- [x] DB lint、対象検査、全体検査、build、Git差分検査を実行し、本番適用前で停止する
- **Status:** complete

### Phase 14: 店舗詳細・Phase 4の本番反映
- [x] 実装一式をコミットし、最新 `origin/main` を統合する
- [x] NodemailerのHigh advisoryを9.0.3固定で解消し、独立レビューを完了する
- [x] 全test、lint、typecheck、441ページbuild、High/Critical 0を再確認する
- [x] 別サービスを指していたSupabase CLIリンクを解除する
- [x] 正しいエスコミ本番Supabaseへ店舗責任者申請migrationを適用する
- [x] Vercel ProductionへSupabase接続情報とrate limit secretを登録する
- [x] `main` へ反映し、GitHub ActionsとVercel本番を確認する
- [x] PC・スマホ・対象店舗・申請APIの本番確認を行う
- **Status:** complete

### Phase 15: Eskomi 店舗一覧・店舗詳細 UX再構築
- [x] A案の設計書を作成し、別担当レビューで実装ブロッカー0を確認する
- [x] 分離worktreeで依存導入と変更前の全検査を成功させる
- [x] 実装計画を11タスクへ分割し、計画レビューを完了する
- [x] 店舗名改行、順位位置、比較表見切れをテスト先行で修正する
- [x] 可視英字表記とサイト所有の旧ロゴ画像をEskomiへ更新する
- [x] 固定更新日、推定駅近・初心者向け、生成コメント、住所schemaの断定表示を整理する
- [x] 店舗一覧カードを共通正本へ統合し、PC4列・スマホ積み上げへ再構築する
- [x] 料金比較を1つのDOMでPC表・スマホ比較カードへ変形する
- [x] 店舗詳細へ条件付きページ内メニュー、正確な文字階層、予約導線を実装する
- [x] 8画面幅と切替境界で幾何計測・スクリーンショット・アクセシビリティを確認する
- [x] lint、typecheck、全test、production build、独立最終レビューを完了する
- [x] `progress.md` と `pm/PROGRESS.md` を更新し、push・本番公開前で停止する
- [x] ユーザー承認後に`main`へpushし、Xserver・Vercel・SEO確認・本番全幅QAを完了する
- **Status:** complete

### Phase 16: 一覧ランキング・店舗詳細の精密再調整
- [x] 添付スクリーンショットと本番表示を再現し、順位・CTA重複・文字密度の根本原因を特定する
- [x] 失敗する契約検査を追加し、順位バッジをカード内オーバーレイへ統合する
- [x] 店舗詳細の予約導線を役割別に一意化し、同一CTAの二重表示をなくす
- [x] 見出し・数値・本文・余白を情報ポータル向け密度へ再調整する
- [x] WordPressに存在する情報だけで詳細セクションを整理し、推測情報を追加しない
- [x] PC/SPと切替境界を非表示ブラウザで検証し、独立レビューを通す
- [x] `progress.md` と `pm/PROGRESS.md` を更新し、push・本番公開前で停止する
- [x] ユーザー承認後に`main`へpushし、Vercel本番公開と本番全幅QAを完了する
- **Status:** complete

### Phase 17: 店舗詳細の1カラム・二層タブ基盤
- [x] 現行の店舗詳細component、口コミデータ、CTA計測、将来拡張箇所を読み取り確認する
- [x] トップに置く最初のグラフを承認済み口コミの評価集計とし、件数不足時は非表示にする
- [x] 年齢層・在籍数・出勤数・外部評価・外部順位の取得方法と段階導入範囲を確定する
- [x] 3案の構造を比較し、検証済みデータ優先の1カラム・二層メニュー設計を承認する
- [x] 設計書を保存し、placeholder・矛盾・曖昧さ・過剰範囲を自己レビューする
- [x] AI一括取込・WordPress管理・セラピスト連動の別設計書を作成する
- [x] architectureとsecurityの別担当レビューを行い、公開正本・権限・競合・監査・cache契約を修正する
- [x] ユーザーが保存済み設計書を確認する
- [x] 分析ダッシュボードを共通管理shellとし、管理機能を同じnavigationへ段階追加する方針を確定する
- [x] テスト先行の8タスク実装計画を独立レビューし、実装担当と別担当レビューへ分ける
- [x] PC/SP・SEO・アクセシビリティ・実データ境界を検証する
- Task 1: `5c2eabd..394b537`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 2: `e6a82c1..c192969`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 3: `f1b56f3..cdb9368`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 4: `e4dcff9..59e5b4e`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 5: `27b9f33..b01888e`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 6: `ba7c33b`、独立レビュー Critical 0 / Important 0 / Minor 0
- Task 7: `e7f3a48..c3133e5`、独立再レビュー Critical 0 / Important 0 / Minor 0
- Task 8: `39d4e82`と`1bb8c76`で全幅QA・検証記録・初回レビュー指摘を保存。再レビューのfixture幅指摘も、本番6階層・computed grid・公開実route同値比較へ修正した。
- Release: `586cc38`、`cb83de6`、`bf9346b`をmainへ反映。Vercel本番、国内SSH経由のXserver本番、WordPress実データ、1店舗日次更新を検証した。
- **Status:** complete（Task 1〜8、独立レビュー、本番PC/SP QA、出典35件、対象外2店舗draft、1店舗更新成功まで完了）

### Phase 18: AI一括取込・管理画面
- [ ] Phase 0として匿名debug、REST認証全体解除、任意meta更新、認証header転送、cache fail-openを先に解消する
- [ ] fail-closedの管理routeとSupabase非公開stagingを実装する
- [ ] 店舗一覧、手入力、AI調査指示書生成、JSON/CSV取込を実装する
- [ ] WordPress現在値との差分、出典、観測日、承認日を確認できる画面を実装する
- [ ] 承認済みfieldだけWordPressへ反映し、公開履歴と再実行を検証する
- **Status:** pending

### Phase 19: セラピスト・出勤・トップ連動
- [ ] WordPressのセラピストCPTと店舗relationshipを実装する
- [ ] 管理画面のセラピスト・年齢帯・出勤入力を実装する
- [ ] セラピスト詳細、店舗詳細、トップ、店舗一覧を共通IDで連動する
- [ ] 年齢層・在籍数・出勤を実データのある場合だけ表示する
- **Status:** pending

### Phase 20: 8月SEO店舗・地域充実
- [ ] Search Consoleで優先地域と対象queryの基準値を確定する
- [ ] 対象外店舗を整理し、一次情報・画像・独自本文・内部linkを優先地域へ追加する
- [ ] 地域ごとの表示回数、click、平均掲載順位、10位以内queryを週次確認する
- **Status:** pending

## Key Questions

1. 最小構成で、現在不足している本文・口コミ・出典・確認日を拡張できるか。
2. 公開ページをWordPress既定のまま保ち、Supabase比較確認だけを先行できるか。
3. 本番Supabaseや公開参照先の切替なしに、次工程の安全性を検証できるか。

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 現在の正式フォルダ内に `codex/supabase-seo-safe-migration` ブランチを作る | mainへの混入と自動本番反映を防ぎ、既存の一時作業ツリーを変更しないため |
| 公開表示はWordPressを既定値のまま維持する | URL、canonical、サイトマップ、生成HTMLを今回の基盤整備で変えないため |
| 本番Supabaseへの書き込みは承認済みのschema・3店舗・30店舗・382店舗の非公開移行に限定する | SEO切替と公開には別の承認が必要なため |
| Phase 4の対象は2026-07-15にWordPress REST API既定順で取得した堺筋本町の先頭30店舗とする | 対象を再現可能にし、未確定の人気順位や恣意的な入替を避けるため |
| 検索結果や第三者ポータルは公式URL発見の補助に限り、事実値の出典には使わない | 一次情報だけで料金・営業時間・アクセス・予約先を確定するため |
| 調査結果はローカルの根拠付きデータとSupabase非公開draft previewに保存し、WordPressを更新先にしない | WordPressを公開データ元として維持しつつ、移行先の非公開データを確認可能にするため |
| Phase 4投入は既存行を壊さない部分更新とし、生成SQLをローカルで2回通してから本番承認を求める | 重複、公開漏えい、未確認値の上書きを本番前に止めるため |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `task-brief`をPythonとして起動して構文エラー | 1 | シェルスクリプトであることを先頭行から確認し、実行権限付きの本体を直接起動する |
| Task 1 focused検査が旧`rankSlot`・4列仕様を固定して新設計と衝突 | 1 | 旧契約検査自体をTask 1対象へ追加し、順位オーバーレイ・共通3列契約へ更新する |
| Task 1計画とエラー表を1patchで更新し、別ファイルの行を同一ファイルに探して失敗 | 1 | 対象ファイルごとの正確な行を`rg -n`で確認し、別hunkとして更新した |
| Task 2 focused検査2本が旧`visualAside`・旧文字サイズ・旧CTA配置を固定して新設計と衝突 | 1 | 旧契約検査2本をTask 2対象へ追加し、新しい上部2列・画面幅別CTA一意性へ更新する |
| push前のrange差分検査で新規Markdownの行末空白8件を検出 | 1 | 文書の行末空白と末尾の余分な空行を削除し、`origin/main..HEAD`の差分検査を再実行する |
| Task 3 browser GREENが760pxで非表示のhero CTAを先頭待機してtimeout | 1 | 表示中のCTAを待つselectorへ限定し、同じ56 scenariosを再実行してfailure 0を確認する |
| `docs/ai-skills.md` が存在しない | 1 | AGENTS.mdのルールと利用可能なSupabase手順を直接適用し、不在を進行ログへ記録する |
| `../pm/DECISIONS.md` と `../docs/design/...` を誤った相対位置で読もうとして失敗 | 1 | リポジトリルート基準の `pm/...` と `docs/...` に直して再確認する |
| Docker daemonが起動しておらず、SupabaseローカルDBへ接続できない | 1 | Docker Desktopを起動し、専用portで実DB適用・reset・lintまで成功した |
| 監査moduleの正規表現でword boundaryへ量指定子を付け、構文エラー | 1 | 不要な `?` を削除し、同じ検査を再実行する |
| VM内オブジェクトを `deepEqual` し、別realmのprototype差で失敗 | 1 | JSON値として比較し、設定内容そのものを検査する |
| 既存 `WP_API_BASE_URL=/wp-json` を監査CLIが二重に扱えない | 1 | `/wp-json` と `/wp-json/wp/v2` を正規化する関数を追加する |
| 公開content/reviewの親店舗・地域が非公開でも行policyだけでは出せた | 1 | RLSへ公開親の存在条件を追加する |
| Secret検査commandの引用符が壊れてshell構文エラー | 1 | 複雑な引用をやめ、JWTとSupabase secret形式の単純な検査へ分けて成功させた |
| commit前の `git diff --check` が文書末尾の余分な空行2件を検出 | 1 | 2文書の末尾空行を削除し、再検査する |
| Chrome操作のvisibility capabilityが利用不可 | 1 | 既存Chromeタブをhandoff状態で残し、ユーザー自身のログイン操作を依頼する |
| 対象Supabaseを開いているChrome profileに操作用拡張がない | 1 | 対象profileへChatGPT Chrome Extensionを追加後、同じproject画面で接続を再確認する |
| `supabase login --profile escomi-prod` が `Unsupported Config Type` | 1 | 既存認証を変更せず、対象ChromeのSQL Editorを使用する |
| Codex Supabase連携が別組織を参照 | 1 | 対象projectへ接続済みのChromeを正本とし、連携からの書き込みは行わない |
| SQL EditorのRun locatorが複数一致 | 2 | DOMで確認した `data-testid=sql-run-button` へ限定する |
| Monaco SQL Editorの通常fillが巨大SQLを全置換せず末尾追記 | 1 | `Meta+A` 後に `type` し、実行前snapshotで行数と内容を確認する |
| 検証SQL実行時に既存 `app.areas` エラー | 1 | 追記された元migrationがtransaction内で再実行されたため。全体中止を確認し、検証SQLだけへ全置換して成功 |
| local `supabase db query` に2文を渡してprepared statement error | 1 | schema定義と履歴行のqueryを1文ずつ分けて確認する |
| Supabase標準DB port 54322が別ローカルprojectで使用中 | 1 | 他projectを停止せず、このprojectのlocal portを57320番台へ分離する |
| `.env*` が存在しない状態でzsh globを展開し、環境変数名確認が失敗 | 1 | globを使わず `rg --files` で存在するenvファイルだけを確認する |
| 公式statusとchangelogの同時取得が60秒以上応答しない | 1 | 実行を中止し、status APIとchangelog画面を別々に取得して成功した |
| 進行ファイル更新patchの対象行指定が一致せず失敗 | 3 | 対象行を `rg -n` で確認し、小さいpatchに分けて更新した |
| 設計レビュー反映を1つの大きなpatchで行い、末尾の対象行が一致せず失敗 | 2 | 現在の設計書を再読し、対象sectionごとの小さいpatchへ分けて反映した |
| trial SQLを `supabase db query --file` で実行すると複数文prepared statement error | 1 | local SupabaseのPostgres containerへ同じSQLを `psql` で適用し、2回の再実行と検証に成功した |
| 30店舗確認用の一時Node commandでshellの特殊文字が展開された | 1 | shell展開しないheredocへ切り替え、生成済みJSONの検査に成功した |
| 30店舗本番投入時のChrome profileで対象projectを開けない | 1 | 誤projectへ書き込まず停止し、対象アカウントへ再接続後にproject refと事前件数を確認して再開した |
| 参考動画のframe抽出で`ffprobe`が見つからない | 1 | 同じコマンドを繰り返さず、macOS Quick Lookまたはbundled Python画像ライブラリで確認する |
| Supabase公式Markdown 3 URLの直接取得がweb tool内部エラー | 1 | 同じopenを繰り返さず、公式domain限定検索またはcurlでchangelogとsecurity文書を確認する |
| 382店舗SQLの容量確認を `headless/` から誤った相対pathで実行 | 1 | `../supabase/imports/...` に直し、SQL 469,464 bytes・検証SQL 7,314 bytesと確認した |
| `headless/` から計画書をroot相対pathで検索し、ファイルなしになった | 1 | `../docs/superpowers/plans/...` またはリポジトリrootからの絶対pathを使う |
| Phase 4 preview全体を文字列検索し、管理用の `requires_human_review` まで口コミ項目と誤判定した | 1 | 管理用キーを `requires_human_check` に変更し、検査対象を公開フィールド名へ限定した |
| 営業時間注記のSQLで文字列連結とJSON文字列取得の評価順が曖昧になり、接頭辞をJSONとして解釈した | 1 | 再現テストを追加し、`hours.payload ->> 'notes'` を括弧で先に文字列化してから連結した |

## Notes

- 既存の公開12コミットと今回の移行基盤を混ぜない。
- Secret値を表示・記録・コミットしない。
- WordPress本番データ、Supabase公開データ、親リポジトリを変更しない。本番Supabaseは承認済みschemaと非公開試験データだけを対象にする。
- 外部調査結果は `findings.md` にのみ記録する。
- `supabase start`、`supabase db reset`、`supabase db lint --local` は専用portで成功し、検査後にlocal環境を停止した。
- trial再現検査後も `supabase stop --no-backup` でlocal環境を停止した。
- ユーザーは本番project接続、3店舗試験、30店舗試験、382店舗の非公開移行を承認した。
- スクリーンショットのprojectが不健康/500の間は本番DBへ書き込まない。
- 本番382店舗・34地域の非公開移行まで完了した。shadow、cutover、WordPress停止は別承認まで行わない。
- Phase 4の外部調査値は `findings.md` と根拠付きデータファイルへ保存し、`task_plan.md` へ外部ページ本文を転記しない。
- 「未確認」は欠陥ではなく正規の状態とし、0、空文字、推測値で埋めない。
- Phase 4は一次情報72件を記録し、料金21件、営業時間23件、駅情報20件を確認した。一次情報なし4店舗は未確認のまま維持した。
- Supabase非公開draft候補26店舗分は、ローカルDBで初回・再実行を検証済み。本番Supabase、WordPress、公開参照先、push、deployは変更していない。

## 2026-07-16 Owner Task 4 ローカル統合検証の停止状態

- 店舗責任者申請はlocal Supabaseの非公開審査キューで検証済み。
- WordPress公開情報とSupabase公開viewは変更していない。
- 本番migration、Secret登録、本番申請保存、push、deployは未実施。
