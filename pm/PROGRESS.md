# 進行ログ

**運用・自動実行コマンド:** `pm/RUNBOOK.md`（Claude / Cursor は手動指示ではなく **ここに書いたコマンドを実行**する）

### 2026-07-18 Phase 16 一覧・店舗詳細の精密再調整 完了

- 順位badgeを画像内overlayへ移して順位有無のcardを共通3列にし、店舗詳細上部をPCの画像/hero 2列へ整理した。予約・公式情報groupは各画面幅で表示中1つだけにした。
- 旧browser検査をTask 1・2後へ当て、4,971 failuresのREDを確認した。原因は旧`visualAside`、article直下media、独立rank列を検査側が固定していたことだった。
- 新browser検査はmediaWrap内の順位包含、順位あり/なしmedia・title x差2px以内、可視予約group 1、H1 PC 34px/SP 26px以下、facts 18px以下、横はみ出し0、CTA 44px以上を数値確認する。
- fresh検証は通常test 35/35、lint、typecheck、441/441 build、headless 56/56 scenarios・89,836 assertions・32 screenshots・failures 0、High/Critical 0、差分検査0。
- 独立最終レビューはCritical 0 / Important 0 / Minor 0、Ready: Yes。WordPress公開データ元を維持し、WordPress/Supabase書込は行っていない。
- ユーザー承認後、commit `ddddb33` までを`main`へpushした。Vercel run `29617521724`は通常CI build、prebuilt build、本番deploy、SEO cutover checkをすべて通過し、`https://mens-esthe-kuchikomi.com`へ反映した。
- 本番5 URLはHTTP 200。本番headless QAは4経路×14条件=56 scenarios、90,112 assertions、32 screenshots、failures 0で、PC・スマホ・切替境界・横向きを通過した。
- headless配下だけの変更なのでXserver workflowは対象外。WordPress/Supabaseへの書き込みや公開参照先の切替は行っていない。

### 2026-07-17 Eskomi UX再構築 本番反映完了

- 完成済み23コミットを`main`へpushし、Xserver run `29571208433`はFTP反映・OPcache削除・REST確認まで成功した。
- 初回Vercel run `29571208457`は、ローカルprebuilt時の秘匿環境値が有効URLとして扱えず、WordPress取得がNext.jsの50秒cache上限へ到達して失敗した。本番deploy前で止まったため、不完全なVercel公開は発生していない。
- テスト先行でWordPress API/公開baseを絶対HTTP(S) URLだけに限定し、不正・相対・秘匿placeholderは既定originへ戻した。native fetchへ総時間制限を追加し、URL末尾slash・userinfo・query・hashとtimeout異常値も正規化した。
- 修正commitは`10a4d12`と`936462c`。独立再レビューはCritical 0 / Important 0 / Minor 0、Ready: Yes。
- 再実行Vercel run `29572387927`は通常CI build、prebuilt build、本番deploy、SEO cutover checkがすべて成功し、`https://mens-esthe-kuchikomi.com`へ反映した。
- 本番トップ、堺筋本町、大阪エリア、店舗一覧、milk tea店舗詳細はすべてHTTP 200。トップはEskomi表記、固定件数・固定日付なし、有効な`filter=price`、旧画像参照なしを確認した。
- 本番をheadless Chromiumで4経路×14条件確認し、56 scenarios・81,761 assertions・32 screenshots・failures 0。PC、スマホ、760/761・900/901・1024/1025境界、横向きを通過した。
- browser QAは画面非表示で実行し、通常Chromeを操作していない。WordPressを公開データ元として維持し、Supabase公開切替・公開データ書き込みは行っていない。

### 2026-07-17 Eskomi 店舗一覧・店舗詳細 UX再構築 完了

#### 完了したこと

- 軽微修正 → ブランド・ロゴ → 表示の正確性 → 共通店舗一覧 → 店舗詳細shell → headless実ブラウザQA → 最終横断レビューの順で、計画した11タスクを個別レビュー付きで完了した。
- 店舗名改行、順位位置、比較表見切れ、可視ブランドとロゴ、推定・固定情報、一覧3経路の共通カード、詳細の条件付きメニューと2列shell、予約導線を設計書どおり再構築した。
- 固定件数・固定日付・循環更新ラベルを削除した。料金条件は有効な`price` filterへ直し、`shop_ai_summary`を出自ラベルなしの通常紹介として表示せず、画像404はトップ・共通一覧・ランキングでEskomi共通fallbackへ切り替える。
- 最終横断レビュー初回はCritical 0 / Important 4。上記4件を`1654f3b fix: remove unverified portal facts`で修正し、独立再レビューはCritical 0 / Important 0 / Minor 0、Ready: Yesとなった。
- 構造レビューでは`check-shop-content-accuracy.mjs` 617行と`check-area-shop-card-view-model.mjs` 527行を、今後検査を追加するときのfixture/helper分離候補とした。今回の完了を妨げる問題ではない。

#### 最終検証

- `npm test`: 34/34、終了コード0。
- `npm run lint`: 終了コード0。
- `npm run typecheck`: 終了コード0。
- `npm run build`: 441/441ページ、終了コード0。
- build直後の`npm run test:portal-browser-layout`: headless、56 scenarios、81,557 assertions、32 screenshots、failures 0、終了コード0。
- `npm audit --audit-level=high`: Critical 0 / High 0 / Moderate 2（既知PostCSS）、終了コード0。
- `git diff --check`成功、`next-env.d.ts`差分なし、3100 listener・検査script・検査用Chromium残存0。
- middleware名称非推奨、WordPress timeout fallback、`useSearchParams` client renderingの既知warningは残るが、検査・buildのfailureは0。

#### 画面占有と停止位置

- browser QAはheadless既定で、`PORTAL_QA_HEADED=1`明示時だけ可視Chromiumを使う。最終検証では未設定で、通常ChromeとPlaywright MCPを操作・終了していない。
- WordPressを公開データ元として維持した。Supabase公開接続・書き込み、WordPress書き込み、push、PR、deploy、本番公開は実施していない。

### 2026-07-16 店舗詳細C案のローカル実装・全幅QA

#### 最終横断レビュー修正（独立再レビュー承認済み）
- DB/APIのcanonical encoded slug、target URL完全一致、WordPress正本照合、private分散rate limit、口コミの店舗ID一致、production 18条件証跡の6件をテスト先行で修正した。
- local SupabaseでC-REST申請を実APIから保存し、WordPress正式名への正本化、匿名拒否、原子RPCの6回目拒否を確認して検査行を削除した。
- Nextの静的生成paramだけをdecoded Unicodeへ変換し、canonical single-encoded店舗URLの404を200へ直した。公開URLとWordPress slugは変更していない。
- JSON-LDのscript境界をescapeし、`next start`で3店舗×6幅=18条件をすべて再実測して18/18合格、代表6画像を目視した。
- 独立最終再レビューでCritical 0、Important 0を確認し、全26検査、lint、型チェック、441/441ページbuild、3店舗のcanonical URLが再度成功した。11/11のローカル完了を承認済み。

#### 完了したこと
- Owner 4タスク、Detail 7タスクの合計11タスクをローカルで完了した。
- 店舗責任者の申請はSupabase非公開審査候補へ保存し、自動公開しない流れにした。
- 店舗詳細C案を全店舗共通で実装し、画像・料金・営業時間・公式URLなど、WordPressで存在を確認できた情報だけを表示するようにした。
- 代表3店舗をPC 1440/1280/1024、スマホ390/375/320で確認し、合計18条件すべてで横崩れ、重なり、画像縦伸ばし、操作領域、表の折返しを合格させた。
- 仮の12,000円、静的OPEN、0名を除去した。画像なし店舗は共通画像、料金なし店舗は料金欄なしで表示した。
- LINE・電話予約、公式サイト、店舗責任者クリックを区別し、各1回、重複0、電話番号なしを実画面で確認した。
- percent-encoded WordPress slug、店舗責任者帯の文字色、旧電話計測の番号残存をテスト先行で修正した。
- 全26 npm検査、local Supabase統合、lint、型チェック、441/441ページbuild、Git差分検査が成功した。
- 詳細は `.superpowers/sdd/task-7-report.md`、数値証跡は `.superpowers/sdd/task-7-browser-evidence.json` に保存した。

#### 現在の停止位置
- 最終横断レビューのImportant 6件は修正済み。独立再レビューでCritical 0、Important 0となり、11/11のローカル完了を承認済み。
- WordPressを公開データ元として維持し、本番Supabase、WordPress公開値、GA外部送信は変更していない。
- local Supabase、開発サーバー、表示ブラウザは停止済み。
- stage、commit、push、deployは未実施。本番確認は別承認とする。
- 非ブロッキングの後続候補は、期限切れrate-limit行の削除方針とraw `img`の画像最適化。

### 2026-07-16 店舗詳細C案の設計・実装計画

#### 完了したこと
- 店舗詳細の画像縦伸ばし、PCの狭い本文幅、スマホ上部の過大表示、仮値表示をコードと実画面で確認した。
- A/B/C案から、角丸カードを並べず、罫線・余白・文字組みで構成するC案をユーザー承認済み設計として確定した。
- PC最大1360px、スマホ左右16px、画像4:3、確認できた情報だけを表示する基準を確定した。
- 予約・公式サイトクリックを主要指標とし、配置別・店舗別に区別する計測方針を確定した。
- WordPressを公開データ元として維持し、店舗責任者申請はSupabase非公開審査候補へ保存して自動公開しない設計にした。
- 設計書1本と、非公開申請フロー・店舗詳細C案の実装計画2本を保存し、自己レビューを完了した。

#### 現在の停止位置
- 店舗詳細の完成品質は約40%。設計・実装計画は完了し、本体コードは未着手。
- 次は `docs/superpowers/plans/2026-07-16-shop-owner-request-flow.md`、続いて `docs/superpowers/plans/2026-07-16-shop-detail-c-editorial-redesign.md` の順に実行する。
- local migration・画面実装・全幅QA・build後の95%で停止する。
- 本番Supabase、WordPress公開値、push、deployは変更しない。

### 2026-07-15 堺筋本町 Phase 4 Supabase非公開投入準備

#### 完了したこと
- 本番へは書き込まず、26店舗・料金89行・営業時間23行・公式URL単位の出典71行・項目別出典189行を非公開で保存するSQLと検証SQLを作成した。
- 既存382店舗の非公開データをローカルDBへ復元し、同じPhase 4 SQLを2回実行した。2回目も件数は増えず、取込記録26件を維持した。
- 営業時間注記の文字列処理エラーは、失敗する自動検査を追加してから修正した。
- 料金・営業時間の重複0、匿名公開view全9種0件、DBの規則違反0を確認した。
- 調査レポートはローカル検証済みと本番未実施を分けて表示するよう更新した。
- 全18検査、コード規則、型チェック、本番相当build 440/440ページ、Git差分検査が成功した。QAセルフレビューで追加の修正事項はなかった。

#### 現在の停止位置
- 本番SupabaseへのPhase 4データ投入は未実施。
- WordPressを公開データ元として維持し、公開参照先、URL、canonical、sitemapは変更していない。
- commit、push、deploy、本番公開は未実施。
- 次は、生成SQLの内容と対象26店舗を確認し、本番Supabaseへ非公開で投入するか明示承認を得る。

### 2026-07-15 SEO Phase 4「堺筋本町の実データ強化」

#### 完了したこと
- WordPress堺筋本町term 46の既定順先頭30店舗を固定し、人気順位・口コミ順位とは扱わず調査した。
- 公式サイト、公式予約先、公式SNSだけを一次情報として72件記録した。検索結果と第三者サイトは値の出典にしていない。
- 確認済みは正式名26、住所11、駅情報20、営業時間23、料金21、電話25、予約方法26、初回向け公式案内5店舗だった。
- 一次情報を確認できなかった殿様気分、Elin、Feliz、プレミアム離宮は、推測やWordPress現行値で補わず未確認のまま残した。
- 代表料金21店舗は最小8,000円、中央値12,500円、最大18,000円。価格帯は1 / 6 / 9 / 5 / 0店舗だった。
- 営業時間確認済み23店舗のうち、具体的な翌日閉店時刻を確認できた20店舗だけを深夜対応に数えた。LAST表記2店舗は深夜件数へ含めていない。
- 30店舗の根拠データ、一次情報一覧、比較集計、Supabase非公開draft候補26店舗分を生成した。
- draft候補は既存の `app.shops`, `app.shop_prices`, `app.shop_business_hours`, `app.sources`, `app.shop_source_links` へ対応し、料金89行、営業時間23行、調査記録72件（公式URL単位71行）、項目別出典189行を保持する。
- WordPress現行値は比較用snapshotに限定し、WordPress更新候補は廃止した。
- 検査は30件と順序の固定、一次出典、未確認0、代表料金規則、空更新、口コミ・評価フィールドを拒否する。

#### 検証結果
- `npm run test:sakaisujihonmachi-phase4-data`: 成功。
- `npm test`: 全17検査成功。
- `npm run lint`: エラー0。
- `npm run typecheck`: エラー0。
- `npm run build`: 440/440ページ生成、終了コード0。
- `git diff --check`: エラー0。
- build中のWordPress応答遅延による代替データと `useSearchParams()` の表示切替は既存ログで、build自体は完了した。

#### 現在の停止位置
- Supabase非公開draft候補26店舗分はローカル2回投入で検証済み。本番には未投入。
- WordPressを公開データ元として維持し、Supabase、公開参照先、URL、canonical、sitemapは変更していない。
- commit、push、deploy、本番公開は未実施。次は生成SQLを人間確認し、別承認で本番Supabaseへ非公開投入するか決める。

### 2026-07-14 Supabase 382店舗・34地域の非公開移行

#### 完了したこと
- WordPressを再監査し、店舗382・地域34、地域なし75、複数地域230、料金252、画像241を確認した。
- 全地域、複数地域、地域なし店舗を扱う固定SQL生成と検証をテスト先行で実装した。
- local DBで382店舗SQLを2回適用し、地域34・店舗382・関係782・料金252・画像241を維持した。
- localの重複group 0件、anon公開view全9種0件、schema lint error 0を確認した。
- 本番へ382店舗をdraft、地域・料金・画像を非公開で適用した。
- 本番の地域34・子地域26・店舗382・関係782・料金252・画像241・batch 3・record 415を確認した。
- 本番batchはsource 382・imported 382、地域なし75・複数地域230、重複group 0件だった。
- 本番anon公開view全9種は0件、Security/Performance Advisorはerror 0 / warning 0だった。
- 382店舗の固定SQLはWordPress元データを含むためGit除外し、誤追加防止検査を入れた。
- npmの全16検査、lint、typecheck、git diff checkが成功した。

#### 現在の停止位置
- Supabase公開参照先切替、shadow、WordPress停止、push、deployは未実施。
- 次はSEO・視認性改善の設計をユーザー確認後に実装する。

### 2026-07-14 Supabase 30店舗非公開試験

#### 完了したこと
- ユーザー承認後、堺筋本町93店舗から既存3店舗を含む30店舗を固定した。
- 料金欠損5件、画像欠損7件、公式URL欠損15件をすべて含め、通常データと複数地域所属を比較対象にした。
- SQL生成module、再生成command、固定投入SQL、検証SQLをテスト先行で実装した。
- local DBへ3店舗SQL→30店舗SQL→30店舗SQL再実行の順で適用し、店舗30・関係30・料金25・画像23を維持した。
- 料金と画像の重複groupは0件、anonの公開view全9種は0件、schema lintはerror 0だった。
- lint、typecheck、15検査、build 440ページ、git diff checkが成功した。
- 正しいChrome profileで対象project refを照合し、本番事前件数が既存3店舗trialと一致することを確認した。
- 本番へ30店舗SQLを適用し、地域1・店舗30・関係30・料金25・画像23・batch 2・record 33を確認した。
- 30店舗batchはsource 30・imported 30、料金と画像の重複groupは0件、anonの公開view全9種は0件だった。
- 本番Security/Performance Advisorはいずれもerror 0 / warning 0だった。残るinfoは非公開表のdeny-by-defaultと未使用indexの案内だけ。

#### 現在の停止位置
- 本番30店舗の非公開試験は完了した。
- 382店舗全件投入は別承認前で停止している。
- 382店舗、shadow、cutover、WordPress停止、push、deployは実施しない。

### 2026-07-14 Supabase本番schemaと3店舗非公開試験

#### 完了したこと
- 対象Chrome profileへ接続し、正しいSupabase projectが健康状態であることを確認した。
- SEO安全schema 13表・公開view 9件・RLS/policy/権限を本番へ適用した。
- 出典参照3列のindex不足をテスト先行で修正し、追加migrationと履歴を本番へ適用した。
- 本番Performance Advisorはerror 0 / warning 0。残るinfoは空DBでindexが未使用という案内だけ。
- 堺筋本町93店舗には0円表記がなかったため値を作らず、MUSE(695)、sirena II(709)、殿様気分(1237)を試験対象にした。
- 非公開試験SQLと検証SQLをテスト先行で実装し、local DBへ2回適用して重複しないことを確認した。
- localでは地域1、店舗3、地域関係3、非公開料金2、非公開画像2、取込batch 1、取込record 3。公開view全9種はすべて0件だった。
- 本番へ同じtrial SQLを適用し、3店舗がdraft、地域・料金・画像が非公開、取込recordがimportedであることを確認した。
- 本番の保存件数はlocalと一致し、anonの公開view全9種は0件だった。
- 本番Security/Performance Advisorはいずれもerror 0 / warning 0だった。
- 最終QAはlint、typecheck、15検査、build 440ページ、DB lint/Advisor、git diff check、secret形式検査がすべて成功した。
- local Supabaseは検査後に停止した。

#### 現在の停止位置
- 本番schemaと3店舗trialは完了。30店舗拡大の承認前で停止。
- 公開参照先、WordPress、URL、canonical、sitemap、公開HTML、push、deployは変更していない。
- 30店舗・382店舗への拡大、shadow、cutoverは別承認まで行わない。

### 2026-07-14 Supabase SEO安全移行のローカル基盤

#### 実行範囲
- `codex/supabase-seo-safe-migration` ブランチへ分離し、既存の合計12コミット公開単位と混ぜなかった。
- 公開URL、canonical、robots、schema、sitemap、現在のWordPress表示は変更しなかった。
- 本番Supabase作成・接続、WordPress/Supabase本番書き込み、公開参照先切替、push、deployは行わなかった。

#### 実装したこと
- `app` に店舗、地域、料金、営業時間、画像、出典、本文履歴、口コミを分離した最小schemaを作成した。
- `private` に移行batchと行別の生データ・変換結果・警告を残す構成を作成した。
- Supabase Data APIは `api` schemaの `security_invoker` 読み取りviewだけに限定した。
- anon/authenticatedの書き込み権限を与えず、RLSで公開済み店舗・地域・本文・承認済み口コミだけを読めるようにした。
- `CONTENT_DATA_SOURCE` はWordPressを既定値とし、shadow比較とSupabase切替承認を判定するmoduleを追加した。既存公開routeへはまだ接続していない。
- WordPress公開APIを読み取る移行監査を追加し、382店舗・34地域を再確認した。

#### 2026-07-14再監査結果
- 店舗382、地域34。
- 店舗本文0、抜粋0、地域説明0、専用出典URL0、確認日0。
- 画像241、公式URL333、確認可能料金252、AI要約76。
- 地域なし75店舗、複数地域230店舗、公開口コミAPIは未接続。
- 住所は安全側の厳しい判定で49件だけを番地住所候補とし、333件を住所/アクセス要確認とした。

#### TDDとQA
- schema検査、移行監査、参照先設定は、実装前の意図した失敗を確認してから実装した。
- QAで、既存の `WP_API_BASE_URL=/wp-json` 互換不足と、非公開親に紐づく本文/口コミのRLS条件不足を検出した。
- 2件とも再発検査を先に失敗させてから修正し、成功を確認した。

#### 検証結果
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm test`: 既存11件+新規3件、合計14検査すべて成功。
- `npm run build`: 440/440ページ生成で成功。
- `git diff --check`: 成功。
- 公開route、metadata、sitemap、表示component差分: なし。
- JWT / Supabase secret形式: 検出なし。
- `supabase start`: 専用local portでmigration初回適用成功。
- `supabase db reset`: migration再適用成功。
- `supabase db lint --local`: api/app/extensions/private/publicの全schemaでerrorなし。
- `supabase stop`: local環境停止成功。
- build時は既知のmiddleware非推奨、WordPress timeout fallback、`useSearchParams()` bailoutログが出たが、結果は成功した。

#### 未実施と次の停止点
- 本番Supabase接続、3店舗試験、30店舗試験、382店舗投入、shadow、cutoverはそれぞれユーザー承認前で停止する。
- 次は本番projectの所有者・費用・Secret登録場所と、3店舗の非公開試験範囲を確認する。
- 戻し方と段階手順は `docs/runbooks/supabase-seo-safe-migration.md` に記録した。

### 2026-07-15 重点5地域 SEO・視認性改善 本番公開完了

#### 公開したこと
- 重点5地域（堺筋本町、堺、大阪日本橋、新大阪、梅田）の全幅ヘッダー、地域固有本文、「選び方・料金・深夜・口コミ」4カードを `main` へ統合し、本番公開した。
- 公開データの取得元はWordPressのまま維持した。Supabase公開切替、WordPress停止、URL・canonical・robots・schema・sitemapの意図的変更は行っていない。
- `main` の公開対象は、5地域実装の7コミットと、日本語店舗URLの本番再発防止コミット `c448a7a`。

#### 公開時に解消した問題
- 最初の自動デプロイはVercel本番反映まで成功したが、GitHub ActionsからWordPressへ接続できず26ページだけが生成され、日本語slugの店舗ページがNext.js 16.2.6の非ASCII cache tag不具合で500になった。
- 接続可能なローカル環境で440ページを事前生成した成果物 `dpl_CVBV8Wzq6Le2r3a77fb6rppTjggB` を公開し、店舗URLを即時復旧した。
- Next.jsを16.2.10へ更新し、WordPress接続不能時は実店舗ではなく非公開の検査用slugだけを事前生成するよう修正した。修正前に2検査が失敗し、修正後に成功することを確認した。

#### 最終公開結果
- GitHub Actions: run `29352333209` は認証、lint、440ページbuild、Vercel本番反映、SEO切替検査まで全工程成功。
- Vercel production: `dpl_5ZusbxihkRgFWMeSXmVjMSSEimN6`、`Ready`、`https://mens-esthe-kuchikomi.com` へalias済み。
- SEO切替検査: 主要ページ、redirect、robots、canonical、GA4、サイトマップ425件、店舗URL5件、404サンプルがすべて成功。公開後500ログは0件。
- Playwright本番検査: 5地域×パソコン/スマホの10表示がすべてHTTP 200。背景全幅、角丸0、本文開始位置一致、H1各1件、PC4列、スマホ2列×2段、固有本文5種、4リンク、横はみ出し0を確認した。

#### 残課題と評価日
- Search Consoleの公開後基準値取得とURL検査は未実施。14日評価日は2026-07-29、30日評価日は2026-08-14。
- `npm audit` は既存3件（moderate 2、high 1）、`middleware`規約非推奨、GitHub ActionsのNode.js 20互換警告が残る。
- `BLOCK-006` は解除。`BLOCK-005` の監視・自動更新パイプライン整理は継続。

#### 次の1タスク
- Search Consoleで重点5地域の公開後基準値とインデックス状態を記録し、その後は固有情報と承認済み口コミの蓄積を優先する。

### 2026-07-14 重点5地域 SEO・視認性改善（公開前実装完了）

#### 実装したこと
- `codex/seo-visibility-cards` の分離作業ツリーで、堺筋本町、堺、大阪日本橋、新大阪、梅田だけに地域固有の短い解説と「選び方・料金・深夜・口コミ」の4カードを追加した。
- 4カードを店舗一覧、料金表、深夜営業、口コミへ接続し、重複していたヘッダー内チップ、ページ内ナビ、`NEXT CHECK`を統合した。
- 料金は確認済み料金を持つ店舗数、深夜は掲載営業時間から判定できる候補数、口コミは承認済みユーザー口コミだけを使う。0円、未確認の深夜営業、根拠のない評価値は表示しない。
- エリア詳細ヘッダーの背景画像をブラウザ左右端まで広げ、角丸と外枠を削除した。文字と情報枠は本文と同じ幅・左位置へ揃えた。
- 公開データの取得元はWordPressのまま維持し、Supabase公開切替、WordPress停止、URL・canonical・robots・schema・sitemap変更は行っていない。

#### RED / GREEN
- RED: 新規契約検査は`AreaHubDecisionGuide.tsx`未作成で失敗し、コンポーネント追加後もテンプレートの本文幅ラッパー不足を検出した。
- GREEN: 5地域の固有本文、安全な集計、4リンク、パソコン4列、スマホ2列、重複導線削除、角丸なしの契約を実装後、専用検査が成功した。
- ブラウザ検査でヘッダー文字と本文の左端に22px差があることを検出した。本文と同じ1280px枠・48px余白へ修正し、パソコンは両方368px、スマホは両方16pxで一致した。

#### 検査結果
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm test`: 12検査すべて成功。
- `npm run build`: 成功、440ページ生成。
- Playwrightで5地域すべての固有本文と4カードを確認した。パソコン1920pxでは4列、スマホ375pxでは2列2段、H1は1件、横はみ出し0、4リンクは指定アンカーへ接続した。
- 全幅ヘッダーはパソコン・スマホとも左端0px、表示幅と画面幅が一致し、角丸0px、外枠0pxだった。
- 既知の`middleware`規約非推奨と、WordPress API 404時の代替データ使用通知は出たが、buildは終了コード0だった。

#### 未実施
- `main`への統合、push、本番デプロイ、Supabase公開切替、WordPress停止は未実施。

#### 次の1タスク
- 実装・設計6コミットと本記録1コミットの合計7コミットを確認し、`main`へ統合して本番公開するか明示判断する。

### 2026-07-14 主要5地域Top10 SEO Phase 3公開承認

- ユーザーが、Phase 0〜2文書を12件目として含める公開単位を明示承認した。
- 合計12コミットを `main` へpushし、GitHub Actions経由のVercel本番反映と公開後検査まで行う。
- Search Consoleへのログインが必要な操作は自動実行せず、本番確認後に人間向け手順を提示する。
- WordPress、Supabase、親リポジトリ、既存 `/private/tmp` 作業ツリーは今回の公開対象に含めない。

### 2026-07-14 主要5地域Top10 SEO Phase 0〜2公開前確認

#### Phase 0
- 正式作業場所 `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi`、branch `main`、HEAD `6d84706`、`origin/main` `593dcea` を確認した。
- `git fetch origin --prune` 後も、ローカルmainは `origin/main` より11コミット先行している。
- 既存 `/private/tmp/escomi-*` 7作業ツリー、親リポジトリの旧submodule参照、開始時の文書差分を確認し、変更しなかった。
- `backup/original-dirty-20260714` 内の過去SEO計画7件を参照し、現在の `pm/SEO_TOP10_EXECUTION_PROMPT.md` を正本として優先順位を確定した。

#### Phase 1
- Search Console接続機能がないため、Secretや保存ログイン情報を要求せず、人間向け取得手順へ切り替えた。
- `docs/seo/pre-publish-baseline-2026-07-14.md` に、90日・28日の記入欄、URL検査手順、7検索語×Yahoo!検索簡易版10件の観測結果を保存した。
- 観測順はGoogle順位・確定順位として扱わず、14日・30日評価はSearch Consoleの同条件データを正式基準とした。

#### Phase 2
- `headless/` の `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` はすべて成功した。
- 11検査すべて成功し、buildは440ページを生成した。
- 指定8ページをPC 1440×1000、スマホ390×844で確認し、全16表示がHTTP 200、横はみ出し0、壊れた画像0、画面外操作部品0だった。
- 5地域のtitle、description、h1、canonical、robots、料金、FAQ/schema、口コミschema、PR分離、実 `a[href]` 内部リンクを確認した。
- ダッシュボード2ページと口コミ投稿は `noindex, nofollow`。口コミ投稿のローカルcanonicalは `/reviews/submit/` へ修正済みで、公開中はサイトTOPを指していた。
- 公開中5地域との主要SEO項目は同じ。堺筋本町だけローカルに専用ガイド約390文字と内部リンク5本が追加されている。
- 新大阪49店舗中42店舗は複数areaタームを持ち、店舗名・住所・ItemList schemaに別地域名を含む。固定文言の流用ではないが、厳密な地域分離条件では残るリスクとして記録した。
- Playwright撮影の黒い欠けは `backdrop-filter` 部分の画像合成乱れと切り分け、DOMの幅・色・操作部品位置が正常であることを確認した。コードは変更していない。
- 詳細な公開前承認資料を `docs/seo/pre-publish-verification-2026-07-14.md` に保存した。

#### 既存警告・残課題
- build中に `middleware` 規約非推奨、WordPress APIタイムアウト/404時の代替データ、`useSearchParams()` のクライアント描画切替ログを確認した。build結果は成功。
- Search Console実数とGoogle選択canonicalは未取得。
- 公開ダッシュボードはBasic認証でHTTP 401のため、認証を回避せず本文比較を行っていない。
- 親リポジトリのsubmodule参照更新は別承認事項として維持した。

#### 未実施
- Phase 3、commit、push、本番デプロイ、本番WordPress/Supabase変更、Search Console書き込みは未実施。

#### 次の1タスク
- 11コミットだけをpushするか、Phase 0〜2文書を別コミットにまとめて12コミットでpushするか、ユーザーの明示承認を待つ。

### 2026-07-14 主要5地域Top10 SEO実行プロンプト作成

#### 実行したこと
- 正式な作業場所を `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` として固定した。
- 既存の5地域SEO計画、現在のmain、公開前ブロッカー、統合済みQ-01〜Q-07・S-10・S-40の状態を整理した。
- `pm/SEO_TOP10_EXECUTION_PROMPT.md` に、公開前計測、11コミットの検証、本番反映承認、堺筋本町集中、堺東URL判断、14日・30日評価までの実行指示を作成した。
- `pm/NEXT_ACTIONS.md` の先頭を2026-07-14現在の実行順へ更新し、古いQ-01開始指示は履歴扱いであることを明記した。
- 5地域を同時に広げず、堺筋本町を主対象、堺東を次点とする順序を明記した。

#### 制約
- 初回実行はPhase 0〜2までとし、push・本番デプロイ前に必ず停止する。
- 親リポジトリ、既存 `/private/tmp` 作業ツリー、本番DB、Secretは変更しない。
- 堺/堺東URL構造は人間判断前に変更しない。

#### 未実施
- SEO実装、Search Console取得、push、本番デプロイは未実施。

#### 次の1タスク
- `pm/SEO_TOP10_EXECUTION_PROMPT.md` のPhase 0〜2を実行し、公開前判断材料を作成する。

### 2026-07-14 元フォルダ・production作業ツリー統合調査

#### 実行したこと
- 元フォルダとproduction側が、同じGitディレクトリを使うメイン作業ツリーと追加作業ツリーであることを確認した。
- 元フォルダの追跡済み変更49件を、`origin/main`、production HEAD、全Git履歴と比較した。
- ビルド生成物などを除いて、元フォルダだけにある実ファイル117件と、production側だけにある実ファイル20件をchecksum比較した。
- `docs/technical/repository-consolidation-inventory-2026-07-14.md` に保存要否と削除許可条件を記録した。
- `docs/superpowers/plans/2026-07-14-repository-consolidation.md` に、バックアップ作成から元フォルダを正本へ戻すまでの実行手順を記録した。

#### 調査結果
- 元フォルダの追跡済み変更49件のうち15件は `origin/main` と同一、14件はproduction HEADと同一だった。
- 両方と異なる34件のうち20件はGit履歴内に同一内容があり、14件は履歴未保存だった。
- 元フォルダだけにある実ファイル117件のうち116件はGit履歴内に同一内容があり、履歴未保存は `dashboard/.env.example` だけだった。
- 削除前に必ず保存する対象は、履歴未保存の追跡済み14件と `dashboard/.env.example` の合計15件。
- 現在の公開コードはproduction側の `9b66731` を基準にし、元フォルダからの一括コピーは行わない方針とした。

#### 確認結果
- production側: `codex/production-baseline-20260713...origin/main [ahead 2]`、調査開始時はクリーン。
- 元フォルダ: `main...origin/main [behind 26]`、既存の未コミット状態を維持。
- 前ターンの再確認でproduction側 `npm test` は成功。
- `backup/original-dirty-20260714` を一時indexから作成した。
- 一時indexとバックアップrefのtree一致を `git diff --cached --exit-code` で確認した。
- 元フォルダの通常index、実ファイル、`main` は変更していない。
- 追加確認で `dashboard/.env.example` が `dashboard/.gitignore` の `.env*` により初回バックアップ対象外だったことを検出した。
- 一時indexへ同ファイルだけを `git add -f` し、`backup/original-dirty-20260714` を親コミット付きで更新した。
- 更新後、同ファイルのblob一致、一時indexとバックアップrefのtree一致、元フォルダHEAD・通常index・実ファイルの不変を確認した。
- 履歴未保存のダッシュボード・配信設定10ファイルは `backup/original-dirty-20260714` に保存した。
- `DASH-DESIGN-00`、`BLK-SECRET`、`BLK-SUPA-00` が残るため、今回の作業ツリー統合では公開コードへ適用しない。
- production側で `git diff --check`、`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` が成功した。
- 元フォルダを正本へ戻すTask 5は、ユーザーの明示承認後に完了した。

#### 未実施
- push、本番デプロイは未実施。

### 2026-07-14 Task 5 元フォルダへのローカル統合

#### 実行したこと
- `backup/original-dirty-20260714` が `81884f9efca15395a744f64ff1dcf25130b80e14` を指し、履歴未保存15ファイル、一時index、元フォルダ実ファイルの一致を再確認した。
- ユーザーの明示承認後、元フォルダの既存差分を整理し、`main` を検証済みコミット `1e62f683641713916d7efab401f70d06bcea10da` へfast-forwardした。
- 元フォルダの `headless/` で `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` を再実行した。
- `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production` を `git worktree remove` で削除し、`git worktree prune` を実行した。
- `codex/production-baseline-20260713` が `main` に完全に含まれることを確認し、接続先設定を外した後に `git branch -d` で通常削除した。
- 既存の `/private/tmp` 配下の作業ツリーは今回の対象外として変更していない。

#### 確認結果
- lint、typecheck、11検査、buildはすべて終了コード0。
- buildは440ページ生成に成功した。
- 元フォルダはクリーンな `main` となり、production作業ツリーの登録とフォルダがなくなった。
- `backup/original-dirty-20260714` は保持されている。

#### 未実施
- push、本番デプロイは未実施。

### 2026-07-14 Q-07 FAQ表示・schema境界条件修正

#### 修正内容
- `asFaqRows` で回答の表示用HTMLは保持したまま、HTML除去後の本文が空になる行を除外するよう修正した。
- `question: "有効な質問"`、`answer: "<br />"` の入力が表示行の空配列になり、同じ行集合からFAQPage schemaも生成されない回帰テストを追加した。
- 統合計画のTask 1〜4にある全Stepを完了表示へ更新し、明示承認が必要なTask 5は未完了のまま維持した。
- バックアップref、保存対象15件、Task 1〜4のコミットとレビュー、品質検査、未実施事項を `docs/technical/repository-consolidation-inventory-2026-07-14.md` へ追跡済み証拠として保存した。
- `.superpowers/sdd/` は補助記録とし、Task 5前には追跡済み統合台帳と本進行ログを正本として確認する方針を記録した。

#### RED / GREEN
- RED: 回帰テスト追加後の `npm run test:schema-output` は終了コード1。`asFaqRows` が実際には `[{ question: '有効な質問', answer: '<br />' }]` を返し、期待する空配列との差で失敗した。
- GREEN: `asFaqRows` の最小修正後、`npm run test:schema-output` は終了コード0で `schema output condition checks passed`。

#### 最終検証
- `git diff --check`: 成功。
- `headless/` の `npm run lint`: 成功。
- `headless/` の `npm run typecheck`: 成功。
- `headless/` の `npm test`: 11検査すべて成功。
- `headless/` の `npm run build`: 成功、440ページ生成。
- build警告: 既存の `middleware` 規約非推奨と、WordPress APIの404による代替データ使用通知を確認した。

#### 未実施
- Task 5、元フォルダの変更、push、本番デプロイは未実施。

### 2026-07-14 Q-07 HTML空白文字参照の追加修正

#### 修正内容
- FAQ専用の表示可能テキスト判定を追加し、`&nbsp;` の大文字小文字差、`&#160;`、`&#xA0;`、Unicode NBSPを通常空白へ正規化した。
- 質問と回答、`asFaqRows` と `faqJsonLd` の両方で同じ判定を使い、文字参照だけのFAQ行とFAQPage schemaを除外した。
- `asFaqRows` が返す回答の表示用HTMLは維持した。
- 必須4入力に加え、大文字の `&NBSP;`、16進参照 `&#xA0;`、Unicode NBSPを回帰テストで固定した。

#### RED / GREEN
- RED: 回帰テスト追加後の `npm run test:schema-output` は終了コード1。`answer: "&nbsp;"` が表示行に残り、期待する空配列との差で失敗した。
- GREEN: 共通判定の実装後、`npm run test:schema-output` は終了コード0で `schema output condition checks passed`。

#### 最終検証
- `git diff --check`: 成功。
- `headless/` の `npm run lint`: 成功。
- `headless/` の `npm run typecheck`: 成功。
- `headless/` の `npm test`: 11検査すべて成功。
- `headless/` の `npm run build`: 成功、440ページ生成。
- build警告・通知: 既存の `middleware` 非推奨、WordPress APIの404・タイムアウトによる代替データ使用、`useSearchParams()` のクライアント描画切替ログを確認した。

#### 未実施
- Task 5、元フォルダの変更、push、本番デプロイは未実施。

### 2026-07-14 Task 2 履歴未保存の公開UI差分5件の採否判定

#### 判定結果
- 履歴未保存の口コミ・エリア表示5ファイルは `backup/original-dirty-20260714` に保存した。
- 現在のQ-04からQ-07、S-10実装と競合するため、今回の作業ツリー統合では公開コードへ適用しない。
- 必要性が確認された場合だけ、フォルダ統合後の別タスクで個別に再評価する。

### 2026-07-13 S-10 堺筋本町Hub改善

#### 実行したTask ID
- `S-10`: 堺筋本町Hub改善。

#### 変更したファイル
- `headless/lib/area-hub-config.ts`
- `headless/lib/area-shop-utils.ts`
- `headless/components/area/AreaHubPageTemplate.tsx`
- `headless/components/area/area-hub-content.tsx`
- `headless/app/globals.css`
- `headless/scripts/check-s10-sakaisujihonmachi-hub.mjs`
- `headless/package.json`
- `pm/PROGRESS.md`

#### 完了したこと
- 堺筋本町Hub専用に「堺筋本町・本町・北浜の使い分け」ガイド設定を追加した。
- `AreaHubLocalGuideSection` を追加し、堺筋本町Hubだけに仕事帰り・出張前後、徒歩圏、料金・営業時間・公式導線の確認ポイントを表示するようにした。
- ページ内ナビと内部リンク枠に `#local-guide` 導線を追加し、Hub内で選び方ガイドへ移動できるようにした。
- S-10専用検査を `npm test` に追加し、堺筋本町専用ガイド設定・表示コンポーネント・アンカー導線を固定した。

#### テスト結果
- RED確認: `npm run test:s10-sakaisujihonmachi-hub` が実装前に `localGuide` 未定義で失敗。
- `npm run test:s10-sakaisujihonmachi-hub`: 成功。
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm test`: 成功。
- `npm run build`: 成功。
- ローカル本番HTTP確認: `http://127.0.0.1:3010/area/sakaisujihonmachi/` で `#local-guide`、`堺筋本町・本町・北浜の使い分け`、`仕事帰り・出張前後`、`料金・営業時間・公式導線` を確認。`/area/nihonbashi/` には堺筋本町専用ガイドが出ないことも確認。
- 補足: build中に既存の `middleware` 非推奨警告、WordPress origin timeout / 404 fallback、既知の `useSearchParams()` bailoutログは出たが、build結果は成功。

#### 未実施
- 本番デプロイ、push、元の `mens-esthe-kuchikomi` フォルダ変更は未実施。

### 2026-07-13 Q-07 FAQ / schema出力条件確認

#### 実行したTask ID
- `Q-07`: FAQ / schema出力条件確認。

#### 変更したファイル
- `headless/components/AreaPageView.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/scripts/check-schema-output-conditions.mjs`
- `pm/PROGRESS.md`

#### 完了したこと
- 通常エリアページで、表示用FAQ行とは別に `faqJsonLd()` の結果を確認し、FAQPage schemaを作れる場合だけJSON-LD scriptを出すようにした。
- 店舗詳細ページでLocalBusiness schemaを `shopSchema` として先に生成し、scriptにはその確定済みオブジェクトだけを渡す形に整理した。
- Q-07専用検査を強化し、空HTMLだけのFAQ、nullになり得るFAQ schemaの直stringify、ACF口コミ件数や編集部コメントからのAggregateRating/Review出力を検出できるようにした。

#### テスト結果
- RED確認: `npm run test:schema-output` が実装前に通常エリアページのFAQ schemaガード不足で失敗。
- `npm run test:schema-output`: 成功。
- `npm test`: 成功。
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm run build`: 成功。
- 生成物確認: `.next/server/app` のHTML/RSC 3,756ファイルを走査し、`FAQPage` 0件、`AggregateRating` 0件、Review schema 0件、口コミなし表示とAggregateRatingの混在0件を確認。
- 補足: build中に既存の `middleware` 非推奨警告、WordPress origin timeout fallback、既知の `useSearchParams()` bailoutログは出たが、build結果は成功。

#### 未実施
- 本番デプロイ、push、元の `mens-esthe-kuchikomi` フォルダ変更は未実施。

### 2026-07-13 Q-06 ダッシュボード・口コミ投稿ページ noindex / canonical 対応

#### 実行したTask ID
- `Q-06`: title / meta / canonical / noindex確認。

#### 変更したファイル
- `headless/lib/seo.ts`
- `headless/app/dashboard/page.tsx`
- `headless/app/dashboard/analytics/layout.tsx`
- `headless/app/reviews/submit/page.tsx`
- `headless/middleware.ts`
- `headless/scripts/check-q06-seo-metadata.mjs`
- `headless/package.json`
- `pm/PROGRESS.md`

#### 完了したこと
- `pageMetadata` で robots 指定を扱えるようにした。
- `/dashboard/`、`/dashboard/analytics/`、`/reviews/submit/` に `noindex, nofollow` と自己 canonical を明示した。
- `/reviews/submit?shop=...` のようなクエリ付き導線でも、canonical は `/reviews/submit/` に統一する設定にした。
- Basic認証でダッシュボードが401になる場合も、`X-Robots-Tag: noindex, nofollow` を返すようにした。
- Q-06専用検査を `npm test` に追加し、再発を検出できるようにした。

#### テスト結果
- RED確認: `npm run test:q06-seo-metadata` が実装前に robots 未保持で失敗。
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm test`: 成功。
- `npm run build`: 成功。
- 生成HTML確認: `.next/server/app/dashboard.html`、`.next/server/app/dashboard/analytics.html`、`.next/server/app/reviews/submit.html` で `meta name="robots" content="noindex, nofollow"` と各ページ自身の canonical を確認。
- 補足: build中に既存の `middleware` 非推奨警告、WordPress origin timeout fallback、既知の `useSearchParams()` bailoutログは出たが、build結果は成功。

#### 未実施
- 本番デプロイ、push、元の `mens-esthe-kuchikomi` フォルダ変更は未実施。

### 2026-07-12 大阪特集エリアカルーセル全幅化

#### 実行したTask ID
- トップページ「大阪の特集エリア」スライダーを、1枚全幅で内容が欠けないカルーセル表示に調整。

#### 変更したファイル
- `headless/components/AreaFeatureSlider.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 完了したこと
- 前後カードの大きなチラ見せをやめ、各スライドをカルーセル幅いっぱいに表示。
- デスクトップ・スマホともに1枚のカードが途中で切れない幅指定へ変更。
- 既存の左右矢印、ドット、無限ループ挙動は維持。

#### テスト結果
- `php -l functions.php` 成功。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` 成功。
- Playwrightでローカル確認。デスクトップ幅・スマホ幅ともにカード幅とトラック幅が一致し、5件すべてに移動可能、最後から先頭へのループも維持していることを確認。

### 2026-07-12 エリア別おすすめランキング管理・表示

#### 実行したTask ID
- エリアページの店舗一覧におすすめランキング1〜5位を表示し、WordPress管理画面からエリア別に順位を指定できるようにする。

#### 変更したファイル
- `functions.php`
- `headless/app/area/[slug]/page.tsx`
- `headless/app/globals.css`
- `headless/components/AreaPageView.tsx`
- `headless/components/ShopCard.tsx`
- `headless/components/area/AreaHubPageTemplate.tsx`
- `headless/components/area/area-hub-content.tsx`
- `headless/components/area/hub/AreaShopList.tsx`
- `headless/components/area/hub/RankingHeroCards.tsx`
- `headless/components/area/hub/ShopCardLuxury.tsx`
- `headless/lib/area-shop-list-controls.ts`
- `headless/lib/area-shop-ranking.ts`
- `headless/lib/wp/area-shop-rankings.ts`
- `pm/PROGRESS.md`

#### 完了したこと
- WordPress管理画面「設定 → エリア別ランキング」を追加。
- 管理画面で各エリアslugごとに、1〜5位の店舗slugを入力できるようにした。
- REST `GET /wp-json/escomi/v1/area-shop-rankings` を追加。
- 手動順位が未設定のエリアでも、おすすめ順の上位5件に1位〜5位バッジを表示。
- ハブテンプレートと通常エリアページの両方で、同じランキングロジックを使うようにした。
- PR店舗には自然ランキング番号を付けない既存方針を維持。

#### テスト結果
- `php -l functions.php` 成功。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` 成功。
- Playwrightでローカル確認。`/area/nihonbashi/` と `/area/osaka/` の店舗一覧に1位〜5位バッジが出ることを確認。

### 2026-07-12 大阪特集エリアスライダー無限ループ化

#### 実行したTask ID
- 緊急UI修正: トップページ「大阪の特集エリア」スライダーの左右矢印を端で停止させず循環させる。

#### 変更したファイル
- `headless/components/AreaFeatureSlider.tsx`
- `pm/PROGRESS.md`

#### 完了したこと
- 左端で左矢印を押すと最後のエリアへ、右端で右矢印を押すと最初のエリアへ戻るように変更。
- 複数エリアがある場合は左右矢印を常時操作可能にし、1件以下の場合だけ無効化するように変更。

#### テスト結果
- `php -l functions.php` 成功。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` 成功。
- Playwrightでトップページを確認。5スライド、左右矢印有効、左端の左矢印で5件目、右端の右矢印で1件目へ戻ることを確認。

### 2026-07-12 トップ検索欄・大阪特集エリア背景画像修正

#### 実行したTask ID
- 緊急UI修正: トップページ検索欄の幅配分改善、女性イラストバナー素材の撤去、街並み写真背景への差し替え。

#### 変更したファイル
- `functions.php`
- `headless/components/AreaFeatureSlider.tsx`
- `headless/app/globals.css`
- `headless/lib/design-constants.ts`
- `headless/lib/osaka-city-images.ts`
- `headless/lib/home-hero-config.ts`
- `headless/lib/home-feature-banner-config.ts`
- `headless/lib/area-title-banner-config.ts`
- `headless/lib/area-hub-banner-config.ts`
- `headless/public/images/home/*`
- `headless/public/images/area-hub/banners/*`
- `headless/public/images/area-hub/characters/*`
- `pm/PROGRESS.md`

#### 完了したこと
- トップページ検索フォームをスマホでも横並びに保ち、入力欄を広く、検索ボタンを86px前後へ抑制。
- 大阪の特集エリアスライダーを、街並み写真をカード全面背景に敷く形式へ変更。
- 黒50%オーバーレイをカード背景側に設定し、文字の可読性を確保。
- 女性イラスト系のローカルバナー画像と参照設定を削除。
- WordPress側のトップ特集エリア初期画像も街並み写真URLへ差し替え。

#### テスト結果
- `php -l functions.php` 成功。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` 成功。
- Playwrightでトップページを確認。スマホ検索欄は入力264px・ボタン86px、旧ローカル画像参照0件、特集カード背景は街並み写真 + 黒50%を確認。

### 2026-07-12 大阪の特集エリア画像付きスライダー・管理画面化

#### 実行したTask ID
- 緊急UI改善: トップページ「大阪の特集エリア」を画像付きスライダー化し、WordPress管理画面から編集可能にする。

#### 変更したファイル
- `functions.php`
- `headless/app/page.tsx`
- `headless/components/HomePageContent.tsx`
- `headless/components/AreaFeatureSection.tsx`
- `headless/components/AreaFeatureSlider.tsx`
- `headless/lib/design-constants.ts`
- `headless/lib/wp/home-featured-areas.ts`
- `headless/app/globals.css`
- `headless/scripts/check-final-design-preservation.mjs`
- `pm/PROGRESS.md`

#### 完了したこと
- WordPress管理画面「設定 → トップ特集エリア」を追加。
- 管理画面から表示ON/OFF、エリアslug、リンク、画像URL、見出し、説明、ボタン文言を編集できるようにした。
- REST `GET /wp-json/escomi/v1/home-featured-areas` を追加。
- Next.jsトップページがRESTから特集エリア設定を取得し、未設定・未反映時は固定5エリアへフォールバックするようにした。
- 「大阪の特集エリア」を画像付きカードスライダーへ変更し、左右矢印・ドット・横スクロール操作を追加。

#### テスト結果
- PHP構文確認: `php -l ../functions.php` 成功。
- ローカルHTML確認: `WordPress` 表記0件、特集画像5件、5エリア表示・順番OK。
- Playwright確認: 画像5件、矢印2個、ドット5個、クリック後にスクロール位置が変化。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` は成功。

### 2026-07-12 大阪の特集エリアカード崩れ緊急修正

#### 実行したTask ID
- 緊急UI修正: トップページ「大阪の特集エリア」カード表示崩れの修正。

#### 変更したファイル
- `headless/components/AreaFeatureSection.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 完了したこと
- 特集エリアカード内の画像バナーをDOMから削除。
- 5分割で細長く崩れていたカード幅を、読みやすい横スライダー用カード幅へ修正。
- ボタンが丸く潰れないよう、通常の横長リンクへ変更。
- PC・スマホとも横スクロールできる構造を維持。

#### テスト結果
- ローカルHTML確認: `WordPress` 表記0件、5エリア表示・順番OK。
- Playwright確認: 特集カード内の画像0件、横スクロール有効、カード幅360px。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` は成功。

### 2026-07-12 大阪の特集エリア本番表示修正

#### 実行したTask ID
- 緊急UI修正: トップページ「大阪の特集エリア」表示。

#### 変更したファイル
- `headless/components/AreaFeatureSection.tsx`
- `headless/lib/design-constants.ts`
- `headless/app/globals.css`
- `headless/components/AreaPageView.tsx`
- `headless/components/AnalyticsDashboard.tsx`
- `pm/PROGRESS.md`

#### 完了したこと
- お客様に見えるトップページ文言から `WordPress` 表記を削除。
- 「重点エリア特集」を「大阪の特集エリア」に変更。
- 堺筋本町、新大阪、日本橋、梅田、堺の5エリアを指定順で表示。
- 特集エリアを横スクロール可能な5枚カード構成に変更。
- WordPress子テーマCSSの既存指定に負けないよう、該当セクションだけカード幅を上書き。

#### テスト結果
- ローカルHTML確認: `WordPress` 表記0件、5エリア表示・順番OK。
- Playwrightスクリーンショット確認: PCは5枚横並び、スマホは横スクロール表示。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`git diff --check` は成功。

### 2026-07-11 Q-00計画修正（公開中ヘッドレスNext.js基準）

#### 実行したTask ID
- `Q-00`: 公開中ヘッドレスサイト品質監査の再定義。

#### 調査結果
- Next.js version: `16.2.6`。
- Router: App Router。
- 公開ルート: `headless/app` 配下。
- WordPress連携: `headless/lib/wp/*` と `headless/app/wp-json/[[...path]]/route.ts`。
- ACF参照: `headless/lib/area-shop-utils.ts`, `headless/lib/shop-ranking.ts`, 各表示コンポーネント。
- metadata/canonical/schema: `headless/lib/seo.ts`, `headless/app/*/page.tsx`, `headless/components/area/AreaHubPageTemplate.tsx`, `headless/components/ShopDetail.tsx`。
- Supabase: `headless/lib/dashboard-config.ts`, `headless/lib/dashboard-supabase.ts`, `dashboard/supabase-dashboard-schema.sql` に参照あり。ただし本体DBとしての実接続は未確認。

#### 変更したファイル
- `docs/seo-audits/q-00-quality-audit-2026-07-10.md`
- `pm/CODEX_TASKS.md`
- `pm/DAILY_PLAN.md`
- `pm/NEXT_ACTIONS.md`
- `pm/BLOCKERS.md`
- `pm/ACCEPTANCE.md`
- `pm/RISKS.md`
- `pm/DECISIONS.md`
- `pm/PROGRESS.md`

#### 完了したこと
- WordPressテーマ改善前提を削除。
- 公開画面の正本をNext.js App Routerとして明記。
- WordPressを一時的なデータ供給元として位置付け。
- P0を `Q-01`〜`Q-07` に再編。
- `Q-10` を廃止し、星評価は `Q-03`、schema条件は `Q-07` へ統合。
- `S-10`〜`S-14`, `S-40` を現行Next.js改善タスクとして再定義。
- 完全移行工程を `MIG-00` から `WP-OFF-01` まで整理。

#### テスト結果
- コード変更はしていないため、lint/typecheck/buildは未実行。
- 実行した確認: `headless/package.json` 確認、`headless/app` route一覧確認、`rg` によるWordPress/Supabase/metadata/schema依存確認。
- 本番DB操作、本番WordPress操作、Supabase操作、Secret表示、デプロイは未実施。

#### 次にやること
- `Q-01`: 地名流用ミス修正。


### 2026-07-11 Q-00 全ページ品質監査（現行WordPress基準）

#### 実行したTask ID
- `Q-00`: 全ページ品質棚卸し。

#### 前提整理
- 現行本番の正は WordPress + SWELL子テーマ。
- `headless/` は将来のWebアプリ化移行先として扱う。
- 今後は「ヘッドレス化」ではなく「Webアプリ化」と表現する。

#### 変更したファイル
- `docs/seo-audits/q-00-quality-audit-2026-07-10.md`
- `pm/CODEX_TASKS.md`
- `pm/ACCEPTANCE.md`
- `pm/NEXT_ACTIONS.md`
- `pm/BLOCKERS.md`
- `pm/RISKS.md`
- `pm/DECISIONS.md`
- `pm/DAILY_PLAN.md`
- `pm/PROGRESS.md`

#### 完了したこと
- 重点5地域と現行WordPressテンプレートを対象に、地名、0円、口コミ/schema、ランキング、PR、title/meta、内部リンク、CTAのリスクを棚卸し。
- P0/P1/P2/P3で優先度分類。
- `Q-01`, `Q-02`, `Q-03`, `Q-10`, `S-10` 以降へタスク分解。
- Webアプリ化タスクを `WEBAPP-*` として現行WordPress修正から分離。

#### 監査結果サマリー
- P0: 5件。0円表示、根拠なし星評価、ランキング根拠/PR分離不足、地名流用候補、CTA計測なし。
- P1: 12件。サブページ未実装、schema不足、title/canonical確認不足、コンテンツ薄さ、内部リンク不足。
- P2: 10件。FAQ/料金/初心者導線、店舗詳細確認日、口コミ募集中表示。
- P3: 6件。週次運用、ダッシュボード、Webアプリ化整備。

#### テスト結果
- コード変更はしていないため、TypeScript/lint/buildは未実行。
- 本番DB操作、本番WordPress操作、Supabase操作、デプロイは未実施。

#### ブロッカー
- WordPress ACF本文の実値確認が必要。
- ランキング根拠、PR表記、口コミ承認基準は人間確認が必要。
- GA4/GSC/SupabaseのSecret・本番設定は未確定。

#### 次にやること
- `Q-01`: 地名流用ミス修正案。
- `Q-02`: 0円・料金未確認表示修正。
- `Q-03`: 根拠なし星評価/ランキング表現修正。
- `Q-10`: schema条件テスト。

### 2026-07-10 Fable final v6 統合 / Week 1 Day 1 SERP snapshot

#### 読み込んだ設計書
- `docs/fable-final/00-master-index-and-integration-policy.md`
- `docs/fable-final/65-codex-task-queue-and-blocker-rules.md`
- `docs/fable-final/64-codex-continuous-execution-system.md`
- `docs/fable-final/73-one-month-seo-sprint-plan.md`
- `docs/fable-final/74-seo-codex-task-backlog.md`
- `docs/fable-final/90-amendments-to-core-docs.md`
- `docs/fable-final/99-final-report-and-next-actions.md`
- SEO補助: `69`, `70`, `71`, `72`, `75`, `76`, `66`

#### 実行したTask ID
- `SETUP-01`: Fable v6成果物を `docs/fable-final/` に展開。
- `S-01`〜`S-05`: 5地域SERP snapshotをread-onlyで作成。
- `TQ-01`: Markdown版 Codex Task Queue MVP を作成。

#### 変更したファイル
- `docs/fable-final/69-five-area-top10-seo-execution-plan.md` ほか v6正本ファイル一式（ZIP展開）
- `docs/fable-final/71-serp-snapshot-2026-07-10.md`
- `docs/escomi-rebuild-integrated-plan-v6.md`
- `pm/CODEX_TASKS.md`
- `pm/DAILY_PLAN.md`
- `pm/BLOCKERS.md`
- `pm/NEXT_ACTIONS.md`
- `pm/ACCEPTANCE.md`
- `pm/DECISIONS.md`
- `pm/RISKS.md`
- `pm/PROGRESS.md`

#### 完了したこと
- `files (2).zip` を `docs/escomi-fable-final-v6-integrated/` に保管展開。
- 内包ZIPを `docs/fable-final/` に上書き展開し、v6正本として 00, 51〜76, 90, 99 が揃っていることを確認。
- 初回スコープの `S-01`〜`S-05` として、堺筋本町、日本橋、新大阪、堺/堺東、梅田のSERP snapshot草案を作成。
- 競合本文・口コミ本文・画像は転載せず、検索結果と公開ページのメタ/構造シグナルのみ記録。
- v6指定の管理ファイルを作成。

#### テスト結果
- アプリコードは変更していないため、TypeScript/lint/buildは未実行。
- read-only検索とドキュメント整備のみ。

#### ブロッカー
- GA4/GSC/SupabaseのSecret・本番設定は未確定。
- ランキング根拠、PR表記、口コミ承認ガイドラインは人間確認が必要。
- 競合サイトの詳細クロールやrobots判断が必要な取得は実施していない。

#### 人間確認が必要なこと
- 日本橋slugを `nihonbashi` のまま扱うか、v6設計通り `nihonbashi-osaka` 相当に分けるか。
- 堺と堺東HubのURL分離方針。
- 自然ランキングの算出根拠。
- PR枠の表記文言。
- エスコミ専用Supabaseプロジェクトの作成方針。

#### 次にやること
- `Q-00`: 全ページ品質棚卸し。
- 欠陥項目: 地名流用、0円表示、title/meta重複、canonical、noindex、schema条件、口コミschema、PR表記条件。

#### KPIへの影響
- 直接の順位改善ではなく、Week 1の判断材料を整備。
- 次タスク `Q-00` / `S-10` の優先順位付けに使用。

### 2026-07-10 Fable final v5 設計ファイル統合

#### 実施内容
- `/Users/narikiyo/Downloads/files (1).zip` を `docs/escomi-fable-final-v5-integrated/` に展開。
- 内包されていた `escomi-fable-final-v5-integrated.zip` も展開し、保管用として `docs/escomi-fable-final-v5-integrated/fable-final/` に保存。
- 設計文書内の正本ルールに合わせ、実装時に参照する正本として `docs/fable-final/` に同じ最終設計ファイルを展開。
- `docs/escomi-rebuild-integrated-plan-v5.md` を追加し、既存の現行資産棚卸しと Fable final v5 設計を統合。

#### 補足
- 今回は設計ファイルの展開と統合のみ。アプリコード、Supabase、本番環境、Secrets、デプロイは変更していない。
- 次の実装候補は `docs/fable-final/00-master-index-and-integration-policy.md` → `65` → `64` → `62` → `90` を読んだ上で、Week 1 の Supabase基盤を additive migration として開始すること。

### 2026-07-05 Dashboard / Vercel統合方針・UI再構築

#### 実施内容
- `/dashboard/` は独立した静的dashboard配信ではなく、`headless` Next.js アプリのVercel配信に統合する方針へ整理。
- `middleware.ts` のBasic認証を `DASHBOARD_BASIC_AUTH_USER` / `DASHBOARD_BASIC_AUTH_PASSWORD` 優先に変更し、既存 `BASIC_AUTH_*` も互換維持。
- `headless/app/dashboard/page.tsx` と `analytics/page.tsx` を管理画面用ヘッダー・フッター構成に変更。
- `AnalyticsDashboard.tsx` にポータル成長の作戦盤、PDCAアクション、AI壁打ちプロンプト欄を追加。
- Supabase未設定時にモック数値を本番値のように見せず、未連携として扱う表示ロジックに変更。
- Tailwind未導入による裸HTML化を解消するため、`globals.css` に `dashboard-app` 配下限定の管理画面CSSを追加。
- `pm/RUNBOOK.md` にDashboard本番反映、認証、Supabase環境変数の標準手順を追加。

#### 補足
- 標準デプロイは GitHub Actions **Deploy Headless to Vercel**。
- `dashboard/` 専用の別Vercel/Cloudflareワークフローは、現時点では標準運用にしない。
- commit `0c1ae84` を `main` へpush。
- GitHub Actions **Deploy Headless to Vercel** run `28716206568` 成功。
- Vercel Production Environment Variables に `DASHBOARD_BASIC_AUTH_USER` / `DASHBOARD_BASIC_AUTH_PASSWORD` を登録。
- 認証情報の控えはローカル `/Users/narikiyo/.config/escomi/dashboard-basic-auth.txt` に保存（リポジトリ外）。
- 認証反映のため GitHub Actions **Deploy Headless to Vercel** run `28716317642` を再実行し成功。
- 本番確認: 未認証 `/dashboard/` は `401`、認証付き `/dashboard/` と `/dashboard/analytics/` は `200`。

### 2026-07-04 Dashboard P2 実装（GA4 + Search Console）

### 2026-07-04 Dashboard / 本番ルーティング整備（P0）

#### 実施内容
- `headless/app/dashboard/page.tsx` をサーバーコンポーネントへ戻すため `"use client"` を削除。
- `new Date()` を含む日付表示を Server Component で扱う構成に変更し、Next の新規ランタイムでの Client-side 時刻描画エラーを解消。
- `https://mens-esthe-kuchikomi.com/dashboard` の 404 調査で、Next 側の最終ビルド阻害要因を潰す変更として `99262e4` を確定。

#### 実施内容
- `dashboard/lib/ga.ts` を拡張し、GA4 CTAイベント（`cta`）集計を追加。モックデータも同時拡張。
- `dashboard/public/api/ga-proxy.php` に `action=cta` を追加し、`eventCount` と `sessions` を受け取って API 連携済みレスポンス整形を追加。
- `dashboard/public/api/search-console-proxy.php` を新規追加し、`keywords / pages / areas` の3アクションで Search Console データ取得を実装。
- `dashboard/public/api/search-console-proxy.php` の `focus` 判定ロジックを整理し、重点5エリアのパス判定を安定化。
- `dashboard/lib/searchConsole.ts` を追加し、Search Console 指標取得・優先エリア定義・改善候補抽出ロジックを実装。
- `dashboard/components/AnalyticsDashboard.tsx` をSearch Console表示・CTA計測・改善提案・重点5エリア指標を含む構成へ拡張。
- `dashboard/components/AreaSeoTable.tsx` / `SearchKeywordTable.tsx` / `ContentGapPanel.tsx` を追加し、重点エリア・キーワード・改善提案を可視化。
- `dashboard/components/WPQuickLinks.tsx` / `dashboard/app/analytics/page.tsx` に Search Console への導線を追加。

#### 補足
- 現在は WP テーマ配下API経由の実データ取得を前提に実装。認証情報未設定時はモックで表示。
- 次アクション: WordPress 側で Search Console サービスアカウント / サイトURL定数を設定し、実取得で数値を再確認。

### 2026-07-04 FileMaker 商材詳細レイアウト作成

#### 実施内容
- FileMaker Pro の `商材詳細` レイアウト上で、提示スクリーンショットに合わせた商材詳細画面を作成
- 既存の上部ナビゲーションは変更せず、本文側に黒ヘッダー、3カラム情報カード、関連トークテンプレート表を配置
- 主要な余白はスクリーンショット比率から換算し、カード間隔・内側余白・表の行高を統一
- レイアウト本文を指定サイズの `1440 x 1169` に合わせて再配置
- フィールド枠、カード幅、表列、フォントサイズを1440幅基準で再調整
- 本文範囲を `左0 / 上75 / 右1440 / 下1244` に合わせて配置
- 関連トークテンプレートは、ポータル化する前提の下部エリアとして再配置
- 重なっていた旧オブジェクトを削除し、固定ナブ相当のロゴ要素と本文105オブジェクトをクリーンなXMLから貼り直し
- 右側にはみ出していた作業用オブジェクトを含めず、全体の選択範囲を `左0 / 上23 / 右1440 / 下1244` に整理

#### 補足
- 現テーブルにない項目（例: ペルソナ、サービス原価、実績一覧）は見た目用のテキスト枠として配置
- 既存フィールドがある項目は `商材管理` テーブルのフィールドとして配置
- 実ポータル化には、関連先のテーブル名またはテーブルオカレンス名の確認が必要

---

### 2026-07-03 WP管理画面プロキシ追加

#### 実施内容
- `headless/lib/wp/origin-request.ts`: `forwardCookies` オプション追加（Cookieヘッダーを上流転送可能に）
- `headless/app/wp-admin/[[...path]]/route.ts` 新規: `/wp-admin/*` をWordPressオリジンにプロキシ（Cookie転送あり）
- `headless/app/wp-login.php/route.ts` 新規: `/wp-login.php` をWordPressオリジンにプロキシ（Cookie転送あり）
- 管理画面・ログインページともキャッシュ無効・検索インデックス除外

#### 追加修正
- `headless/lib/wp/admin-proxy-response.ts` 新規: WP上流が返す `http://mens-esthe-kuchikomi.com` / URLエンコード済みHTTP URLをHTTPSへ正規化
- `/wp-admin/` の末尾スラッシュを上流リクエストで保持し、ログイン画面への302が正しく返るよう修正
- ローカル確認: `/wp-admin/` → `https://mens-esthe-kuchikomi.com/wp-login.php?...` へ302、`/wp-login.php` 内のHTTP混在0件

#### 確認
- `npm run lint` 成功
- `npm run build` 成功（438 routes、`/wp-admin/[[...path]]` `/wp-login.php` が動的ルートとして追加）
- ローカル curl: `/wp-login.php` → 200（ログインフォームHTML返却）、`/wp-admin/` → WPリダイレクト、`/wp-admin/css/login.min.css` → 200

#### 変更ファイル
- `headless/lib/wp/origin-request.ts`
- `headless/app/wp-admin/[[...path]]/route.ts`（新規）
- `headless/app/wp-login.php/route.ts`（新規）

#### 残タスク
- mainへpush → GitHub ActionsでVercel本番反映
- 本番 `https://mens-esthe-kuchikomi.com/wp-admin/` でログイン確認

---

### 2026-06-20 トップページ改善 本番反映

#### 実施内容
- commit `7d9076f` `feat: improve homepage search and area hub links` を main へ push
- GitHub Actions **Deploy Headless to Vercel** run `27870005992` **成功**（1回目Xserver接続タイムアウト → 再実行で成功）
- 本番URL全4件 HTTP 200 確認

#### 本番確認
- `/` — H1 `関西メンズエステ口コミナビ エスコミ`、検索窓、人気チップ7件、ハブカード3枚（日本橋59件・難波8件・梅田59件）、ミニカード、広告枠、安全表現 ✅
- `/area/nihonbashi/` — HTTP 200 ✅
- `/area/nanba/` — HTTP 200 ✅
- `/area/umeda/` — HTTP 200 ✅
- AggregateRating なし、単独 `0円` なし、`本日`/`今すぐ` 表現なし ✅

#### 変更ファイル
- `headless/components/HomePageContent.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 残タスク
- Search Console で `/` のURL検査（インデックス登録再申請）
- `/area/nihonbashi/` `/area/nanba/` `/area/umeda/` も併せて再申請推奨

---

### 2026-06-20 日本橋SEO残タスク整理・梅田ハブ横展開準備

#### 実施内容
- Cursor連携の参照箇所を確認:
  - Codex側: `/Users/narikiyo/.codex/AGENTS.md` は「明示指示がある場合のみCursor」となっている
  - Claude側: `/Users/narikiyo/.claude/CLAUDE.md` と `/Users/narikiyo/.claude/commands/app-development.md` にCursor委譲前提の記述あり
  - source-command skill: `/Users/narikiyo/.agents/skills/source-command-app-development/SKILL.md` はCursor Agent委譲用
- `/area/umeda/` を `HUB_TEMPLATE_AREAS` に追加し、共通エリアハブテンプレートへ横展開
- 梅田用のSEO title / description / H1 / 店舗一覧文言 / FAQ文言 / 関係ラベル判定を追加
- 梅田・難波の areaHero バナー文言を追加（1メッセージ + 1画像構造）
- `/osaka-nihonbashi/` の本文中に `/area/nihonbashi/` への内部リンクを追加
  - `#shop-list`
  - `#ranking`
  - `#price-table`
  - `#late-night`
- 主要20店舗のWordPress補強用下書き作成:
  - `pm/NIHONBASHI-TOP20-WP-DATA-DRAFT.md`
  - 主要20店舗の編集部コメント個別化案
  - WP管理画面で補強すべきACF項目

#### 本番確認
- `/area/nihonbashi/` 本番:
  - HTTP 200
  - `hl-area-hub-page` あり
  - H1: `大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較`
  - `AggregateRating` なし
  - `FAQPage` / `ItemList` あり
  - 単独 `0円` 表示なし（`13,000円` 等への単純一致は除外）
- `/area/nihonbashi/?page=2` / `?page=3`:
  - 旧テンプレートへ戻っていない
  - page別 title / canonical を確認
- `/area/nanba/`:
  - すでに共通ハブ表示
- `/area/umeda/` 本番:
  - 現時点では旧テンプレート。今回の変更を反映後に共通ハブ化予定

#### 口コミ投稿の確認
- 本番 `https://mens-esthe-kuchikomi.com/wp-json/wp/v2/types` に `reviews` type は未表示
- 本番 `https://mens-esthe-kuchikomi.com/wp-json/wp/v2/reviews` は 404
- フロントの口コミ投稿UI/APIは存在するが、本番運用には `reviews-cpt.php` の本番反映と Application Password 環境変数設定が必要

#### 検証
- `cd headless && npm run lint` — 成功
- `cd headless && npm run build` — 成功
- ローカル `localhost:3460` 確認:
  - `/area/umeda/`: 共通ハブ表示、H1・title反映
  - `/area/nanba/`: 共通ハブ表示継続
  - `/osaka-nihonbashi/`: 日本橋ハブへのアンカーリンク増加

#### 今回やっていないこと
- 本番WordPressデータ変更
- Search Console URL検査リクエスト
- commit / push / deploy
- reviews CPT の本番反映
- 主要20店舗の管理画面への直接入力

#### 追加実施（同日）
- commit `de7de18` を `main` へ push
- GitHub Actions **Deploy Headless to Vercel** run `27847143310` 成功
- GitHub Actions **Deploy to Xserver** run `27847227227` 成功
- 本番確認:
  - `/area/umeda/` — 共通ハブ表示、H1/title 反映、単独 `0円` なし、`AggregateRating` なし
  - `/osaka-nihonbashi/` — 日本橋ハブへの本文内アンカーリンク 8件
  - `/area/nihonbashi/` — 共通ハブ表示維持、単独 `0円` なし、`AggregateRating` なし
- Search Console:
  - Chromeで開いたアカウントでは Search Console がプロパティ追加画面になり、既存プロパティが見えない
  - `/area/nihonbashi/` の再申請は未実行。プロパティ権限付与または正しいGoogleアカウントでのログインが必要
- 口コミCPT:
  - Xserver deploy は成功
  - ただし本番 `wp-json/wp/v2/types` に `reviews` は未表示、`wp-json/wp/v2/reviews` は 404
  - Actionsログでは `functions.php` / `reviews-cpt.php` はサーバー上と同一扱い
  - OPcache reset用URLはNext側404に吸われるため直接実行不可
  - 次の確認: XserverファイルマネージャーまたはFTPで `swell_child/functions.php` と `reviews-cpt.php` の実体確認、WP管理画面の有効テーマ確認、パーマリンク保存

### 2026-06-15 Headless 本番デプロイ（Vercel）

#### 実施内容
- commit `9fdfe53` を `main` へ push
- GitHub Actions **Deploy Headless to Vercel** run `27508211807` **成功**（約2m26s）
- 本番 URL: https://mens-esthe-kuchikomi.com/

#### 本番確認
- `/` — 中段 `home-feature-banner` **なし**、エリア特集カードあり
- `/area/nihonbashi/` — `hl-area-hub-page` 反映、HTTP 200
- SEO cutover check CI **合格**

---

### 2026-06-20 01:50
#### 作業
トップページFV・ハブ導線・広告枠の改善

#### 変更内容
- `headless/components/HomePageContent.tsx`: FVに検索窓と人気チップを追加し、画像だけだったH1をSEO安全なテキストH1へ変更
- `headless/components/HomePageContent.tsx`: 日本橋・難波・梅田の注目ハブカードと日本橋注目店舗5件のミニカードを追加
- `headless/components/HomePageContent.tsx`: 下部説明文を「公開情報・店舗データ・投稿口コミ（承認制）・編集部コメント」に基づく安全な表現へ変更
- `headless/components/HomePageContent.tsx`: 広告枠をFV右側からFV直下へ移動
- `headless/app/globals.css`: 検索窓、人気チップ、ハブカード、ミニカード、レスポンシブ広告枠のスタイルを追加

#### 確認
- `npm run lint` 成功
- `npm run build` 成功
- ローカル `http://localhost:3460/` でH1、検索窓、広告枠、ハブカード、ミニカード、安全化説明文の出力を確認

#### 変更ファイル
headless/components/HomePageContent.tsx
headless/app/globals.css
pm/PROGRESS.md
---

### 2026-06-14 areaHero 最終整理（1メッセージ + 1画像）

#### 実施内容
- areaHero を **「1メッセージ + 1画像」** に整理済み
- メッセージ: 「日本橋で自分に合うメンズエステを見つける」（`resolveAreaHeroBanner` / `AREA_HERO_BANNER_OVERRIDES`）
- 採用画像: `hero-champagne-clean-01.webp`（`transparent_05.png` 由来・黒ドレス透過 WebP、quality 91・縦 1200px）
- H1・stats・条件チップ・アンカーナビはバナー外（`area-hub-header`）維持
- `ThemeBanner` 系 props 最小化、`LAYERED_BANNER_TABS` から `beginner` 除外（セクション横バナー OFF 維持）
- `AreaShopList` hydration mismatch 修正: `useState` 初期値をモバイル固定、マウント後に PC/SP へ同期

#### 確認
- PC/SP Playwright: メッセージ・H1・条件チップへの画像被りなし
- 市松模様 / 白四角は見えない状態を確認
- `npm run lint` 成功
- `npm run build`: 初回 WP API タイムアウトで失敗 → 再実行で成功

#### 変更ファイル（headless ローカル試作）
- `headless/public/images/area-hub/characters/hero-champagne-clean-01.webp`（新規）
- `headless/lib/area-hub-banner-config.ts`
- `headless/components/area/hub/AreaShopList.tsx`
- `headless/components/area/AreaHubPageTemplate.tsx`
- `headless/components/area/hub/ThemeBanner.tsx` / `AreaHubThemeBanner.tsx` / `ThemeBannerCharacter.tsx` / `AreaHubHeroBanner.tsx`
- `headless/components/area/area-hub-content.tsx` / `AreaLatestReviews.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 触っていないもの
- commit / push / deploy / 本番データ
- beginner/ranking/reviews/lateNight バナー展開 / SEO 構造化データ / page=2/3 / `PriceLabel` / `RatingBadge` / `ShopScheduleSnapshot`

---

### 2026-06-14 Vercel 本番反映ブロック整理・AI 更新機能の優先度明文化

#### 状況
- commit `f9a7be4`（feat: unify area hub pagination and add safe display components）は **main へ push 済み**
- GitHub Actions **Deploy Headless to Vercel** run `27463201049` が失敗
- 失敗理由: `The token provided via --token argument is not valid.` → **Repository Secret `VERCEL_TOKEN` 無効**
- ローカル Vercel CLI は `Too many requests - try again in 24 hours`（`api-upload-free`）で停止。**復旧は GitHub Actions 経由を最優先**

#### 最優先アクション（人が実施）
1. Vercel Account Settings → Tokens で新トークン発行（例: `github-actions-escomi`）
2. GitHub Repository Secret **`VERCEL_TOKEN`** を更新（**Vercel Project Environment Variables ではない**）
3. Actions → Deploy Headless to Vercel → **Re-run jobs**
4. 本番 URL 確認 → Search Console URL 検査

詳細手順: `pm/RUNBOOK.md` **A-6** / `pm/BLOCKER.md` **BLOCK-006**

#### 本番反映後の確認 URL
- https://escomi-headless.vercel.app/area/nihonbashi/
- https://escomi-headless.vercel.app/area/nihonbashi/?page=2
- https://escomi-headless.vercel.app/area/nihonbashi/?page=3
- （カスタムドメイン）https://mens-esthe-kuchikomi.com/area/nihonbashi/ および `?page=2` / `?page=3`

**確認項目:** page2/3 が旧テンプレに戻らない / title・canonical がページ別 / 0円単独なし / AggregateRating なし（口コミ0件） / 編集部を Review 扱いしない / 本日・今すぐ表現の安全化

#### AI 更新機能の判断（今回は実装しない）
現時点では、AI による店舗情報の**自動更新機能は実装しない**。
理由: Vercel 本番反映未完了 / WordPress 不足 ACF / Supabase 管理画面・AI ジョブ管理テーブル未整備 / 完全自動更新の誤更新リスク。

**実装優先順位（全体）**
1. Vercel 本番反映
2. Search Console / GA4 確認
3. 日本橋ハブ本番表示確認
4. 難波・梅田への横展開
5. WordPress 側不足 ACF 追加
6. reviews CPT
7. area_guides CPT
8. Vercel + Supabase 管理画面 MVP
9. AI 改善提案機能
10. AI 公式サイト差分検知 / 更新候補生成

**将来の AI 機能（Phase 1→3、提案・下書き・チェックまで）**
1. SEO 改善タスク生成 AI
2. 店舗情報品質チェック AI
3. 口コミ審査・要約 AI
4. title / meta description 改善案 AI
5. 記事テーマ提案 AI
6. 記事下書き生成 AI
7. 編集部レビュー下書き AI
8. 公式サイト差分検知 AI

**実装しない方針:** 口コミ・体験談・評価点の自動生成 / ランキング順位の完全自動変更 / 店舗情報の完全自動上書き / 「本日案内可能」の自動表示 / AI 生成記事の完全自動公開。公開・承認・ランキング反映は**人間が最終判断**。

#### 変更ファイル（ドキュメントのみ）
- `pm/RUNBOOK.md`（A-6 復旧手順追加）
- `pm/BLOCKER.md`（BLOCK-006 追加）
- `pm/HEADLESS-CUTOVER-CHECKLIST.md`（§0 復旧リンク）
- `pm/PROGRESS.md`

#### 今回やっていないこと
- AI 更新機能の実装 / Supabase テーブル作成 / WordPress 本番データ変更 / Vercel Token のコード記載 / Secret ログ出力 / deploy・Actions 再実行 / commit・push

---

### 2026-06-13 Headless 表示基盤 Phase 1/2 前半（共通コンポーネント・メタデータ・安全化）

- 既存未コミット草案（`AreaHubPageTemplate` / `area-hub-content` / `AreaShopCard` 系 / `area-shop-utils`）を削除せず統合・完成度向上
- 共通コンポーネント追加: `PriceLabel` / `RatingBadge` / `AreaLatestReviews` / `ShopScheduleSnapshot`
- 料金表示: `resolvePriceDisplay` + `PriceLabel` で 0円/空/null を禁止（available / 要確認 / 公式サイト確認中 / 店舗ページで確認 / 未掲載）
- 評価表示: `resolveRatingDisplay` + `RatingBadge`（口コミ件数あり→口コミ評価、review_star のみ→編集部参考スコア、なし→評価集計中）
- `generateMetadata`: `searchParams.page` 対応。page2/3 は自然な title/description/self canonical（`?page=N`）
- `AreaHubPageTemplate`: page1 に `AreaLatestReviews`（口コミ CPT 未整備時は「口コミ募集中」CTA）、page2 以降も同一テンプレ（ランキング/FAQ 非表示）
- `AreaHubRankingSections`: FAQ 後に店舗カード残骸が出ないよう `#reviews` を `AreaLatestReviews` へ分離
- `areaRelation` 安全化: dispatch / related（梅田・西中島・新大阪・京橋）/ nearby（堺筋本町・本町・心斎橋）/ core・walkable（日本橋・なんば等）/ unknown
- `ShopDetail`: `RatingBadge` + `ShopScheduleSnapshot`（取得日不明時は「最終取得日: 未確認」、本日/今すぐ非表示）
- `ShopAreaHubLinks`: 日本橋店舗から `/area/nihonbashi/` へ具体アンカー（#shop-list / #ranking / #price-table / #station / #reviews）
- 構造化データ: 口コミ0件の AggregateRating 非出力・編集部スコアを Review にしない方針を維持

#### WordPress 編集可否（Headless 表示との役割分担・秘密情報なし）

| 項目 | WP で編集 | Headless 側 | 備考 |
|------|-----------|-------------|------|
| 店舗基本情報（名前・住所・電話・営業時間・料金 ACF） | ✅ | 表示のみ | REST `shop` + ACF |
| 店舗 AI サマリー `shop_ai_summary` | ✅ | 表示のみ | 編集部コメント |
| 出勤分析 `shop_today_analysis` | ✅（AI更新） | `ShopScheduleSnapshot` で安全表示 | 取得日 ACF が無い場合は「未確認」 |
| エリア FAQ `area_faq_content` | ✅ | ハブは `buildFaqItems` 静的（日本橋） | 他エリア展開時に WP 連携検討 |
| エリアランキング `area_ranking_shops` | ✅ | 親エリア設定から子店舗抽出（既存ロジック） | |
| ユーザー口コミ CPT | ❌ 未整備 | `AreaLatestReviews` は CTA のみ | 将来 `review` CPT + REST 化 |
| ハブ UI テンプレ・条件チップ・構造化データ | ❌ | Next コンポーネント | `HUB_TEMPLATE_AREAS` で段階展開 |
| ページネーション title/canonical | ❌ | `generateMetadata` + `resolveAreaHubCanonicalPath` | |

#### 変更ファイル
- `headless/components/common/PriceLabel.tsx`（新規）
- `headless/components/common/RatingBadge.tsx`（新規）
- `headless/components/area/AreaLatestReviews.tsx`（新規）
- `headless/components/shop/ShopScheduleSnapshot.tsx`（新規）
- `headless/lib/area-shop-utils.ts`
- `headless/lib/seo.ts`
- `headless/components/area/AreaHubPageTemplate.tsx`
- `headless/components/area/area-hub-content.tsx`
- `headless/components/common/AreaShopCard.tsx`
- `headless/components/common/AreaShopMiniCard.tsx`
- `headless/components/common/AreaShopTable.tsx`
- `headless/components/common/ShopAreaHubLinks.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/app/area/[slug]/page.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` — 成功
- `cd headless && npm run build` — 成功
- ローカル `127.0.0.1:3456` 確認:
  - `/area/nihonbashi/`: `hl-area-hub-page`、FAQ 後に店舗カード残骸なし、AggregateRating なし、0円単独なし、`口コミ募集中` CTA あり
  - `/area/nihonbashi/?page=2`: 同一テンプレ、title「2ページ目」、canonical `?page=2`、ランキング/FAQ なし
  - `/area/nihonbashi/?page=3`: 同上（3ページ目）
  - `/shops/genie.../`: `rating-badge`・`最終取得日` 表示、本日/今すぐなし、`/area/nihonbashi/` 内部リンクあり

#### 残課題（Phase 2 後半）
- `HUB_TEMPLATE_AREAS` を他エリアへ段階展開
- 口コミ CPT + REST 連携後に `AreaLatestReviews` を実データ表示へ
- 条件チップの JS 絞り込み（現状アンカーのみ）
- `shop_schedule_updated_at` 等の取得日 ACF を WP 側で整備すると出勤表示がより正確に

### 2026-06-13 共通エリアハブテンプレート化 Phase 1

- 日本橋専用ハブを `AreaHubPageTemplate` へリファクタ。`/area/nihonbashi/` の page=1・page=2 以降とも同一テンプレート（page=2 以降はランキング/FAQ 非表示、店舗一覧・ページネーション・条件チップは維持）
- 共通コンポーネント追加: `AreaShopCard` / `AreaShopMiniCard` / `AreaShopTable` / `ShopAreaHubLinks`
- 表示ロジック共通化: `area-shop-utils.ts`（`TargetAreaRelation`、料金0円禁止、口コミ募集中、駅近は徒歩表記時のみ）。`nihonbashi-shop-utils.ts` は互換 re-export
- 条件フィルターチップ（深夜営業・駅近・料金掲載あり・公式サイトあり・初心者向け）をハブ上部に追加（アンカーリンク）
- ランキング/条件別セクションはミニカード・表形式に軽量化（フル RankingCard 繰り返し廃止）
- `ShopDetail`: エリア戻りリンクを `ShopAreaHubLinks` に共通化、`todayAnalysis` の本日/TODAY 文言を安全化
- 既存 `NihonbashiAreaHubPage` / `NihonbashiHubCard` / `nihonbashi-content` は薄い re-export に変更
- CSS: `area-hub-*` / `area-shop-*` / `area-table-*` クラスを `globals.css` に追加

#### 変更ファイル
- `headless/lib/area-shop-utils.ts`（新規）
- `headless/lib/nihonbashi-shop-utils.ts`
- `headless/components/area/AreaHubPageTemplate.tsx`（新規）
- `headless/components/area/area-hub-content.tsx`（新規）
- `headless/components/common/AreaShopCard.tsx`（新規）
- `headless/components/common/AreaShopMiniCard.tsx`（新規）
- `headless/components/common/AreaShopTable.tsx`（新規）
- `headless/components/common/ShopAreaHubLinks.tsx`（新規）
- `headless/app/area/[slug]/page.tsx`
- `headless/components/NihonbashiAreaHubPage.tsx`
- `headless/components/NihonbashiHubCard.tsx`
- `headless/components/nihonbashi-content.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint && npm run build` — 成功
- ローカル `localhost:3456` 確認:
  - `/area/nihonbashi/`: H1・`area-shop-card`・ItemList・FAQPage・AggregateRating なし
  - `/area/nihonbashi/?page=2`: `hl-area-hub-page`（AreaPageView に戻らない）、ランキング/FAQ なし
  - `/area/osaka/`: 日本橋 59件チップ・`/area/nihonbashi/` 導線あり

#### 残課題（Phase 2）
- `HUB_TEMPLATE_AREAS` を他エリアへ段階展開（現状 `nihonbashi` のみ）
- `generateMetadata` の page=2 以降 title/canonical（searchParams 非対応のため page=1 canonical 維持）
- 条件チップの JS 絞り込み（現状アンカーのみ）

### 2026-06-13 エリア選択UIの日本橋ラベルを自然な表示へ修正

- `AreaPageView`: 詳細エリアチップの表示名を WordPress エリア名（`child.name`）に統一
- nihonbashi のみ「大阪日本橋メンズエステ」へ変換していた `childAreaDisplayName` を削除
- PCグリッド・SP横スクロールとも「日本橋 59件」形式に。リンク先 `/area/nihonbashi/` は変更なし
- SEO本文（AreaSeoGuide 等）の表記は今回変更なし

#### 変更ファイル
- `headless/components/AreaPageView.tsx`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint && npm run build`

### 2026-06-13 本番反映: 日本橋SEOハブ実装
- コミット: 5a16b0b feat: make nihonbashi area seo hub
- Vercel deployment: dpl_CHMTvYEbT737KZ5WD2K7nzziwsKb
- Production URL: https://mens-esthe-kuchikomi.com
- /area/nihonbashi/ 本番確認: 200、title/H1反映、first H2=日本橋メンズエステ店舗一覧、BreadcrumbList + ItemList + FAQPage、AggregateRatingなし、単独0円なし、ページネーションリンクあり
- /osaka-nihonbashi/ 本番確認: 選び方ガイドとして title/H1 反映、/area/nihonbashi/ 導線あり
- /area/osaka/ 本番確認: 200、/area/nihonbashi/ 導線あり
- 店舗詳細代表（うさぎのお部屋）本番確認: title反映、直近の出勤・空き状況、AggregateRatingなし、本日の出勤/TODAYなし、/area/nihonbashi/ 内部リンクあり
- seo:cutover-check: すべて合格（主要ページ、canonical/noindex、GA4、sitemap 425 URLs、404）
- perf:check: すべて合格（/area/nihonbashi/ TTFB 52ms、total 1525ms、493.5KB）

### 2026-06-13 複数拠点住所の日本橋徒歩圏判定を優先するよう改善

- `nihonbashi-shop-utils`: 梅田・本町等のNEARBYワードより、日本橋駅徒歩・近鉄日本橋・黒門・千日前・なんば等のコア指標を優先
- `classifyNihonbashiLocation` / `resolveNihonbashiRelation` / `shopNearestStation` を同一優先順位で整理

#### 変更ファイル
- `headless/lib/nihonbashi-shop-utils.ts`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint && npm run build`

### 2026-06-13 ACF画像候補を店舗画像へ反映、/area/nihonbashi/ページネーション操作性を改善

- `normalizeShop`: アイキャッチ最優先 → ACF画像フィールド（shop_image 等）次点 → 空文字（コンポーネント側で DEFAULT_SHOP_IMAGE）
- ACF画像値は string URL / `{ url }` / `{ source_url }` / `{ sizes }` 形式に対応。数値IDは無視
- `/wp-content/` パスは `normalizeImageUrl` を通す
- ページネーションCSSを `.hl-nihonbashi-hub-page` にも適用。a.page-numbers のクリック領域を明確化

#### 変更ファイル
- `headless/lib/wp/normalize.ts`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint && npm run build`

### 2026-06-13 SEOハブ変更: /area/nihonbashi/ 本命化

- 本命SEOハブを `/area/nihonbashi/`（page=1）へ移行。`NihonbashiAreaHubPage` で店舗一覧→ランキング→比較→FAQの構成を実装
- `/osaka-nihonbashi/` を選び方ガイド（`NihonbashiGuidePage`）へ役割変更。上位5件の簡易紹介のみ
- 日本橋ハブ用 `NihonbashiHubCard` 追加（エリア関係・料金・口コミ・編集部コメント短縮版等）
- 構造化データ: BreadcrumbList + ItemList + FAQPage（Review/AggregateRating なし）
- 内部リンク: `AREA_FEATURE`・`AreaSeoGuide`・`ShopDetail` を `/area/nihonbashi/` へ集約
- 店舗詳細: 日本橋店舗のメタタイトル変更、編集部参考スコア（review_star なしは非表示）、出勤表現を「直近の出勤・空き状況」へ

#### 変更ファイル
- `headless/components/NihonbashiAreaHubPage.tsx`（新規）
- `headless/components/NihonbashiGuidePage.tsx`（新規）
- `headless/components/NihonbashiHubCard.tsx`（新規）
- `headless/components/nihonbashi-content.tsx`（新規）
- `headless/components/NihonbashiSeoPage.tsx`（削除）
- `headless/lib/nihonbashi-shop-utils.ts`
- `headless/lib/seo.ts`
- `headless/lib/design-constants.ts`
- `headless/lib/static-pages.ts`
- `headless/app/area/[slug]/page.tsx`
- `headless/app/[slug]/page.tsx`
- `headless/app/shops/[slug]/page.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/components/AreaSeoGuide.tsx`
- `headless/components/HomePageContent.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証予定
- `cd headless && npm run lint` / `npm run build`
- `/area/nihonbashi/` の H1・店舗一覧・ランキング・アンカー・構造化データ
- `/osaka-nihonbashi/` のガイド内容とハブへのCTA
- 日本橋店舗詳細の内部リンク・編集部参考スコア表示

### 2026-06-13 修正: WP画像プロキシ日本語パス対応・料金ACF取得改善

- `/wp-content` プロキシ: origin へ渡すパスをセグメント単位で URL エンコード（既存 `%XX` は decode→encode で二重エンコード回避）
- `normalizeImageUrl`: `/wp-content/...` 正規化後、日本語等は `encodeURI` でブラウザ向けパスに変換
- `featuredImage`: `featured_media=0` の店舗は空文字 → `DEFAULT_SHOP_IMAGE` を使用
- `ShopCard`: `extractShopPriceYen` で複数 ACF 料金フィールドから最初の正の金額を表示（0円は非表示）

#### 変更ファイル
- `headless/lib/wp/path-encoding.ts`（新規）
- `headless/app/wp-content/[...path]/route.ts`
- `headless/lib/wp/normalize.ts`
- `headless/lib/nihonbashi-shop-utils.ts`
- `headless/components/ShopCard.tsx`
- `pm/PROGRESS.md`

#### 検証予定
- `cd headless && npm run lint` / `npm run build`
- 本番 `/area/nihonbashi/` で日本語ファイル名アイキャッチの表示確認
- 料金未設定店舗の compact「店舗ページで確認」・featured_media=0 のデフォルト画像

#### 本番反映
- commit `a86d7c6`
- Vercel production deployment `dpl_486KbBp5u9aR67gzJQzTBtzQcs1r` → https://mens-esthe-kuchikomi.com に反映済み
- 本番確認: `/wp-content/uploads/images/...うさぎのお部屋.jpg` と `...神の領域.jpg` が 200 `image/jpeg`
- 本番確認: 日本橋ページ2で神の領域 32,500円・俺の家 日本橋店 13,000円確認、0円表示なし
- 本番確認: ページネーション確認済み
- 本番確認: `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` → 全合格
- 本番確認: `npm run perf:check -- https://mens-esthe-kuchikomi.com` → 全合格

### 2026-06-13 SEO強化: 日本橋親ページLP化 Phase 1

- `/osaka-nihonbashi/` を Next 専用コンポーネント `NihonbashiSeoPage` で表示（WP固定ページより優先）
- ランキング・料金比較表・深夜営業・初心者向け・駅近・口コミ方針・FAQ・選び方ガイドを実装
- FAQPage / BreadcrumbList 構造化データを追加（Review/AggregateRating は未使用）
- トップ AREA_FEATURE を `/osaka-nihonbashi/` へリンク、大阪エリア SEO ガイドに内部リンク追加
- 日本橋店舗詳細に関連ページリンクボックス追加、ShopCard の 0円表示を解消
- Hello world! コラムを非表示、代替静的ガイドリンクを追加

#### 変更ファイル
- `headless/components/NihonbashiSeoPage.tsx`（新規）
- `headless/lib/nihonbashi-shop-utils.ts`（新規）
- `headless/app/[slug]/page.tsx`
- `headless/lib/static-pages.ts`
- `headless/lib/design-constants.ts`
- `headless/components/AreaFeatureSection.tsx`
- `headless/components/AreaPageView.tsx`
- `headless/components/AreaSeoGuide.tsx`
- `headless/components/ShopCard.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/components/HomePageContent.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` → 成功
- `cd headless && npm run build` → 成功
- ローカル `:3035` で `/osaka-nihonbashi/`・`/`・`/area/osaka/`・`/area/nihonbashi/`・`/shops/genie/` を確認済み
- ページネーションリンク（`?page=2` 等）確認済み
- 空料金の「店舗ページで確認」表示確認済み

#### 本番反映
- commit `e454673`
- Vercel production deployment `dpl_9j1AN3TKtz7cc7ey8G5yuHQ3LfJ9` → https://mens-esthe-kuchikomi.com に反映済み
- 本番確認: `/osaka-nihonbashi/`・`/`・`/area/osaka/`・`/area/nihonbashi/`・`/shops/genie/` の主要確認が全て OK
- 本番確認: `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` → 成功
- 本番確認: `npm run perf:check -- https://mens-esthe-kuchikomi.com` → 成功

### 2026-06-13 修正: エリアページネーション・店舗画像URL正規化

- エリアページのページネーションを `Link` 化し、`searchParams.page` で WP REST の `page` パラメータと連動
- `getAreaShops(areaId, page)` が `per_page=24` + 総ページ数を返すよう変更
- `normalizeImageUrl` で本番ドメインの `http/https` 画像URLを `/wp-content/...` に正規化
- 2ページ目以降も SEO ガイド用に1ページ目の店舗データを別途取得

#### 変更ファイル
- `headless/components/Pagination.tsx`
- `headless/components/AreaPageView.tsx`
- `headless/app/area/[slug]/page.tsx`
- `headless/lib/wp/areas.ts`
- `headless/lib/wp/normalize.ts`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` → 成功
- `cd headless && npm run build` → 成功（AreaPage を Suspense 分割して PPR ビルドエラー解消）
- ローカル `:3035/area/nihonbashi/` → `href="/area/nihonbashi/?page=2"` 等の Link 確認
- ローカル `:3035/area/nihonbashi/?page=3` → 200、Sanando / ゆだねて / DSP の src が `/wp-content/uploads/...`
- 1ページ目の画像なし店舗は `/shop-default-image.webp` のまま（default 7件 / uploads 18件）

#### 本番反映
- 本番反映: Vercel deployment `dpl_7zG367YQC53fYP75vQE9LP6KqhCm` / https://mens-esthe-kuchikomi.com に alias 済み
- 本番確認: `/area/nihonbashi/` で page=2/page=3 のリンク確認
- 本番確認: `/area/nihonbashi/?page=3` で Sanando / ゆだねて の店舗画像が `/wp-content/uploads/...` で表示されることを確認
- 本番確認: 画像なし店舗は `/shop-default-image.webp` のまま
- 本番確認: `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` 成功
- 本番確認: `npm run perf:check -- https://mens-esthe-kuchikomi.com` 成功

### 2026-06-13 UI微調整: エリア特集カード高さ圧縮

- AREA FEATURE カード: PC は `height: 320px` / `max-height: 340px` で縦サイズを抑制し、画像は `object-fit: cover` でトリミング
- PC 本文 padding・要素間余白を前回より詰めつつ `justify-content: center` で縦中央寄せ
- SP 画像高さを 180px に抑え、本文 padding を 18px に調整
- 金色枠・横並びレイアウト・他コンポーネントは変更なし

#### 本番反映
- Vercel production deployment `dpl_5hYBr4tsHWHG8ee5k1g85fZPXfK5` → https://mens-esthe-kuchikomi.com に反映済み

#### 変更ファイル
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` → 成功
- `cd headless && npm run build` → 成功
- SP画像高さ180pxに再調整（`front-page.css` の 200px 上書きを `!important` で打ち消し）
- ローカル `next start` 3035 + Playwright でトップ PC/SP を確認
- PC itemHeight 320 / imageHeight 318 / 横スクロールなし
- SP imageHeight 180 / 横スクロールなし
- スクリーンショット: `/tmp/escomi-area-feature-compact2-desktop.png` `/tmp/escomi-area-feature-compact2-mobile.png`
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` → 成功
- `npm run perf:check -- https://mens-esthe-kuchikomi.com` → 成功

### 2026-06-13 UI修正: エリア特集余白・店舗デフォルト画像

- AREA FEATURE カード: PC の `max-height: 280px` 固定を解除し、本文 padding・要素間余白を拡大（金色枠・横並びレイアウトは維持）
- SP 縦並び時も画像下〜本文上の余白を `globals.css` で調整
- 店舗画像未設定時のフォールバックを `DEFAULT_SHOP_IMAGE`（`/shop-default-image.webp`）に統一
- `headless/public/shop-default-image.webp` を追加（元 PNG 1536px → 800px WebP 約 33KB）
- `ShopCard`（compact / 通常 / 新着）・`ShopDetail` で共通定数を使用。新着カードは No Image 文言ではなくデフォルト画像 + NEW バッジ

#### 本番反映
- Vercel production deployment `dpl_EocDtXjJhtKTmmkzEZKs84fsLxXs` → https://mens-esthe-kuchikomi.com に反映済み

#### 変更ファイル
- `headless/public/shop-default-image.webp`（新規）
- `headless/lib/design-constants.ts`
- `headless/components/ShopCard.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/app/globals.css`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` → 成功
- `cd headless && npm run build` → 成功
- ビルド出力のトップページ HTML で画像なし新着店舗に `/shop-default-image.webp` を確認
- ローカル `next start` 3033 で Playwright 確認済み
- トップ PC/SP で AREA FEATURE の余白と横スクロールなしを確認
- トップ新着店舗で `/shop-default-image.webp` が6件表示
- 日本橋一覧で compact 画像なし店舗に `/shop-default-image.webp` が7件表示
- 画像なし店舗詳細（`/shops/アテナ/`）で詳細メイン画像に `/shop-default-image.webp` が表示された
- スクリーンショット: `/tmp/escomi-ui-fix-home-desktop.png` `/tmp/escomi-ui-fix-home-mobile.png` `/tmp/escomi-ui-fix-nihonbashi-list.png` `/tmp/escomi-ui-fix-shop-detail-default.png`
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` → 成功
- `npm run perf:check -- https://mens-esthe-kuchikomi.com` → 成功
- 本番 `https://mens-esthe-kuchikomi.com/shop-default-image.webp` → 200 / image/webp / content-length 33688
- 本番トップで `/shop-default-image.webp` 12件
- 本番日本橋一覧で `/shop-default-image.webp` 14件検出

---

### 2026-06-13 SEO強化 Phase 1 エリアSEOガイド基盤

- headless 側にエリアページ共通の SEO ガイド基盤を追加（店舗一覧直後、`area_column_content` 前）
- `buildAreaSeoModel`: 店舗数・駅キーワード・深夜営業/出張件数・代表店舗リンクを店舗データから生成
- `AreaSeoGuide`: アクセス/営業時間/比較ポイントの3カード + 代表店舗内部リンク（最大5件）。`dangerouslySetInnerHTML` 不使用
- 日本橋（`slug=nihonbashi`）は駅名・なんば/谷町九丁目方面・深夜帯などを自然に含む専用コピー
- metadata description fallback を検索意図（駅近・営業時間・料金・口コミ・予約）入りに改善

#### 本番反映
- Vercel production deployment `dpl_GGbeRaSyMx5UcXQrHfiUNNjxBNVR` → https://mens-esthe-kuchikomi.com に反映済み

#### 変更ファイル
- `headless/lib/area-seo.ts`（新規）
- `headless/components/AreaSeoGuide.tsx`（新規）
- `headless/components/AreaPageView.tsx`
- `headless/app/globals.css`
- `headless/app/area/[slug]/page.tsx`
- `pm/PROGRESS.md`

#### 検証
- `cd headless && npm run lint` → 成功
- `cd headless && npm run build` → 成功
- Playwright: `/area/nihonbashi/` `/area/osaka/` の desktop/mobile → 横スクロールなし・ガイド表示 OK
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` → 成功
- `npm run perf:check -- https://mens-esthe-kuchikomi.com` → 成功
- 本番 `/area/nihonbashi/` HTML に以下を確認:
  - 「日本橋でメンズエステを探すポイント」
  - 「日本橋駅・谷町九丁目駅・難波駅」
  - 「深夜帯の営業時間が確認できる店舗が24件」

#### 次タスク
- 店舗詳細の構造化データ（LocalBusiness / FAQ 等）強化
- エリア本文の ACF 連携・手動コピーとの役割分担整理
- 内部リンク（関連エリア・関連店舗）の追加強化

---

### 2026-06-13 Search Console 初期反映

- sitemap.xml を Search Console に送信済み
- URL検査でトップ、`/area/osaka/`、`/area/nihonbashi/`、`/shops/` をインデックス登録リクエスト済み
- robots.txt / sitemap.xml / canonical / noindex / GA4 / sitemap内店舗URLサンプルの事前チェックは合格済み
- 次タスク: SEO強化（エリア本文増強、構造化データ強化、内部リンク強化、title/description改善）

#### 変更ファイル
- `pm/PROGRESS.md`

---

### 2026-06-13 app-development Phase 1-3（WP revalidate 通知 + CSS 余白基盤）

- POST先 revalidate URL を末尾スラッシュ付き（`/api/revalidate/`）へ正規化し、308 リダイレクトを回避

#### 要件 A: WordPress 更新 → Next 即時反映
- `functions.php` に `escomi_headless_*` で revalidate 通知を追加
- フック: `save_post_shop/post/page`, `trashed_post`, `deleted_post`, `edited_area`, `created_area`, `delete_area`
- autosave / revision 除外、20 秒 transient throttle、shutdown で非同期送信
- `wp_remote_post` は `blocking => false` / `timeout => 0.1` の fire-and-forget とし、WP 保存画面を待たせない設計
- レビュー時に重複していた revalidate ブロックを削除し、フック登録は1セットのみに整理
- secret 取得順: `ESCOMI_REVALIDATE_SECRET` 定数 → 環境変数 → option `escomi_revalidate_secret`
- `pm/RUNBOOK.md` A-5、`pm/HEADLESS-CUTOVER-CHECKLIST.md` §14 に設定・テスト手順を追記

#### 要件 B: CSS / コンポーネント余白基盤
- `headless/app/globals.css`: デザイントークン（container / gutter / section gap / radius / shadow / 色系）と `.hl-page-inner` `.hl-section` `.hl-surface` `.hl-stack` `.hl-cluster` を追加
- 既存色 `--mep-navy` `--es-gold` `--es-turquoise` は維持
- `AreaPageView` / `ShopDetail` / `ShopContactCta` / `WpStaticPage` / `shops/page` に最小限 `hl-*` クラス適用
- スマホ向け overflow-wrap / gutter 縮小を追加

#### 検証
- `npm run lint` 成功
- `npm run build` 成功（Next.js 16.2.6 / Cache Components 有効 / 435 routes）
- `php -l functions.php` 成功
- ローカル `http://127.0.0.1:3030` で `/` `/area/nihonbashi/` `/shops/` `/about/` → 200
- Playwright で desktop/mobile の `/` `/area/nihonbashi/` `/shops/` `/shops/genie.../` `/about/` を確認。ページ全体の横スクロールなし（スマホのエリアチップ横スクロールは意図したUI）
- 本番 `GET /api/revalidate?tag=wp`（secret なし）→ `401 Invalid secret`（`REVALIDATE_SECRET` 設定済みを確認）
- ローカル同 API → 同上（secret 必須環境）。WP 連携の E2E は `wp-config.php` 設定後に実施

#### 変更ファイル
- `functions.php`
- `headless/app/globals.css`
- `headless/components/AreaPageView.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/components/ShopContactCta.tsx`
- `headless/components/WpStaticPage.tsx`
- `headless/app/shops/page.tsx`
- `pm/RUNBOOK.md`
- `pm/HEADLESS-CUTOVER-CHECKLIST.md`
- `pm/PROGRESS.md`

#### 懸念・本番作業
- `wp-config.php` への `ESCOMI_REVALIDATE_SECRET` 登録は人手（RUNBOOK C / A-5）
- secret 未設定時は Next 側 `REVALIDATE_SECRET` も空なら revalidate は通るが、本番では両方設定推奨
- 初回 push 後の Xserver Action は FTP 425 で失敗。`deploy.yml` を安全化（`dangerous-clean-slate: false`、不要フォルダ除外、headless/pm 等のみの変更ではXserver deployを走らせない）して再実行対象にした
- 安全化後に Xserver workflow を手動実行し成功（run `27428443734`）。`functions.php` は本番 WordPress 側へ反映済み

---

### 2026-06-12 本番反映（遷移空画面対策・店舗slug 404修正）

- main に `118b7d1`（遷移空画面対策）・`565c7c5`（店舗slug 404修正）を push 済み
- Vercel CLI `vercel deploy --prebuilt --prod --yes --archive=tgz` で本番 `https://mens-esthe-kuchikomi.com` に反映
- 本番確認: `/area/nihonbashi/` 200、空 fallback 未検出、`/shops/genie.../` と `/shops/zenith-spa.../` 200
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` 合格、`npm run perf:check -- https://mens-esthe-kuchikomi.com` 合格
- 残課題: GitHub Actions Headless は VERCEL_TOKEN 無効 / Xserver は今回 FTP timeout（WP 側変更なし・Next 本番表示への影響なし）

---

### 2026-06-12 店舗詳細の日本語slug 404修正

- `getShopBySlug`: Next params（URLデコード済み）と WP REST `shop.slug`（percent-encoded）の不一致で404になる問題を修正
- 直接 slug クエリは複数バリアント（encode / 生値）を試行し、失敗時は search → 一覧で `decodeURIComponent` 正規化後の完全一致フォールバック
- `cacheTag` を `shop:h:{sha256先頭16}` に短縮（256文字制限対策）
- 対象: `headless/lib/wp/shops.ts`

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル `http://127.0.0.1:3025` で `/shops/genie%ef%bc%88.../`・`/shops/genie/`・zenith-spa エンコード slug → 200
- `npm run seo:cutover-check -- http://127.0.0.1:3025` の sitemap 店舗サンプルは本番 URL を叩くため未反映時は 404（コード側はローカルで確認済み）

---

### 2026-06-12 Headless 遷移中の空画面抑制

- 空の Suspense fallback（`<main class="..."></main>` のみ）を削除
- `area/[slug]` / `shops/[slug]` / `[slug]` / `column/[slug]` は `generateStaticParams` + async default export に変更（Suspense 不要化）
- `/shops/` のみ `searchParams` 都合で Suspense を維持し、`RoutePageFallback`（min-height 確保）に差し替え
- 目的: 画面遷移時にヘッダー＋フッターだけの一瞬の空白を出さない

#### 検証
- `npm run lint` 成功
- `npm run build` 成功（Cache Components 有効）
- ローカル `http://127.0.0.1:3023` で `/area/nihonbashi/` `/shops/` `/shops/genie/` `/about/` → 200
- curl HTML: 空の `<main class="l-main_content l-article"></main>` 系 fallback は未検出

---

### 2026-06-12 GitHub Actions Headless デプロイ（Vercel scope 固定を外した）

- `.github/workflows/deploy-headless.yml` から `VERCEL_SCOPE` 依存を削除（`vercel pull` / `vercel build` / `vercel deploy` は `.vercel/project.json` の orgId/projectId のみ使用）
- 原因: `scope-not-accessible`（run `27417847473`）

---

### 2026-06-12 店舗詳細CTAの細エリア導線を修正

- `shop.areaSlug` を最優先し、WP REST `_embed` で parent 欠落時も細エリア（例: 日本橋）へ CTA・エリア導線を向ける
- 対象: `shop-contact.ts` / `ShopDetail.tsx` / `shops/[slug]/page.tsx` / `seo.ts`（`areaServed`）

---

### 2026-06-12 Headless 回遊・CV改善（実装完了）

- `/shops/` を `searchParams` 対応（`q` / `area` / `available`）。GET フォームで URL に条件を保持
- WP API から最大500件をページング取得・キャッシュし、サーバー側で絞り込み（`getAllShopsForListing` + `shop-filter`）
- `AreaQuickLinks` を `/shops/` と店舗詳細下部に追加（`es-area-link-item` 系、`/area/[slug]/` リンク）
- 店舗詳細に「予約・問い合わせ」CTA パネルとモバイル固定 CTA バー（tel / LINE / 公式）を追加
- `headless/app/globals.css` にフィルター・結果表示・固定 CTA 用スタイルを追加

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル `http://127.0.0.1:3022` で `npm run seo:cutover-check` 全合格
- ローカル `http://127.0.0.1:3022` で `npm run perf:check` 全合格（キャッシュ後 `/shops/` total 約48ms）
- Playwright確認: `/shops/?q=genie` で検索フォーム・結果1件・genie表示OK
- Playwright確認: genie店舗詳細で CONTACT が「日本橋エリア」、`/shops/?area=nihonbashi` 導線、モバイル固定CTA表示OK
- スクリーンショット: `/tmp/escomi-shops-filter.png`, `/tmp/escomi-shop-detail-desktop.png`, `/tmp/escomi-shop-detail-mobile.png`

---

### 2026-06-12 Headless 速度・運用品質改善（実装完了）

- `/wp-content/[...path]` の cache-control をパス種別ごとに最適化（uploads=1年 immutable / theme CSS・JS=短ブラウザ+長CDN+SWR / その他 wp-content も CDN 向け SWR）
- 画像読み込み属性を最適化（ヘッダーロゴは `loading="eager"`、LCP 候補（トップロゴ・コラム詳細アイキャッチ等）は `fetchPriority="high"`、一覧・特集・詳細は `loading`/`decoding`/寸法）
- `headless/scripts/performance-check.mjs` と `npm run perf:check` を追加（主要ページ・CSS・WP JSON の status/TTFB/サイズ閾値チェック）

#### 検証
- `npm run lint` 成功
- `npm run build` 成功
- ローカル本番 `http://127.0.0.1:3021` で `npm run seo:cutover-check` 全合格
- `npm run perf:check` 全合格
- CSS cache-control: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`
- uploads 画像 cache-control: `public, max-age=31536000, s-maxage=31536000, immutable`

#### 本番反映
- commit `969a283` を `main` に push 済み
- GitHub Actions: Deploy Headless to Vercel run `27408389607` 成功、Deploy to Xserver run `27408389612` 成功
- 本番 `https://mens-esthe-kuchikomi.com` で `npm run seo:cutover-check` 全合格
- `npm run perf:check` 全合格
- CSS と uploads 画像で `x-vercel-cache: HIT` を確認

---

### 2026-06-12 Headless DNS cutover 完了

- MX: 優先度 0 `sv16727.xserver.jp` に反映済み
- A レコード: `mens-esthe-kuchikomi.com` / `www` / wildcard → `76.76.21.21` に反映済み
- Vercel certs issue: `mens-esthe-kuchikomi.com` と `www` の証明書を発行済み
- `https://mens-esthe-kuchikomi.com` → HTTP/2 200、`/wp-json`・`/wp-content` → 200
- `npm run seo:cutover-check -- https://mens-esthe-kuchikomi.com` 全合格
- 次: Search Console で sitemap 送信と URL 検査

---

### 2026-06-12 Headless origin proxy 本番反映完了

- commit `2260655` を `main` に push 済み
- GitHub Actions: Deploy Headless to Vercel run `27403883247` 成功、Deploy to Xserver run `27403883246` 成功
- `https://escomi-headless.vercel.app` で `/wp-json`・`/wp-content`・SEO cutover check が成功
- DNS はまだ Xserver のまま（A=`85.131.213.108` / MX=`mens-esthe-kuchikomi.com`）。次は MX を `sv16727.xserver.jp` に変更してから A を Vercel へ切り替える

---

### 2026-06-12 Headless WP origin proxy（DNS 切替前）

- DNS 切替後も WP REST API / wp-content が壊れないよう、headless に origin proxy を実装
- Node fetch では `Host` ヘッダーが効かないため、origin proxy は `node:http` で中継（`lib/wp/origin-request.ts`）
- サーバー fetch: `WP_API_BASE_URL` 既定を `http://85.131.213.108/wp-json`、`WP_ORIGIN_HOST` で `Host` ヘッダー付与（`lib/wp/client.ts`）
- Route Handler: `/wp-content/[...path]` / `/wp-json/[[...path]]` → Xserver origin へプロキシ
- 表示用画像・CSS を `/wp-content/...` 相対 URL に変更（JSON-LD logo 等の canonical 絶対 URL は維持）
- テーマ CSS は Turbopack が `@import` の root 相対 URL を解決できないため `layout.tsx` の `<link href="/wp-content/...">` で読み込み
- `.env.example` に `WP_API_BASE_URL` / `WP_ORIGIN_HOST` を追記、`HEADLESS-CUTOVER-CHECKLIST.md` §1 を更新

---

### 2026-06-12 Headless Vercel CI SEOチェックURL固定

- Vercel deploy は成功したが、SEO check が DNS 未切替の `mens-esthe-kuchikomi.com` を見て失敗した
- GitHub Repository Variable `HEADLESS_CI_CHECK_URL` で `https://escomi-headless.vercel.app` を指定済み
- workflow は `HEADLESS_CI_CHECK_URL` を優先し、未設定時のみ deploy output URL を使う
- DNS 切替後はこの variable を本番ドメインへ変更または削除してもよい

---

### 2026-06-12 Headless Vercel CI workflow 修正（GitHub secrets 経由 SMTP）

- Vercel pull だけでは GitHub Actions 内の SMTP チェックに機密 env が渡らず失敗した
- GitHub Repository Secrets に SMTP/CONTACT 系の値を登録済み
- workflow の contact:check-env ステップへ secrets を env として渡すよう修正
- 検証予定: `npm run contact:check-env` / `npm run lint` / `npm run build` / main push 後の GitHub Actions 確認

---

### 2026-06-12 Headless Vercel CI workflow 修正（env 同期）

#### 失敗原因（run 27400076147）
- `vercel pull` は `.env.local` ではなく `.vercel/.env.production.local` を生成する（Vercel CLI 54.x）。
- `contact:check-env` は `.env` / `.env.local` のみ読むため、CI で SMTP 6 件すべて「未設定」で exit 1。

#### 修正
- `deploy-headless.yml`: `vercel pull` 直後に `.vercel/.env.production.local` → `.env.local` をコピー（`.env.local` は gitignore のまま）。どちらも無く `.env` も無い場合は日本語エラーで停止。

#### 検証
- ローカル: `npm run lint` / `npm run build` / `npm run contact:check-env`（headless/）
- GitHub Actions 再実行で green 確認（secrets/variables 登録済み前提）

---

### 2026-06-12 Headless Vercel CI workflow 修正

#### 内容
- `check-contact-env.mjs`: `.env` → `.env.local` の順で読み込み（後者優先）。読み込み前から存在した process.env は上書きしない。`SMTP_PASS` は引き続きマスク表示。
- `deploy-headless.yml`: `lint` → Vercel CLI install → link → `vercel pull --scope` → `npm run build` → `contact:check-env` → `vercel build` → `vercel deploy` → SEO check の順に整理。非対話 CI 向け `--scope`（既定 `narikiyos-projects`）と `--yes` を付与。デプロイ URL は CLI 出力の最後の https を抽出、空なら日本語エラー。
- `HEADLESS-CUTOVER-CHECKLIST.md` §0 の workflow 手順を上記順序に合わせて更新。

#### 検証（ローカル）
- `npm run lint` / `npm run build` / `npm run contact:check-env`（headless/）

#### 残課題
- GitHub secrets/variables 登録後、workflow 初回実行で green を確認。
- DNS A レコード切替 → 本番ドメインで §8 再チェック。

---

### 2026-06-12 Headless Vercel GitHub Actions CI/CD

#### 内容
- `.github/workflows/deploy-headless.yml` 新規: `main` へ `headless/**` 変更 push 時および `workflow_dispatch` で Vercel 本番（`escomi-headless`）へデプロイ。
- Node 24、`npm ci` → `lint` → Vercel pull → `build` → `contact:check-env` → Vercel prebuilt deploy。デプロイ URL に `npm run seo:cutover-check`。
- `VERCEL_TOKEN`（secret）と `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID`（variables または secrets）未設定時は日本語エラーで停止。
- `pm/HEADLESS-CUTOVER-CHECKLIST.md` §0 に GitHub 設定値と DNS 手動切替の注意を追記。
- 既存 `deploy.yml`（Xserver FTP / WP テーマ）は未変更。

#### GitHub 登録（運用者）
- Secret: `VERCEL_TOKEN`
- Variable（推奨）: `VERCEL_ORG_ID=team_WBpmGGwLZPtutzOCsGN2lluQ`, `VERCEL_PROJECT_ID=prj_lgQwu8WqzjHvKLEGAGBh4Xyq38b8`, `VERCEL_SCOPE=narikiyos-projects`（任意）

#### 残課題
- 上記 secrets/variables を GitHub に登録後、workflow 初回実行で green を確認。
- DNS A レコード切替 → 本番ドメインで §8 再チェック。

---

### 2026-06-12 Headless Vercel 本番デプロイ準備

#### 内容
- Vercel プロジェクト `escomi-headless` を `narikiyos-projects` 配下に作成。
- 本番用環境変数を Vercel に登録済み（値はログ・ドキュメントに記載しない）。
- 初回 Vercel デプロイは Framework が `Other` のため 404。プロジェクト設定を `nextjs` に修正後、再デプロイ成功。
- 本番エイリアス `https://escomi-headless.vercel.app` は **READY**。
- カスタムドメイン `mens-esthe-kuchikomi.com` を Vercel プロジェクトに追加済み。

#### 検証（2026-06-12）
- `npm run seo:cutover-check -- https://escomi-headless.vercel.app` … **PASS**
- `npm run seo:url-parity -- --current https://mens-esthe-kuchikomi.com --candidate https://escomi-headless.vercel.app` … **PASS**（WARN のみ、exit 0）

#### DNS / 切替
- 現行 DNS は Xserver `85.131.213.108` を向いたまま。**本番ドメイン切替前**に DNS プロバイダで `mens-esthe-kuchikomi.com` の A レコードを `76.76.21.21`（Vercel）へ変更すること。
- `www.mens-esthe-kuchikomi.com` も Vercel プロジェクトに追加済み。www を Vercel で配信する場合は、DNS プロバイダで `www.mens-esthe-kuchikomi.com` の A レコードを `76.76.21.21` へ設定すること。
- 現行 WP 本番ドメインは DNS 更新まで変更なし。

#### 残課題
- main への push / 現行 GitHub Actions は headless をデプロイしない（従来どおり WP のみ）。
- DNS A レコード切替 → Vercel 本番ドメイン反映 → 切替チェックリスト §5 以降。

---

### 2026-06-12 Headless SEO カットオーバー URL パリティ CLI

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `url-parity-check.mjs` 新規: 現行 WP と候補 Next を `--current` / `--candidate` で比較。sitemap（`/sitemap.xml`・`/wp-sitemap.xml`・インデックス再帰）、主要パス・エリア・固定ページ・店舗サンプルのステータス / canonical / noindex / タイトルを検査。
- `npm run seo:url-parity` 追加。レポート出力は `headless/reports/`（ルート `.gitignore`）。
- `HEADLESS-CUTOVER-CHECKLIST.md` §4 に自動パリティ手順を追加（手動目視の前）。
- 検証（2026-06-12 成功）: `npm run lint` / `npm run build` / `npm run seo:cutover-check` / `npm run contact:check-env` / `npm run seo:url-parity`（本番 vs `localhost:3000`、`npm run start` 後）。候補 sitemap 425 URL、主要10パスは候補 200、タイトル差分は WARN のみ exit 0。現行 WP sitemap は本番で 404 のため WARN。

#### 変更ファイル（headless/）
- `scripts/url-parity-check.mjs`, `package.json`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- main への push・本番デプロイは未実施

---

### 2026-06-12 Headless 切替前完成度（legacy sitemap・SEO CLI・SMTPチェック）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `next.config.ts`: 旧 WP sitemap URL（`/wp-sitemap.xml`, `/sitemap_index.xml`, 代表子 sitemap, `/wp-sitemap-:slug`）を `/sitemap.xml` へ permanent redirect。
- `seo-cutover-check.mjs` 強化: legacy sitemap redirect、canonical/noindex、GA4、 sitemap 店舗 URL サンプル 200、件数 300 未満 WARN。
- `check-contact-env.mjs` 新規 + `npm run contact:check-env`。`.env.example` / `HEADLESS-CUTOVER-CHECKLIST.md` に追記。
- 問い合わせ: `targetUrl` は http/https 以外 400、`sourceUrl` は 2048 文字で切り詰め。

#### 変更ファイル（headless/）
- `next.config.ts`, `lib/contact-validation.ts`
- `scripts/seo-cutover-check.mjs`, `scripts/check-contact-env.mjs`
- `package.json`, `.env.example`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- 本番 SMTP 実値設定と実メール送信確認
- main への push・本番デプロイは未実施

---

### 2026-06-12 Headless [slug] 404 修正（PPR シェル 200 回避）

- `headless/app/[slug]/page.tsx`: 未知 slug は Suspense 前に `notFound()`。`generateMetadata` も同様。検証: `npm run lint` / `npm run build` / `seo:cutover-check` で 404 警告解消。

---

### 2026-06-12 Headless お問い合わせフォーム + 切替チェック整備

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- `/contact/` 固定ページ（`WpStaticPage`）内に Next 側 `ContactForm` を追加。種別・名前・メール・店舗名・対象URL・本文・同意・honeypot 対応。
- `POST /api/contact/` を追加。nodemailer 送信、バリデーション、メモリベースレート制限（同一IP 60秒5回）、`CONTACT_FORM_DRY_RUN`、本番 SMTP 未設定時 503。
- 送信成功時 GA4 `contact_form_submit` イベント。フォーム CSS を `globals.css` に追加（白・ネイビー・ゴールド）。
- 切替前チェック: `pm/HEADLESS-CUTOVER-CHECKLIST.md` 新規、`headless/scripts/seo-cutover-check.mjs` + `npm run seo:cutover-check`。
- `.env.example` に SMTP / 問い合わせ用 env を追記。`nodemailer` 依存追加。
- 検証: `npm run lint` / `npm run build` 成功。`CONTACT_FORM_DRY_RUN=true` で API 200、`seo:cutover-check` 主要URL 200・sitemap 425件・`/listing/` 308 確認。

#### 変更ファイル（headless/）
- `components/ContactForm.tsx`, `components/WpStaticPage.tsx`
- `app/api/contact/route.ts`, `app/globals.css`
- `lib/contact-validation.ts`, `lib/contact-rate-limit.ts`
- `scripts/seo-cutover-check.mjs`, `package.json`, `package-lock.json`, `.env.example`

#### 変更ファイル（pm/）
- `HEADLESS-CUTOVER-CHECKLIST.md`, `PROGRESS.md`

#### 残課題
- 本番 SMTP 設定と実メール送信確認（`CONTACT_FORM_DRY_RUN` を本番でオフ）
- main への push・本番デプロイは未実施
- Search Console への sitemap 再送信はドメイン切替後（チェックリスト参照）
- PPR 環境では存在しない URL が 200 シェルになる場合あり（404 警告は手動確認推奨）

---

### 2026-06-12 Headless SEO/URL事故防止（sitemap全件・固定ページ・listingリダイレクト）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は未変更。
- sitemap: `getShopsForSitemap` / `getPostsForSitemap` を `x-wp-totalpages` ベースの順次ページングに変更（店舗382件=4ページを全件取得）。
- 固定ページ `/contact/` `/about/` `/sitemap/` `/storelisting/` `/osaka-nihonbashi/` を `app/[slug]/page.tsx` で表示。REST `content.rendered` 空時は用途別フォールバック本文+CTA。
- metadata: 固定ページに title / description / canonical / OGP を付与（canonical は `https://mens-esthe-kuchikomi.com/{slug}/`）。
- `/listing/` → `/storelisting/` へ permanent redirect。ヘッダー/フッター/トップCTA のリンクを `/storelisting/` に統一。
- GA4: `listing_click` を `/listing` と `/storelisting` の両方で判定。
- sitemap static routes に固定ページ5件を追加。固定ページ用 CSS を `globals.css` に追加。
- 検証: `npm run lint` / `npm run build` 成功。dev server で `/sitemap.xml` 200・店舗URL 382件、`/listing/` → 308 `/storelisting/`、`/contact/` `/storelisting/` 200 を確認。

#### 変更ファイル（headless/）
- `lib/wp/client.ts`, `lib/wp/shops.ts`, `lib/wp/posts.ts`, `lib/wp/pages.ts`, `lib/static-pages.ts`
- `app/[slug]/page.tsx`, `app/sitemap.ts`, `next.config.ts`, `app/globals.css`
- `components/WpStaticPage.tsx`, `GoogleAnalytics.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `HomePageContent.tsx`

#### 残課題
- 本番デプロイ・ドメイン切替は未実施
- Search Console への headless 用 sitemap 再送信は切替後
- contact 固定ページは WP 側本文空のため、フォーム連携（CF7等）の REST 公開は別途検討

---

### 2026-06-12 Headless SEO/GA4基盤 実装

#### 内容
- `headless/` のみ編集。WP PHP/CSS は参照のみ・未変更。
- GA4: `G-6XFMW5XKBW`（`NEXT_PUBLIC_GA_MEASUREMENT_ID` で上書き可）。`send_page_view: false` + 手動 `page_view`。pathname/searchParams 監視で SPA 遷移計測。tel・外部リンク・問い合わせ/掲載・店舗詳細のイベント委譲。
- GA4 補強: `URL(href, origin)` 正規化後の pathname で `/contact` `/listing` を判定し、同一ドメインリンクでも `contact_click` / `listing_click` を送信。
- SEO: layout + 全主要ページに canonical（末尾スラッシュ統一）、openGraph、twitter、robots。`trailingSlash: true`。
- `app/sitemap.ts` / `app/robots.ts` 追加（エリア・店舗100件・コラム100件まで）。
- JSON-LD: トップ WebSite+Organization、エリア BreadcrumbList、店舗 HealthAndBeautyBusiness。既存 FAQ JSON-LD は維持。
- `npm run lint` / `npm run build` 成功。`curl` で `/sitemap.xml` `/robots.txt` 200 確認。

#### 変更ファイル（headless/）
- `app/layout.tsx`, `app/page.tsx`, `app/sitemap.ts`, `app/robots.ts`
- `app/area/[slug]/page.tsx`, `app/shops/page.tsx`, `app/shops/[slug]/page.tsx`
- `app/column/page.tsx`, `app/column/[slug]/page.tsx`
- `components/GoogleAnalytics.tsx`, `components/AreaPageView.tsx`, `components/ShopDetail.tsx`
- `lib/seo.ts`, `lib/gtag.ts`, `lib/wp/shops.ts`, `lib/wp/posts.ts`
- `types/gtag.d.ts`, `next.config.ts`, `.env.example`

#### 残課題
- 本番デプロイ・ドメイン切替は未実施（別タスク）
- sitemap 店舗/コラムは `per_page=100` 上限（全件化は WP 件数確認後）
- Search Console への headless 用 sitemap 再送信は切替後

---

### 2026-06-12 Headless デザイン再現 追加修正

#### 内容
- フォントを Shippori Mincho + Playfair Display に変更（WP `functions.php` と同方向）。
- ヘッダー: ネイビー上線、ロゴ画像、薄い高さ。
- トップ見出し（人気エリア・新着店舗・新着コラム）: 絵文字除去、中央 + 金色短線。WP 赤線を上書き。
- 関西タイル画像（奈良・滋賀・和歌山）を WP 本番 URL に統一。
- AREA FEATURE カード PC 高さ ~280px、本文余白調整。
- `getShopBySlug`: slug 直取得失敗時に search フォールバック（`/shops/genie` 対応）。
- MAP SEARCH: iframe 非表示時用の地図風 CSS 背景を `lux-map-frame` に追加。
- MAP SEARCH: フォールバックを iframe 上に薄く重ね、中央に赤ピン追加（白紙 iframe 対策）。
- `npm run lint` / `npm run build` 成功（cacheComponents 維持）。

#### 変更ファイル（headless/）
- `app/globals.css`
- `components/SiteHeader.tsx`, `HomePageContent.tsx`, `KansaiAreaGrid.tsx`
- `lib/design-constants.ts`, `lib/wp/shops.ts`

---

### 2026-06-12 Headless デザイン再現（WPスクショ準拠）

#### 内容
- `headless/` のみ編集。WP PHP/CSS は参照のみ。
- トップ: AREA FEATURE、6分割エリアタイル、新着店舗3カラム+CTA、コラム/About、フッター（ターコイズ罫線）を実装。
- エリア: ヒーロー画像、MAP SEARCH（大阪親エリア）、導入文ボックス、SHOP LIST、ページネーション、OTHER AREAS を実装。
- 店舗詳細: OPEN/WEBバッジ、星評価、編集部Review、出勤枠（静的プレースホルダ）、AGE/PRICE/SHOP INFO/AREA LIST セクションを実装。
- フォント（Noto Serif JP）、色（#143d4d / #d4af37 / #00a4a6）、fade-in / card hover アニメーション追加。
- `npm run lint` / `npm run build` 成功（Next.js 16.2 cacheComponents 維持）。

#### 変更ファイル（headless/）
- `app/page.tsx`, `app/globals.css`, `app/area/[slug]/page.tsx`, `app/shops/[slug]/page.tsx`
- `components/HomePageContent.tsx`, `AreaFeatureSection.tsx`, `KansaiAreaGrid.tsx`, `AreaHero.tsx`, `SectionTitle.tsx`, `Pagination.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `ShopCard.tsx`, `ShopDetail.tsx`, `AreaPageView.tsx`
- `lib/design-constants.ts`, `lib/wp/areas.ts`

#### 残課題
- AI出勤: REST 連携後に本格実装（現状は静的プレースホルダ）
- エリアページネーション: UI のみ（API ページング未接続）
- 店舗 `shop_feature` タクソノミーの REST 分離表示

---

#### 内容
- WordPress を CMS として残し、表側を Next.js で段階的に再構築する方針で要件定義を作成。
- 現行の `front-page.php` / `taxonomy-area.php` / `single-shop.php` / `functions.php` / `ai-update-log.php` / `dashboard/` / `ai-site-monitor/` を確認し、再現対象の画面・ACF項目・API要件・SEO要件・工数・リスクを整理。
- 公式情報として WordPress REST API、Next.js ISR、WPGraphQL の前提を確認。現行 `dashboard` の `output: "export"` では ISR が使えないため、本体サイトは Node.js 実行環境を前提にする必要あり。
- Gemini にも全体分析を依頼し、API戦略、ACF公開、ルーティング、レンダリング、プレビュー、ショートコード棚卸し、AI更新ログ、ダッシュボード統合の観点を確認。シェル変数名の衝突でコマンド終了コードは1になったが、分析本文は取得できた。
- Cursor Agent 調査は2回実行したが、どちらもセッション作成直後に空出力で失敗。ローカル調査と既存資料をもとに作成。
- `docs/ai-skills.md` は見つからなかった。

#### 変更ファイル
- `pm/HEADLESS-WP-REQUIREMENTS.md`（新規）
- `pm/PROGRESS.md`

---

### 2026-06-11 Headless Phase 1 実装準備

#### 内容
- 作業ブランチ `codex/headless-phase1` を作成。
- Phase 1 実装計画 `docs/superpowers/plans/2026-06-11-headless-phase1.md` を作成。
- 方針: 既存 WordPress 本番表示は維持し、`headless/` に Next.js アプリを別建てで追加する。公開切り替えは全ページ比較・SEO確認後。
- Cursor Agent へ実装依頼を3回実行:
  - Phase 1 Task 1〜4 一括: 空出力で失敗。
  - Task 1のみ、`gpt-5.3-codex-low-fast`: 空出力で失敗。
  - `--status` / `--models` は成功し、ログインと利用可能モデルは確認済み。
- 現時点では Cursor Agent ブリッジが初期化後に実行へ進まないため、コード実装は未着手。

#### 変更ファイル
- `docs/superpowers/plans/2026-06-11-headless-phase1.md`（新規）
- `pm/PROGRESS.md`

---

### 2026-06-11 Headless Phase 1 初期実装

#### 内容
- `headless/` に Next.js App Router アプリを新規作成。
- WordPress REST API 取得層を追加し、`shop` / `area` / 通常投稿を取得できるようにした。
- トップ、エリア詳細 `/area/[slug]/`、店舗一覧 `/shops/`、店舗詳細 `/shops/[slug]/`、コラム一覧 `/column/`、コラム詳細 `/column/[slug]/` を実装。
- 既存 WordPress 本番FTPデプロイに混ざらないよう `.github/workflows/deploy.yml` の exclude に `headless/**` を追加。
- ローカル表示確認:
  - `http://localhost:3001/` 表示OK。
  - `http://localhost:3001/area/nihonbashi/` 表示OK、店舗24件取得。
  - 日本橋の店舗詳細1件（アテナ）表示OK。
  - `http://localhost:3001/column/` と記事詳細 `hello-world` 表示OK。
- `npm run lint` 成功。
- `npm run build` 成功。

#### 注意
- REST API上で ACF の全項目が返っていないため、FAQ / エリアコラム / 店舗AIサマリー等は未表示のページがある。完全再現には WordPress 側で headless 用 REST 拡張または WPGraphQL 導入が必要。
- Browser のスクリーンショット取得は CDP タイムアウトで失敗。DOMベースの表示確認は完了。

#### 変更ファイル
- `.github/workflows/deploy.yml`
- `headless/`
- `pm/PROGRESS.md`

---

### 2026-06-11 23:39 Headless デザイン再現・Next.js 16.2 キャッシュ対応

#### 内容
- Cursor Agent へ headless 側のデザイン再現とキャッシュ実装を依頼。初回は長時間停止したが、最終的に headless 側の一部編集・lint/build まで実行された。
- 既存ファイル `css/base.css` / `css/front-page.css` / `css/single.css` と `front-page.php` / `taxonomy-area.php` / `single-shop.php` を参照し、Next側のマークアップを既存クラスへ寄せた。
- トップページを `mep-homeNightLux` / `mep-hero-estama mep-hero-nightlux` / `mep-hero-glass` / `mep-feature-card` 中心の構造へ変更。
- エリアページを `area-archive-header` / `wolfman-list-container` / `shop-list-row` 中心の構造へ変更。
- 店舗詳細を `shpc-header-box` / `shpc-intro-section` / `shop-info-section` / `mod-customColor` 中心の構造へ変更。
- 本番WordPressの子テーマCSSを `headless/app/globals.css` から読み込む形に変更し、Next側で不足していたヘッダー横並び、フッター、エリアカード、No Image の補完CSSを追加。
- `next.config.ts` に `cacheComponents: true` を追加。
- WordPress取得関数に Next.js 16.2 の `"use cache"` / `cacheLife()` / `cacheTag()` を追加。
- キャッシュタグは全体 `wp`、カテゴリ `areas` / `shops` / `posts`、個別タグの3段構成にした。
- WordPress更新後にNextキャッシュを更新できるよう `/api/revalidate?tag=wp` を追加。
- 動的ページは `params` を Promise として扱い、`Suspense` 内で取得する構造に修正。同期 `params` 化による 404 と、`cacheComponents` の build エラーを解消。

#### 検証
- `npm run lint` 成功。
- `npm run build` 成功。Next.js 16.2.6 / Cache Components enabled。
- `http://localhost:3001/` 200。
- `http://localhost:3001/area/nihonbashi/` 200。
- `http://localhost:3001/shops/アテナ/` 200。
- ブラウザで主要CSS変数 `--mep-red` / `--mep-navy` / `--accent-gold` と、主要パネルの背景色・角丸・影を確認。
- `/api/revalidate?tag=wp` は `{ "ok": true, "tag": "wp" }` を返すことを確認。

#### 注意
- 親テーマSWELLのCSSすべてをNextへ移植しているわけではないため、現時点では子テーマ主要CSS + Next補完CSSでの再現。
- REST APIに出ていないACF項目は引き続き未表示。完全再現には WordPress側の headless REST 拡張または WPGraphQL が必要。

#### 変更ファイル
- `headless/app/globals.css`
- `headless/app/page.tsx`
- `headless/app/api/revalidate/route.ts`
- `headless/app/area/[slug]/page.tsx`
- `headless/app/shops/[slug]/page.tsx`
- `headless/app/column/[slug]/page.tsx`
- `headless/components/ShopCard.tsx`
- `headless/components/ShopDetail.tsx`
- `headless/lib/wp/areas.ts`
- `headless/lib/wp/shops.ts`
- `headless/lib/wp/posts.ts`
- `headless/next.config.ts`
- `headless/.env.example`
- `headless/public/no-image.svg`
- `pm/PROGRESS.md`

---

## ステータスサマリー
| 項目 | 状態 | 備考 |
|------|------|------|
| GA4実装 | ✅ 完了 | G-6XFMW5XKBW |
| Search Console | ✅ 完了 | sitemap 送信・主要4URLインデックス登録リクエスト済み（2026-06-13） |
| GitHubリポジトリ | ✅ 完了 | atmgmj7-lab/mens-esthe-kuchikomi |
| GitHub Actions | ✅ 完了 | deploy.yml作成済み |
| CLAUDE.md整理 | ✅ 完了 | スリム化・ファイル分担構成 |
| .gitignore | ✅ 完了 | |
| GitHub Secrets登録 | ✅ 完了 | FTP_HOST / FTP_USERNAME / FTP_PASSWORD / FTP_PATH（2026-05-09） |
| 自動デプロイ動作確認 | ✅ 完了 | dry-run 成功後に本番転送へ切替（2026-05-09） |
| エリア地図 iframe 化（area_map_nav ＋ taxonomy-area） | ✅ 完了 | SP でも iframe 表示（2026-04） |
| area-seo-hooks-optimized接続 | ✅ 完了 | `functions.php` で `area-seo-hooks-optimized.php` を読込 |
| 日本橋SEO／エリアページ ACF の HTML 出力 | ✅ 完了 | `taxonomy-area.php` に特性・コラム・FAQ・JSON-LD を直接出力（SWELL フック非対応分の補完）（2026-04-29） |
| REST API権限強化 | ✅ 完了 | `escomi/v1/update` は POST + `edit_posts`（2026-05-10） |
| REST API 401「Missing API key.」修正 | ⏳ 再調査中 | `functions.php` v4/v5 デプロイ済みだが本番匿名 POST は依然 `Missing API key.`（2026-05-21） |
| Gemini モデル動的選択・JSON表示バグ修正 | ✅ 完了 | `ai_auto_updater.py` + `functions.php` 修正（2026-05-16） |
| ai-site-monitor稼働確認 | ✅ 一部完了 | mens-esthe-seo-tools: 実URL4件監視（`/area/namba/` はサイトに該当ページなしのため対象外） |
| Agent Foundation（ローカル監視） | ✅ 一部完了 | `agent-foundation/` Flask + `start.sh` で Dashboard 連携起動（2026-05-21） |
| ダッシュボード 静的書き出し + GA4連携 | ✅ 完了 | `dashboard/` Next.js 16 静的書き出し。GA4プロキシ・モックUI・CIビルド設定済み（2026-05-17） |
| エリア・店舗コンテンツ（ACF） | ✅ 一部完了（日本橋 WP-CLI 投入済） | その他エリア・`area_column_content` 等は `pm/CONTENT-IMPLEMENTATION-GUIDE.md` |
| 日本橋59店舗 `shop_ai_summary` JSON 投入 | ⏳ 待機 | JSON 未配置。配置後: `python3 tools/import_shop_ai_summaries.py`（`content/nihonbashi_shop_summaries.json` または引数でパス指定） |
| 店舗AI自動更新（全店舗） | ✅ パイロット完了 | `escomi/v1/update` 疎通確認済み（401→認証 OK）。手動1件実行 OK（2026-05-14）。詳細 `SHOP-AI-ROLLOUT.md` |

#### ブロッカー
- （自動デプロイ系）FTP Secrets 未登録は解除済み。REST `escomi/v1/update` は権限チェック済み（2026-05-10）
- **本番 REST `Missing API key.` 再発**: ローカルに該当文字列なし → サーバー側 `mu-plugins/proxy-app-passwords.php` 再生成、OPcache、または `rest_pre_dispatch` 経路の切り分けが必要。確認: `GET /wp-json/escomi/v1/debug`（`deployed: v5` か）
- `.htaccess` Authorization ヘッダー転送: サーバー直接作業が必要。Xserver ファイルマネージャーで `/public_html/.htaccess` 先頭付近（`# BEGIN WordPress` の上）に `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` を追加する。

#### 次のアクション
- [x] Search Console 初期反映（sitemap 送信・主要URLインデックス登録リクエスト）（2026-06-13）
- [ ] SEO強化（エリア本文増強、構造化データ強化、内部リンク強化、title/description改善）
- [x] FTP Secrets 登録・自動デプロイ疎通（dry-run → 本番転送）（2026-05-09）
- [x] デプロイ後 `/area/osaka/` で `lux-map-iframe` の表示確認（curl）
- [x] REST API 401「Missing API key.」解消（2026-05-15）
- [x] Gemini モデル自動選択・JSON 生表示バグ修正（2026-05-16）
- [ ] `.htaccess` Authorization ヘッダー設定（Xserver ファイルマネージャーで手動）
- [ ] 日本橋エリア SEO ギャップ埋め（`area_column_content` 等・競合対策）
- [x] 店舗 AI 自動更新パイロット（`daily_shop_update.yml` 1件実行成功・`escomi/v1/update` 疎通確認 2026-05-14）
- [ ] SEOツールをRenderにデプロイ
- [ ] 本番 `Missing API key.` 解消（`/escomi/v1/debug` → mu-plugins 確認 → 認証付き POST 再テスト）

### 2026-05-21 REST API 再調査 + Agent Foundation ローカル起動

#### 内容
- **REST 401 再調査**: デプロイ後も `POST /wp-json/escomi/v1/update`（認証なし）が `rest_forbidden` + `Missing API key.` のまま。OPcache 単独説は不十分。`functions.php` では `rest_authentication_errors` と `rest_pre_dispatch` の両方で遮断、`init` で `proxy-app-passwords.php` 自動削除、`GET /escomi/v1/debug`（v5・OPcache reset）を実装済み。
- **Agent Foundation**: `agent-foundation/`（Flask 監視 UI・Obsidian エクスポート・WP/GA モック連携）と `start.sh`（Dashboard + Agent Foundation 一括起動）を追加。
- **作業メモ**: 別チャット相談用に調査ログを整理済み。

#### 変更ファイル
- `agent-foundation/`（新規）
- `start.sh`（新規）
- `pm/PROGRESS.md`

---

### 2026-05-10 店舗AI自動更新: SQLite キャッシュ・REST 認可・異常終了

#### 内容
- **GitHub Actions**（`daily_shop_update.yml`）: `actions/cache@v4` で `ai-site-monitor/escomi_crawler.db` を保存・復元。キー `${{ runner.os }}-escomi-db-${{ github.run_id }}` + `restore-keys: ${{ runner.os }}-escomi-db-` で直近キャッシュ継承。
- **REST**（`ai-update-log.php`）: `permission_callback` を `current_user_can('edit_posts')` に変更。メソッドは POST のみ。
- **Python**（`ai_auto_updater.py`）: `/update` は既存どおり Basic 認証（`requests` の `auth=`）。ループ終了時に WP 更新の成功／失敗件数を出力し、成功 0・失敗ありのときは `sys.exit(1)`。

#### 変更ファイル
- `.github/workflows/daily_shop_update.yml`
- `ai-update-log.php`
- `ai-site-monitor/ai_auto_updater.py`
- `pm/BLOCKER.md` / `pm/PROGRESS.md`

---

### 2026-05-09 GitHub Actions 自動デプロイ（本番化）

#### 内容
- Repository secrets（`FTP_HOST` / `FTP_USERNAME` / `FTP_PASSWORD` / `FTP_PATH`）を用いた `SamKirkland/FTP-Deploy-Action@v4.3.4` によるデプロイを構築済み。
- **exclude**: `.git` / `.github` / `*.md` / `pm/` / `ai-site-monitor/` / `tools/` / `content/` / インポート用 PHP・CSV・秘密系パターン等を転送対象外に設定。
- **検証**: `dry-run: true` で GitHub Actions 上のテストデプロイがエラーなし完了 → `dry-run` をコメントアウトし **本番ファイル転送を有効化**。
- **トリガー**: `main` への push および `workflow_dispatch`。
- **SEO／テンプレ整合**: `area_characteristics` の二重表示を解消し本文は `taxonomy-area.php` に一本化済み。メタディスクリプションは Yoast／Rank Math 未入力時に ACF から自動要約を供給。コラム・FAQ は `taxonomy-area.php` のみ出力（`swell_after_post_list` 側の重複を除去）。

#### 変更ファイル（当ログ対応コミット時）
- `.github/workflows/deploy.yml`
- `pm/PROGRESS.md`

---

### 2026-04-05 06:01
#### コミット
test: auto log hook動作確認

#### 変更ファイル
.DS_Store
---

### 2026-04-05 06:54
#### コミット
test: 自動デプロイ動作確認

#### 変更ファイル

---

### 2026-04-05 07:04
#### コミット
fix: correct deploy.yml secret variable names

#### 変更ファイル
.DS_Store
.github/workflows/deploy.yml
pm/PROGRESS.md
---

### 2026-04-05 エリア地図 iframe 化
#### コミット
fix: replace img with iframe in area map nav

#### 変更内容
- `functions.php` の `area_map_nav`: 6エリア Google Maps embed URL、`lux-map-bg`（img）を `lux-map-iframe`（iframe）に変更
- `taxonomy-area.php`: 親エリアの地図を同じ6 URL・同じ iframe マークアップに統一
- `css/single.css`: `.lux-map-frame iframe.lux-map-iframe` を追加（画像用の回転・ブレンドは iframe では無効化）

#### 確認メモ
- 本番を `curl` で取得した時点（このコミットのデプロイ前）: 旧 `<img class="lux-map-bg">` のHTMLのまま
- **大阪（親）** `/area/osaka/`: デプロイ後、PC表示（`u-pc-only`）で iframe が出る想定
- **日本橋（子）** `/area/nihonbashi/` 等: `taxonomy-area.php` は `is_parent_area` のときだけ地図セクションを出すため、**子エリアには地図＋ピンは表示されない**（店舗一覧アーカイブ）。ピン重ねは親エリアページのみ

#### デプロイ後確認（2026-04-05、本番 HTML を curl で取得）
- `/area/osaka/`: `class="lux-map-iframe"` の iframe が出力されていることを確認
- `/area/nihonbashi/`: `MAP SEARCH` / `lux-map-frame` は含まれず（子エリアは地図ブロック非表示で仕様どおり）

---

### 2026-04-05 07:22
#### コミット
docs: dedupe PROGRESS log entries

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

## 2026-04-06

### 完了タスク
- area_map_nav iframeに変更（functions.php・taxonomy-area.php・css/single.css）
- MCP設定完了（fetch/filesystem/github）
- ai_auto_updater.pyのバグ修正（result.appendインデント修正）
- REST API疎通確認（`/wp-json/escomi/v1/update` が匿名 POST で 401、`edit_posts` 付きユーザーで認証済み POST が貫通するか）
- ai-site-monitorをmens-esthe-seo-toolsリポジトリに移行
- daily_cron.yml稼働確認（GitHub Actions成功）
- sites.jsonをダミー1000件→実URLに差し替え（のち実URL4件に整理。namba は当該URLなしのため除外）
- FTPデプロイ復旧（FTP_USERNAMEをescomi@mens-esthe-kuchikomi.comに修正）
- `functions.php` で `area-seo-hooks-optimized.php` を読込（BLOCK-003 解除）

### 次回優先タスク
- daily_cron（4URL）の定期実行確認（`total_sites` と `sites.json` の一致）
- ✅ 日本橋エリア ACF：`area_characteristics` / FAQ（term meta） / `area_ranking_shops`（59店）を本番 WP-CLI で反映（2026-04-29）
- ai_auto_updater.pyの本番テスト実行

---

### 2026-04-06 04:25
#### コミット
docs: update progress log 2026-04-06

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

## 2026-04-07 優先タスクフォロー（1→2→3）

### 1. daily_cron（5URL）実行結果確認 — 実施済み
- **Actions**: `Daily Site Monitor` を `workflow_dispatch` で実行（run 成功・約48秒）。
- **成果物**: `mens-esthe-seo-tools` の `ai-site-monitor/results/changes_20260405_192907.json`
  - `total_sites`: **5**
  - `changed_count`: 0（初回ベースライン／変更なし）
- **`data/hashes.json`**: 当時 **4 URL**（`/area/namba/` はサイト側にページが無く取得できないため **`sites.json` から除外**し、致命度はなし）。

### 2. 日本橋エリア ACF — 投入済み（WP-CLI）（2026-04-29）
- **対象ターム**: `tag_ID=7`（slug `nihonbashi`）
- **反映済みメタ**: `area_characteristics`、FAQ 配列 `area_faq_content`（7件、`get_field()` 確認済）、子ターム側 `area_ranking_shops`（59 IDs・`_area_ranking_shops`= `field_6984c71ca23e5`）
- **補足**: `_area_faq_content` がリレーション用フィールドキーを指すと `get_field()` が投稿オブジェクト側に寄るため、この投入では削除し Q&A 配列のみ保持する形にしている。親エリアの「厳選」表示はコード上 `area_ranking_pickup` や親のランキングを参照する。**未入力**: `area_column_content`。

### 3. ai_auto_updater.py 本番テスト — 手順のみ（未実行）
- **前提**: `ai-site-monitor/.env` に `WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`。Playwright の `chromium` インストール済み。
- **コマンド**（リポジトリ: `mens-esthe-seo-tools/ai-site-monitor/` または `swell_child/ai-site-monitor/`）:
  - `pip install -r requirements.txt && playwright install chromium`
  - `python ai_auto_updater.py`
- スクリプトは **CRAWL_LIMIT=3** のテスト仕様。本番で店舗メタ更新できるか WP 側で確認。

---

### 2026-04-07 進行メモ
#### 内容
優先タスク1の検証（workflow 手動実行・total_sites:5・hashes 4件の記録）。タスク2・3は手順整理。

#### 変更ファイル
pm/PROGRESS.md
---

### 追記（namba 除外）
- 本サイトに `/area/namba/` 相当ページが無いため、**監視対象から削除**して問題なし（致命ではない）。
- `mens-esthe-seo-tools/ai-site-monitor/sites.json` は **実URL4件**に更新。

### RUNBOOK A-4 再実行（エージェント・Cursor）
- `git pull` → `gh workflow run "Daily Site Monitor" --ref main` → `gh run watch` まで実施。
- **GitHub Actions run ID:** `24009000520`（成功・約1分10秒）。
- **検証:** `total_sites` **4** = `sites.json` の URL 数 **4** = `data/hashes.json` のキー数 **4**（一致）。
- **成果物:** `ai-site-monitor/results/changes_20260405_194233.json`（`changed_count`: 0）。

### RUNBOOK A-4 ステップ実装（番号手順・最新）
- **A-4.1〜A-4.7** を `pm/RUNBOOK.md` に表形式で追記済み。合格条件3項目を明記。
- **実行 run ID:** `24009070604`（成功・約48秒）。
- **検証:** URL 数 4 = hashes 4 = `total_sites` 4 → **合格**。
- **成果物:** `changes_20260405_194610.json`（`changed_count`: 0）。

---

### 2026-04-06 04:29
#### コミット
docs: log daily_cron 5-URL verification and task 2-3 follow-up

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:37
#### コミット
docs: note namba URL removed from monitor list

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:39
#### コミット
docs: add RUNBOOK for agent-executable ops and clarify manual boundary

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
pm/ARCHITECTURE.md
pm/PROGRESS.md
pm/RUNBOOK.md
---

### 2026-04-06 04:43
#### コミット
docs: log RUNBOOK A-4 Daily Site Monitor run (total_sites 4)

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 04:46
#### コミット
docs: RUNBOOK A-4 step table + log latest Daily Site Monitor run

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
pm/RUNBOOK.md
---

### 2026-04-05
#### コミット
feat(seo): load area-seo-hooks-optimized; chore: deploy, map CSS, updater, BLOCKER

Made-with: Cursor

#### 変更内容
- `functions.php`: `area-seo-hooks-optimized.php` を require（旧 `area-seo-hooks.php` は未読込）
- `.gitignore`: `ai-site-monitor/venv/` 等を追加
- `pm/BLOCKER.md`: BLOCK-002/003 を解除済みに移動
- その他: `deploy.yml`, `ai_auto_updater.py`, `css/single.css`, `taxonomy-area.php`（先行差分のまとめ）

#### 変更ファイル
.github/workflows/deploy.yml
.gitignore
ai-site-monitor/ai_auto_updater.py
css/single.css
functions.php
pm/BLOCKER.md
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 店舗AI全店舗展開（CLI・ドキュメント）
#### コミット
feat(ai): crawl limit --all/--limit, SHOP_DELAY_SECONDS, SHOP-AI-ROLLOUT doc

#### 変更内容
- `ai_auto_updater.py`: `--all`, `--limit N`, `CRAWL_LIMIT=all`, `SHOP_DELAY_SECONDS`
- `pm/SHOP-AI-ROLLOUT.md`: フェーズ表・AI/手動分担・実行例
- `ai-site-monitor/README.md` / `.env.example` 更新、`CONTENT-IMPLEMENTATION-GUIDE.md` 追記、`CLAUDE.md` 読む順追加

#### 変更ファイル
ai-site-monitor/ai_auto_updater.py
ai-site-monitor/README.md
ai-site-monitor/.env.example
pm/SHOP-AI-ROLLOUT.md
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
CLAUDE.md
---

### 2026-04-06 コンテンツ実装指示書
#### コミット
docs: add CONTENT-IMPLEMENTATION-GUIDE for area and shop pages

#### 変更内容
- `pm/CONTENT-IMPLEMENTATION-GUIDE.md` 新設（エリア ACF・店舗手動/AI 分担・チェックリスト）
- `pm/ARCHITECTURE.md` の optimized 接続状況を更新、`CLAUDE.md` に読む順へ追記

#### 変更ファイル
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/ARCHITECTURE.md
CLAUDE.md
pm/PROGRESS.md
---

### 2026-04-06 MAP SEARCH 見出しを SP で確実に表示
#### コミット
fix(css): reset area-map full-bleed on mobile so MAP SEARCH + map are visible

#### 変更内容
- 768px 以下で `body.tax-area .area-map-section` の `100vw` / 負マージンを解除（親 overflow で欠ける対策）
- ショートコードのフルブリードも同様に SP でリセット
- `.lux-heading` を `display:block` / `z-index` で明示

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 地図 iframe を SP 表示
#### コミット
fix(area-map): show Google map iframe on mobile

#### 変更内容
- `taxonomy-area.php`: `wp_is_mobile()` 条件と `u-pc-only` を外し、親エリアで地図を SP でも出力
- `single.css`: 768px 以下で `.lux-map-section` を非表示にしていたルールを削除

#### 変更ファイル
taxonomy-area.php
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 地名ピンと iframe の重なり
#### コミット
fix(css): hide legacy lux-pin overlays when Google map iframe is present

#### 変更内容
- `.lux-map-frame` 内に `.lux-map-iframe` があるとき、旧静止画用の **`.lux-pin`（地名タブ）を非表示**（Google 地図と重なる二重表示の解消）
- iframe に `z-index: 1` を付与

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 u-pc-only グリッド修正
#### コミット
fix(css): u-pc-only use block instead of grid to avoid narrow map layout

#### 変更内容
- `.u-pc-only` の `display: grid` を `block` に変更（地図 `section` がグリッド1カラム化して細長く見える問題）
- `.es-area-grid.u-pc-only` は `flex` を明示してエリアチップ一覧を維持

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-05 地図枠・埋め込み調整
#### コミット
fix(area-map): widen layout, coord+zoom embed, optional area list in shortcode

Made-with: Cursor

#### 変更内容
- 親エリア地図 URL を府県名クエリから **都市中心座標＋ z=11** に変更（表示範囲を絞る。ラベル完全消去は embed では不可）
- `body.tax-area` の **inner 最大幅 1400px**、地図ブロック **100vw フルブリード**
- `.lux-map-frame` を **2:1・min-height 大** で枠を広げる
- `[area_map_nav]` の **AREA LIST は既定非表示**（`list="1"` で表示）

#### 変更ファイル
css/single.css
functions.php
taxonomy-area.php
pm/PROGRESS.md
---

### 2026-04-06 04:48
#### コミット
feat(seo): load area-seo-hooks-optimized; chore: deploy, map, updater, docs

Made-with: Cursor

#### 変更ファイル
.github/workflows/deploy.yml
.gitignore
ai-site-monitor/ai_auto_updater.py
css/single.css
functions.php
pm/BLOCKER.md
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 04:59
#### コミット
fix(area-map): widen layout, coord+zoom embed, optional shortcode list

Made-with: Cursor

#### 変更ファイル
css/single.css
functions.php
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 05:06
#### コミット
fix(css): u-pc-only use block instead of grid to avoid narrow map layout

Made-with: Cursor

#### 変更ファイル
css/single.css
---

### 2026-04-06 05:06
#### コミット
docs: log u-pc-only grid fix in PROGRESS

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 05:08
#### コミット
fix(css): hide legacy lux-pin overlays when Google map iframe is present

Made-with: Cursor

#### 変更ファイル
css/single.css
---

### 2026-04-06 05:08
#### コミット
docs: log lux-pin iframe overlap fix

Made-with: Cursor

#### 変更ファイル
pm/PROGRESS.md
---

### 2026-04-06 05:21
#### コミット
fix(area-map): show Google map iframe on mobile

Made-with: Cursor

#### 変更ファイル
css/single.css
pm/PROGRESS.md
taxonomy-area.php
---

### 2026-04-06 05:36
#### コミット
fix(css): reset area-map full-bleed on mobile for MAP SEARCH visibility

Made-with: Cursor

#### 変更ファイル
css/single.css
pm/PROGRESS.md
---

### 2026-04-06 05:38
#### コミット
docs: add CONTENT-IMPLEMENTATION-GUIDE for area and shop WP content

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
pm/ARCHITECTURE.md
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
---

### 2026-04-06 05:42
#### コミット
feat(ai): shop auto-updater --all/--limit, rollout doc and env hints

Made-with: Cursor

#### 変更ファイル
CLAUDE.md
ai-site-monitor/.env.example
ai-site-monitor/README.md
ai-site-monitor/ai_auto_updater.py
pm/CONTENT-IMPLEMENTATION-GUIDE.md
pm/PROGRESS.md
pm/SHOP-AI-ROLLOUT.md
---

### 2026-04-16
#### コミット
fix(css): 店舗「最新ニュース・動向」リストのレスポンシブ（コンテナクエリ＋任意メモ列）

#### 変更内容
- `css/single.css`: `.ai-intel-news-list` に `container-type`、狭い幅で行を縦積み。本文・メモに `min-width:0` と `overflow-wrap` で1文字縦積み回避
- `single-shop.php`: ACF リピーターで `memo` / `note` / `status` 等があれば第3列 `.ai-intel-news-meta` として表示

#### 変更ファイル
single-shop.php
css/single.css
pm/PROGRESS.md
---

## 2026-07-04
-  が 404 になった原因を切り分け、headless 側の  ルート（）・認証ミドルウェア・連携コンポーネントを本番反映対象としてコミット・Push 準備を実施。
### 2026-07-04 Dashboard 404 再発防止（build修正）

#### 実施内容
- `headless/app/dashboard/layout.tsx` で Server Component 向けに `styled-jsx` を利用していたため `styled-jsx cannot be imported from a Server Component module` で Vercel `npm run build` が失敗していた問題を修正。
- `styled-jsx` を撤去し、Tailwind のクラスを使う純粋コンポーネント構成へ変更。

#### 確認状況
- 問題箇所のログ: GitHub Actions run `28694561187` の `Vercel build (prebuilt)`。
- 次ステップ: 変更を反映した再デプロイで `/dashboard` のビルドルートを復元する。

## 2026-07-11 Q-01 地名流用ミス修正
- `headless/lib/area-content-integrity.ts` を追加し、エリア別の禁止地名・許可地名・駅名・代替文を集約。
- `headless/lib/area-seo.ts` の駅名抽出を対象エリアslugベースに変更。
- `headless/app/area/[slug]/page.tsx` と `headless/components/AreaPageView.tsx` で、本文・FAQ・メタdescriptionの地名安全化を追加。
- `headless/components/ShopDetail.tsx` と `headless/app/shops/[slug]/page.tsx` の日本橋固定文言を廃止。
- `headless/scripts/check-area-content-integrity.mjs` と `npm run test:area-integrity` を追加。

### Q-01 検証結果（2026-07-11）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm test`: 成功（area integrity check passed）
- `npm run build`: 成功（440 static pages generated）

## 2026-07-11 Q-02 0円・料金未確認表示修正
- `headless/lib/price-normalization.ts` を追加し、料金正規化を共通化。
- 代表料金・コース料金では 0 / 0円 / 無料 / 空文字 / 未確認 / 不正値を確認済み価格として扱わないよう変更。
- 一覧、ランキング、Hub料金表、店舗詳細、JSON-LDの価格条件を共通化。
- 店舗詳細の `Number()` 直変換を廃止し、確認済み価格のみ表示。
- `headless/scripts/check-price-normalization.mjs` を追加し、再発防止テストを `npm test` に組み込み。

### Q-02 検証結果（2026-07-11）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm test`: 成功（area integrity / price normalization）
- `npm run build`: 成功（440 static pages generated）
- 生成結果検索: `0円〜` / `¥0` / `￥0` / `最安0円` / `price: 0` / `lowPrice: 0` / `highPrice: 0` / `priceRange: 0` は限定検索でヒットなし
- 備考: build時の middleware 非推奨警告は TECH-01 に登録済み

## 2026-07-11 Q-03 ランキング表現・星評価修正
- `headless/lib/review-rating.ts` を追加し、評価値正規化・実口コミ判定・AggregateRating条件を共通化。
- `review_star` を公開評価表示から除外し、口コミ0件・1〜2件では総合評価を表示しないよう変更。
- 店舗カード・店舗詳細・Hubの `RatingBadge` は件数表示または `口コミ募集中` に統一。
- PR店舗を自然順位TOPから除外し、ランキングカード側でもPRに自然順位番号を付けない防御を追加。
- `headless/scripts/check-review-rating.mjs` を追加し、再発防止テストを `npm test` に組み込み。

### Q-03 検証結果（2026-07-11）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm test`: 成功（area integrity / price normalization / review rating）
- `npm run build`: 成功（440 static pages generated）
- 公開生成物検索: 口コミ0件+4.0、reviewCount 0、ratingCount 0、aggregateRating、人気No.1、口コミ評価4.0 はヒットなし
- 公開ソース検索: `review_star` / `editor_score` は公開表示経路から除去済み。`AggregateRating` 系のヒットは判定関数名のみで、schema出力ではない
- 備考: build時の middleware 非推奨警告は TECH-01 登録済み

## 2026-07-11 Q-04 口コミと編集部コメントの区別整理

- `headless/lib/content-provenance.ts` を追加し、user-review / editorial-comment / shop-provided / shop-description / ai-generated / promotion / unknown を共通分類。
- `headless/lib/review-rating.ts` を共通出自判定へ接続し、Q-03評価対象を明示的な承認済み公開ユーザー口コミだけに限定。
- ACF `review_count` / `shop_review_count` は実口コミ件数ではなく `referenceCount` として扱う方針へ変更。
- `AreaLatestReviews` は確認済みユーザー口コミだけを表示し、なければ空状態に変更。
- `ShopDetail` は掲載情報コメント、店舗紹介、ユーザー口コミを分離。
- `headless/scripts/check-content-provenance.mjs` を追加し、再発防止テストを `npm test` に組み込み。
- WordPress、Supabase、DB、本番環境、Secrets、デプロイは変更していない。

### Q-04 検証結果（2026-07-11）

- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm test`: 成功（area integrity / price normalization / content provenance / review rating）
- `npm run build`: 成功（440 static pages generated）
- 公開生成物検索: `口コミ・編集部` / `編集部レビュー` / `editor_score` / `review_star` / `AggregateRating` / `aggregateRating` / `お客様の声` / `実際の利用者` / `口コミで人気` / `AI生成` はヒットなし。
- 公開生成物PR検索: 単独 `PR` / `sponsored` / `promotion` はヒットなし。
- 公開経路ソース検索: `content-provenance` のpromotion型、`shop-ranking` のsponsored型、`RankingHeroCards` のPRラベルのみ。PR最終表記はQ-05へ引き継ぎ。
- 備考: build時の middleware 非推奨警告は TECH-01 登録済み。

## Q-05 PR・広告枠表記整理

- PR/広告判定を headless/lib/promotion-disclosure.ts に集約
- 自然ランキングからPR/広告を除外
- PR/広告はエリアページで別枠表示
- PR/広告の公式外部リンクだけ sponsored nofollow noreferrer を付与
- ItemList schema からPR店舗を除外
- 残課題: PR文言・広告掲載基準・契約終了後ルールは人間確認

## 2026-07-12 完成形UI Phase 1/2

- 添付ZIPを安全名で展開し、1a〜1d、状態バリエーション、DB注記、画像資料、店舗詳細PDFを確認。
- docs/design/escomi-final-design-implementation-map.md を作成し、公開4ページの対応表と段階実装順を整理。
- トップページの写真アコーディオンを削除せず、hover/focus展開・mobile画像カード・reduced motion対応の完成形UIへ更新。
- 日本橋画像付き重点エリアを AREA_FEATURES ベースに変更し、将来の重点エリア追加に備えた。
- ダッシュボード完成デザイン不足を DASH-DESIGN-00 としてBLOCKER登録。
- WordPress、Supabase、DB、本番、Secret、デプロイは変更していない。

## 2026-07-12 完成形UI Phase 2

- `AreaHubPageTemplate` に完成形のエリア詳細ヒーローを追加。
- `AreaPageView` に通常エリアページ用の完成形サマリーを追加。
- 口コミ・編集部コメント・PR情報の分離注記をエリアページ上部にも表示。
- 店舗数はWordPress由来の実データを使用し、0件時は `掲載準備中` と表示。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。

## 2026-07-12 完成形UI Phase 3

- `ShopDetail` に完成形の店舗詳細ファーストビューを追加。
- 画像、店舗名、料金目安、料金状態、口コミ件数、予約導線を上部で確認できる構成へ変更。
- 店舗詳細内メニューとして `料金表`、`口コミ`、`基本情報`、`予約・問い合わせ` のアンカーを追加。
- 料金は既存の正規化ロジックを使用し、未確認時は `料金は店舗へお問い合わせください。` を表示。
- ユーザー口コミ、編集部コメント、店舗提供情報、PR情報の分離注記を店舗詳細上部にも表示。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。

## 2026-07-12 完成形UI Phase 4

- `SiteHeader` を完成形デザインの共通ヘッダーへ寄せた。
- `SiteFooter` を完成形デザインの共通フッターへ寄せた。
- 共通ヘッダーに `店舗を探す`、`エリアから探す`、`口コミについて`、`掲載について`、`検索` を追加。
- 共通フッターに運営説明と、ユーザー口コミ/編集部コメント/店舗提供情報/PR情報の分離ポリシーを追加。
- ダッシュボード配下は既存どおりヘッダー/フッター非表示のまま維持。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。

## 2026-07-12 完成形UI Phase 5

- 最終横断確認を実行。
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` が成功。
- Playwrightで `/`, `/area/osaka/`, `/area/nihonbashi/`, 店舗詳細を 1440/1024/390/360px で確認。
- `/dashboard` では公開サイト用ヘッダー/フッターが表示されないことを確認。
- 公開画面に `DB:` 注記が出ていないことを確認。
- 主要幅で横スクロールがないことを確認。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。

## 2026-07-12 UI-FINAL-06 本番反映判断

- 現在の未コミット差分を確認。
- UI-FINAL Phase 1-5 はローカル検証済みだが、ダッシュボード、GitHub Actions、Fable資料、SEO品質修正が混在しているため、現状態の一括本番反映は非推奨と判断。
- `docs/design/escomi-final-ui-deploy-readiness-2026-07-12.md` に本番反映判断メモを作成。
- 推奨は、UI-FINALだけを反映単位として分離し、再検証後に本番反映すること。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。

## 2026-07-12 UI-FINAL-07 isolated branch and draft PR

- Created isolated worktree: `/tmp/escomi-ui-final-worktree-041607`.
- Created branch: `codex/ui-final-ready-20260712-041607`.
- Copied only public UI-FINAL changes and required public quality guardrails.
- Excluded dashboard implementation, dashboard deploy workflows, Fable bulk docs, and production GitHub Actions workflow changes.
- Isolated validation passed: lint, typecheck, test, build, Playwright crosscheck.
- Created commit: `e361779 feat: isolate escomi final public UI`.
- Pushed branch to GitHub.
- Created draft PR: https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/pull/2
- PR checks at creation: no status checks reported yet.
- Status: `ISOLATED_UI_FINAL_READY`.

## 2026-07-12 UI-FINAL isolated preview deploy result
- Isolated branch: `codex/ui-final-ready-20260712-041607`
- Draft PR: https://github.com/atmgmj7-lab/mens-esthe-kuchikomi/pull/2
- Vercel preview: https://escomi-headless-ks9qz97jb-narikiyos-projects.vercel.app
- Vercel deployment ID: `dpl_Gv3ZBUhMDcEnPgVMqdyAo2jVujTC`
- Remote Vercel build: READY / build completed successfully / 440 pages generated
- Local isolated checks: lint, typecheck, test, build, Playwright route crosscheck passed
- Remaining blocker: preview URL is protected by Vercel Authentication, so normal browser-based visual verification redirects to Vercel login.


## 2026-07-12 UI-FINAL protected preview browser verification
- Vercel protected preview access was resolved by issuing a temporary share URL.
- Verified routes with Playwright against the Vercel preview:
  - `/` title: `Escomi | 関西メンズエステ口コミナビ`
  - `/area/osaka/` h1: `大阪のメンズエステ`
  - `/area/nihonbashi/` h1: `大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較`
  - concrete shop detail: `/shops/c-r-e-a-m%ef%bc%88%e3%82%af%e3%83%aa%e3%83%bc%e3%83%a0%ef%bc%89/` h1: `C.r.e.a.m（クリーム）`
- Screenshots saved under `/tmp/escomi-ui-final-vercel-share-crosscheck-20260712`.
- Production gate: preview build and browser verification are now complete. Final production reflection still requires explicit production approval.


## 2026-07-12 UI-FINAL production reflection completed
- PR #2 was marked ready and merged into `main`.
- Main commit after merge: `48b8d0ae5acfceacb3d74cc4ee42f343f3c68041`.
- Remote UI work branch was deleted after merge.
- Vercel production deployment: `dpl_G6hqGYQoQPg8sctg95QAgGEY1VQk`.
- Production deployment URL: `https://escomi-headless-6rvvf0sz1-narikiyos-projects.vercel.app`.
- Production aliases confirmed:
  - `https://mens-esthe-kuchikomi.com`
  - `https://www.mens-esthe-kuchikomi.com`
  - `https://escomi-headless.vercel.app`
- Production status: READY.
- Production browser verification passed:
  - `/` title: `Escomi | 関西メンズエステ口コミナビ`
  - `/area/osaka/` h1: `大阪のメンズエステ`
  - `/area/nihonbashi/` h1: `大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較`
  - `/shops/c-r-e-a-m%ef%bc%88%e3%82%af%e3%83%aa%e3%83%bc%e3%83%a0%ef%bc%89/` h1: `C.r.e.a.m（クリーム）`
- Production screenshots: `/tmp/escomi-ui-final-production-crosscheck-20260712`.
- Vercel error log check: no error logs found in the last 1 hour.


## 2026-07-12 TECH-02 useSearchParams CSR bailout原因調査
- 本番相当のclean worktree `/tmp/escomi-tech02-use-search-params` を `origin/main` (`48b8d0a`) から作成して調査。
- 通常ワークツリーは未コミット差分が大量にあるため、本番相当判定には使わなかった。
- buildでは `useSearchParams` / `bailout` / `client-side rendering` 警告は再現なし。
- `next start` production runtimeで `BAILOUT_TO_CLIENT_SIDE_RENDERING` を再現。
- 原因は `headless/components/GoogleAnalytics.tsx` の `useSearchParams()`。
- `headless/app/layout.tsx` の `Suspense fallback={null}` により影響はGA subtree限定。
- `/`, `/area/[slug]`, `/shops`, `/shops/[slug]`, `/reviews/submit`, `/dashboard`, `/dashboard/analytics` のStatic/PPR状態を確認。
- JS無効時HTMLシェル、GA初回/page/query/back/clickイベントをPlaywrightで確認。
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 成功。
- コード変更、本番反映、WordPress、Supabase、DB、Secret変更なし。
- 証跡: `docs/technical/use-search-params-bailout-audit-2026-07-12.md`。


## 2026-07-12 Q-06 title / meta / canonical / noindex確認
- `origin/main` 相当のclean worktreeでmetadata生成経路を確認。
- `/reviews/submit/` は `noindex,nofollow` だがcanonicalがRoot Layout由来でトップへ継承されていたため、自己canonicalへ修正。
- `/dashboard/` と `/dashboard/analytics/` は管理画面にもかかわらず `index,follow` かつcanonicalがトップへ継承されていたため、noindex化と自己canonical化を実装。
- 変更ファイル: `headless/app/reviews/submit/page.tsx`, `headless/app/dashboard/layout.tsx`, `headless/app/dashboard/page.tsx`, `headless/app/dashboard/analytics/page.tsx`。
- 証跡: `docs/technical/q06-title-meta-canonical-noindex-audit-2026-07-12.md`。
- 検証コマンドは未実行。次にbuildで生成HTML確認が必要。


### Q-06 検証結果（2026-07-12）
- clean worktree `/tmp/escomi-tech02-use-search-params` で `npm run build` 成功。
- 440/440 pages generated。
- `/reviews/submit/`: `robots=noindex,nofollow`, canonical=`https://mens-esthe-kuchikomi.com/reviews/submit/` を確認。
- `/dashboard/`: `robots=noindex,nofollow`, `googlebot=noindex,nofollow`, canonical=`https://mens-esthe-kuchikomi.com/dashboard/` を確認。
- `/dashboard/analytics/`: `robots=noindex,nofollow`, `googlebot=noindex,nofollow`, canonical=`https://mens-esthe-kuchikomi.com/dashboard/analytics/` を確認。
- build時の `middleware` deprecation warning はTECH-01へ分離。


## 2026-07-12 トップページ構成修正
- スクリーンショット指摘に合わせ、トップページの `日本橋の注目店舗` セクションを削除。
- `注目エリアハブ` に `堺筋本町` と `堺・堺東` を追加し、PCでは5カード表示へ変更。
- トップビジュアルをスクリーンショットに近い大きな白いカード構成へ調整。
- タブレットは3列、スマホは1列に落ちるようレスポンシブを追加。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。次にブラウザ確認またはbuild確認が必要。


## 2026-07-12 日本橋エリア専用バナー削除
- スクリーンショット指摘に合わせ、日本橋エリアページの旧 `AREA FEATURE` 画像バナーを非表示化。
- 日本橋だけヒーロー画像枠を出さず、通常のエリア説明カードとして表示する条件を追加。
- 他エリアは既存のタイトルバナーまたは汎用テーマバナーを継続表示。
- 変更ファイル: `headless/components/area/AreaHubPageTemplate.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。次にブラウザ確認またはbuild確認が必要。


## 2026-07-12 トップページ・日本橋バナー修正 本番デプロイ
- `origin/main` から隔離作業ディレクトリを作成し、今回対象の3ファイルだけを載せてVercel本番へ直接デプロイ。
- 対象: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`, `headless/components/area/AreaHubPageTemplate.tsx`。
- Vercel buildでコンパイル、TypeScript、440ページ生成が成功。
- 本番alias `https://mens-esthe-kuchikomi.com` に反映済み。
- Deployment ID: `dpl_7QZgFJeySoPum37JwYnJ3q7PC9xo`。
- 注意: この本番デプロイはGitHubの `origin/main` へは未反映。後続で差分をPR/mergeしてソースと本番を同期する必要あり。


## 2026-07-12 トップページ完成形デザイン再構成
- スクリーンショット指摘に合わせ、トップページを完成形デザインへ再構成。
- ヒーローを左テキスト・検索・条件チップ、右統計カードの構成へ変更。
- 都道府県セクションは大阪・京都など地名カードに画像付きアコーディオンを追加。
- 重点エリア、条件検索、更新店舗、情報出自ラベル、初心者導線、店舗オーナー導線をデザイン枠として設置。
- 将来の口コミ・絞り込み・更新履歴機能に接続しやすいよう、リンクとDBメモを残した構成に整理。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。次にブラウザ確認またはbuild確認が必要。


## 2026-07-12 Escomi完成形デザインPDFの正本化
- 添付 `Escomi完成形デザイン.pdf` を確認。
- PDFはトップ、都道府県、地域詳細、店舗詳細、運用/分析ダッシュボード、デザインシステム、状態バリエーションを含む1ページ縦長カンプ。
- 正本PDFを `docs/design/escomi-final-design-source.pdf` に保存。
- 確認用PNGを `docs/design/escomi-final-design-source.png` に保存。
- 機能別の再現ルールと優先順位を `docs/design/escomi-final-design-implementation-map.md` に整理。
- 今後は機能単位でこのPDFの該当画面・状態を再現する方針に変更。


## 2026-07-12 P0 トップページ PDF 1a 追従
- PDF 1aの状態バリエーションに合わせ、トップページのデータ取得を `Promise.allSettled` 化。
- 店舗数取得失敗時もページ全体を落とさず、エリア導線と再読み込み導線を表示する設計へ変更。
- 都道府県件数の取得失敗時はカード導線を維持し、件数のみ「件数再取得」として表示。
- 更新店舗0件または店舗取得失敗時の空状態UIを追加。
- 検索候補なし状態に接続するための検索フィードバックUIテンプレートを追加。
- 変更ファイル: `headless/app/page.tsx`, `headless/components/HomePageContent.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。次にブラウザ確認またはbuild確認が必要。


## 2026-07-12 P0 トップページ PDF 1a 追従 本番デプロイ
- `origin/main` から隔離作業ディレクトリを作成し、トップページ対象の3ファイルだけを載せてVercel本番へ直接デプロイ。
- 対象: `headless/app/page.tsx`, `headless/components/HomePageContent.tsx`, `headless/app/globals.css`。
- Vercel buildでコンパイル、TypeScript、440ページ生成が成功。
- 本番alias `https://mens-esthe-kuchikomi.com` に反映済み。
- Deployment ID: `dpl_5418toHQfLrWU4c3SDCJjZy289jw`。
- 注意: この本番デプロイはGitHubの `origin/main` へは未反映。後続で差分をPR/mergeしてソースと本番を同期する必要あり。


## 2026-07-12 P0 地域詳細ページ PDF 1c 追従
- 地域詳細ページの店舗一覧に、モバイル用の下部シート風フィルター導線を追加。
- フィルター結果0件時に、外す条件候補と増加件数を提示する空状態UIを追加。
- ランキング対象が10件未満の場合、順位番号ではなくピックアップ表示へ降格する制御を追加。
- PR枠は自然ランキングとは別枠であることが視覚的にも分かるよう、PR枠ラベルを強化。
- 口コミ0件時のCTA文言をPDF 1cの口コミ募集文脈に寄せて修正。
- 変更ファイル: `headless/components/area/area-hub-content.tsx`, `headless/components/area/hub/RankingHeroCards.tsx`, `headless/components/area/hub/AreaShopList.tsx`, `headless/components/area/AreaLatestReviews.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。次にブラウザ確認またはbuild確認が必要。


## 2026-07-12 トップページ細部レイアウト調整
- ヒーロー見出しを `関西メンズエステ口コミナビ` に変更。
- 手動改行を削除し、見出し・説明文の文字サイズと行間を調整。
- 改行崩れを抑えるため、見出しに `text-wrap: balance` と最大幅を追加。
- 都道府県パネルをサムネイル型から画像背景型に戻し、開閉時に詳細が広がるアコーディオン風UIへ調整。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`。
- 検証コマンドは未実行。開発サーバー上で目視確認が必要。


## 2026-07-12 トップページ文字サイズ・モバイル崩れ修正
- ヒーロー見出しを正式名 `関西メンズエステ口コミナビ` のまま維持し、PC/スマホで大きすぎない最大サイズへ調整。
- 公開画面に出ていた内部向けDBメモ表示をトップページから削除。
- 都道府県・重点エリアは既存の完成形部品 `KansaiAreaGrid` / `AreaFeatureSection` に戻し、画像アコーディオン保持テストと整合。
- 初心者向け手順の説明文が番号列に入って縦に潰れる問題をCSSグリッド指定で修正。
- 条件カード、更新店舗カード、統計カードの横はみ出しを抑える `min-width: 0` とレスポンシブ指定を追加。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`, `pm/PROGRESS.md`。
- 検証結果: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 成功。
- Playwrightで `http://localhost:3013/` を 1440/768/390/360px で確認。H1正式名、横スクロールなし、DBメモ非表示、初心者向け説明の縦潰れなしを確認。
- スクリーンショット: `/tmp/escomi-home-desktop.png`, `/tmp/escomi-home-mobile390.png`。
- 本番、WordPress、Supabase、DB、Secret、デプロイは変更なし。


## 2026-07-12 トップページ修正 本番デプロイ再試行
- トップページ文字サイズ・モバイル崩れ修正を `origin/main` へ反映するため、隔離作業ディレクトリからGitHub Actionsデプロイを実行。
- 初回ActionsはVercel build中のWordPress API接続タイムアウトで失敗。
- `lib/wp/origin-request.ts` にWP origin接続タイムアウトを追加し、長時間待機でビルドが止まる問題を防止。
- `area`, `column`, `shops`, 固定ページのWP取得失敗時に、静的生成・一覧表示・固定本文フォールバックへ逃がす処理を追加。
- Cache Componentsでは `generateStaticParams` が空配列を返せないため、WP取得失敗時は既知パス1件を返すよう調整。
- 再発防止として `scripts/check-wp-build-resilience.mjs` と `npm run test:wp-build-resilience` を追加。
- 検証結果: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `WP_ORIGIN_TIMEOUT_MS=1 npm run build` 成功。


## 2026-07-12 エリア詳細イラスト枠・トップスライダー修正
- エリア詳細ページのヒーローから、画像なしでも残っていた大型イラスト/バナー枠を削除。
- トップ「大阪の特集エリア」スライダーのスマホ画像を180pxサムネイル化し、カード下部が切れにくい形へ調整。
- 変更ファイル: `headless/components/area/AreaHubPageTemplate.tsx`, `headless/app/globals.css`。
- 検証結果: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` 成功。
- Playwrightで `http://localhost:3025/area/umeda/` のヒーロー画像枠0件、`http://localhost:3025/` のスマホスライダー画像5枚・矢印2つ・ドット5つを確認。


## 2026-07-13 共通タイポグラフィ・エリア写真バナー化
- トップで整えた見出し階層、本文サイズ、タグ表示を共通CSSと `ResponsiveTag` 部品へ整理し、店舗カード・エリアカード・ランキング周辺へ適用。
- エリアページのトップバナー背景を、トップ「大阪の特集エリア」で使う街並み画像と同じ解決ロジックに変更。WordPressの `home-featured-areas` が入れば管理側の画像を優先し、未設定時は静的フォールバックを使う。
- エリア詳細のヒーローは写真背景＋暗めのオーバーレイにし、モバイルでも長い見出し・説明文・タグが右にはみ出さないよう調整。
- Supabase接続は新しい `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` を優先し、既存互換で `NEXT_PUBLIC_SUPABASE_ANON_KEY` も読めるようにした。
- 変更ファイル: `headless/app/area/[slug]/page.tsx`, `headless/components/AreaHero.tsx`, `headless/components/AreaPageView.tsx`, `headless/components/area/AreaHubPageTemplate.tsx`, `headless/components/common/ResponsiveTag.tsx`, `headless/lib/design-constants.ts`, `headless/lib/dashboard-config.ts`, `headless/app/globals.css`, `headless/.env.example`, `pm/RUNBOOK.md` ほか。
- 検証結果: `git diff --check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 成功。
- Playwright CLIで `http://localhost:3015/` 390px、`/area/umeda/` 390px、`/area/nihonbashi/` 1440px を確認。トップは大きな構成変更なし、エリアページは街並み写真背景として表示。
- 注意: build時点では WordPress `home-featured-areas` API が404のため、現状は静的フォールバック画像で表示。本番デプロイ・Gitコミット・pushは未実行。


## 2026-07-13 トップビジュアル夜景スライド化
- トップヒーロー背景を大阪・関西の夜景写真5枚のCSSスライドショーへ変更。
- 写真は約5秒間隔でフェードし、黒フィルターと白ベースの文字に切り替えて、検索欄と集計パネルは既存構成を維持。
- 画像の表示位置は中央より少し上寄りにし、PC/スマホともに夜の街並みが背景として見えるよう調整。
- 追加画像: `headless/public/images/home-hero/osaka-night-alley-lanterns.jpg`, `kansai-night-station-street.jpg`, `kansai-night-food-street.webp`, `osaka-night-sign-street.jpg`, `osaka-senba-night-road.jpg`。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`, `pm/PROGRESS.md`。
- 検証結果: `git diff --check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` 成功。
- Playwright CLIで `http://localhost:3016/` をPC 1440pxの1.2秒後/6.2秒後、スマホ390pxで確認。背景の切り替わり、白文字、検索欄、集計パネルの視認性を確認。
- 本番デプロイ・Gitコミット・pushは未実行。


## 2026-07-13 エリア特集カード黒背景の白文字化
- トップ「大阪の特集エリア」カードで、黒フィルター上の地域名・説明文・ステータス文字が黒系に戻っていた問題を修正。
- 共通見出しルールは維持しつつ、写真背景カード内だけ白文字と黒影に上書きし、地域名・本文・掲載店舗数が読みやすい状態に調整。
- 変更ファイル: `headless/app/globals.css`, `pm/PROGRESS.md`。


## 2026-07-13 トップ情報出自セクション AI要約非表示
- トップページ「情報の出自を分けて掲載しています」から、前面訴求しない `AI要約` 行を削除。
- 表示対象を4種類に合わせ、説明文の件数も `5種類` から `4種類` に修正。
- 変更ファイル: `headless/components/HomePageContent.tsx`, `headless/app/globals.css`, `pm/PROGRESS.md`。


## 2026-07-13 トップヒーロー集計カード白背景・黒フィルター薄め調整
- トップヒーロー右側の集計カードを半透明ではなく白背景にし、背景写真の黒フィルターがカードにかかったように見える状態を解消。
- 夜景背景の黒オーバーレイを全体的に約1段階薄くし、文字の視認性を保ったまま街並みが少し見えるよう調整。
- モバイル表示で `382 店舗` の単位が下段へ回り込まないよう、集計カードの先頭行を横並びで固定。
- 変更ファイル: `headless/app/globals.css`, `pm/PROGRESS.md`。


## 2026-07-13 地域詳細 店舗一覧フィルターURL同期・ゼロ件復帰導線
- トップページのデザインは変更せず、地域詳細ページの店舗一覧だけを対象に要件定義の `1c 地域詳細` を前進。
- 店舗一覧の絞り込み・並び替えをURLへ同期し、`filters=` / `sort=` 付きURLで再表示・共有できるようにした。
- モバイルでは既存CSSの折りたたみフィルターUIを実際に使用し、一覧上部の表示密度を抑えた。
- 条件0件時に、外すと候補が戻る条件と件数を提示する復帰導線を追加。
- 変更ファイル: `headless/components/area/hub/AreaShopList.tsx`, `headless/components/area/hub/AreaFilterChips.tsx`, `headless/lib/area-shop-list-controls.ts`, `headless/scripts/check-final-design-preservation.mjs`, `pm/PROGRESS.md`。


## 2026-07-13 店舗詳細完成形・主要エリアHub横展開
- トップページのデザインは変更せず、店舗詳細と地域詳細テンプレートを対象に実装。
- 店舗詳細ページへ、店舗画像のビジュアルデッキ、料金・口コミ・予約導線の信頼情報レール、料金/口コミ/基本情報/問い合わせを揃えるセクショングリッドを追加。
- 地域詳細ページのランキング直上に、公開情報・料金・営業時間・予約導線・更新状況を基準にした編集部整理であることを明記。
- `HUB_TEMPLATE_AREAS` を主要5エリアへ横展開。対象: 堺筋本町 `sakaisujihonmachi`、新大阪 `shinosaka`、日本橋 `nihonbashi`、梅田 `umeda`、堺・堺東 `sakai`。
- 堺筋本町の実slugを本番WordPressに合わせ、旧 `/area/sakaisuji-hommachi/` は `/area/sakaisujihonmachi/` へ308リダイレクト。
- 変更ファイル: `headless/components/ShopDetail.tsx`, `headless/components/area/area-hub-content.tsx`, `headless/lib/area-hub-config.ts`, `headless/lib/design-constants.ts`, `headless/lib/area-content-integrity.ts`, `headless/app/area/[slug]/page.tsx`, `headless/next.config.ts`, `headless/app/globals.css`, `headless/scripts/check-final-design-preservation.mjs`, `pm/PROGRESS.md`。
- 検証結果: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` 成功。
- ローカルHTTP確認: `/area/sakaisujihonmachi/`, `/area/shinosaka/`, `/area/nihonbashi/`, `/area/umeda/`, `/area/sakai/`, `/shops/milk-tea.../` が200。旧堺筋本町slugは308。
- Playwright CLIで `/shops/milk-tea.../` 390px と `/area/sakaisujihonmachi/` 1440px のスクリーンショットを確認。


## 2026-07-13 Q-07 FAQ / schema出力条件確認
- SEO事故防止のため、FAQPageと店舗LocalBusiness JSON-LDの出力条件を明示的に検査。
- `faqJsonLd` は空配列・質問または回答が空のFAQ行では `null` を返し、FAQPage schemaを生成しないよう変更。
- `AreaHubPageTemplate` は `faqJsonLd` がschemaを返す場合だけFAQPage JSON-LDを出力するよう変更。
- `AreaFaqSection` はFAQ行0件の場合に表示セクション自体を描画しないよう変更。
- `shopLocalBusinessJsonLd` がACFの `review_count` / `review_star` / `shop_ai_summary` だけで `aggregateRating` や `review` を出力しないことを再発防止テストで固定。
- 追加テスト: `headless/scripts/check-schema-output-conditions.mjs`、npm script `test:schema-output`。
- 検証結果: `npm run test:schema-output` 成功、`npm test` 成功、`npm run typecheck && npm run lint && npm test && npm run build && git diff --check` 成功。
- ローカル本番HTML確認: `/area/sakaisujihonmachi/` は `BreadcrumbList` / `ItemList` / 有効な `FAQPage`、`/area/osaka/` は `BreadcrumbList` のみ、`/shops/milk-tea.../` は `HealthAndBeautyBusiness` のみ。3ページとも `AggregateRating` 0件、空FAQPage 0件。
- 次の候補: schema条件の本番HTML確認後、`S-40` 主要内部リンク整理または `MIG-00` WordPress依存調査。


## 2026-07-13 S-40 主要内部リンク整理
- SEO回遊導線の強化として、地域Hubページに `NEXT CHECK` の内部リンク枠を追加。
- 地域Hubから店舗一覧、同ページ内ランキング、料金比較、初心者向け、関連エリアへ移動できるようにした。
- 地域詳細の店舗カードから店舗詳細へ進む導線をS-40専用テストで固定。
- 店舗詳細のパンくずに所属エリアリンクを追加。
- 店舗詳細上部のクイックナビに、同エリアランキング、同エリア料金比較、口コミ投稿へのリンクを追加。
- 既存の `ShopAreaHubLinks` による店舗詳細下部のランキング、料金比較、口コミ導線もS-40専用テストで固定。
- 追加テスト: `headless/scripts/check-internal-link-map.mjs`、npm script `test:internal-links`。
- 検証結果: `npm run typecheck && npm run lint && npm test && npm run build && git diff --check` 成功。
- ローカル本番HTML確認: `/area/sakaisujihonmachi/` はS-40内部リンク枠、店舗一覧、ランキング、料金比較、初心者向け、関連エリア、店舗詳細リンクが欠落なし。`/shops/milk-tea.../` は同エリアランキング、同エリア料金比較、口コミ投稿リンクが欠落なし。


## 2026-07-15 GA4・Search Console初期設定完了
- GA4の対象プロパティ「関西メンズエステ口コミナビ」（プロパティID `531229543`）と測定ID `G-6XFMW5XKBW` を確認。
- 本番ウェブストリーム `https://mens-esthe-kuchikomi.com`（ストリームID `14311325096`）が過去48時間以内のデータを受信していることを確認。
- Xserver DNSへSearch Console所有権確認用TXTを追加し、ドメインプロパティ `mens-esthe-kuchikomi.com` の所有権確認に成功。既存SPFレコードは維持。
- `https://mens-esthe-kuchikomi.com/sitemap.xml` は送信済み・読み込み成功・425ページ検出を確認。
- URL検査結果: トップ、堺筋本町、堺、大阪日本橋、新大阪はGoogle登録済み。梅田は「クロール済み - インデックス未登録」だったため、優先クロールキューへの追加を実行。
- GA4とSearch Consoleのドメインプロパティを本番ウェブストリームへ連携し、GA4管理画面のリンク一覧に2026-07-15付で表示されることを確認。

## 2026-07-16 Owner Task 4 ローカル統合検証の停止状態

- 店舗責任者申請はlocal Supabaseの非公開審査キューで検証済み。
- WordPress公開情報とSupabase公開viewは変更していない。
- 本番migration、Secret登録、本番申請保存、push、deployは未実施。

## 2026-07-16 店舗詳細・Phase 4 本番反映準備

- 実装一式をコミットし、最新 `origin/main` を競合解消して統合した。
- Nodemailerを9.0.3へ固定し、High advisoryを解消した。別担当の再レビューは全分類0件で公開可。
- 全test、lint、typecheck、441ページbuildが成功し、npm監査はHigh / Critical 0件。
- 誤接続していた別サービスのSupabase projectは書き込みなしでunlinkした。
- 正しいエスコミ本番Supabase `goeagrxjsjcbbatpotbu` を接続済みChrome profileで照合した。
- 本番へmigration `20260716003830_shop_owner_requests.sql` をtransaction適用し、履歴、2テーブル、RLS、匿名・authenticated拒否、service role権限を確認した。
- Vercel Productionへ `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SHOP_OWNER_REQUEST_RATE_LIMIT_SECRET` を値非表示で登録した。
- WordPress公開情報とSupabase公開viewは変更せず、`main` push・Vercel deploy前で進行記録を更新した。

## 2026-07-16 店舗詳細・Phase 4 本番反映完了

- 実装反映commit `badd4f9` を `main` へpushした。
- GitHub ActionsはVercel run `29504137602`、Xserver run `29504137607` が成功した。
- Vercel production deployment `https://escomi-headless-g7shr3mav-narikiyos-projects.vercel.app` はREADYで、本番URL `https://mens-esthe-kuchikomi.com` へ反映済み。
- トップ、堺筋本町、代表3店舗、店舗登録ページはHTTP 200。申請APIは不正な空入力を400で拒否し、申請・rate limitテーブルは0件のまま。
- PC 1440pxとスマホ390pxで、横スクロール0、4:3画像、店舗責任者導線、スマホ固定導線を確認。画像なし店舗も代替画像が4:3で表示された。
- 本番Supabaseのmigration履歴、RLS、匿名拒否、service role権限を確認。Security / Performance Advisorはともにerror 0 / warning 0。
- Phase 4の調査値は非公開候補のまま維持し、WordPress公開情報、Supabase公開view、公開参照先は変更していない。

## 2026-07-18 Phase 17 店舗詳細・AI管理・セラピスト連動 設計完了

- 店舗詳細を1カラム・二層anchor menu・口コミ優先・基本情報下部へ再構成する設計書を更新した。
- 口コミgraphはWordPress `reviews`の承認済み実データ3件以上だけを使い、最新3件と専用口コミ一覧、AggregateRatingを共通adapterへ統一する。
- 管理者がCodex/ChatGPT向け調査指示書を生成し、JSON/CSVを非公開stagingへ取込み、差分・出典・観測日を確認後、承認fieldだけWordPressへ反映する別設計書を追加した。
- 店舗情報の確認状況は料金・営業時間・アクセス・予約・公式URL・画像の6項目とし、field別provenanceと公開値hashが一致する場合だけ確認済みにする。
- セラピストはWordPress `therapist`、出勤は`therapist_schedule`を正本にし、店舗詳細・セラピスト詳細・トップ・一覧・地域を共通IDで連動する。
- security読取監査で既存REST保護解除、匿名debug、任意meta更新、Authorization転送、cache fail-openを確認した。実装順0番の安全化が完了するまで新管理書込を接続しない。
- architecture・securityの独立再レビューはCritical 0 / Important 0 / Go。Google評価は対象外、公式site crawlerと外部portal月次取得は後工程とした。
- 現在はユーザーの改訂設計書確認待ち。コード実装、WordPress/Supabase書込、push、deploy、本番公開は未実施。

## 2026-07-18 Phase 17 設計承認・実装計画作成

- ユーザー承認により、既存の分析ダッシュボードを共通管理shellとし、管理routeを実装済みのものから同じnavigationへ追加する方針を確定した。
- 実装計画を8タスクへ分割した。最初にWordPress REST、日次更新bridge、Dashboard認証・再検証を安全化し、その後に共通shell、承認済み口コミ、評価graph/schema、確認状況・順位・1カラム二層menu、全幅QAを行う。
- 日次jobの互換性を維持するため、callerの認証headerを転送せず、専用secretとserver-only WordPress Application Passwordを使うexact path bridgeを計画した。
- push・deploy・本番WordPress/Supabase操作は実装と独立レビューの完了後も別の明示許可まで行わない。

## 2026-07-18 Phase 17 実装計画承認

- 8タスク実装計画を独立レビューし、Critical 0 / Important 0 / Goを確認した。計画上のMinor 1件は3つのPHP構文確認という正しい文言へ修正した。
- Phase 0安全化から順に、各Taskを実装担当と別担当レビューへ分離して進める。
- 計画承認時点でコード実装、WordPress/Supabase書込、push、deploy、本番公開は行っていない。

## 2026-07-18 Phase 17 Task 1 WordPress REST安全化

- 日次更新routeを専用権限・店舗編集権限・UUIDv4・3項目allowlist・上限検証・店舗単位lock・rollback付きへ縮小した。匿名debug、認証解除、重複route、固定認証値は削除した。
- `ai_update_log`は管理画面だけの非公開CPTとし、実変更時だけ監査を残す。履歴、監査、lock解放の失敗は秘密値を含めない運用logと明示errorへ変換した。
- 追跡済み`.env`とSFTP設定をGit追跡外へ移し、WordPress、Gemini、Xserver SFTP/FTP候補の失効・再発行を本番前の必須確認へ追加した。
- 3回の独立レビュー修正後、Critical 0 / Important 0 / Minor 0、Ready Yes（ローカル実装）。外部ローテーション表は`required`のためpush、deploy、本番操作は不可のまま。

## 2026-07-18 Phase 17 Task 2 日次更新bridge

- 公開`wp-json`のPOSTを日次route完全一致へ限定し、受信Authorization破棄、3環境変数fail-closed、timing-safe比較、256KB上限、server-only Basic認証、no-storeを実装した。
- 日次・毎時callerは専用secretとUUIDだけへ移行し、月次・料金・汎用crawlerの公開書込と月次scheduleを停止した。旧直接POST文書も安全なbridgeまたは実行禁止へ更新した。
- review修正で設定例、Headless URL要件、Content-Type限定、stream cancel失敗、GET/HEAD/POST response契約を補強した。
- 独立最終レビューはCritical 0 / Important 0 / Minor 0、Ready。外部ローテーションと本番3環境変数設定は未実施のためpush・deploy禁止を維持する。
