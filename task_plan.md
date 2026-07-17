# Task Plan: SEOを守るSupabase段階移行

## Goal

公開中のURL・検索向け設定・WordPress表示を変えずに、承認済みの本番SupabaseへWordPress全382店舗・34地域を非公開で移し、検証後にSEOと視認性改善の次実装へ進む。

## Current Phase

Phase 16 complete（一覧順位・店舗詳細の密度・CTA一意性を再調整し、headless全幅QAと独立レビューを完了。push・deploy前で停止）

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
- **Status:** complete

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
| 進行ファイル更新patchの対象行指定が一致せず失敗 | 1 | 対象行を `rg -n` で確認し、小さいpatchに分けて更新した |
| trial SQLを `supabase db query --file` で実行すると複数文prepared statement error | 1 | local SupabaseのPostgres containerへ同じSQLを `psql` で適用し、2回の再実行と検証に成功した |
| 30店舗確認用の一時Node commandでshellの特殊文字が展開された | 1 | shell展開しないheredocへ切り替え、生成済みJSONの検査に成功した |
| 30店舗本番投入時のChrome profileで対象projectを開けない | 1 | 誤projectへ書き込まず停止し、対象アカウントへ再接続後にproject refと事前件数を確認して再開した |
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
