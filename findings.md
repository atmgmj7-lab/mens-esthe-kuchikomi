# Findings & Decisions

## 2026-08-16 UX-PROD-T3A-RESUME-PRIMARY-AWARE-01

- 専用branchは`codex/eskomi-ux-production-t3a-primary-aware`、worktreeは`/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-eskomi-ux-production-t3a-primary-aware`、baseは`2bc9fb07de4830bb266d246ccae20b4273a563a8`である。
- runtimeのPrimary正本は`ShopView.primaryArea`だけとし、preview JSONはcontract/browser fixture以外から参照しない。名前、住所、slug、term順による所属推測は行わない。
- precision modeはArea ID 17/13/7/46/4の5件だけに適用する。主一覧は`primaryArea.id === currentArea.id`、legacy relationがある別PrimaryはRELATED、Primary nullはUNCLASSIFIEDとする。
- canonical WP IDで重複を拒否し、同じ表示名でもIDが違えば別店舗として維持する。previewの6/3/12/18/5はfixture検査値でありproduction UIへ固定値として埋め込まない。
- 現行Area Hubはlegacy relationの全店舗を単一一覧へ渡し、formal rankがなくても配列順から順位を作る経路がある。初心者・駅filter/moduleも有効data 0で残るため、priority5側だけfail closedへ改める必要がある。
- `shop_access`は広い自由文で、単独では正式station dataへ昇格しない。専用station fieldと徒歩情報を同時に満たさない場合、駅module/filter/copy/countをDOMへ出さない。
- URL、canonical、sitemap、robots、title/H1の全面変更、SEO長文、FAQ、新storage、本番書込、dependency更新は今回の範囲外である。
- 初回実装の独立レビューで、priority5が旧`escomi_area_shop_rankings`を正式順位として読み得ること、共通順位/駅helperが非priorityまで変更されたこと、副次店舗がfull cardで長すぎること、空の比較/価格moduleが残ること、browser fixtureが本番component/CSSを直接使っていないことをCritical/Importantとして確認した。
- 正式`ranking_configuration`は現契約で`storage-not-configured`のため、priority5は旧順位endpointを取得せず、順位module・順位badge・旧順位sort・PR順位をすべて出さない。非priorityの旧順位normalizer、駅helper、RankingHeroCardsは初回baseと完全一致へ戻した。
- priority専用の駅判定は専用駅fieldに「駅」があり、同fieldまたは専用徒歩fieldに徒歩分数がある場合だけtrueとする。汎用`shop_access`はpriority判定へ使わない一方、非priorityの従来判定は維持する。
- RELATED/UNCLASSIFIEDは店舗IDをDOMへ保持したSSRの通常link一覧へ変更した。同名別IDを別行として維持し、PCは2列、767px以下は1列、1行48〜52pxで全店舗をcrawl可能なままfull cardより大幅に短縮した。
- 実`AreaHubPageTemplate`、`AreaShopList`、`AreaShopCard`、production CSSを一時Next routeから読むfixtureへ変更した。一時route/appは検査後に削除し、repoへ本番routeを残さない。fixture 55とcurrent-data fail-safe 55の計110 scenarios・1,400 assertions・20 screenshotsがfailure 0となった。

## 2026-08-16 UX-AREA-PRIMARY-BACKFILL-PREVIEW-01

- 今回の書込候補母集団はWork成果物214件のうち`VERIFIED_EXACT` 44件だけであり、他statusはpreview recordへ混入させない。
- 現行Primary契約が本番へ反映済みとは確認できないため、公開RESTに明示値がなくても`null`とは断定せず`NOT_VERIFIED_CONTRACT_NOT_PRODUCTION`として記録する。
- `READY_PRIMARY_ONLY`は対象termが現在のArea relationに含まれる場合だけ許可し、legacy relationは削除・置換しない。
- 指定名`priority5-area-mapping.json`の独立fileはworkspace/Downloadsに存在しなかった。Work JSONの`canonicalAreas`を読み、taskで固定された5組（ID・slug・label・route）と完全一致する場合だけ採用し、さらに公開WordPress Area 34件のID/slugへ照合する。
- 入力SHA-256は`0c64cec9c8be2e96495abc0c9acc9149e779de2fefeef08de1c614c77964309e`。214件、EXACT 44、NEARBY 1、REVIEW 156、UNRESOLVED 13、重複ID 0、source/observedAt欠損0、Exact以外のPrimary候補0を確認した。
- 変更前`npm test`はexit 0。focused REDは判定module不存在でexit 1、次のREDはGET専用generator不存在でexit 1となり、意図した未実装点を確認した。
- 公開WordPress RESTをGETのみで再取得し、要求44件に対して44件、Area 34件を受信した。44件すべてID/slug/publish/title/modified_gmt/target relationが一致した。
- preview分類はREADY_PRIMARY_ONLY 44、NEEDS_AREA_RELATION_ADD 0、STALE_OR_IDENTITY_CONFLICT 0、EVIDENCE_OR_MAPPING_CONFLICT 0。legacy複数relationを含むShopもrelationを保持するwrite previewである。
- 独立security reviewの初回Important 3を再現した。`unofficial-portal`の誤通過、userinfo付きURL、空identity一致をtestへ追加し、official source type明示許可、URL credential拒否、identity非空必須へ修正した。

## 2026-08-16 UX-AREA-PRIMARY-CONTRACT-01

- 専用branchは`codex/ux-area-primary-contract-01`、worktreeは`/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-ux-area-primary-contract-01`、baseは`649d2474f6029de16b10cd4bf53f55338843cadf`である。
- T3-Aの未commit draft worktreeと元のcheckoutは変更しない。
- WordPress実コードにはPrimary Area相当のACF/metaが存在しない。`shop-public-meta.php`の既存正式metaは`shop_fact_provenance`と`shop_area_ranking_snapshot`で、`shop_*`命名と権限付き保存を採用している。
- `functions.php`の`area_slug`は`get_the_terms()`から最初の子term、なければ配列先頭を返すlegacy値である。これは明示値ではなく、今回のPrimary Areaとして使用しない。
- 既存Supabaseには`app.shop_areas.is_primary`と1店舗1件のpartial unique indexがあるが、既存移行値はfalseで、`docs/data/supabase-wp-field-map-2026-07-14.md`も「配列順から推測しない」と明記している。今回Supabaseは変更しない。
- 正式保存keyは既存命名規則に合わせて`shop_primary_area_term_id`とする。値は単一の正整数term IDだけを受け、taxonomyが`area`かつ対象Shopの正式Area関係に含まれる場合だけ有効とする。
- 保存値0、空、不正形式、存在しないterm、別taxonomy、関係外termは公開readerで`null`にする。別Areaや`area_slug`へのfallbackは行わない。
- REST書込み契約は今回追加しない。公開read値は既存`acf` envelopeへ安全に追加し、Next側で埋込みArea termと照合して`ShopView.primaryArea = { id, slug, name } | null`へ正規化する。
- `ShopView.terms`とlegacy `areaSlug`は互換維持のため残す。公開Area一覧・Area SEO・将来Area rankingがPrimary Areaへ切り替わるのはT3-A以降の別taskである。
- 移行候補のAUTO_SAFEは、(1)有効Area関係が1つだけ、または(2)一意の末端Areaがあり他の関係がすべてその祖先、に限定する。複数末端、無関係term、階層cycle、親情報欠落はNEEDS_REVIEW、Area関係0はUNCLASSIFIEDとする。
- 候補生成は店舗名、住所、slug文字列、検索結果、REST配列順、既存`area_slug`を判断材料にしない。同名店舗でもWP IDが異なれば別Shopとして1行ずつ扱う。
- 候補JSONはread-only公開WordPressから全Shopと全Areaを取得し、`wpShopId`、slug、表示名、全関係、提案Primary、分類、機械判定理由を記録する。書込み処理は持たせない。
- `docs/ai-skills.md`と`RTK.md`はbaseに存在しない。既存AGENTS.md、`.cursorrules`、pm資料、repo実コードを使う。
- 2026-08-16の公開RESTはShop 380、Area 34。過去382件から減った2件は既存運用で意図的にdraft化した温泉投稿ID 1259/1255であり、今回の公開Shop候補母集団は380件である。
- 380件の分類結果はAUTO_SAFE 175、NEEDS_REVIEW 130、UNCLASSIFIED 75。AUTO_SAFE内訳は単一relation 76、一意leaf+ancestor 99。NEEDS_REVIEW 130はすべて複数leaf、Areaなし75はUNCLASSIFIEDである。
- generatorの初回Node fetchは公開domain接続timeoutとなり、成果物を書かず停止した。既存正式origin IPへHost名/TLS検証を保ったGET接続へ変え、2回目は全ページ取得に成功した。
- 初回security reviewのImportant 4件により、Area source rowの`taxonomy=area`必須、`shop.area`欠落時のreport failure、Next termの非空slug/name、pagination header/途中変化/部分件数のruntime fixtureを追加した。最終再reviewはCritical/Important/Minor 0。

## 2026-08-16 UX-PROD-T2-RESUME

- 専用branch `codex/eskomi-ux-production-t2-resume`、worktree `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-ux-production-t2-resume` をbase `b785315a2a3cd490772fd70cd18bb1f8b21f2f75`から作成した。
- 元のmain checkoutには既存の未完了ファイルがあるため、以後の変更は専用worktreeだけで行う。
- 承認済みT2の核は、Topの意味順、global approved reviewsのSSR表示、新規`/reviews/` Hub、投稿CTA、実dataだけのUpdates、strict ranking unavailable時のsection非表示、重点5Areaへの通常linkである。
- 禁止範囲はT3/T4、new storage、dependency、Secret、push、deploy、本番変更である。
- `docs/ai-skills.md`と`RTK.md`はbase worktreeに存在しない。AGENTS.md、`.cursorrules`、既存計画・進捗・blockerを正本として継続する。
- Downloads内の`(1)`付きHandoff/Data Contractは同名の非`(1)`版とSHA-256が一致し、内容の重複である。今回指定された`(1)`版を読む。
- 修正版production planは旧T0専用worktreeの`docs/superpowers/plans/2026-08-15-eskomi-ux-production.md`にある。実装差分は持ち込まず、計画だけを参照する。
- 添付taskにある`npm run test:internal-link-map`というscript名は現packageにはなく、同等の正式scriptは`npm run test:internal-links`である。
- YAMLの旧home section orderでは`new_reviews`が後段だが、承認済みproduction planが表示順だけを限定overrideし、T2はHero/search→start points→new reviews→strict ranking（有効record時だけ）→Updates→priority Area→その他とする。
- `/reviews/`はqueryなしだけindex候補。query付きfilter/searchはcanonical `/reviews/`、`noindex, follow`とし、sitemap/static paramsへ組合せURLを追加しない。
- strict overall ranking storageは未設定なので、T2ではsection、順位、ranking schemaをすべて非表示にし、既存おすすめ順や口コミ点数から生成しない。
- Updatesの正式候補はapproved review、公開shop、公開column。schedule/therapist/coupon/helpful/shop replyは正式sourceがないためtab/空枠ごと出さない。
- 実装とreviewは分離し、Critical/Important 0になるまでcommitしない。stageは対象path名を明示し、push/deploy/WordPress/Supabase/Secret操作は行わない。
- 新worktreeは`npm ci`後もaudit vulnerability 0、変更前の`npm test`が全件PASSした。以後のfailureはT2差分に帰属できる。
- `headless/lib/wp/reviews.ts`にはglobal reader、exact-key validation、`wp`/`reviews:global` cache tag、source identity、deep freezeが既にある。T2で別adapterやPHP endpointを増やす必要はない。
- 現TopはHero直後に`KansaiAreaGrid`/`AreaFeatureSection`があり、条件・掲載店舗・provenance/guideへ続く。approved reviewとcolumnはTopへ未接続である。
- 現Topの固定hidden検索失敗文と未検証`初心者向け`filterは承認済みplanに従って削除する。一方、料金掲載など実filter契約がある既存条件linkは「既存その他content」として下段に保持する。
- Headerの口コミ導線は現在`/reviews/submit/`、Footerは投稿だけである。T2ではHeaderを`/reviews/`、FooterをHubと投稿の2導線に分ける。
- `HomePageContent`は`posts` propを受け取るが未使用。公開columnをUpdates Hub/編集部コラムへ接続できる既存sourceである。
- global REST/readerの公開query contractは`page`と`per_page`だけで、area/searchは受けない。accepted readerを拡張せず、Hub filterは「表示中の最新口コミ」をSSRで絞る最小機能として明示する。
- `StrictRankingAvailability`は現状`storage-not-configured`のunavailable型だけである。T2の`ScopedRankingModule`はこの値を受けて`null`を返し、公開順位やschemaを発明しない境界にする。
- `/reviews/submit/`のcontextなし状態は現在日本橋一覧だけへ誘導する。既存`getAllShopsForListing()`とshop termsで公開店舗select・area frontend-only prefilterを追加でき、投稿API payloadは`shopSlug`のまま維持できる。
- `KansaiAreaGrid`は0件地域へ`掲載準備中`を出す既存の公開状態契約を持つ。Reviews Hubの未契約機能を準備中cardにしない要件とは別なので、T2ではこの既存Area componentを変更しない。
- 既存`test:portal-browser-layout`はShop/Area/shops専用のDOM前提が強く、Top/Reviews routeを単純追加すると既存card geometry contractを誤適用する。T2は専用focused browser scriptを追加し、全指定幅・route・H1・overflow・CTA・keyboard/focus・section順を測る。
- Focused contract testsは、文字列grepだけにせず、pure filter/update modelを実入力で実行し、ReviewCard/ReviewsHub/HomePageContentをserver renderして利用者が見るDOM順・link・非表示境界を検査する。
- 複数語検索は連続文字列一致では日本語助詞を挟む本文を落とすため、正規化後の空白区切り語をすべて含むAND検索にする。
- 添付動画はAVFoundationで00:03、00:10、00:18、01:05、01:13のframeを抽出して確認した。白〜薄いneutral背景、細いborder、明朝の大見出し、teal CTA、密度の高い更新row、余白を取った1列口コミcard、Header/tab/footerの一定したリズムをvisual referenceとして採用する。
- 動画の表示順は追加指示で上書きし、Topでは口コミをranking/Updatesより上へ、Reviews Hubでは架空の参考数・セラピスト・ratingを出さない。実在するapproved reviewと正式relationだけをSSR表示する。
- 動画内の架空店舗・架空口コミ・helpful数はdata sourceにせず、layout/density/color/border/typographyだけを参照した。
- Next.js 16.3.1のCache Componentsでは、`searchParams`を直接awaitするroute contentはprerenderを阻害する。既存`/shops/`とArea routeはdefault exportの静的shellからSuspense内のasync contentへPromiseを渡すため、`/reviews/`も同じ境界に揃える。review reader自体の`use cache`/tag契約は変更しない。
- local production serverでは未公開のglobal endpointを利用できず、Top review previewは非表示、Reviews Hubは取得不能を明示した。available card/search-emptyはpure render test、実card layoutはproduction component/CSS fixtureで検証し、取得不能を0件へ偽装していない。
- browser QAはSuspense fallback消滅、settled main 1、visible H1 1を条件待機する。全11幅の実route 55 scenarioに、production ReviewCard/CSS fixture 11 scenarioを加え、1列/2列、長い日本語店名、複数Area link、overflowを必須化した。
- 新規配色はteal `#006f72`（白とのcontrast 5.97:1）、gold `#755a16`（白とのcontrast 6.50:1）へ調整し、focus outlineも不透明tealで3:1以上をbrowser実測する。
- `/reviews/`のsitemap追加は技術的には固定entry追加で可能だが、承認済みplanが別承認まで追加しないと明示しているため、T2では既存sitemapを変更せずHeader/Footer/Topからcrawlable linkを出す。

## Requirements

- SEO目標を妨げない範囲で、WordPressからSupabaseへの移行計画を実装する。
- 今後、店舗本文・口コミ・地域説明・出典・確認日を増やしやすい構成にする。
- 公開URL、canonical、サイトマップ、現在のWordPress表示は今回変えない。
- 当初は本番Supabase作成・投入前で停止していた。今回の承認後、許可範囲はschema適用と3店舗・30店舗の非公開試験まで拡大した。
- 2026-07-14、ユーザーが作成済み本番Supabaseへの接続と3店舗の非公開試験投入を承認した。
- 2026-07-14、ユーザーが3店舗試験の成功後に30店舗の非公開試験へ広げることを承認した。
- 公開参照先、WordPress、URL、canonical、sitemapは引き続き変更しない。

## Research Findings

### 2026-07-18 Phase 17 店舗詳細の次期構成

- 現行店舗詳細は`ShopDetail`を親に、Hero、Gallery、Sections、SectionNav、Actions、OwnerCtaへ既に分割されており、1枚の巨大componentではない。
- 現在のページ内メニューは、実在するsectionだけを出す横スクロール型の1段navで、IntersectionObserverにより現在位置を表示する。
- 現在の口コミ表示は、出自を確認できる承認済みユーザー口コミだけを対象とし、店舗紹介文やAI要約を口コミへ混ぜない。口コミ0件の店舗では投稿導線だけを表示する。
- WordPress公開データでは店舗本文と抜粋が全382店舗で空、公開口コミAPIも未接続であり、店舗別の予約実績比率も存在しない。
- 既存GAは予約・LINE・電話・公式サイトのクリックを区別して送信できる。ただしこれは予約完了比率ではなく、予約導線クリック比率としてのみ表示可能である。
- 次期構成は、口コミを上部へ置き、実在データのsectionだけを表示し、メニュー・セラピスト・有料店舗情報は将来追加できるoptional moduleとして境界を用意する必要がある。
- グラフは最低件数、対象期間、出典、確認日を同時表示し、実データがない場合はグラフ自体を非表示にする契約が必要である。
- ユーザーは最初のグラフとして承認済み口コミの評価集計を選択した。対象は総合・料金・接客・清潔感で、口コミ不足時は推測値を補わない。
- 競合ポータルには店舗・セラピスト・口コミ・ランキング・在籍数・出勤率を扱う事例が実在するが、今回確認した範囲で公開利用できる店舗ランキングAPIは見つからなかった。
- 他ポータル順位の自動取得は、HTML変更、利用条件、同名店舗の誤照合、順位算出根拠の違いがあるため高難度。初期版は管理者が出典URL・順位・対象地域・取得日を確認して登録する方式が安全である。
- Google Places APIは`rating`と`userRatingCount`を提供する。表示にはGoogle Mapsの帰属表示、元ページへの導線、Google由来情報と自サイト口コミの視覚分離が必要で、保存・更新にも公式ポリシー上の制約がある。
- 公式ホームページの在籍一覧、年齢、出勤表は店舗ごとにHTML構造が異なる。店舗管理画面からの入力を正本にする方式は中難度、公式サイトからの自動抽出は高難度で継続保守が必要になる。
- 既存の口コミ投稿は総合・料金・接客・清潔感をWordPressのpending口コミへ保存する。集計側には承認済み公開口コミ3件以上だけ総合評価を表示する安全条件が既にあるため、評価グラフはこの境界を拡張できる。
- 現行の店舗責任者機能は申請受付だけで、会員、料金プラン、店舗編集権限、セラピスト、出勤、ブログの保存schemaはまだない。申請内容が自動公開されないdeny-by-default設計は将来の管理機能でも維持する。
- `ShopScheduleSnapshot`には最終取得日と準備中表示があるが現在の店舗詳細からは未使用で、構造化された在籍者・出勤データもない。次期UIでは空の枠を表示せず、データが揃った時だけmoduleを登録する方式が必要である。
- 参考動画は、白背景、薄い罫線、大きなグラフcard、指標card列、積み上げ棒、詳細内訳card、状態chipという構成だった。派手な装飾ではなく、数値・ラベル・補足を同じcard内で段階表示する点が見やすさの中心である。
- 動画の大型日別推移グラフと多数の操作filterは店舗詳細の初期表示には重すぎる。店舗詳細には総合評価の小型ring、4項目の横棒、件数・確認日の小cardまでを軽量CSS/SVGで採用し、時系列操作は実データ蓄積後の別moduleにする。
- 店舗詳細のダッシュボード表現は、本文を置き換えず「口コミの要約」と「確認済み店舗情報」の視覚補助として使う。見出し、口コミ本文、基本情報、出典はサーバーHTMLに残すため、SEOの主情報はグラフへ依存しない。
- WordPress公開店舗に、対象外データと判断できる`あしぎぬ温泉`（ID 1259、area 5）と`天然温泉 ひなたの湯`（ID 1255、area 2・13）の2件が存在する。温泉・銭湯・サウナ・整体・美容室・脱毛・フィットネスの検索では他の明確な候補は出なかった。
- 上記2件は現在、メンズエステ店舗としてindex可能なtitleとcanonicalを持つ公開ページで、WordPress REST、内部の監視data、Next.js店舗詳細に残っている。単なるcard非表示では不十分で、WordPressをdraft化し、公開route・sitemap・内部リンクから除外されることを確認する必要がある。
- ユーザーは、管理者が地域・店舗を選び、CodexまたはChatGPT向けの調査指示書を生成し、AI出力のJSON/CSVを一括取込して出典・更新日付きで承認公開できる運用を希望している。外部AI APIの直接統合より、指示書生成・schema検証・差分承認を先に作る方が低コストで安全である。
- 既存`/dashboard`はBasic認証に対応するが、認証環境変数がない場合は閲覧を許可する。店舗情報を書き換える新しい管理画面とmutation APIは、認証未設定時に必ず拒否するfail-closed guardが必要である。
- Supabaseはimperative migration構成で、Data API公開schemaは`api`。新しいimport batchとrowはRLS有効、PUBLIC/anon/authenticated grantなし、service roleだけをserver-sideで使用する現在のowner request方式を踏襲する。
- Supabase公式仕様でも、公開schemaのtableはRLSを有効にし、grantとRLSの両方で最小権限にする必要がある。service roleはRLSを迂回できるためbrowserへ出さず、管理routeのserver処理だけに限定する。
- 公開正本はWordPressを維持する。AI出力はSupabaseの非公開stagingへ保存し、管理者承認後だけWordPress IDに紐づく公開metaへ反映することで、店舗詳細・セラピスト詳細・トップの参照先を分裂させない。
- WordPressには`shop_today_therapists`、`shop_today_analysis`、`shop_availability`、7つの年齢帯、`therapist_1..3`、`shop_last_ai_check`、`ai_update_log`が既にある。headless公開画面では未使用または一部未接続なので、既存metaを正規化して再利用できる。
- 既存`/wp-json/escomi/v1/update`は`edit_posts`権限で住所、電話、営業時間、料金、公式URL、AI要約、当日出勤、年齢帯などを直接上書きし、AI更新日時を保存する。新管理画面ではこの直接公開経路を拡張せず、非公開staging・差分・承認を必須にする。
- `shop_last_ai_check`はAI処理日時であり、人が出典を確認した`shop_updated_at`ではない。公開確認日は承認時に別fieldへ保存し、AI処理日時を掲載確認日へ読み替えない。
- WordPress旧表示には、availabilityが空の場合に「本日すぐご案内可能」と補う処理がある。headlessと新管理基盤では明示値がない空き状況を作らず、出勤・空きは日付と出典がある実データだけ公開する。
- AI管理、公開店舗UI、セラピスト詳細、トップ連動は独立したsubsystemだが、`wp_shop_id`、`therapist`のWordPress relationship、共通の公開view modelを正本にして連動させる。巨大な1計画ではなく、public UI→admin import→therapist→schedule/topの順に分割する。

### 2026-07-15 SEO Phase 4開始時点

- WordPress REST APIの堺筋本町termはID 46、公開店舗数93件だった。
- `shop?area=46&per_page=30&page=1&_embed=1` は30件を返し、これをPhase 4の再現可能な対象集合として固定する。
- 公開アーカイブ先頭には、殿様気分、Riru cheri、Elin、Feliz、Drnu、FROG SPAなどが並ぶ。これは人気順位ではなくWordPress既定順である。
- 先頭30件のWordPress値には、住所と複数拠点のアクセスが同じ `shop_address` に混在する店舗がある。
- `official_url` が第三者の転送URLまたは空の店舗があるため、検索結果は公式サイト発見だけに使い、値の確認元にはしない。
- 既存WordPress項目は `shop_address`, `shop_hours`, `shop_tel`, `shop_booking`, `official_url`, `basic_price`, `price_90`, `price_120`, `price_150`, `price_textarea` などである。
- 既存項目だけでは、駅・出口・徒歩分、項目別出典、情報確認日、未確認理由を安全に分離できない。調査正本ではこれらを分離し、WordPress反映用差分は現行項目へ明示的に変換する。
- 公開参照先は `CONTENT_DATA_SOURCE=wordpress` が既定で、今回も公開routeやSupabase切替を変更しない。

### Phase 4の一次情報採用順

1. 店舗運営者の公式サイト内ページ。
2. 公式サイトから直接リンクされた公式予約ページまたは公式LINE。
3. 公式サイトがない場合だけ、店舗名・連絡先との一致を確認できる公式SNS。
4. 検索結果、Googleマップ、第三者ポータル、まとめ記事はURL発見の補助に限り、料金・営業時間・アクセスの確定値にはしない。

### Phase 4の確定データ項目

- 識別: WordPress ID、slug、選定順、WordPress登録名。
- 正式情報: 公式店名、公式URL、住所または「予約後案内」の公開状態。
- アクセス: 最寄駅、出口、徒歩目安。公式記載がなければ未確認。
- 営業: 公式表記、開店時刻、閉店時刻、日跨ぎ、深夜対応。深夜対応は確認済み閉店時刻が24時を超える場合だけ集計する。
- 料金: コース名、分数、金額、条件、代表料金。代表料金は通常の最短有料コースを機械的に選び、指名料等を混ぜない。
- 予約: 電話、Web、LINE、その他の公式予約方法と予約先URL。
- 根拠: 出典URL、ページ名、確認日、出典種別、確認できた項目。
- 品質: 未確認項目、確認不能理由、WordPress反映候補、反映時の注意。
- 比較用: 初回案内の有無。公式に「初めての方」等の案内がある場合だけ初心者向け比較へ含める。

### Phase 4 一次情報調査メモ（1〜5件目）

- Riru chéri公式サイトは店名、営業時間11:00〜29:00、受付10:00〜27:00、電話080-9831-1557を掲載している。
- Riru chéri料金ページは通常コース90分17,000円、120分23,000円を掲載している。期間限定イベント値は代表料金に使わない。
- Riru chériアクセスページは堺筋本町ルームを「堺筋本町駅より徒歩5分程」とし、出口は掲載していない。
- Riru chéri公式サイトからネット予約とLINEへリンクしている。予約先は公式サイトからの直接リンクとして一次情報扱いにできる。
- Drnu公式サイトは電話070-5430-5661、通常コース70分11,000円、100分15,000円、130分19,000円、160分23,000円を掲載している。
- Drnuアクセス欄は完全予約制、淀屋橋駅徒歩3分、別ルームは御堂筋線淀屋橋駅11番出口徒歩3分、LINE予約を掲載している。
- Drnuの営業時間はサイト上部「11時〜27時」とアクセス欄「10:00〜翌3:00（最終受付1:00）」が不一致のため、反映候補では未確認として扱う。

### Phase 4 一次情報調査メモ（6〜10件目）

- FROG SPA公式サイトは営業時間12:00〜27:00、受付10:00〜25:30、電話080-3832-1844を掲載している。
- FROG SPA料金ページは通常コース60分13,000円、90分15,000円、120分20,000円、150分25,000円を掲載している。アクセスページは大阪市中央区南久宝寺町、堺筋本町駅6番出口から徒歩4分とし、詳細住所は予約後案内としている。
- 祇園the.Mrs公式サイトは営業時間11:00〜翌5:00、受付10:00〜翌3:00、電話070-9003-3363、堺筋本町駅徒歩5分を掲載している。WordPress名の「天満橋店」は現在の公式ページでは確認できないため、同一表記として断定しない。
- 祇園the.Mrs料金ページは通常コース75分12,000円、90分15,000円、120分20,000円、150分25,000円、180分30,000円を掲載している。
- ChouChou公式サイトは北新地・梅田・堺筋本町の案内をまとめて掲載し、営業時間10:00〜翌4:00、電話080-4889-1063、堺筋本町ルームは駅から徒歩5分としている。
- ChouChou料金ページはスタンダードコース60分10,000円、90分13,000円、120分18,000円、150分23,000円を掲載している。
- Mrs.FlowerSpa公式サイトは営業時間11:00〜翌5:00、受付10:00〜翌3:00、電話080-4583-9121、堺筋本町ルームは駅から徒歩5分としている。
- Mrs.FlowerSpa料金ページは通常コース90分15,000円、100分17,000円、120分20,000円、150分25,000円、180分30,000円を掲載している。
- ファーストクラス公式サイトは営業時間10:00〜26:00、受付9:00〜25:00、電話06-6633-7886、大阪市中央区材木町1丁目、堺筋本町駅徒歩5分を掲載し、詳細住所は予約後案内としている。
- ファーストクラス料金ページは通常コース60分10,000円、90分14,000円、120分18,000円、150分23,000円を掲載している。

### Phase 4 一次情報調査メモ（11〜15件目）

- `karisome.jp` は現在 `karisome-bekkan.com` へ公式転送され、転送先は営業時間10:00〜翌5:30、受付9:00〜翌3:30、電話090-2282-4545、ネット・LINE・電話予約を掲載している。
- 君色ドレスSPA、milk tea、Mrs.HOLICの登録済み公式URLは2026-07-15時点で表示できた。ページ内の料金・場所・予約先を個別に確認してから、確認済み項目だけを根拠データへ入れる。
- かりそめ別館の料金ページは通常メンズエステコース90分13,000円、120分17,000円、150分21,000円、180分25,000円を掲載している。現行公式名がWordPressの「Karisome」と異なるため、自動上書き対象にはしない。
- Mrs.HOLIC公式サイトは営業時間10:00〜翌5:00、電話080-9303-2100、住所大阪市中央区高津2丁目を掲載している。料金ページの割引前価格と割引価格は区別して保持する。
- なにわ女子公式サイトは営業時間14:00〜翌5:00、最終受付3:30、電話080-7385-5289、堺筋本町駅徒歩3分を掲載している。
- なにわ女子料金ページは通常コース60分11,000円、90分15,000円、120分20,000円、150分25,000円、180分30,000円を掲載している。
- 君色ドレスSPA公式サイトは営業時間10:00〜翌6:00、電話090-8239-1919、堺筋本町駅徒歩3分、公開住所は大阪市中央区までを掲載している。
- 君色ドレスSPA料金ページは基本コース60分10,000円、90分13,000円、120分17,000円、150分21,000円、180分25,000円を掲載し、公式ページからネット予約とLINE予約へ直接リンクしている。
- milk tea公式サイトは営業時間10:00〜翌5:00、電話080-9125-1071を掲載している。登録内容と公式ページはいずれも日本橋店表記で、堺筋本町の駅情報は確認できていない。

### Phase 4 一次情報調査メモ（16〜20件目）

- LUXY、Un Secret、CLUB LEGGENDAの登録済み公式URLは2026-07-15時点で表示できた。各公式ページの料金・連絡先・場所を個別に確定する。
- VISCONTIの登録URL `menseste.jp` は調査ツールでは表示できず、現時点ではWordPress値を一次情報として採用しない。
- C.r.e.a.mは検索で現行公式ドメイン `cream-osaka.com` を特定できたが、第三者紹介ページの料金・駅・営業時間は根拠に使わない。公式ページを直接取得できた項目だけを採用する。
- CLUB LEGGENDA公式ページ上部・下部は営業時間16:00〜翌5:00、電話080-4709-6286を掲載している。ページ内の古いイベント本文に16:00〜翌4:00も残るため、出典箇所を区別する。
- LUXY公式サイトは営業時間10:00〜翌4:00、受付終了翌2:30、電話06-4256-1638、堺筋本町駅徒歩すぐを掲載している。基本メニューは90分15,000円税別（16,500円税込）からで、保存値は支払額となる税込価格を採用する。
- Un Secret公式サイトは営業時間10:00〜翌4:00、受付9:00〜翌2:30、電話06-4256-1639、堺筋本町駅徒歩すぐを掲載している。コースは90分18,000円、120分24,000円、150分31,000円、180分40,000円。
- CLUB LEGGENDA料金ページは夜蝶コース65分12,000円、90分16,000円等と通常コース90分13,000円等を掲載する。固定ルールでは最短の通常支払コースである65分12,000円を代表値にする。
- C.r.e.a.m公式アクセスページは大阪市中央区久太郎町、堺筋本町駅3番出口徒歩2分、営業時間10:00〜翌5:00、受付翌3:30、電話080-6210-9216を掲載している。詳細住所は予約時案内。
- VISCONTI公式サイトは電話080-9601-0184、LINE予約、堺筋本町駅3番出口徒歩2分を掲載し、詳細住所は予約後にSMSまたはLINEで案内すると明記している。
- VISCONTI料金ページは料金説明が画像中心で金額を取得できず、営業時間も店舗共通値を確定できないため未確認のままにする。一方、明示額以外の追加料金・指名料・オプションがないとの初心者向け説明は本文で確認できた。

### Phase 4 一次情報調査メモ（21〜25件目）

- Sanando公式サイトは営業時間10:00〜26:00、受付9:00〜25:00、事前予約9:00〜24:00、電話080-8520-0955を掲載している。公式ページは日本橋表記で、堺筋本町の場所は確認できない。
- こころのゆりかご公式サイトは堺筋本町・北新地・新大阪を対象エリアとして掲げ、料金・予約・アクセスの専用ページを持つ。詳細は各ページで確定する。
- ゆだねて公式サイトは堺筋本町を出勤場所として掲載するが、日記の個別出勤時刻を店舗営業時間へ流用しない。
- アヌSPA公式サイトは電話070-4416-2728、営業時間11:00〜LAST、受付10:00〜LASTを掲載する。LASTの時刻は推測せず、終了時刻なしの表示として扱う。
- WordPressで公式URLが空だったThe.glossは、現行公式サイト `gloss-osaka.com` を一次情報として特定できた。公式料金は90分16,000円、120分22,000円、150分28,000円、180分34,000円、営業時間10:00〜翌5:00、電話080-3039-4363。
- The Gloss公式アクセスページは大阪府大阪市中央区久太郎町1丁目6-1、堺筋本町駅3番出口徒歩5分を掲載している。
- Sanando料金ページは75分12,500円、90分14,500円、120分18,500円、150分23,500円、180分29,500円を掲載する。アクセスページは大阪市中央区高津2丁目3-14、日本橋駅7番出口徒歩5分で、堺筋本町店舗の住所としては扱わない。
- こころのゆりかごの料金・アクセスは画像中心で値を確認できない。WEB予約フォームの存在だけを確認済みにし、画像から読めない料金や駅を作らない。
- ゆだねて公式サイトは営業時間10:00〜2:00、受付8:00〜2:00、電話080-8899-1363、通常コース60分11,000円からを掲載している。
- ゆだねて公式アクセスは堺筋本町駅10番出口徒歩6分と長堀橋駅2-B番出口徒歩3分を掲載し、堺筋本町ルームの営業時間だけ10:00〜3:00としている。共通ヘッダーとの終了時刻差は注記する。
- アヌSPA料金ページの料金表は画像中心で金額を確認できない。営業時間は11:00〜LAST（受付10:00〜LAST）として、終了時刻を空欄で保存する。
- アヌSPAは初回客に指名なしのフリーオーダーを推奨し、電話・LINE予約、予約後のSMSで部屋位置を案内すると公式ページに明記している。アクセスページは谷町九丁目駅徒歩1分だけを掲載し、堺筋本町駅の分数は確認できない。

### Phase 4 一次情報調査メモ（26〜30件目）

- 桃源郷とVIO:Vの登録済み公式URLは調査ツールでは表示できず、直接取得で確認できる項目だけを採用する。
- プレミアム離宮は一次情報となる現行公式サイトを特定できていない。第三者サイトの営業時間・住所・料金はデータへ採用しない。
- UNION＋公式サイトは営業時間10:00〜25:00、受付9:00〜24:00、電話080-9600-9300、大阪市中央区北久宝寺町1丁目3、堺筋本町駅徒歩3分を掲載している。
- Queen Spumanteの現行公式サイトを `queenspumante.com` と特定した。営業時間は10:00〜LAST、電話受付9:30〜3:30、電話080-9602-0880。
- Queen Spumante公式アクセスは堺筋本町ルームを大阪市中央区南久宝寺町1丁目、堺筋本町駅3番出口徒歩5分、長堀橋駅3番出口徒歩5分としている。
- 桃源郷公式サイトは営業時間10:00〜翌5:00、電話070-4192-6210、堺筋本町3番出口、大阪市中央区南久宝寺1丁目を掲載する。料金は90分12,000円、120分16,000円、150分20,000円。
- UNION＋料金ページは通常90分14,000円、120分19,000円、150分24,000円、180分29,000円を掲載する。新規割引などは代表料金から除外する。
- Queen Spumante料金ページは基本料金60分8,000円、90分12,000円、120分18,000円、150分24,000円、180分32,000円を掲載する。終了時刻はLASTのまま保存する。
- VIO:V公式サイトは営業時間10:00〜22:00、受付9:00〜21:00、電話070-1814-0342、長堀橋駅徒歩1分、所在地は大阪市中央区島之内周辺、詳細住所は予約時SMS案内と掲載している。
- VIO:Vの料金表は画像だけで金額を確認できないため未確認とする。公式LINE予約先は確認できた。
- Felizの登録URLは現在、第三者のメンエスMAPへ転送される。一次情報として採用せず、公式サイト再特定までは全項目未確認とする。
- 殿様気分とElinは調査ツールから公式候補URLの取得がタイムアウトした。別経路で再確認し、読めなければ未確認にする。

### Phase 4 調査確定結果

- 30店舗について一次情報72件を記録した。確認済みは正式名26、住所11、駅情報20、営業時間23、料金21、電話25、予約方法26、初回向け公式案内5店舗。
- 一次情報なしは殿様気分、Elin、Feliz、プレミアム離宮の4店舗。WordPress現行値や第三者情報を一次情報へ昇格せず、全対象項目を未確認として維持した。
- 代表料金21件は最小8,000円、中央値12,500円、最大18,000円。営業時間23件中、具体的な翌日閉店時刻を確認できた20件だけを深夜対応へ含めた。
- Supabase非公開draft候補は26店舗。`app.shops` はdraft、料金89行、営業時間23行、項目別出典189行はすべて非公開として人間確認対象にした。
- 一次情報の調査記録は72件だが、C.r.e.a.mの同じ公式URLが2項目で重複するため、Supabaseの `app.sources` は公式URL単位で71行へ統合する。項目別出典189行は失わない。
- WordPress現行値は比較用snapshotに限定し、WordPress更新候補は廃止した。
- 根拠データ、Supabase draft preview、集計レポートをローカル生成し、WordPress、Supabase、公開参照先、push、deployは変更していない。

### Phase 4 Supabase非公開投入のローカル検証

- 既存382店舗の非公開データをローカルSupabaseへ復元し、Phase 4固定SQLを初回・再実行の2回適用した。
- 再実行後も店舗26、料金89、営業時間23、公式出典71、項目別出典189、取込record 26で件数不変だった。
- 料金・営業時間の重複groupは0件。匿名で参照できる公開view全9種は0件だった。
- 営業時間注記は `文字列 || JSON ->> notes` の評価順で接頭辞がJSON解釈される問題を実DBで確認した。失敗検査を追加し、JSON文字列取得を括弧で先に行う修正後に2回投入が成功した。
- DB lintはapi/app/private/public/extensionsのschema error 0だった。
- 本番Supabase、WordPress、公開参照先、push、deployは変更していない。

- WordPress REST APIには店舗382件、地域34件、画像268件がある。
- 店舗本文と抜粋は382件すべて空で、公開口コミAPIも確認できない。
- 画像、公式URL、料金、AI要約は一部店舗のみで、地域説明は34地域すべて空だった。
- 住所欄にはアクセス案内が混在し、一次情報の出典と確認日を保存する項目がない。
- 現在のNext.jsには `ShopView` / `AreaView` があり、保存先変更時の境界として使える。
- 現在のSupabase利用はダッシュボード取得に限られ、公開店舗コンテンツ用migrationは存在しない。
- Supabaseの現在仕様では、API公開schema、権限、RLSを明示する必要がある。
- 現行の代表料金候補は `shop_price_60min`、`price_50`〜`price_150`、`basic_price` で、数値0は未確認として扱う実装になっている。
- 店舗と地域の関係はWordPressの埋め込みtermを通じて取得でき、Supabaseでは多対多関係として保持する必要がある。
- 新しい読み取り専用監査でも店舗382件、地域34件を再確認し、本文0、抜粋0、地域説明0、専用出典URL0、確認日0だった。
- 画像241件、公式URL333件、確認可能な料金252件、AI要約76件、地域なし75店舗、複数地域230店舗、公開口コミAPI未接続も再確認できた。
- 住所判定は以前の概算より厳しくし、確実な町名・番地形式だけ49件を住所候補とした。残り333件は移行時に住所とアクセスを人間確認する。
- 堺筋本町93店舗では、料金欠損5件、画像欠損7件、公式URL欠損15件、複数地域所属83件を確認した。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 全41テーブル案を一括導入せず、店舗・地域・料金・営業時間・画像・出典・口コミ・本文・取込履歴に絞る | 未使用の複雑さを避け、SEOに必要な確認済み情報を先に蓄積するため |
| 生の取込記録はprivate schema、公開読み取りはapi schemaのviewに限定する | 管理データや審査前口コミの漏えいを防ぐため |
| 公開APIは読み取りのみ、書き込みは将来のNext.jsサーバー経由とする | ブラウザへ強い権限を渡さず、口コミ審査を必須にするため |
| `CONTENT_DATA_SOURCE=wordpress` を既定にする | 基盤追加だけで公開HTMLが変わらないため |
| `supabase` 単独参照は承認フラグがない限り拒否する | 未検証データへの誤切替を防ぐため |
| 公開routeへ参照先設定をまだ接続しない | schemaとデータ一致確認前に生成HTMLを変えないため |
| 非公開店舗・地域に紐づく本文と口コミはRLSで公開しない | 子データだけが先に公開される漏えいを防ぐため |
| 堺筋本町93店舗に0円表記がないため、料金なし店舗を試験対象にする | 0円を創作せず、欠損値をnullのまま安全に検証するため |
| 30店舗は料金・画像・公式URLの欠損店舗をすべて含め、通常データと複数地域所属で補う | 欠損変換と地域関係を30件の中でまとめて検証するため |
| 30店舗SQLは固定JSONをtemporary tableへ入れ、set-based insertとUPSERTを使う | 382店舗へ拡張しやすく、個別INSERTの重複と長いtransactionを避けるため |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| ルートにplanning-with-files用の3ファイルがなかった | 今回の移行作業用に新規作成した |
| `docs/ai-skills.md` がなかった | 利用可能なSupabase skillとAGENTS.mdの安全条件を正本として進める |
| 現行の `npm test` | 11種類の品質検査がすべて成功し、変更前基準は正常だった |
| Supabase CLI | ローカルにversion 2.101.0があり、公式migration生成手順を使える |
| Supabase実DB検査 | Docker Desktopを起動し、migration初回適用、db reset、api/app/private/public/extensionsのDB lintがすべて成功した |
| 公式status/changelogの初回同時取得 | 60秒以上応答せず中止し、status APIとchangelog本体を分けて取得した |
| 30店舗本番投入時のChrome認証 | 指定Chrome profileで対象projectを開けず、組織一覧へ戻るため本番書き込みを停止した |

## Conclusion

- WordPressからSupabaseへの移行は可能で、公開表示をWordPressのまま保つ限り今回の基盤追加はSEOへ直接影響しない。
- Supabase化だけでは順位は上がらない。本文0件、地域説明0件、口コミ公開経路なし、出典0件、確認日0件を埋める運用が主なSEO施策になる。
- 今回の構成は料金・営業時間・画像・出典・本文履歴・口コミ審査を分離しているため、現在のWordPress ACFへ項目を足し続けるより拡張しやすい。
- 30店舗SQLはlocalと本番で重複なし・公開漏えいなしを確認済み。次の安全な工程は、欠損・住所・地域関係を人間確認してから382店舗全件投入を別承認することである。

## 2026-07-17 Eskomi UX再構築の事前監査

- 店舗名は500pxで約43pxかつ`overflow-wrap:anywhere`のため、英字と日本語の途中で不自然に改行する。
- 料金比較は`min-width:640px`を内部スクロールさせるため、狭い画面で見切れに見える。760px以下は比較カードへ変形する。
- 順位数字と「位」は異なる文字サイズのbaseline揃えにより上端が約4pxずれている。
- エリア一覧は、6つのハブ対象が`AreaHubPageTemplate`系、それ以外が`AreaPageView`系、`/shops/`が旧`ShopCard`系に分かれている。店舗単位は共通`AreaShopCard`を正本にする。
- 2026-07-17のWordPress REST読取では382店舗中、料金候補252、営業時間382、住所・アクセス382、予約方法文字340、公式URL333、電話382、LINE198、AI編集コメント76だった。
- 駅専用キー、Web予約URL、確認日、本文・抜粋、特徴、承認済み口コミは公開WordPressでほぼ空。空セクションや仮値を作らない。
- 現行には固定のエリア更新日`2026年6月13日`、住所文字列からの駅近推定、料金等からの初心者向け推定、AI要約なし店舗の定型編集コメント生成がある。断定表示をやめる。
- 手動ランキングRESTは本番404、`area_rank`実値は1店舗のみ。順位はPRを除外し、公開済み情報による既存の安定ソートであることを明示する。
- 店舗責任者申請は`/storelisting/`で実在し、料金、営業時間、アクセス、予約、紹介、特徴、公式画像、その他を非公開審査候補として受付できる。
- 公開データ元はWordPressのまま維持し、Supabase非公開候補は今回のSSR表示に接続しない。

## Resources

- Google Search Central: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google LocalBusiness structured data: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Google review snippet: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- Supabase database migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- `pm/DECISIONS.md`
- `pm/CODEX_TASKS.md`
- `headless/docs/content-provenance.md`
- `docs/design/escomi-ui-data-map.md`

## Visual/Browser Findings

- 公開対象の地域ページは店舗一覧と共通部品の文字量が中心で、独自の地域ガイドと利用者口コミが少ない。
- 堺筋本町の地域ガイドは約359文字で、検索意図へ答える独自情報を今後増やす余地が大きい。
- 2026-07-14 14:21のSupabase画面では、作成済みprojectのprimary databaseが「不健康」、直近の記録がHTTP 500だった。
- 同画面上部に、地域によってproject作成へ影響する可能性がある旨のstatus案内が表示されていた。原因確定前のmigration適用は止める。
- 公式status APIは2026-07-14時点でAll Systems Operational、未解決incident 0件だった。画面の不健康は全体障害よりproject固有の作成・起動状態である可能性が高い。
- 2026-07-10のchangelogでTypeScript 5以上への将来要件を確認した。現行projectはTypeScript 5のため影響しない。
- 2026-04-28のbreaking changeで新規tableはData/GraphQL APIへ自動公開されない。今回のmigrationは `api` schemaと明示GRANT/RLSを持つため方針と一致する。
- Supabase CLIは認証済みで2projectを列挙できたが、スクリーンショットの新projectは一覧に存在しなかった。
- スクリーンショット原寸でもproject URLの読み取りは一致したため、CLI profileとChromeで開いている組織・アカウントの不一致が第一仮説である。
- Chromeで対象project URLを直接開くと、project画面を維持できず組織一覧へ戻された。
- 現在Chromeで確認できる組織にも対象projectはなく、スクリーンショットとは別アカウントでログインしている。
- CLIとChromeの両方で対象projectへの権限が確認できないため、原因は全体障害ではなくアカウントまたは組織の不一致と判断する。
- 誤ったprojectへの反映を防ぐため、本番migration・試験データ投入は未実施。対象アカウントへの再ログイン待ち。
- ユーザー提供の2026-07-14 14:39画面では、対象projectは正しいアカウントで開かれ、状態が「健康」、直近requestがHTTP 200へ回復している。
- ただし操作用のChatGPT Chrome ExtensionはDefault profileだけにあり、対象projectを開いている別profileには未導入だった。
- 対象profileを操作経路へ接続できるまで、schema適用と3店舗試験投入は引き続き停止する。
- 対象Chrome profileへのChatGPT Chrome Extension追加後、対象projectタブへ直接接続できた。
- 2026-07-14 14:50時点のproject概要で状態「健康」、最終migration「移行なし」、Advisorはsecurity/performanceとも指摘なしを確認した。
- project概要には断続的なHTTP 500/400も残るため、schema適用後はmigration履歴・query・advisorを個別に再検証する。
- CLIで専用profileを指定したloginは `Unsupported Config Type` で失敗し、profileもtokenも作成・変更されなかった。
- CodexのSupabase連携は別組織の認証で、対象projectを列挙できなかったため、対象ChromeのSQL Editorを安全な実行経路にする。
- SQL Editorのread-only preflightで `app` / `private` / `api` schemaと `supabase_migrations.schema_migrations` はすべて未作成と確認した。
- ローカルで検証済みmigration（SHA-256 `9764fa6ac97bf6cceaa4a3fc1008c8ea9bbf879a3124cbdba2860091223de6c6`）を本番SQL Editorからtransaction内で適用し、`Success. No rows returned` を確認した。
- 本番検証結果は app 11表、private 2表、api 9view、RLS 13表、app policy 10件、PUBLIC table grant 0件、店舗0件、公開店舗0件。
- SQL EditorのMonaco入力欄に通常の `fill` を使うと、巨大SQLの文書全体ではなく表示bufferだけが置換され、検証SQLがmigration末尾へ追記された。
- 追記状態での再実行は最初の `app.areas` 作成で `42P07` となり、transaction全体が中止されたため追加変更はなかった。以後は `Meta+A` と `type` で全置換する。
- ローカルの正式なmigration管理表は `version text primary key`, `statements text[] null`, `name text null` で、適用済みversion `20260714020257` / name `seo_safe_content_core` を保持する。
- 本番にCLI互換migration管理表を作成し、version `20260714020257` / name `seo_safe_content_core` を1件記録した。管理表はRLS有効、PUBLIC grant 0件。
- Security Advisorはerror 0 / warning 0 / info 3。infoは公開不要な `app.content_revisions`, `private.import_batches`, `private.import_records` のRLS policyなしで、意図したdeny-by-defaultと一致する。
- Performance Advisorはerror 0 / warning 0 / info 14。空DB由来のunused index 11件に加え、`app.content_revisions`, `app.contents`, `app.shop_source_links` の出典FK 3列にcovering index不足がある。
- 将来の出典削除・参照性能を守るため、3店舗投入前に3本のFK indexを追加migrationで解消する。
- fail-first契約検査は `app.content_revisions.source_id` のcovering index不足で意図どおり失敗した。
- `20260714060257_add_source_fk_indexes.sql` に `content_revisions`, `contents`, `shop_source_links` の `source_id` indexを追加後、契約検査は成功した。
- local `db reset` で2migrationを順番に適用し、migration list 2件一致、schema lint error 0、Advisor warn/error 0を確認した。
- 追加migrationとCLI互換履歴を本番へtransaction適用し、出典FK index 3本・migration履歴2件・店舗0件・公開店舗0件をqueryで確認した。
- Performance Advisor再確認ではerror 0 / warning 0。info 14件は、出典FKを含む14本すべてが空DBで未使用という案内に変わり、index不足は解消した。
- 堺筋本町の公開WordPress 93店舗には `0` / `0円` / `無料` の料金候補がなかった。値を創作せず、料金なし・画像なしの「殿様気分」(1237) を欠損試験に使う。
- 残りは、公式URLなし・住所形式・料金/画像ありの「sirena II」(709) と、公式URL/料金/画像あり・住所アクセス混在の「MUSE」(695) を選んだ。
- trial SQL契約検査はファイル未実装で意図どおり失敗し、非公開area/draft shop、public false、口コミ/本文なし、公開view検証を実装後に成功した。
- local DBへtrial SQLを2回適用しても、地域1・店舗3・関係3・料金2・画像2・batch 1・record 3を維持し、anonの公開view 7種はすべて0件だった。
- local schema lintはerror 0、Advisorはwarn/error 0。試験SQLは本番適用前の条件を満たした。
- QAで公開確認が7viewに留まる点を検出した。fail-first検査を追加し、営業時間・出典を含む公開view全9種へ検証を拡張した。
- 本番へtrial SQLをtransaction適用し、MUSE(695)、sirena II(709)、殿様気分(1237)がすべてdraft、堺筋本町areaが非公開、取込recordがimportedであることを確認した。
- 本番の保存内訳は地域1・店舗3・関係3・非公開料金2・非公開画像2・batch 1・record 3。anonの公開view全9種は0件だった。
- 本番Security Advisorはerror 0 / warning 0、Performance Advisorもerror 0 / warning 0。trial投入後のperformance infoは8件で、未使用indexの参考情報だけだった。
- 30店舗は既存3件を含む固定ID30件とし、料金欠損5件、画像欠損7件、公式URL欠損15件をすべて含めた。
- local DBへ3店舗SQL、30店舗SQL、30店舗SQL再実行の順で適用し、店舗30・地域関係30・料金25・画像23を維持した。料金と画像の重複groupは0件だった。
- 30店舗検証でもanonの公開view全9種は0件、schema lint error 0、lint・typecheck・15検査・build 440ページが成功した。
- 2026-07-14 15:50に指定されたChromeでは対象project URLが組織一覧へ戻ったため、この時点では誤投入を避けて再接続待ちとした。
- 対象projectを開いた正しいChrome profileへ再接続し、project ref `goeagrxjsjcbbatpotbu` と既存3店舗trialの事前件数を照合した。
- 本番へ30店舗SQLをtransaction適用し、地域1・店舗30・地域関係30・非公開料金25・非公開画像23・batch 2・record 33を確認した。
- 30店舗batchはsource 30・imported 30、料金と画像の重複groupは0件、anonの公開view全9種は0件だった。
- 本番Security Advisorはerror 0 / warning 0 / info 3、Performance Advisorはerror 0 / warning 0 / info 8。Security infoは非公開表のpolicyなし、Performance infoは未使用indexだけで、今回の非公開試験を止める内容ではなかった。
- 382店舗移行前のWordPress再監査でも、店舗382・地域34、地域なし75、複数地域230、料金252、画像241、公式URL333で以前の監査と一致した。
- 全件SQLは34地域を先にUPSERTし、親子関係26件を復元後、382店舗とWordPress地域関係782件をset-basedで保存する。
- local DBへ3店舗→30店舗→382店舗→382店舗再実行の順で適用し、地域34・店舗382・関係782・料金252・画像241・batch 3・record 415を維持した。
- 本番へ同じ382店舗SQLを適用し、localと同じ件数、地域なし75、複数地域230、料金/画像の重複group 0件を確認した。
- 本番anon公開view全9種は0件、Security Advisor error 0 / warning 0 / info 3、Performance Advisor error 0 / warning 0 / info 8だった。
- 382店舗を移しても本文0・地域説明0・公開口コミ経路なし・出典0・確認日0は変わらない。次のSEO効果は移行そのものではなく、情報を増やし読みやすく見せる実装で作る必要がある。
# 2026-07-18 Phase 16 添付画面の初期所見

- 店舗一覧では順位バッジが画像の左隣に独立した列として置かれ、本文列を圧迫している。順位なしカードと開始位置が揃わず、一覧の縦軸が崩れて見える。
- 店舗詳細では主領域のCTA群と右側 `AT A GLANCE` のCTA群に同じ公式・LINE・電話導線が重複している。
- 店舗詳細のH1、料金、営業時間が現在の情報量に対して大きく、営業時間の長い文字列が不自然に改行されている。
- 画像は主領域幅いっぱいだが、上部の情報量が少なく、大きな余白と巨大画像が先行してポータルとしての密度が低く見える。
- 今回は色を変えず、Hot Pepperの良い点である「要点をコンパクトにまとめる上部」「ページ内メニュー」「写真と文章の整理」「料金・基本情報の表形式」をEskomiの既存データ契約に合わせて取り入れる。
- WordPressに存在しないメニュー、スタッフ、口コミ、設備情報は作らず、空データを埋めるための推測文も追加しない。
- 参考画像は1310×7960pxの長尺ページで、上部概要→横並びページ内メニュー→写真＋短い紹介→複数の小セクション→基本情報表→料金群→注意事項の順に、文字を小さめに保ちながら情報を段階的に見せている。
- 参考デザインの価値は配色の複製ではなく、狭い本文幅の中で「タイトル・予約」「写真・要約」「セクション見出し・表・カード」を反復し、同じCTAを各所に無秩序に置かない情報設計にある。
- Eskomiでは既存の深緑・生成り・金を保ち、写真・料金・営業時間・アクセス・予約・口コミ有無・近隣導線を条件付きで同じ順序へ整理する。

# 2026-07-18 Phase 16 実ブラウザ所見

- 旧browser検査をTask 1・2後のfresh buildへ当てると、16/56 scenarios時点で4,971 failuresとなった。代表値は店舗詳細H1の実x=1,056pxに対する旧期待x=64pxで、旧`visualAside`配置を検査側が固定していた。
- 一覧の旧検査はmediaをarticle直下で探し、独立rank列と旧body/action位置を期待していたため、新しいmediaWrap DOMを正しく計測できていなかった。画面CSSの追加修正ではなく検査selectorを新DOMへ合わせるのが正しい対応だった。
- 新検査では順位badgeのmediaWrap直下・矩形内包含、同一一覧の順位あり/なしcardのmedia/title x差2px以内を、順位あり/なしが実在することも含めて確認する。
- 店舗詳細は各幅で表示中の`予約・公式情報` groupを1つに限定し、H1をPC 34px以下・760px以下26px以下、facts値を18px以下として数値確認する。
- fresh headless QAは4経路×14幅=56 scenarios、89,836 assertions、32 screenshots、failures 0。横はみ出し0、表示中CTA 44px以上を維持した。
- 独立最終レビューはCritical 0 / Important 0 / Minor 0、Ready: Yes。旧DOM前提、条件不在によるすり抜け、selector誤り、境界の欠落は見つからなかった。

# 2026-07-18 AI管理・セラピスト連動 設計レビュー所見

- 管理者がCodex/ChatGPTへ渡す指示書を生成し、JSON/CSVを一括取込する方式は実装可能。外部AI APIやcrawlerを初期版へ入れず、非公開staging、差分、承認、WordPress公開の順に分離すると運用負荷と誤公開を抑えられる。
- 口コミ公開は現行`reviews`投稿typeと店舗詳細の既存集計が接続されていない。専用の承認済み口コミRESTと共通adapterを先に作り、graph・一覧・件数・AggregateRatingを同じ正本へ統一する必要がある。
- 情報確認状況はページ更新日だけで判断できない。料金、営業時間、アクセス、予約、公式URL、画像ごとの出典、観測日、確認日、公開値hashをWordPressで持つ必要がある。
- `functions.php`にREST認証保護の全体解除、MU plugin削除、匿名debugと`opcache_reset()`があり、既存AI更新routeにも任意店舗meta更新を許す境界がある。新管理機能の前にPhase 0で閉じる。
- 公開`wp-json` proxyは受信AuthorizationをWordPressへ転送し、cache再検証routeはsecret未設定時に通るため、専用server clientとfail-closedへ分ける必要がある。
- セラピスト、年齢、出勤の公開正本を`therapist`と`therapist_schedule`へ統一し、旧3枠・年齢帯meta・当日出勤metaは移行とshadow比較だけに限定する。
- 外部順位は45日でstaleにし、Eskomi順位とは別snapshotへ保存する。Google評価は初期・将来範囲から除外した。
# 2026-08-16 UX-PROD-T3A Primary-aware Area Precision

- 重点5Areaはslugや名称ではなくterm ID `17/13/7/46/4`だけで精密表示を有効化する。主一覧は`primaryArea.id`完全一致だけ、旧Area関係があってPrimaryが別IDなら関連、Primary未設定なら確認中へ分けた。
- 現在の公開取得dataにはPrimaryが未反映なので、5Areaの主一覧・主件数・順位・主一覧schemaは0件として閉じる。旧Area関係を完全一致へ推測しない。
- accepted preview 44件はbrowser fixtureだけで使用し、EXACT件数`6/3/12/18/5`を再現する。production runtimeからpreview JSONや固定店舗mappingは参照しない。
- 駅名表示は専用駅fieldと徒歩情報の両方がある場合だけ有効とし、汎用`shop_access`だけでは駅filter・駅tab・駅tagを出さない。初心者情報も明示featureが0件なら関連UIとFAQを出さない。
- 正式順位recordがない場合は順位moduleを出さず、明示された順位の空きを詰めない。RELATED/UNCLASSIFIEDには順位を付けない。
- 任意追加で実行した旧`test:portal-browser-layout`は、堺筋本町Hubに旧自動順位・比較表を必須とする前提が新しいfail-closed仕様と衝突した。Task指定の2-mode browser QAは別runnerで成功しており、停止条件に従い旧runnerの変更は残していない。
