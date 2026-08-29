# 新大阪・堺東 Area Depth 実装計画

Task: `SHINOSAKA-SAKAIHIGASHI-AREA-DEPTH-IMPLEMENT-01`

Base: `origin/main@59621213bdf35868010d8d0b8d7ea6b82758ccd6`

## 目的と境界

既存の `/area/shinosaka/` と `/area/sakai/` に、2026-08-29 の5正本で承認された集計済み編集データだけをSSR表示する。既存URL、metadata、H1、店舗カード、ランキング、口コミ、FAQ、内部リンク、canonical、既存schemaの意味を維持する。WordPress、Supabase、production、Vercel環境、mainは変更しない。

## 実装単位

1. `headless/scripts/check-area-depth-editorial-contract.mjs`
   - 対象2エリアの分母・標本・率・観測日・ステータスを契約として固定する。
   - 非対象エリアと公開店舗数drift時のfail-closedを検証する。
   - SSR文字列、禁止表現、FAQ visible/schema同一性、ItemList同一母集団を検証する。
   - 最初にテストだけ追加してREDを確認する。
2. `headless/lib/area-depth-editorial.ts`
   - 2エリアの集計正本を型付き静的datasetとして保持する。
   - 表示率・不足件数を分母と確認済み件数から算出し、未確認を0件と誤表示しない。
   - public shop countが正本の58/25と一致しない場合はデータを返さない。
   - 各表示blockに独立feature flagを持たせる。
3. `headless/components/area/AreaEditorialDepth.tsx` とCSS module
   - Server Componentのみでcoverage、price、hours、station、portal、therapistを表示する。
   - 堺東の料金はLIMITED_SAMPLEを明示し、全体相場と断定しない。
   - 外部媒体は掲載確認、therapistは標本集計として表示し、評価・口コミ・ランキングへ変換しない。
   - PC 2列、390px 1列、横スクロールなしをCSSで保証する。
4. `headless/components/area/AreaHubPageTemplate.tsx`
   - hero直後・DecisionGuide前にcoverageを置く。
   - 店舗一覧前にportal/therapistを置く。
   - 同一のFAQ配列からvisible FAQとFAQPage schemaを生成する。
   - ItemListは既存の店舗配列とPR除外条件を維持する。
5. `headless/components/area/area-hub-content.tsx`
   - price、late-night、stationの既存panel内に対応集計を先頭挿入する。
   - 既存比較表と店舗抽出ロジックは変更しない。
6. `headless/package.json`
   - focused testを登録しfull regressionに組み込む。
7. 検証成果物
   - 30/30 Current-vs-Proposed実装結果CSVを作成する。
   - validation reportへ正本hash、テスト、SSR/schema/browser QA、変更境界、rollbackを記録する。

## 検証順序

1. focused test RED
2. 最小実装後focused test GREEN
3. typecheck / lint / build
4. ローカルSSR HTMLでH1、section順、FAQPage、ItemList、件数を確認
5. Playwrightで1440pxと390pxの両URLを確認
6. `npm test`、関連browser regression、`git diff --check`
7. 自己レビューでCritical/Importantを0にし、production release可否を判定する

## Rollback

第一段階はarea別の公開店舗数guard、第二段階はblock別feature flag、最終段階は本branch差分の不採用で戻せる。既存metadata・URL・WordPressデータを変更しないため、rollbackにmigrationやデータ復元は不要。
