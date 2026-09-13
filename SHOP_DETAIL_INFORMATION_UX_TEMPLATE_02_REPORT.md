# SHOP-DETAIL-INFORMATION-UX-TEMPLATE-02

## 実装計画と結果

1. 最新origin/mainをfetchし、`9dcab69` から専用clean worktreeと `codex/shop-detail-information-ux-template-02` を作成。元worktreeの未コミット変更は保持。
2. SSRでtable排除・dt/dd意味構造、公式計測・アンカー・確認日、coverage-only、口コミ0件を先にREDにした。
3. 基本情報/アクセスを1section内の罫線付き縦型dlに変更。coverage-onlyは紹介大見出しを省き、件数・日付と展開可能な確認項目に縮小。口コミ0件は本文・投稿CTAを中心に縮小し、既存リンク先を小さく保持。
4. 公開WordPressの代表2店舗をREAD-ONLY取得し、既存normalizeShop→ViewModel→local production routeの各infoRowを照合。
5. focused/関連/全体検査、6幅browser、独立レビューを実施。結果は以下に記録。

## Before / After

| 対象 | Before | After |
| --- | --- | --- |
| 基本情報・アクセス | label/value横2列table | dtの下にdd、全幅1列。長文自然折返し |
| 本文なし店舗紹介 | 大きな紹介見出しと確認card | 紹介見出しなし、compact Trust。確認状態の詳細は開閉可 |
| 承認済み口コミ0件 | graph条件説明・分離説明・複数リンクが大きく占有 | 空状態本文・投稿CTAを中心に小型化、既存リンク先は保持 |
| Hero / 口コミあり / 関連 / footer | 既存 | 値・CTA・構造を維持 |

section順・既存anchor IDは維持。本文なしの場合も `shop-information` とnavigationリンクは保持し、リンク切れを作らない。

## 検証

| 検査 | 結果 / 証拠 |
| --- | --- |
| focused RED | PASS: 旧tableと大きな紹介表示に対するassertion failure。口コミは完全なzero fixtureで旧rendererへのREDを別途確認 |
| focused GREEN | PASS: SSR 9 checks（取得失敗、1/2/3件、本文あり/なし、空値を含む） |
| related Shop Detail tests | PASS: ViewModel / SEO asset / density / responsive / CTA tracking / review dashboard |
| npm test | PASS、exit 0 |
| npm run lint / typecheck | PASS、exit 0 |
| npm run build | PASS、exit 0、850/850 static generation |
| browser QA | PASS、代表2店舗×1440/1280/1024/390/375/320 = 12条件、横overflow 0、dt→dd縦型、table 0 |
| keyboard / focus | PASS、Trust summary Enter開閉、公式リンクfocus-visible。開いたTrustも横overflow 0 |
| WP→ViewModel→route | PASS、公開origin GETの実値を実normalizeShop/VMに通し、production buildの全infoRowsと照合 |
| SEO non-regression | PASS、同一公開入力に対する起点9dcab69と変更後SSRのJSON-LD全値・H1・リンク先集合が一致。実routeのschemaも一致 |
| git diff --check | PASS |
| Secret/PII scan | PASS、変更対象全13 filesで秘密鍵/credential pattern/email/電話番号literalの検出0。一般的pattern検査と差分目視 |
| SPEC_COMPLIANCE | 独立レビューPASS、Critical 0 / Important 0（最終成果物再確認を含む） |
| CODE_QUALITY_SECURITY | 独立レビューPASS、Critical 0 / Important 0（最終成果物再確認を含む） |

ブラウザ証拠: `/tmp/shop-detail-information-ux-template-02/browser-report.json` と同directory内のPNG。実行コマンド: headless内で `npm run build`、`npm run start -- --hostname 127.0.0.1 --port 3127`、`node scripts/check-shop-detail-information-browser.mjs`。このscriptは公開WPへのGETのみ、2つの固定代表IDを再取得する。元SHAへのSSR比較も含む。

最終画面の目視: 新大阪390pxの長文アクセス・縦型基本情報、堺東1440pxの基本情報/関連ページを確認。TrustはPC約122px/SP約120px、口コミ0件sectionはPC約197px/SP約335〜362px。

URL、slug、title/description/canonical/robots生成、sitemap、BreadcrumbList/LocalBusiness/Review/AggregateRating/priceRange、SEO sourceは変更していない。公開本番との全URL再監査ではなく、変更前後の同一入力比較・既存SEO tests・local routeの確認。承認済み口コミありの実店舗データは今回の代表に含まれず、1/2/3件条件は既存契約検査とSSRで確認した。

初回環境検査ではnode_modules外部symlink拒否とPlaywright依存欠落が発生。worktree内にlockfile通り `npm ci` し再検証して解消。既存responsive testのCSS参照一覧は今回のdl/compact classに合わせて更新し、focus・44px tap・折返し検査を新selectorへ移した。SEO期待値の変更なし。

## 変更ファイル

- `headless/components/shop-detail/ShopBasicInformationSection.tsx`
- `headless/components/shop-detail/ShopAccessSection.tsx`
- `headless/components/shop-detail/ShopOverviewSection.tsx`
- `headless/components/shop-detail/ShopInformationCoverage.tsx`
- `headless/components/shop-detail/ShopDetailModuleList.tsx`
- `headless/components/shop-detail/ShopDetail.module.css`
- `headless/scripts/check-shop-detail-information-ux.mjs`
- `headless/scripts/check-shop-detail-information-browser.mjs`
- `headless/scripts/lib/shop-detail-source-loader.mjs`
- `headless/scripts/check-shop-detail-responsive-contract.mjs`
- `headless/package.json`
- `SHOP_DETAIL_WP_FIELD_DISPLAY_MAP.md`
- 本report

WordPress field mappingと代表店舗の詳細は `SHOP_DETAIL_WP_FIELD_DISPLAY_MAP.md` を参照。

## 境界

本番未変更。main push / deploy / promotion / WordPress write / Supabase write / env・Secret変更なし。次Taskへは進まない。
