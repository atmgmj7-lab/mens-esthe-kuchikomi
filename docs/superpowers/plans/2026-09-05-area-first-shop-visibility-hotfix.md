# Area First Shop Visibility Hotfix 実装・検証計画

- Task ID: `AREA-FIRST-SHOP-VISIBILITY-HOTFIX-01`
- Base: `origin/main` / `7cf39fb4dbd45a820d5ca9e0b17b7097464a91a1`
- 対象: `/area/shinosaka/`, `/area/sakai/`
- 境界: local application codeとtestのみ。push、deploy、WordPress/Supabase writeは行わない。

## 実装方針

1. `AreaHubPageTemplate`で店舗一覧前の既存secondary informationを一度だけ組み立てる。
2. Area Depthの対象データが有効な新大阪・堺東だけ、既存renderer群を閉じたHTML `details`の子として包む。
3. summaryはエリア名を含む1行の操作導線とし、44px以上、keyboard開閉、`focus-visible`を満たす。
4. metadata、JSON-LD、店舗選択、公開データ、Area Depth計算と既存本文は変更しない。
5. 対象外エリアは追加DOMなしで従来rendererをそのまま返す。

## TDD

1. `npm run test:area-depth-editorial`へsemantic disclosureとSSR本文保持のcontractを先に追加する。
2. 旧UIでdisclosure export不在によるREDを確認する。
3. wrapper、最小CSS、template integrationを実装し、focused contractをGREENにする。
4. `npm run test:area-first-shop-visibility-browser`を追加し、変更前production buildでdisclosure不在とY座標未短縮のREDを確認する。
5. 変更後production buildで2route×8幅、閉状態・展開状態、keyboard、focus、overflow、SSR、SEO/schema、58/25件を再検証する。

## 完了検証

- `npm run test:area-depth-editorial`
- `AREA_DEPTH_BASE_URL=http://127.0.0.1:3117 npm run test:area-depth-ssr`
- `AREA_VISIBILITY_BEFORE_REPORT=reports/area-first-shop-visibility-hotfix-01/baseline.json npm run test:area-first-shop-visibility-browser`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- task差分だけを対象にしたsecret pattern scan

## 証拠と停止位置

- before/after JSONとheadless screenshotsは `headless/reports/area-first-shop-visibility-hotfix-01/` に生成する。
- task fileだけを明示stageし、local commitする。
- 実装証拠を返却し、独立review・次Task・push・deployへ進まず停止する。
