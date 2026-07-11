# Escomi 完成形UI 本番反映判断メモ 2026-07-12

## 結論

状態: `UI_READY_BUT_DEPLOY_BLOCKED_BY_SCOPE`

完成形UI Phase 1-5 はローカル検証済み。ただし、現在の未コミット差分には UI 移行以外の変更が多数混在しているため、この状態のまま本番へ一括反映するのは非推奨。

## ローカル検証結果

| 項目 | 結果 |
|---|---|
| `npm run lint` | 成功 |
| `npm run typecheck` | 成功 |
| `npm test` | 成功 |
| `npm run build` | 成功、440/440ページ生成 |
| Playwright `/` | 成功 |
| Playwright `/area/osaka/` | 成功 |
| Playwright `/area/nihonbashi/` | 成功 |
| Playwright 店舗詳細 | 成功 |
| Playwright `/dashboard` 分離 | 成功 |

## 今回UI移行として本番候補にできる変更

| 区分 | 主なファイル |
|---|---|
| トップ完成形UI | `headless/components/HomePageContent.tsx`, `headless/components/KansaiAreaGrid.tsx`, `headless/components/AreaFeatureSection.tsx`, `headless/lib/design-constants.ts` |
| エリア詳細完成形UI | `headless/components/AreaPageView.tsx`, `headless/components/area/AreaHubPageTemplate.tsx` |
| 店舗詳細完成形UI | `headless/components/ShopDetail.tsx`, `headless/components/ShopContactCta.tsx` |
| 共通ヘッダー/フッター | `headless/components/SiteHeader.tsx`, `headless/components/SiteFooter.tsx` |
| 共通スタイル | `headless/app/globals.css` |
| 完成形UI保全テスト | `headless/scripts/check-final-design-preservation.mjs`, `headless/package.json` |
| UI設計記録 | `docs/design/escomi-final-design-implementation-map.md`, `docs/design/escomi-image-animation-preservation.md`, `docs/design/escomi-ui-data-map.md` |
| PM記録 | `pm/PROGRESS.md`, `pm/CODEX_TASKS.md`, `pm/NEXT_ACTIONS.md`, `pm/ACCEPTANCE.md`, `pm/RISKS.md` |

## 同時に混在しているため分離判断が必要な変更

| 区分 | 主なファイル/ディレクトリ | 判断 |
|---|---|---|
| ダッシュボード実装 | `dashboard/**`, `.github/workflows/deploy-dashboard-*.yml` | UI公開サイトとは別リスク。別PR/別反映推奨 |
| GitHub Actions変更 | `.github/workflows/deploy.yml` | 本番反映経路に影響するため、内容確認後に別判断 |
| Fable/統合設計資料 | `docs/fable/**`, `docs/fable-final/**`, `docs/escomi-fable-final-*` | ドキュメントとしては安全寄りだが、UI本番反映とは分けるのが安全 |
| SEO監査/品質修正 | `docs/seo-audits/**`, `headless/lib/area-content-integrity.ts`, `headless/lib/price-normalization.ts`, `headless/lib/content-provenance.ts`, `headless/lib/review-rating.ts`, `headless/lib/promotion-disclosure.ts` | Q-01〜Q-05として価値はあるが、UI移行とは別スコープ |
| 既存SEO/ランキング/カード修正 | `headless/lib/area-shop-utils.ts`, `headless/lib/shop-ranking.ts`, `headless/components/ShopCard.tsx`, `headless/components/common/**`, `headless/components/area/hub/**` | 品質修正を含むため、UIと同時反映するならリスク説明が必要 |

## 本番反映の推奨方針

1. まず `UI-FINAL` だけの反映単位を作る。
2. ダッシュボード、GitHub Actions、Fable資料、SEO品質修正は別単位に分ける。
3. UI-FINAL単位で `lint/typecheck/test/build/Playwright` を再実行する。
4. 問題なければ GitHub Actions または Vercel の通常フローで本番反映する。

## 今すぐ本番反映しない理由

- 未コミット差分が 40ファイル以上のtracked変更と多数のuntracked変更を含む。
- `.github/workflows/deploy.yml` が変更されており、本番反映経路自体が変更対象に含まれる。
- `dashboard/**` と公開サイトUIが同じ未コミット状態に混在している。
- ダッシュボードは完成デザイン素材不足のBLOCKERが残っている。

## 補足

Vercel OIDC Federation は実行時に外部クラウドへ安全接続するための仕組みであり、GitHub Actions から Vercel CLI でデプロイする認証の代替ではない。CIデプロイには引き続き `VERCEL_TOKEN` が必要。
