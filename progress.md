# Progress Log

## Session: 2026-07-16

### Phase 15: 店舗詳細C案のローカル実装・全幅QA
- **Status:** complete（全11タスクの実装、最終横断レビュー修正、独立再レビューを完了。push・本番確認前で停止）
- Actions taken:
  - 店舗責任者の非公開申請フローと、店舗詳細C案をテスト先行でローカル実装した。
  - 画像・料金・公式URLあり、画像なし、料金なしの代表3店舗をWordPress公開データから選び、データは変更せず確認した。
  - PC 1440×1000 / 1280×900 / 1024×768、スマホ390×844 / 375×812 / 320×568の合計18条件を検証し、全条件を合格させた。
  - 最大横幅1360px、左右余白、画像4:3、横スクロールなし、要素重なりなし、44px以上の操作領域、表の折返し、固定ボタンと最終内容の非重複を実測した。
  - 仮の12,000円、静的OPEN、0名、画像縦伸ばしを除去し、存在するWordPress公開データだけを表示した。
  - LINE・電話予約、公式サイト、店舗責任者を別イベントにし、各1回、generic重複0、電話番号なしを確認した。
  - QAでpercent-encoded WordPress slug、店舗責任者帯の文字色、旧電話計測の番号残存を検出し、それぞれ失敗する検査を追加してから修正した。
  - QAセルフレビューで、HTML、外部リンク、空見出し、CSS範囲、固定導線、計測の個人情報、WordPress/Supabase境界を確認し、Critical / Importantの未解決事項なしとした。
  - 修正後に全26検査、local Supabase統合、lint、型チェック、441/441ページbuild、Git差分検査をすべて終了コード0で完了した。
  - 最終横断レビューのImportant 6件をテスト先行で修正した。DBのencoded slug対応、target URL完全一致、WordPress正本照合、private分散rate limit、口コミの店舗ID一致、全18条件のproduction実測を追加した。
  - local SupabaseへC-RESTのcanonical encoded slugを実APIから保存し、WordPress正式名への置換、匿名拒否、原子RPCの1〜5回許可・6回目拒否を確認後、検査行を削除した。
  - JSON-LDのscript境界escapeと、Next static paramsの二重encodeを修正した。Mrs.FlowerSPAのcanonical single-encoded URLで404を再現してから、`next start`で200を確認した。
  - 再build後に3店舗×6幅の18条件をすべて`next-start-production`で再実測し、18/18合格、代表6画像を目視した。
  - 独立最終再レビューでCritical 0、Important 0を確認し、11/11のローカル完了を承認した。再レビュー担当による全26検査、lint、型チェック、441/441ページbuild、3店舗のcanonical URL確認も成功した。
- Evidence:
  - `.superpowers/sdd/task-7-browser-evidence.json`
  - `.superpowers/sdd/task-7-report.md`
- Current stop:
  - WordPressを公開データ元として維持し、本番Supabase、WordPress公開値、GA外部送信は変更していない。
  - local Supabase、開発サーバー、表示ブラウザは停止済み。
  - stage、commit、push、deployは未実施。11/11はローカル完了済みで、次は明示承認後のpush・本番確認とする。
  - 非ブロッキングの後続候補は、期限切れrate-limit行の削除方針とraw `img`の画像最適化。

### Phase 14: 店舗詳細C案の設計・実装計画
- **Status:** complete（設計・計画のみ。本体実装、push、本番公開は未実施）
- Actions taken:
  - 公開中の店舗詳細をPC 1440×1000、スマホ390×844で確認し、画像比率、横幅、上部情報量、固定導線を監査した。
  - 382店舗の公開データを再監査し、本文0、抜粋0、画像241、公式URL333、確認可能料金252、AI要約76、住所候補49という情報差を確認した。
  - `ShopDetail.tsx` と `globals.css` を確認し、画像への重複した高さ指定、仮の平均12,000円、0名、不定休、完全予約制、駐車場なし、静的OPENを特定した。
  - A/B/C案を比較し、角丸カードを並べないC案「データ先行・編集型」をユーザー承認済み設計として確定した。
  - PC最大1360px、スマホ左右16px、画像4:3、存在する情報だけを表示する基準を確定した。
  - 予約・公式サイトクリックを主要指標、店舗責任者の登録・修正クリックを補助指標とした。
  - WordPressを公開データ元として維持し、店舗責任者申請はSupabase非公開審査候補へ保存し、自動公開しない境界を確定した。
  - 画像ファイル直接アップロードは初回範囲外とし、公式画像URLの受付に限定した。
  - 承認済み設計書と、店舗責任者申請・店舗詳細C案の2本のテスト先行実装計画を作成し、仕様網羅、placeholder、型・名前の整合を自己レビューした。
- Files created/modified:
  - `docs/superpowers/specs/2026-07-16-shop-detail-c-editorial-redesign-design.md`
  - `docs/superpowers/plans/2026-07-16-shop-owner-request-flow.md`
  - `docs/superpowers/plans/2026-07-16-shop-detail-c-editorial-redesign.md`
  - `task_plan.md`
  - `progress.md`
  - `pm/PROGRESS.md`
  - `pm/NEXT_ACTIONS.md`
- Current stop:
  - 店舗詳細の完成品質は現状約40%。設計と計画は完了したが、本体実装は未着手。
  - 次は店舗責任者の非公開申請フローを実装し、その後に店舗詳細C案を実装する。
  - ローカル検証後の95%で停止し、push・本番公開は別承認とする。

## Session: 2026-07-15

### Phase 13: 堺筋本町 Phase 4のSupabase非公開投入準備
- **Status:** complete（ローカル2回投入検証済み。本番Supabase・push・公開切替前で停止）
- Actions taken:
  - ユーザーの実行指示を、直前に提示した「投入SQL・検証SQLの作成とローカル実行確認」への承認として扱い、本番Supabaseは対象外とした。
  - 既存の `app.shops`, `app.shop_prices`, `app.shop_business_hours`, `app.sources`, `app.shop_source_links`, `private.import_batches`, `private.import_records` だけを使う固定SQLをテスト先行で実装した。
  - 26店舗をdraftのまま部分更新し、未確認値を上書きせず、料金89行・営業時間23行・公式URL単位の出典71行・項目別出典189行をすべて非公開で保存する契約にした。
  - 一次情報の調査記録72件のうち、同じ公式URLが重なる1件を統合し、`app.sources` は71行とした。項目別の確認記録は189行のまま保持した。
  - 営業時間注記のJSON文字列取得と文字列連結の評価順エラーを実DBで再現し、失敗する自動検査を追加してから括弧を補った。
  - ローカルDBへ既存382店舗の非公開データを復元し、Phase 4 SQLを2回実行した。2回目も26店舗・料金89・営業時間23・出典71・項目別出典189・取込記録26で件数不変だった。
  - 検証SQLで料金・営業時間の重複0、匿名公開view全9種0件を確認した。`supabase db lint --local --level error --fail-on error` もschema error 0だった。
  - 調査レポートを「ローカル2回検証済み」「本番未実施」に分け、WordPressが公開データ元である停止状態を明記した。
  - `npm test` 全18検査、`npm run lint`、`npm run typecheck`、`npm run build` 440/440ページ、`git diff --check` が終了コード0だった。コード変更後のQAセルフレビューでも追加の修正事項はなかった。
- Files created/modified:
  - `headless/scripts/lib/sakaisujihonmachi-phase4-supabase-sql.mjs`
  - `headless/scripts/prepare-sakaisujihonmachi-phase4-supabase-import.mjs`
  - `headless/scripts/check-sakaisujihonmachi-phase4-supabase-import.mjs`
  - `supabase/imports/20260715_sakaisujihonmachi_phase4_verified_draft.sql`（ローカル生成・Git除外）
  - `supabase/imports/verify_20260715_sakaisujihonmachi_phase4_verified_draft.sql`（ローカル生成・Git除外）
  - `docs/runbooks/supabase-seo-safe-migration.md`
  - `docs/seo/sakaisujihonmachi-phase4-data-report-2026-07-15.md`
  - `headless/package.json`
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `pm/PROGRESS.md`
  - `pm/NEXT_ACTIONS.md`

### Phase 12: SEO実行プロンプト Phase 4「堺筋本町の実データ強化」
- **Status:** complete（Supabase非公開投入・push・本番公開前で停止）
- **Started:** 2026-07-15
- Actions taken:
  - AGENTS.md、.cursorrules、SEO_TOP10_EXECUTION_PROMPT、PM文書、既存計画、Git状態を確認した。
  - 公開データ元をWordPressのまま維持し、調査値はSupabase非公開draft候補へ変換して投入・push・本番公開前で停止する条件を確定した。
  - WordPress REST APIから堺筋本町93店舗と先頭30店舗を読み取り、対象を人気順位ではなく再現可能な公開アーカイブ先頭30件として固定した。
  - 一次情報の採用順、未確認の扱い、料金・営業時間・駅出口・予約・確認日・出典の項目を確定した。
  - 対象30店舗をWordPress IDと選定順で固定したJSONを生成した。WordPress現行値はsnapshotへ隔離し、一次情報確認前にverifiedへ昇格しない構成にした。
  - Phase 4データ未作成で検査が意図どおり失敗することを確認した後、30件固定、一次出典、推測禁止、口コミ・評価禁止を検査するmoduleを実装した。
  - 30店舗について一次情報72件を調査し、正式名26件、住所11件、駅情報20件、営業時間23件、料金21件、電話25件、予約方法26件、初回向け公式案内5件を確認済みにした。
  - 公式情報を安全に特定できなかった殿様気分、Elin、Feliz、プレミアム離宮は、WordPress現行値や第三者情報を昇格せず未確認のまま残した。
  - 確認済み代表料金21件から、最小8,000円、中央値12,500円、最大18,000円の分布を生成した。
  - 営業時間確認済み23件のうち、具体的な翌日閉店時刻を確認できた20件だけを深夜対応に数えた。LAST表記2件は推測せず除外した。
  - 30店舗の根拠データ、Supabase非公開draft候補26店舗分、一次情報一覧と比較集計レポートを生成した。
  - draft候補は `app.shops` をdraft、料金89行・営業時間23行・調査記録72件（公式URL単位71行）・項目別出典189行を非公開として既存schemaへ対応させた。
  - WordPress現行値は比較用snapshotに限定し、旧WordPress更新previewを廃止した。
  - 検査へ第三者出典、未確認0、代表料金規則違反、対象順変更、口コミ・評価フィールド、空更新、出典欠損の拒否条件を追加した。
  - `npm test` 全17検査、`npm run lint`、`npm run typecheck`、`npm run build` 440/440ページ、`git diff --check` が終了コード0だった。
  - 本番WordPress、Supabase、公開参照先、push、deployは変更していない。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `docs/superpowers/plans/2026-07-15-sakaisujihonmachi-phase4-real-data.md`
  - `docs/data/sakaisujihonmachi-phase4-30-shops-2026-07-15.json`
  - `docs/data/sakaisujihonmachi-phase4-evidence-2026-07-15.json`
  - `docs/data/sakaisujihonmachi-phase4-supabase-draft-preview-2026-07-15.json`
  - `docs/seo/sakaisujihonmachi-phase4-data-report-2026-07-15.md`
  - `headless/scripts/lib/sakaisujihonmachi-phase4-data.mjs`
  - `headless/scripts/prepare-sakaisujihonmachi-phase4-data.mjs`
  - `headless/scripts/check-sakaisujihonmachi-phase4-data.mjs`
  - `headless/scripts/render-sakaisujihonmachi-phase4-report.mjs`
  - `headless/package.json`
  - `pm/PROGRESS.md`
  - `pm/NEXT_ACTIONS.md`

## Session: 2026-07-14

### Phase 1: 現状復元と安全確認
- **Status:** complete
- **Started:** 2026-07-14
- Actions taken:
  - AGENTS.md、SEO実行プロンプト、pm/PROGRESS.md、pm/BLOCKER.mdを確認した。
  - 正式作業場所とGit状態を確認した。
  - `codex/supabase-seo-safe-migration` ブランチへ分離した。
  - 公開表示をWordPressのまま維持する実装範囲を確定した。
  - `headless/npm test` を実行し、既存11検査がすべて成功した。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 2: 設計と実装計画
- **Status:** complete
- Actions taken:
  - SEO非変更、本番非変更の設計を作成した。
  - app/private/apiの責務と最小テーブルを確定した。
  - テスト先行の実装計画を作成した。
- Files created/modified:
  - `docs/superpowers/specs/2026-07-14-supabase-seo-safe-migration-design.md`
  - `docs/superpowers/plans/2026-07-14-supabase-seo-safe-migration.md`

### Phase 3: Supabaseローカル基盤
- **Status:** complete
- Actions taken:
  - schema契約検査を先に失敗させ、app/private/apiのmigrationを実装した。
  - 公開APIを読み取りviewだけに制限し、RLSと明示権限を追加した。
  - WordPress移行監査をテスト先行で実装し、公開382店舗へ読み取り検査した。
- Files created/modified:
  - `supabase/config.toml`
  - `supabase/migrations/20260714020257_seo_safe_content_core.sql`
  - `headless/scripts/check-supabase-content-schema.mjs`
  - `headless/scripts/check-wp-migration-audit.mjs`
  - `headless/scripts/lib/wp-migration-audit.mjs`
  - `headless/scripts/audit-wp-migration-source.mjs`
  - `headless/scripts/fixtures/wp-migration-sample.json`

### Phase 4: WordPress既定の移行接続点
- **Status:** complete
- Actions taken:
  - 参照先設定検査を先に失敗させた。
  - 設定なしではWordPress、shadowはWordPress表示+Supabase比較となる判定を実装した。
  - Supabase単独参照には明示承認フラグを必須にした。
- Files created/modified:
  - `headless/lib/content-source/config.ts`
  - `headless/scripts/check-content-source-config.mjs`
  - `headless/.env.example`

### Phase 5: 検証と引き継ぎ
- **Status:** complete
- Actions taken:
  - QAで既存API base互換と非公開親データの公開漏えいを発見し、テスト先行で修正した。
  - lint、typecheck、14検査、build 440ページ生成を実行した。
  - 公開route、metadata、sitemap、表示componentに差分がないことを確認した。
  - Secret形式の混入がないことと `git diff --check` を確認した。
  - Supabaseを専用local portで起動し、migration初回適用、db reset、DB lintを実行した。
  - 検査後に `supabase stop` でlocal環境を停止した。
  - 本番未接続、未投入、未切替、未push、未deployを確認した。
- Files created/modified:
  - `docs/data/supabase-wp-field-map-2026-07-14.md`
  - `docs/runbooks/supabase-seo-safe-migration.md`
  - `pm/DECISIONS.md`
  - `pm/NEXT_ACTIONS.md`
  - `pm/PROGRESS.md`

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 開始時Git状態 | `git status -sb` | mainがclean | `main...origin/main`、変更なし | 成功 |
| 変更前の品質基準 | `headless/npm test` | 既存検査が成功 | 11検査すべて成功 | 成功 |
| Supabase schema RED | `npm run test:supabase-content-schema` | migration未実装で失敗 | `supabase/config.toml` 不在のAssertionError | 意図どおり失敗 |
| Supabase schema GREEN | `npm run test:supabase-content-schema` | 契約検査成功 | 必須schema・RLS・view・権限を確認 | 成功 |
| SupabaseローカルDB準備 | `docker info` | Docker利用可否を確認 | daemon未起動で接続不可 | 未実施条件を記録 |
| WordPress移行監査 RED | `npm run test:wp-migration-audit` | 監査module未実装で失敗 | module不在のAssertionError | 意図どおり失敗 |
| WordPress移行監査 GREEN | `npm run test:wp-migration-audit` | fixture検査成功 | 欠損・危険値・移行規則を確認 | 成功 |
| WordPress公開データ再監査 | `node scripts/audit-wp-migration-source.mjs` | 382店舗の現況を読取 | 382店舗・34地域、本文/出典/確認日0を再確認 | 成功 |
| 参照先設定 RED | `npm run test:content-source-config` | 設定module未実装で失敗 | module不在のAssertionError | 意図どおり失敗 |
| 参照先設定 GREEN | `npm run test:content-source-config` | WordPress既定と承認ゲート成功 | 全条件を確認 | 成功 |
| QA追加検査 RED | schema / WP audit | 非公開親の漏えいと既存API baseを検出 | 2検査とも意図どおり失敗 | 意図どおり失敗 |
| QA追加検査 GREEN | schema / WP audit | 2問題を修正 | 両検査成功 | 成功 |
| lint | `npm run lint` | 成功 | 警告・エラーなし | 成功 |
| typecheck | `npm run typecheck` | 成功 | 型エラーなし | 成功 |
| 全検査 | `npm test` | 14検査成功 | 既存11件+新規3件成功 | 成功 |
| build | `npm run build` | 440ページ生成 | 440/440成功 | 成功 |
| 公開コード差分 | app/components/seo/wp | 差分なし | 出力なし | 成功 |
| Secret形式検査 | JWT / Supabase secret形式 | 検出なし | 検出なし | 成功 |
| Supabase初回適用 | `supabase start` | migration適用 | schema初期化とmigration適用成功 | 成功 |
| Supabase再構築 | `supabase db reset` | 再適用成功 | migration再適用成功 | 成功 |
| Supabase DB lint | `supabase db lint --local` | schema errorなし | 5schemaすべてerrorなし | 成功 |
| Supabase停止 | `supabase stop` | local container停止 | 停止成功 | 成功 |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-07-14 | `docs/ai-skills.md` が存在しない | 1 | AGENTS.mdとSupabase skillの手順を適用して継続 |
| 2026-07-14 | 設計資料2件を誤った相対パスで読み込み | 1 | リポジトリルート基準のパスへ修正 |
| 2026-07-14 | Docker daemonへ接続できない | 1 | 本番や外部DBへ代替接続せず、静的契約検査を継続 |
| 2026-07-14 | 監査moduleの正規表現が構文エラー | 1 | word boundaryへの不要な量指定子を削除 |
| 2026-07-14 | VM内オブジェクトのdeepEqualが別realm差で失敗 | 1 | JSON値比較へ変更 |
| 2026-07-14 | 既存 `WP_API_BASE_URL=/wp-json` を監査CLIが扱えない | 1 | API base正規化関数を追加 |
| 2026-07-14 | 公開content/reviewが非公開店舗に紐づく場合のRLS条件不足 | 1 | 公開親店舗・地域の存在条件をpolicyへ追加 |
| 2026-07-14 | Secret検査commandの引用符がshell構文エラー | 1 | 単純な2形式の検査に分けて成功 |
| 2026-07-14 | 文書末尾の余分な空行2件をdiff checkが検出 | 1 | 末尾空行を削除して再検査 |
| 2026-07-14 | Supabase標準DB port 54322が別projectと競合 | 1 | local portを57320番台へ分離 |

## 5-Question Reboot Check

| Question | Answer |
|----------|--------|
| Where am I? | Phase 5: 検証と引き継ぎ |
| Where am I going? | 設計、ローカル基盤、WordPress既定の接続点、検証 |
| What's the goal? | 公開SEOを変えずにSupabase段階移行基盤を作る |
| What have I learned? | `findings.md`参照 |
| What have I done? | ブランチ分離と安全範囲確定 |

### Phase 6: 本番projectの健康確認
- **Status:** complete
- **Started:** 2026-07-14
- Actions taken:
  - ユーザーから本番接続と3店舗非公開試験の承認を受けた。
  - スクリーンショットでdatabase不健康とHTTP 500を確認した。
  - 正常化するまで本番DB書き込みを止め、CLIと公式statusを先に確認する方針にした。
  - 公式statusは全体正常、未解決incident 0件と確認した。
  - 最新changelogから新規tableのAPI非自動公開と明示権限要件を再確認した。
  - CLIは2projectへアクセスできるが、対象projectを認識しないことを確認した。
  - 原寸画像でproject URLを再確認し、読み取り違いを除外した。
  - Chromeで対象project URLを開いても組織一覧へ戻され、現在のログイン先には対象projectがないことを確認した。
  - 全体障害ではなく認証先の不一致と判断し、対象アカウントへの切り替えまでPhase 6を停止した。migration・3店舗試験投入は未実施。
  - ユーザーの追加画面で、対象projectが正しいアカウント上で「健康」、直近HTTP 200へ回復したことを確認した。
  - 対象projectを開いているChrome profileには操作用拡張がなく、別profileだけが接続済みと確認した。対象profileへ拡張を追加するまでDB書き込みを停止する。
  - 対象Chrome profileへの拡張追加後、対象projectタブへ接続できた。
  - project概要で状態「健康」、既存migrationなし、Advisor指摘なしを確認した。Phase 7のCLI接続確認へ進む。
  - CLI専用profile loginは設定形式エラーで失敗し、既存認証への変更はなかった。
  - Supabase連携も別組織の認証だったため、正しいChromeのSQL Editorへ切り替えた。
  - read-only preflightで対象3schemaとmigration管理表がすべて未作成と確認した。
  - 検証済みmigrationをtransaction内で本番適用し、成功を確認した。
  - app 11表、private 2表、api 9view、RLS 13表、policy 10件、PUBLIC grant 0件、店舗・公開店舗0件を本番queryで確認した。
  - SQL Editorの通常置換が巨大SQLを末尾追記する問題を特定した。誤再実行はtransaction内の既存表エラーで全体中止され、追加変更なし。全選択入力へ修正し、検証query成功を確認した。
  - ローカルDBからCLI互換migration管理表の列・主キー・version/nameを確認した。
  - 本番にmigration履歴1件をRLS有効・PUBLIC grantなしで記録し、version/nameをqueryで再確認した。
  - Security Advisorはerror 0 / warning 0。意図したpolicyなし3表だけがinfoだった。
  - Performance Advisorはerror 0 / warning 0。未使用index 11件は空DB由来、出典FK index不足3件は拡張性のため追加migrationで直す方針にした。
  - 出典FK index契約を先に追加し、意図した失敗を確認した。
  - 3本のindexを追加migrationへ実装後、契約検査が成功した。
  - local db reset、migration list、schema lint、Advisorがすべて成功した。
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### Phase 7: 本番schema適用
- **Status:** complete
- Actions taken:
  - 出典FK index 3本とCLI互換migration履歴を本番へtransaction適用した。
  - 本番queryでindex 3本、migration履歴2件、店舗0件、公開店舗0件を確認した。
  - Performance Advisorはerror 0 / warning 0。info 14件は空DBで全indexが未使用という案内だけだった。

### Phase 8: 3店舗の非公開試験投入
- **Status:** complete
- Actions taken:
  - 堺筋本町93店舗を再取得し、0円表記がないため値を創作せず、料金なし・画像なしを含む3店舗を選んだ。
  - 対象を MUSE(695)、sirena II(709)、殿様気分(1237) とし、地域は堺筋本町(46)に限定した。
  - trial SQL契約検査を先に追加し、SQL未実装のAssertionErrorを確認した。
  - 非公開area、draft shop、非公開料金/画像、private取込履歴と公開漏えい検証を実装し、契約検査成功を確認した。
  - local DBへ同じSQLを2回適用し、地域1・店舗3・関係3・料金2・画像2・batch 1・record 3のまま重複しないことを確認した。
  - QAで営業時間・出典を含む公開view全9種へ漏えい検査を拡張し、追加前の失敗と追加後の成功を確認した。
  - 本番へtrial SQLをtransaction適用し、3店舗がdraft、地域が非公開、料金・画像が非公開、取込recordがimportedであることを確認した。
  - 本番の地域1・店舗3・関係3・料金2・画像2・batch 1・record 3を確認し、anonの公開view全9種が0件であることを確認した。
  - 本番Security/Performance Advisorはいずれもerror 0 / warning 0。30店舗拡大前で停止した。
  - 最終QAでlint、typecheck、15検査、build 440ページ、git diff check、secret形式検査がすべて成功した。
  - local Supabaseは `supabase stop --no-backup` で停止した。

### Phase 9: 30店舗の非公開試験投入
- **Status:** complete
- Actions taken:
  - ユーザーから30店舗への非公開拡大承認を受けた。
  - 堺筋本町93店舗を再取得し、既存3店舗に加えて料金欠損5件、画像欠損7件、公式URL欠損15件をすべて含む30店舗を固定した。
  - SQL生成moduleと30店舗準備commandをテスト先行で実装した。
  - 30店舗の固定投入SQLと検証SQLを生成し、WordPress ID、slug、正規パス、地域関係、欠損値を保存した。
  - set-based insert、短いtransaction、UPSERTを使い、全店舗をdraft、料金と画像を非公開のまま保存する構成にした。
  - local DBへ既存3店舗SQL、30店舗SQL、30店舗SQL再実行の順で適用した。
  - localの最終件数は地域1・店舗30・地域関係30・非公開料金25・非公開画像23・batch 2・record 33。料金と画像の重複groupは0件だった。
  - anonの公開view全9種は0件、schema lintはerror 0だった。
  - lint、typecheck、15検査、build 440ページ、git diff checkが成功した。buildの既存WordPress timeout fallbackと `useSearchParams()` ログは残るが終了コード0だった。
  - Supabase連携は別組織を参照したため使用せず、対象projectを開いた正しいChrome profileへ接続してproject refを照合した。
  - 本番事前確認で地域1・店舗3・関係3・料金2・画像2・batch 1・record 3、30店舗batch未作成を確認した。
  - 本番へ固定30店舗SQLをtransaction適用し、`Success. No rows returned` を確認した。
  - 本番の最終件数は地域1・店舗30・地域関係30・非公開料金25・非公開画像23・batch 2・record 33。30店舗batchはsource 30・imported 30、料金と画像の重複groupは0件だった。
  - 検証SQLを実行し、anonの公開view全9種が0件であることを確認した。
  - 本番Security/Performance Advisorはいずれもerror 0 / warning 0。Security info 3件は非公開表のdeny-by-default、Performance info 8件は小規模試験時点の未使用index案内だけだった。
  - 382店舗、shadow、cutover、WordPress停止、push、deployは実施せず停止した。
- Files created/modified:
  - `headless/scripts/lib/supabase-trial-sql.mjs`
  - `headless/scripts/prepare-supabase-30-shop-trial.mjs`
  - `headless/scripts/check-supabase-trial-import.mjs`
  - `supabase/trials/20260714_sakaisujihonmachi_30_shops.sql`
  - `supabase/trials/verify_20260714_sakaisujihonmachi_30_shops.sql`
  - `headless/package.json`
- Stop reason:
  - 承認範囲の30店舗非公開試験を完了したため、382店舗全件投入の別承認前で停止する。

### Phase 10: 382店舗・34地域の非公開移行
- **Status:** complete
- Actions taken:
  - ユーザーから382店舗の非公開移行承認を受け、WordPressを再監査して店舗382・地域34を確認した。
  - 地域なし75店舗、複数地域230店舗、料金252件、画像241件、公式URL333件を再確認した。
  - area normalizer、全件SQL renderer、全件検証renderer、固定SQL生成commandをテスト先行で実装した。
  - 34地域の親子関係26件と、店舗‐地域関係782件を創作せずWordPress IDのまま保持した。
  - local DBへ3店舗→30店舗→382店舗→382店舗再実行の順で適用した。
  - local最終件数は地域34・店舗382・関係782・料金252・画像241・batch 3・record 415。料金/画像の重複groupは0件だった。
  - localの地域なし75・複数地域230はWordPress監査と一致し、anonの公開view全9種は0件、schema lintはerror 0だった。
  - 正しいChrome profileのproject refと事前件数を照合し、本番へ固定382店舗SQLをtransaction適用した。
  - 本番最終件数も地域34・子地域26・店舗382・関係782・料金252・画像241・batch 3・record 415だった。
  - 本番batchはsource 382・imported 382、地域なし75・複数地域230、料金/画像の重複group 0件だった。
  - 本番anon公開view全9種は0件。Security/Performance Advisorはいずれもerror 0 / warning 0だった。
  - 382店舗の固定SQLはWordPress元データを含むため `.gitignore` で `supabase/imports/*.sql` を除外し、Git混入防止検査を追加した。
  - npmの全16検査、lint、typecheck、git diff checkが成功した。
  - local Supabaseは `supabase stop --no-backup` で停止した。
- Files created/modified:
  - `headless/scripts/check-supabase-full-import.mjs`
  - `headless/scripts/prepare-supabase-full-import.mjs`
  - `headless/scripts/lib/supabase-trial-sql.mjs`
  - `supabase/imports/20260714_wordpress_382_shops.sql`（local生成・Git除外）
  - `supabase/imports/verify_20260714_wordpress_382_shops.sql`（local生成・Git除外）
  - `headless/package.json`
- Stop reason:
  - Supabaseは全件非公開のまま維持し、shadow・cutover・WordPress停止・push・deploy前で停止する。

## 2026-07-16 Owner Task 4 ローカル統合検証の停止状態

- 店舗責任者申請はlocal Supabaseの非公開審査キューで検証済み。
- WordPress公開情報とSupabase公開viewは変更していない。
- 本番migration、Secret登録、本番申請保存、push、deployは未実施。

# 2026-07-16 店舗詳細C案 Detail Task 4 完了

- 店舗詳細専用CSSでPC最大1360px、スマホ左右16px、画像4:3、固定導線のsafe-area対応を契約化した。
- 金色文字のコントラストとキーボード操作時のフォーカス表示を追加した。
- 4:3の表示幅漏れ、固定導線の高さ超過、フォーカス線の後勝ち消去を意図的に作る3変異をすべて検査で拒否した。
- 独立レビューはCritical 0、Important 0、Minor 0で承認。
- push、deploy、本番、WordPress、Supabaseへの書き込みは未実施。

## 2026-07-16 店舗詳細C案 Detail Task 5 完了

- 旧店舗詳細をC案のHero、4:3画像、情報section、店舗責任者案内、地域導線へ統合した。
- 仮の12,000円、静的OPEN、0名、未確認値の代替表示、旧重複CTAと旧visualを除去した。
- WordPressを公開データ元として維持し、LocalBusiness JSON-LD、パンくず、承認済み口コミ、PR属性、地域内部リンクを維持した。
- full/sparse店舗の実静的描画契約で表示順、部品回数、条件付きリンク、口コミ受け渡しを固定した。
- 独立レビューはCritical 0、Important 0、Minor 0で承認。
- push、deploy、本番、WordPress、Supabaseへの書き込みは未実施。

## 2026-07-16 店舗詳細C案 Detail Task 6 完了

- 予約・LINE・電話、公式サイト、店舗責任者のクリックを既存の1つの監視内で区別した。
- 店舗CTAは一般の外部リンク計測へ流さず、1クリック1イベントにした。
- 安全な店舗識別子だけを送り、電話予約の番号は`tel:`へ正規化して計測へ含めない。
- focused実動作検査、型、lint、全18検査を実行し、独立レビューは問題0で承認。
- 実GA送信、push、deploy、本番、WordPress、Supabaseへの書き込みは未実施。

## 2026-07-16 本番反映準備

- 実装コミット `990274a` と最新mainの統合コミット `5b0b8fd` を作成した。
- Nodemailerを9.0.3へ固定し、独立レビューはCritical 0 / Important 0 / Minor 0で公開可判定となった。
- 全test、lint、typecheck、441ページbuild、依存監査を再実行し、High / Critical 0を確認した。
- Supabase CLIが別サービスのprojectを指していたため、書き込みを行わずリンクを解除した。
- 正しいエスコミ本番Supabase `goeagrxjsjcbbatpotbu` を接続済みChrome profileで照合した。
- 店舗責任者申請migration `20260716003830` をtransaction適用し、履歴・RLS・匿名拒否・service role権限を検証した。
- Vercel Productionへ `SUPABASE_URL`、server-only secret、rate limit secretを値非表示で登録した。
- WordPress公開情報とSupabase公開viewは変更せず、`main` push・本番deploy前で進行記録を更新した。

## 2026-07-16 店舗詳細・Phase 4 本番反映完了

- 実装反映commit `badd4f9` を `main` へpushし、GitHub ActionsのVercel run `29504137602` とXserver run `29504137607` が成功した。
- Vercel production deployment `https://escomi-headless-g7shr3mav-narikiyos-projects.vercel.app` はREADYで、`https://mens-esthe-kuchikomi.com` へ反映済み。
- トップ、堺筋本町、代表3店舗、店舗登録ページはHTTP 200。存在しない入力を送った申請APIは400で拒否し、本番DBの申請・rate limit行はいずれも0件のまま。
- PC 1440pxとスマホ390pxで店舗詳細を確認し、横スクロール0、画像4:3、店舗責任者導線、スマホ固定導線を確認した。画像なし店舗の代替画像も4:3を維持した。
- 本番Supabaseはmigration `20260716003830`、RLS、匿名・authenticated拒否、service role権限を確認。Security Advisorはerror 0 / warning 0、Performance Advisorもerror 0 / warning 0。
- Phase 4調査値は根拠付きの非公開候補として維持し、WordPress公開情報、Supabase公開view、公開参照先は変更していない。
- 最終検証は全test、lint、typecheck、441ページbuild、High / Critical 0。残る依存監査は既存PostCSS由来のModerate 2件のみで、破壊的な強制更新は行っていない。

## 2026-07-17 Eskomi 店舗一覧・店舗詳細 UX再構築 開始

- ユーザー承認のA案で、軽微な崩れ修正後に一覧・詳細を段階再構築する設計を確定した。
- `docs/superpowers/specs/2026-07-17-eskomi-portal-ux-rebuild-design.md` を作成し、2回の別担当レビュー後に実装ブロッカー0となった。
- 可視英字表記だけをEskomiへ変更し、日本語名、ドメイン、URL、CSS/API/DBの内部識別子は維持する。
- 公式参考構造は情報順、比率、文字階層、余白、ページ内移動、予約導線へ適用し、固有素材・文章・色・商標表現は複製しない。
- ブランチ`codex/eskomi-portal-ux-rebuild`と分離worktree`.worktrees/eskomi-portal-ux-rebuild`を作成した。
- 分離worktreeの`headless/`で依存導入と変更前の全30契約検査に成功した。
- 実装計画を11タスクへ分割し、2回の別担当レビュー後にCritical 0 / Important 0で実装開始可能となった。
- push、deploy、本番WordPress画像差し替えは未実施。

## 2026-07-17 Eskomi UX Task 10 実ブラウザQA

- `@playwright/test` 1.61.1を完全固定し、通常の`npm test`と分離した`test:portal-browser-layout`を追加した。
- 最新production buildを専用`127.0.0.1:3100`で起動し、既存5000番を使わず、終了時にserver process treeとChromiumを停止する再実行可能な検査にした。
- 店舗詳細`milk-tea（ミルクティー）`実slug、堺筋本町、通常の大阪エリア、店舗一覧の4経路を、標準8幅と760/761・900/901・1024/1025・320×568・スマホ横向きで測定した。
- レビュー指摘を受け、経路ごとの必須部品数と表示中の全店舗カードの画像・見出し・本文・操作欄を省略なく検査するよう強化した。予約情報がない店舗には架空のボタンを足さず、操作欄自体と経路内の実在ボタンを必須にした。
- Next.jsが裏で準備する非表示要素を表示済みと誤認した30件を検査側の問題として特定し、必須部品が実際に見えるまで待つよう修正した。画面側CSS/TSXの修正は不要だった。
- ページ移動前から`console.error`と画面内JavaScript errorを収集する。許可は任意faviconと意図的な壊れ画像検査の完全一致404だけで、広い除外は追加していない。
- summaryは開始時に前回成功を`running`で無効化し、予期しない失敗でも`failed`を必ず保存する。スクリーンショットは実行ID別に分離し、成功時だけ`passed`にする。
- DOM欠落、`console.error`、画面内JavaScript error、server起動後の強制例外、接続拒否を注入し、すべて終了コード1・`failed` summary・process残存なしとなることを確認した。
- 検査用Chromiumは画面非表示を既定にし、`PORTAL_QA_HEADED=1`を明示した場合だけ表示する。通常ChromeやPlaywright MCPには触れず、画面非表示の1経路×1幅smokeは29 assertion、画像1枚、失敗0だった。
- 最終結果は4経路×14表示条件=56条件、81,515 assertion、標準8幅×4経路=32枚のスクリーンショットで失敗0だった。
- 横スクロール、順位数字と「位」の上下差、主要開始位置、余白、4:3画像、44px以上CTA、比較表示の760px境界、見出し非隠蔽を実寸で確認した。
- キーボードフォーカス、ページ内メニュー移動、スマホ固定操作、画像読込失敗時のEskomi代替画像、Task 1と同じ2種類の長い店舗名を操作・計測した。外部予約リンクはクリックしていない。
- 初回は検査側でTask 1の正本より長い70文字超の単一英字列を使ったため、500/390/320pxの3件だけ4〜5行として失敗した。Task 1の既存fixtureへ正確に揃えて再検査し、表示用CSS/TSXの修正なしで全件成功した。
- `npm test`の通常34検査、lint、typecheck、441/441ページbuild、その直後のbrowser検査が成功した。High/Critical依存問題は0で、既存Next.js経由のModerate 2件は継続する。
- スクリーンショットとsummaryは`headless/reports/portal-ux-2026-07-17/`へGit除外で保存した。push、deploy、本番WordPress・Supabase変更は行っていない。

## 2026-07-17 Eskomi UX Task 11 全体検証・最終レビュー

- **Status:** complete（全11タスク、最終横断レビュー修正、独立再レビューを完了。push・PR・deploy・本番公開前で停止）
- 軽微修正 → ブランド・ロゴ → 表示の正確性 → 共通店舗一覧 → 店舗詳細shell → headless実ブラウザQA → 最終横断レビューの順で、11タスクを個別レビュー付きで完了した。
- 最終横断レビュー初回はCritical 0、Important 4。固定の未確認件数・日付・循環更新ラベル、無効な料金filter、出自ラベルなしのAI要約、画像404時の共通fallback不足を検出した。
- `1654f3b fix: remove unverified portal facts`で4件を修正した。固定件数・日付・循環更新ラベルを削除し、料金filterを有効な`price`へ変更し、`shop_ai_summary`の無ラベル通常紹介をやめ、トップ・共通一覧・ランキング画像へ共通404 fallbackを適用した。
- 修正後の独立再レビューはCritical 0、Important 0、Minor 0、Ready: Yes。構造上の非ブロッカーとして、`check-shop-content-accuracy.mjs` 617行と`check-area-shop-card-view-model.mjs` 527行は、今後検査を増やす場合のfixture/helper分離候補として残した。

### 最新コードHEAD `1654f3b` の最終検証

- `npm test`: 34/34、終了コード0。
- `npm run lint`: 終了コード0。
- `npm run typecheck`: 終了コード0。
- `npm run build`: 441/441ページ、終了コード0。
- build直後の`npm run test:portal-browser-layout`: headless、56 scenarios、81,557 assertions、32 screenshots、failures 0、終了コード0。
- `npm audit --audit-level=high`: Critical 0 / High 0 / Moderate 2（既知のPostCSS）、終了コード0。
- `git diff --check`成功、`next-env.d.ts`差分なし、3100 listener・検査script・検査用Chromium残存0。
- 既知warningはmiddleware名称の非推奨、WordPress timeout時のfallback、`useSearchParams`のclient rendering。いずれもfailureなし。

### 画面占有と停止位置

- browser QAはheadless既定で、可視化は`PORTAL_QA_HEADED=1`明示時だけ。最終検証では未設定で、通常ChromeとPlaywright MCPを操作・終了していない。
- WordPressを公開データ元として維持した。Supabase公開接続・書き込み、WordPress書き込み、push、PR、deploy、本番公開は実施していない。

## 2026-07-17 Eskomi UX再構築 本番反映完了

- ユーザー承認後、完成済み23コミットを`main`へpushした。Xserver run `29571208433`はFTP反映、OPcache削除、REST確認まで成功した。
- 初回Vercel run `29571208457`はprebuilt buildで`USE_CACHE_TIMEOUT`となり、本番deploy前に停止した。原因はVercelローカルbuildの不正・秘匿placeholder URLと、native WordPress fetchに総時間制限がなかった組合せだった。
- `10a4d12 fix: bound WordPress build fetches`で環境URL検証とnative fetch timeoutを追加し、`936462c fix: normalize WordPress runtime config`で末尾slash、userinfo、query、hash、timeout範囲を正規化した。
- 通常build 441/441とplaceholder再現build 27/27 fallbackを成功させ、独立再レビューはCritical 0、Important 0、Minor 0、Ready: Yesだった。
- 再push後のVercel run `29572387927`は通常CI build、prebuilt build、本番deploy、SEO cutover checkがすべて成功し、`https://mens-esthe-kuchikomi.com`へ公開した。
- 本番5 URLはHTTP 200。トップでEskomi表記、固定件数・固定日付なし、`filter=price`、旧画像参照なしを確認した。
- 本番headless QAは4経路×14条件=56 scenarios、81,761 assertions、32 screenshots、failures 0。標準PC・スマホ幅と760/761、900/901、1024/1025、スマホ横向きを通過した。
- 検査は画面非表示で、通常Chromeには触れていない。WordPressを公開データ元として維持し、Supabase公開切替・公開データ書き込みは行っていない。
## 2026-07-18 Phase 16 一覧・店舗詳細の精密再調整 開始

- ユーザー添付の本番スクリーンショットで、順位バッジの独立列、店舗詳細のCTA重複、文字サイズと余白の過大を確認した。
- 既存の隔離worktree `codex/eskomi-portal-ux-rebuild` を継続利用し、`main` 直下の古い作業状態には触れない。
- 現行カラー、WordPress公開データ元、推測値・架空口コミを追加しない条件を維持する。
- 次は本番とローカルのDOM/CSSを再現し、契約検査を失敗させてから修正する。

## 2026-07-18 Phase 16 一覧・店舗詳細の精密再調整 完了

- **Status:** complete（Task 1〜3、fresh全検証、独立最終レビュー、main反映、本番全幅QAまで完了）
- Task 1 `0c40101`で順位badgeをmediaWrap内overlayへ移し、順位有無で共通の3列cardにした。
- Task 2 `3398593`で店舗詳細上部をPCの画像/hero 2列へ整理し、予約・公式情報groupをPC/SPそれぞれ表示中1つにした。
- Task 3では旧browser検査をTask 1・2後へ当て、4,971/15,377 failuresのREDを確認した。旧`visualAside`、article直下media、独立rank列の期待が原因だった。
- browser検査を新DOMへ更新し、順位badgeのmediaWrap包含、順位あり/なしmedia・title x差2px以内、可視予約group 1、H1 PC 34px/SP 26px以下、facts 18px以下、横はみ出し0、CTA 44px以上を実寸確認する。
- fresh検証は`npm test` 35/35、lint、typecheck、441/441 build、build直後のheadless browser 56/56 scenarios・89,836 assertions・32 screenshots・failures 0、High/Critical 0、`git diff --check`がすべて終了コード0。
- 独立最終レビューはCritical 0 / Important 0 / Minor 0、Ready: Yes。WordPressを公開データ元として維持し、WordPress/Supabase書込は行っていない。

## 2026-07-18 Phase 16 本番反映完了

- ユーザー承認後、実装と検証記録を含むcommit `ddddb33` までを`main`へpushした。
- GitHub ActionsのVercel run `29617521724`は、通常CI build、prebuilt build、本番deploy、SEO cutover checkをすべて通過し、`https://mens-esthe-kuchikomi.com`へ反映した。
- トップ、堺筋本町、大阪エリア、店舗一覧、milk tea店舗詳細の5 URLがHTTP 200であることを確認した。
- 本番headless QAは4経路×14条件=56 scenarios、90,112 assertions、32 screenshots、failures 0。PC、スマホ、760/761・900/901・1024/1025境界、320×568、スマホ横向きを通過した。
- 今回はheadless配下だけの変更なのでXserver workflowは対象外。WordPressを公開データ元として維持し、WordPress/Supabaseへの書き込みや公開参照先の切替は行っていない。

## 2026-07-18 Phase 17 店舗詳細の1カラム・二層タブ基盤 開始

- ユーザー要望を、1カラム、二層タブ、口コミ優先、基本情報は下部、メニュー・セラピスト・有料店舗情報を後から追加できる基盤として整理した。
- 現行componentとデータ境界を確認し、口コミ・予約実績比率は公開できる実データが現時点でないこと、予約導線クリックはGAで区別できることを確認した。
- 推測グラフを作らず、表示する集計の正本・最低件数・期間・出典を先に確定してから設計書へ進む。
- 最初のグラフは承認済み口コミの総合・料金・接客・清潔感とすることでユーザー確認済み。
- 競合ポータル、Google Places公式仕様、現行データを比較した。外部順位は管理者確認入力、年齢・在籍・出勤は店舗管理入力を正本にし、Google評価はユーザー判断で対象外とした。
- 既存口コミ投稿には4評価項目があり、承認済み公開口コミ3件以上の安全条件も実装済み。最初の評価グラフは既存契約を壊さず拡張できる。
- 店舗責任者機能は現状申請受付だけで、店舗編集・会員プラン・セラピスト・出勤・ブログの保存基盤は未実装。次期UIはデータがあるmoduleだけを描画する登録方式にする必要がある。
- 参考動画を8秒〜78秒の代表frameで確認した。大型推移グラフ、指標card、積み上げ棒、詳細内訳のうち、店舗詳細初期版には小型ring・4項目横棒・指標cardの軽量表現だけを採用する方針とした。
- 公開WordPressを読み取り監査し、対象外の温泉店舗2件（ID 1259、1255）を特定した。いずれも現在index可能な店舗詳細を持つため、実装時はWordPressの可逆的なdraft化と公開route・sitemap・内部リンク除外を一体で検証する。
- 3案を比較し、検証済みデータ優先のA案を採用した。自動取得優先は保守・誤照合リスク、会員基盤優先は現在のUI完成が遅れるため後工程とした。
- `docs/superpowers/specs/2026-07-18-shop-detail-dashboard-foundation-design.md`へ、1カラム・二層menu、口コミdashboard、確認状況、順位、将来module、速度、SEO、対象外2店舗、検証条件を確定した。
- 設計書はplaceholder、矛盾、曖昧語、範囲過大を自己レビューし、本文幅の曖昧表現をprofile/dashboard/table 1200px・紹介/口コミ本文960pxへ確定した。
- ユーザーの設計レビューを受け、AI調査指示書、JSON/CSV一括取込、出典付き差分確認、承認時の更新日自動記録、WordPress公開反映を管理画面要件へ追加する方針とした。
- 既存dashboard認証とSupabase構成を確認し、書込機能はfail-closed、service roleはserver-only、AI出力は非公開staging、公開時だけWordPressへ反映する安全境界を確定した。
- WordPress既存の年齢帯、当日出勤、おすすめセラピスト、AI更新ログ、AI更新APIを確認した。再利用できる一方、現行APIは直接上書きのため、新管理画面では差分承認を必須にする。
- 公開UIとAI管理・セラピスト・出勤/top連動を別subsystemへ分け、WordPress IDと共通公開view modelで接続する設計へ修正する。

## 2026-07-18 Phase 17 AI管理・セラピスト連動 設計改訂

- 管理者が地域・店舗・項目を選び、Codex/ChatGPT向け調査指示書を生成し、JSON/CSVを非公開取込する管理設計を`docs/superpowers/specs/2026-07-18-ai-content-admin-therapist-design.md`へ保存した。
- 手入力とAI取込は同じ差分・承認経路を通し、出典・観測日・承認日・現在値hashを確認後、承認fieldだけWordPressへ公開する。Supabaseは非公開stagingに限定する。
- 口コミはWordPress `reviews`、セラピストは`therapist`、出勤は`therapist_schedule`を公開正本とし、店舗詳細・セラピスト詳細・トップ・一覧・地域は共通IDとadapterを使う設計へ統一した。
- architectureとsecurityを別担当が読取専用レビューした。口コミ集計の既存断絶、field別出典、会員入力権限と公開範囲、競合・冪等性・cache、少人数年齢保護を設計へ反映した。
- 既存コードに匿名debug、REST認証保護の全体解除、MU plugin削除、任意店舗meta更新、受信Authorization転送、cache secret未設定時fail-openがあるため、新管理機能より先のPhase 0安全化を必須にした。
- Google評価は対象外とし、公式サイトはURL・取得方式・最終実行・状態の管理項目だけを初期実装する。crawlerと外部portal月次自動取得は後工程へ分離した。
- 現時点は設計のみ。コード実装、WordPress/Supabase書込、push、deploy、本番公開は行っていない。
- 反映後の独立再レビューはarchitecture・securityともCritical 0 / Important 0 / Go。実装計画へ進める設計品質を確認した。

## 2026-07-18 Phase 17 設計承認・実装計画レビュー開始

- ユーザーが改訂設計書を承認した。既存の分析ダッシュボードを管理画面全体の共通入口とし、分析・店舗・口コミ・AI取込・セラピスト・出勤・公開管理を同じshellへ段階追加する方針を確定した。
- Phase 0安全化、日次更新専用bridge、Dashboard認証、共通shell、承認済み口コミREST、口コミgraph/schema、6項目確認状況・明示順位・1カラム二層menu、全幅QAの8タスク実装計画を作成した。
- 現行日次更新を壊さないため、公開POST全削除ではなく、専用secretで許可した`escomi/v1/update`だけをHeadlessがserver-only認証で中継する計画へ修正した。
- 追跡中の移行scriptに残る固定WordPress認証値をPhase 0で削除し、月次・料金移行・汎用crawlerから日次routeへの公開直書きを停止する項目を追加した。認証値そのものは記録へ転記していない。
- 現在は実装計画の独立レビュー中。コード実装、WordPress/Supabase書込、push、deploy、本番公開は未実施。

## 2026-07-18 Phase 17 実装計画承認

- 8タスク計画を独立レビューし、UUIDv4検証、旧直接POST文書、安全な日次bridge、認証0件表示、将来module登録、対象外店舗previewまで修正した。
- 最終判定はCritical 0 / Important 0 / Go。文言だけのMinor 1件も計画書上で修正した。
- 次はTask 1のWordPress REST安全化を、実装担当と別担当レビューに分けて開始する。push、deploy、本番WordPress/Supabase操作は未実施。

## 2026-07-18 Phase 17 Task 1 WordPress REST安全化

- 匿名debug、REST認証解除、MU plugin削除、任意meta更新、重複routeを削除し、専用権限と店舗編集権限を必要とする日次3項目allowlistへ縮小した。
- UUIDv4、24時間・最大100件の再送検出、店舗単位lock、途中失敗時rollback、非公開監査log、失敗時の秘密値なし運用記録を実装した。
- 追跡されていた`.env`とSFTP設定をローカルに保持したままGit追跡外へ移し、WordPress、Gemini、Xserver SFTP/FTPの全候補を失効・再発行する確認表を追加した。
- 実装commitは`5c2eabd`、`c56347d`、`394b537`。独立再レビューはCritical 0 / Important 0 / Minor 0、Ready Yes（ローカル実装）だった。
- focused Node/PHP、通常`npm test`、3 PHP構文、YAML、Python構文、差分検査が成功した。外部ローテーション未完了のためpush、deploy、本番操作は禁止を維持する。
