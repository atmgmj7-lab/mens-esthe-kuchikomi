# 主要5地域 SEO Phase 0〜2 公開前確認（2026-07-14）

## 結論

- Phase 0〜2を正式作業場所のローカル `main` で完了した。
- `lint`、`typecheck`、11検査、`build` はすべて成功し、440ページを生成した。
- 指定8ページはローカルでPC・スマホともHTTP 200。canonical、noindex、料金、FAQ/schema、口コミschema、PR分離、内部リンク、横はみ出し、画像、操作部品の検査に合格した。
- 公開中ページとの差は、堺筋本町の追加ガイド・内部リンク、口コミ投稿ページのcanonical修正が主なものだった。公開ダッシュボードはBasic認証のHTTP 401が正常に返り、本文比較はしていない。
- Search Consoleには接続できなかったため、正式数値は未取得。人間向け取得手順と、Yahoo!検索簡易版で観測した7検索語×10件を `docs/seo/pre-publish-baseline-2026-07-14.md` に保存した。
- push、本番デプロイ、本番データ変更、親リポジトリ変更は行っていない。Phase 3へは進んでいない。

## Phase 0: 作業場所とGit安全確認

| 項目 | 確認結果 |
|---|---|
| 正式作業場所 | `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` |
| branch | `main` |
| HEAD | `6d847060b30335c332bcef1890449fd0a6cbb963` |
| `origin/main` | `593dcea44ccfa83f414dac1027dca9222066d600` |
| 差 | `main` が `origin/main` より11コミット先行 |
| fetch | `git fetch origin --prune` を実行済み |
| 開始時の未コミット差分 | `pm/NEXT_ACTIONS.md`、`pm/PROGRESS.md`、`pm/SEO_TOP10_EXECUTION_PROMPT.md`。いずれも今回の指示文書として保全 |
| 追加作業ツリー | 既存 `/private/tmp/escomi-*` 7件を確認。変更・削除・prune対象にしていない |
| 親リポジトリ | submodule参照が旧コミット `ad852cb` のまま。今回の承認対象と分離し、変更していない |
| 禁止対象 | 削除済みproduction作業場所、Secret、本番WordPress/Supabase、親テーマへ未接触 |

確認した正本:

- `AGENTS.md`、`.cursorrules`
- `pm/PROGRESS.md`、`pm/BLOCKER.md`、`pm/BLOCKERS.md`
- `pm/CODEX_TASKS.md`、`pm/ACCEPTANCE.md`、`pm/RUNBOOK.md`
- `docs/technical/repository-consolidation-inventory-2026-07-14.md`
- `docs/design/escomi-final-design-implementation-map.md`

保全ref `backup/original-dirty-20260714` で参照した過去計画:

- `docs/fable-final/69-five-area-top10-seo-execution-plan.md`
- `docs/fable-final/70-five-area-keyword-map.md`
- `docs/fable-final/71-serp-snapshot-2026-07-10.md`
- `docs/fable-final/72-five-area-page-architecture.md`
- `docs/fable-final/73-one-month-seo-sprint-plan.md`
- `docs/fable-final/74-seo-codex-task-backlog.md`
- `docs/fable-final/76-seo-feasibility-and-risk-analysis.md`

過去計画と現在の指示が異なる箇所は、`pm/SEO_TOP10_EXECUTION_PROMPT.md` の優先順位を正本とした。

## Phase 1: 公開前基準値

詳細: `docs/seo/pre-publish-baseline-2026-07-14.md`

- Search Console接続機能はなく、ログイン情報やSecretを要求せず停止した。
- 90日・28日、7検索語、PC/モバイル、表示URL、インデックス、Google選択canonicalを人間が保存する手順を記録した。
- 代替として2026-07-14にYahoo!検索簡易版を未ログイン・位置指定なしで観測し、7検索語それぞれ10件、合計70件のURL、title、ページ種別、主な強みを記録した。
- 観測順はGoogle順位でも確定順位でもない。14日・30日評価は同条件のSearch Consoleデータを正式基準とする。

## 公開予定の11コミット

| 順 | commit | 内容 |
|---:|---|---|
| 1 | `bc2b296` | Q-06。ダッシュボード・口コミ投稿のnoindex/canonical、schema安全条件、回帰検査 |
| 2 | `9b66731` | S-10。堺筋本町の使い分けガイド、ページ内導線、専用検査 |
| 3 | `72b1150` | リポジトリ統合計画と保全台帳 |
| 4 | `b88bf02` | 公開UI差分を今回採用しない判断記録 |
| 5 | `88426d7` | ダッシュボード差分を今回採用しない判断記録 |
| 6 | `c0bb030` | バックアップ対象漏れの補完記録 |
| 7 | `c1600e8` | 統合後の基準確認記録 |
| 8 | `5be0515` | FAQ表示行とFAQPage schemaの条件統一 |
| 9 | `1e62f68` | HTML空白文字参照だけのFAQを空として扱う修正と検査 |
| 10 | `7bf643f` | ローカル作業場所統合完了記録 |
| 11 | `6d84706` | 統合作業ブランチ整理記録 |

今回作成・更新したPhase 0〜2文書は未コミットであり、上記11コミットのpushには自動で含まれない。

## Phase 2: 自動検査

`headless/` で実行:

| 検査 | 結果 |
|---|---|
| `npm run lint` | 成功 |
| `npm run typecheck` | 成功 |
| `npm test` | 成功。11検査すべて通過 |
| `npm run build` | 成功。440ページ生成 |
| `git diff --check` | 文書更新後の最終確認で実行する |

11検査: area integrity、price normalization、content provenance、review rating、promotion disclosure、Q-06 SEO metadata、schema output、S-10、internal links、final design preservation、WordPress build resilience。

buildで確認した既存警告・通知:

- Next.jsの `middleware` ファイル規約が非推奨。
- WordPress APIの404・タイムアウト時に代替データを使用。
- `GoogleAnalytics.tsx` の `useSearchParams()` によるクライアント描画切替ログ。

いずれもbuildの終了コードは0。今回のPhase 0〜2では修正していない。

## 生成HTML・ブラウザ確認

対象:

- `/area/sakaisujihonmachi/`
- `/area/sakai/`
- `/area/nihonbashi/`
- `/area/shinosaka/`
- `/area/umeda/`
- `/dashboard/`
- `/dashboard/analytics/`
- `/reviews/submit/`

PC 1440×1000、スマホ390×844の合計16表示で確認した。

| 確認内容 | 結果 |
|---|---|
| HTTP | 16表示すべて200 |
| title / description / h1 | 5地域すべて対象地域名と一致 |
| 地域別の説明・FAQ・title・description・Breadcrumb/FAQ schema | 他地域向けの固定文言流用なし |
| canonical | 8ページすべて意図した自ページ |
| robots | 5地域にnoindexなし。ダッシュボード2ページと口コミ投稿は `noindex, nofollow` |
| 未確認料金 | `0円`、`0円〜`、`¥0` の不正表示なし |
| 口コミschema | `AggregateRating`、`Review` の不正出力なし |
| FAQ | 表示FAQとFAQPage schemaが同時に存在。空FAQだけのschemaなし |
| PR | 自然順位内に `.area-promotion-card` なし。現在の取得データではPRカード0件 |
| 内部リンク | 店舗一覧、ランキング、料金相場、口コミ投稿への実 `<a href>` を5地域で確認 |
| 画面幅 | 横はみ出し0、壊れた画像0、画面外操作部品0 |

### 地域名混在の切り分け

- ページ固有のtitle、description、h1、導入文、ガイド、FAQ、Breadcrumb/FAQ schemaには他地域向け文言の流用はなかった。
- ItemList schemaと店舗一覧には、複数地域で営業する店舗の正式名・住所に含まれる地域名が残る。例: 新大阪ページの「小悪魔Alice 梅田・新大阪」「Mrs.Feliciarc 堺筋本町店」、梅田ページの「Checkmate 新大阪・梅田」。
- WordPress RESTを読み取り専用で確認すると、新大阪49店舗中42店舗が複数のareaタームを持ち、7店舗だけが新大阪単独だった。これは別地域ページの固定文言流用ではなく、現行の複数拠点データに由来する。
- ただし「他地域名を一切含めない」を文字どおりの公開条件にする場合は未達となる。複数拠点店舗を残すか、地域ごとに表示拠点を絞るかは公開後のデータ設計判断が必要。

### 画面撮影の補足

Playwrightのheaded撮影では、`backdrop-filter` のある部分が一時的に黒く欠ける画像合成乱れを確認した。DOMの表示状態、背景色、幅、操作部品位置は正常で、検査時だけぼかし効果を外すと内容が表示された。アプリのコードは変更していない。

## 公開中ページとローカル版の差分

比較日: 2026-07-14

| ページ | 公開中 | ローカル | 公開後の主差分 |
|---|---|---|---|
| 堺筋本町 | HTTP 200、主要SEO項目正常 | HTTP 200。本文が約390文字、内部リンクが5本多い | 専用の使い分けガイドと `#local-guide` 導線が追加 |
| 堺・堺東 | HTTP 200 | HTTP 200 | 本文・主要SEO項目は同じ |
| 大阪日本橋 | HTTP 200 | HTTP 200 | 本文・主要SEO項目は同じ |
| 新大阪 | HTTP 200 | HTTP 200 | 本文・主要SEO項目は同じ |
| 梅田 | HTTP 200 | HTTP 200 | 本文・主要SEO項目は同じ |
| ダッシュボード | Basic認証でHTTP 401 | HTTP 200、self canonical、noindex | 公開本文は認証を回避せず未比較。認証自体は維持 |
| 詳細分析 | Basic認証でHTTP 401 | HTTP 200、self canonical、noindex | 公開本文は認証を回避せず未比較。認証自体は維持 |
| 口コミ投稿 | HTTP 200、canonicalがサイトTOP | HTTP 200、self canonical、noindex | 誤canonicalを `/reviews/submit/` へ修正。title重複も解消 |

公開5地域の `robots: index, follow` とローカルのrobots meta省略は、どちらもindex可能で意味は同じ。

## 公開後に改善される問題

1. 口コミ投稿ページのcanonicalがサイトTOPを指す状態を解消する。
2. 堺筋本町に地域特化の使い分けガイドとページ内導線が追加される。
3. FAQの見える内容とFAQPage schemaの条件が一致し、空HTMLや空白文字参照だけの行を出さない。
4. ダッシュボード系と口コミ投稿のnoindex/canonical条件が回帰検査で固定される。
5. ローカルの検証済み11コミットを `origin/main` の履歴へ同期できる。

## 残るリスク

1. Search Consoleの90日・28日実数、Google選択canonical、現在順位は未取得。
2. 新大阪などの複数拠点店舗は、店舗名・住所・ItemList schemaに別地域名を含む。固定文言の流用ではないが、検索意図を薄める可能性は別途評価が必要。
3. build時にWordPress APIのタイムアウトと代替データ使用が発生した。公開後は実データ件数と主要店舗を再確認する。
4. 公開ダッシュボードはBasic認証により本文差分を確認していない。
5. `middleware` 非推奨と `useSearchParams()` ログは未解消。
6. 親リポジトリのsubmodule参照更新は今回の承認対象外。別承認なしに変更しない。
7. 現在のPhase 0〜2文書は未コミット。11コミットだけをpushする場合は公開履歴に含まれない。

## ロールバック方法

1. 障害時はVercelのDeploymentsで、直前に確認済みだった本番deploymentへRollbackまたはPromoteする。
2. Git履歴はresetやforce pushで書き換えず、更新後の `main` からrevert用branchを作る。
3. 現在の基準 `593dcea44ccfa83f414dac1027dca9222066d600` から `6d847060b30335c332bcef1890449fd0a6cbb963` までをrevert候補とし、差分を確認してからrevert commitを作る。
4. revert後も `headless/` のlint、typecheck、test、buildと8ページ確認を行い、明示承認後にpushする。
5. 親リポジトリ、WordPress、Supabaseは今回変更しないため、今回のロールバック対象に含めない。

## 承認停止点

Phase 3は未実施。`git push`、Vercel本番デプロイ、Search Consoleへの再クロール依頼を行う前で停止している。

承認時は、次のどちらを公開対象にするかを明示する。

- 検証済み11コミットだけをpushする。
- Phase 0〜2文書を別コミットにまとめてから、12コミットとしてpushする。
