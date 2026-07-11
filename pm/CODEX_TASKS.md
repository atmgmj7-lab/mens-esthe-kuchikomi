# Codex Task Queue

更新日: 2026-07-11

正本: `docs/fable-final/`

## Queue方針

| 項目 | 方針 |
|---|---|
| 公開画面の正本 | 現在公開中のNext.js App Routerサイト |
| WordPressの扱い | 改善対象CMSではなく、完全移行までの一時的なデータ供給元 |
| 最終形 | Next.js + Supabase + Vercel のWebアプリ |
| Go/Stop | `docs/fable-final/65-codex-task-queue-and-blocker-rules.md` に従う |
| 禁止 | 本番DB、本番デプロイ、Secret表示、破壊的migration、自動公開、自動承認、口コミ捏造、PR表記なし広告、WordPressテーマ全面改修 |
| fallback | Stop時は同KPIに寄与するread-only/docs/testタスクへ移る |

## 完了済み

| Task ID | タスク名 | 状態 | 成果物 |
|---|---|---|---|
| S-01 | 堺筋本町SERP snapshot | done | `docs/fable-final/71-serp-snapshot-2026-07-10.md` |
| S-02 | 日本橋SERP snapshot | done | 同上 |
| S-03 | 新大阪SERP snapshot | done | 同上 |
| S-04 | 堺/堺東SERP snapshot | done | 同上 |
| S-05 | 梅田SERP snapshot | done | 同上 |
| Q-00 | 公開中ヘッドレスサイト品質監査 | done | `docs/seo-audits/q-00-quality-audit-2026-07-10.md` |

## 正式優先タスク

| Task ID | タスク名 | 優先度 | 目的 | 対象レイヤー | 原因候補 | 調査対象ファイル | 実装対象ファイル | WordPress修正の必要性 | Supabase依存 | 人間判断 | BLOCKER | 完了条件 | テスト方法 | ロールバック方法 | 次のタスク |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q-01 | 地名流用ミス修正 | 1 | 他地域名混入を止める | 複合 | Next.js表示ロジック / Next.jsハードコード / WordPress元データ / データ変換処理 / 未確認 | `headless/lib/area-hub-config.ts`, `headless/lib/area-seo.ts`, `headless/app/area/[slug]/page.tsx`, `headless/lib/wp/areas.ts` | 同左 | 条件付き。Next.js表示と移行対象データのみ | なし | 修正文面は必要 | ACF実値確認 | title/description/schema/本文/FAQに他地域名が混入しない | 文字列検査、対象slug別表示確認 | 変更箇所を戻す | Q-02 |
| Q-02 | 0円・料金未確認表示修正 | 2 | 未確認料金を0円表示しない | Next.js UI / data fetching | Next.js表示ロジック / WordPress元データ / データ変換処理 | `headless/lib/area-shop-utils.ts`, `headless/components/ShopCard.tsx`, `headless/components/ShopDetail.tsx`, `headless/components/common/PriceLabel.tsx` | 同左 | 原則不要。Next.jsで吸収。移行対象データだけ後続で正規化 | なし | 不要 | なし | null/undefined/空/0/不正値が安全表示になる | 値パターンごとの関数テストまたは静的確認 | 料金表示関数を戻す | Q-03 |
| Q-03 | ランキング表現・星評価修正 | 3 | 根拠なし評価表示を止める | Next.js UI / JSON-LD / WordPress ACF | 複合原因 | `headless/lib/shop-ranking.ts`, `headless/lib/area-shop-utils.ts`, `headless/components/common/RatingBadge.tsx`, `headless/components/area/hub/RankingHeroCards.tsx` | 同左 | 条件付き。実口コミ/評価根拠データのみ | なし | ランキング根拠は必要 | PR/ランキング判断 | 口コミ0件で星評価なし、固定評価なし、広告と自然順位分離 | 表示条件確認、JSON-LD確認 | 表示条件を戻す | Q-04 |
| Q-04 | 口コミと編集部コメントの区別整理 | 4 | ユーザー口コミと編集部/AI文を混同しない | Next.js UI / WordPress ACF | WordPress元データ / Next.js表示ロジック | `headless/components/ShopDetail.tsx`, `headless/components/area/AreaLatestReviews.tsx`, `headless/lib/area-shop-utils.ts` | 同左 | 条件付き。移行対象の文章分類だけ | なし | 口コミ承認基準は必要 | 口コミ基準未確定 | 編集部コメントを口コミ件数に含めない | 表示ラベル確認 | ラベル変更を戻す | Q-05 |
| Q-05 | PR・広告枠表記整理 | 5 | PR/広告/おすすめ/自然順位を分離 | Next.js UI | Next.js表示ロジック / WordPress元データ | `headless/lib/shop-ranking.ts`, `headless/components/area/area-hub-content.tsx`, `headless/docs/shop-ranking.md` | 同左 | 条件付き。PR元データが表示に使われる場合のみ | なし | PR文言/法務判断が必要 | PR表記未承認 | PR候補箇所、必要ラベル、rel条件が整理される | 静的確認 | 表示文言を戻す | Q-06 |
| Q-06 | title / meta / canonical / noindex確認 | 6 | インデックス事故と重複を防ぐ | Next.js metadata | Next.js metadata / WordPress URL重複 | `headless/lib/seo.ts`, `headless/app/*/page.tsx`, `headless/app/sitemap.ts`, `headless/app/robots.ts`, `headless/scripts/url-parity-check.mjs` | 同左 | 条件付き。WP公開URL重複時のみ | なし | slug/URL方針は必要 | 日本橋slug、堺/堺東URL | 全公開ページに適切なmetadata/canonical/noindex | URL別HTML確認、script実行候補 | metadata変更を戻す | Q-07 |
| Q-07 | FAQ / schema出力条件確認 | 7 | 不正schemaを出さない | Next.js JSON-LD | Next.js JSON-LD / WordPress元データ | `headless/lib/seo.ts`, `headless/components/area/AreaHubPageTemplate.tsx`, `headless/components/ShopDetail.tsx` | 同左 | 原則不要。schemaはNext.jsで制御 | なし | 口コミschema方針は必要 | 口コミ根拠未確定 | FAQなしでFAQPageなし、口コミ0件でAggregateRatingなし | JSON-LD確認 | schema出力条件を戻す | S-10 |
| S-10 | 堺筋本町Hub改善 | 8 | 最初の重点地域を強化 | Next.js UI / data fetching | コンテンツ薄さ / 内部リンク不足 | `headless/app/area/[slug]/page.tsx`, `headless/components/area/*`, `headless/lib/area-hub-config.ts` | 同左 | 元データ補正が必要な場合のみ | なし | 公開文面は必要 | なし | 72-1に近いHub構成 | 表示確認 | コンポーネント変更を戻す | S-11 |
| S-11 | 日本橋Hub改善 | 9 | 大阪日本橋を明示し意図分散を防ぐ | Next.js UI / metadata | title/本文/slug方針 | 同上 | 同上 | 条件付き | なし | 日本橋slug判断が必要 | slug判断 | 大阪日本橋がtitle/本文/schemaで明確 | 表示確認 | 変更を戻す | S-12 |
| S-12 | 新大阪Hub改善 | 10 | 出張/新幹線/ホテル需要を強化 | Next.js UI | コンテンツ不足 / 地名混入 | 同上 | 同上 | 条件付き | なし | 文面確認 | なし | 新大阪固有語句が明確 | 表示確認 | 変更を戻す | S-13 |
| S-13 | 堺 / 堺東Hub改善 | 11 | 堺市全体と堺東駅前を分離 | Next.js UI / metadata | URL/意図分離 | 同上 | 同上 | 条件付き | なし | URL構造判断が必要 | URL方針 | 堺/堺東の意図が分かれる | 表示確認 | 変更を戻す | S-14 |
| S-14 | 梅田Hub改善 | 12 | 複合KW向けに強化 | Next.js UI | 競合強度 / コンテンツ不足 | 同上 | 同上 | 条件付き | なし | 文面確認 | なし | 複合KW向け導線がある | 表示確認 | 変更を戻す | S-40 |
| S-40 | 主要内部リンク整理 | 13 | クロールと回遊を改善 | Next.js UI / routing | 主要導線不足 | `headless/components/area/AreaHubPageTemplate.tsx`, `headless/components/ShopDetail.tsx`, `headless/app/sitemap.ts` | 同左 | 原則不要 | なし | サブページURL方針は必要 | 未実装サブページ | Hub/詳細/口コミ/料金/初心者/パンくずの主要導線 | リンク確認 | 追加リンクを戻す | MIG-00 |
| MIG-00 | WordPress依存調査 | 14 | WordPressから救出する依存を確定 | WordPress REST API / ACF / 運用 | 未確認 | `headless/lib/wp/*`, `headless/app/api/*`, `.github/workflows/*`, `reviews-cpt.php`, `functions.php` | docs | 調査のみ | なし | 不要 | なし | REST/ACF/CPT/taxonomy/media/webhook/cacheを一覧化 | rg/静的確認 | docs戻し | SUPA-00 |
| SUPA-00 | Supabase存在確認 | 15 | 既存Supabaseの有無をSecret非表示で確認 | Supabase | 未確認 | `headless/.env.example`, `headless/lib/dashboard-config.ts`, `headless/lib/dashboard-supabase.ts`, `dashboard/supabase-dashboard-schema.sql`, `.github/workflows/*` | docs | 不要 | あり | Secret設定は必要 | Secret不明 | URL/anon/service/migration/SQL/接続コードの有無を記録 | secret非表示の静的確認 | docs戻し | MIG-01 |
| MIG-01 | 移行対象データ確定 | 16 | 移行する/しないデータを分ける | 移行スクリプト / 運用 | 未確認 | WP REST/ACF調査結果 | docs | 条件付き | あり | 人間確認あり | 移行対象未承認 | 店舗/エリア/口コミ/FAQ/記事/media等の対象確定 | docs確認 | docs戻し | SUPA-02 |
| SUPA-02 | 論理DB設計 | 17 | 本番作成前に論理スキーマを定義 | Supabase | 未確認 | `docs/fable-final/57-kpi-data-model-and-supabase-extension.md`, `docs/fable/escomi-supabase-logical-schema.md` | docs | 不要 | あり | 人間確認あり | 本番作成未承認 | 必要最小テーブルと関係が定義される | docs確認 | docs戻し | MIG-02 |
| MIG-02 | データ変換・クレンジング仕様 | 18 | WP値を安全にSupabaseへ移す | 移行スクリプト | WordPress元データ | MIG-01/SUPA-02成果 | docs | 条件付き | あり | 人間確認あり | なし | ID変換、slug維持、料金null/0、口コミ分離が定義 | docs確認 | docs戻し | SUPA-01 |
| SUPA-01 | Supabase新規作成または接続 | 19 | 正本DBを用意する | Supabase | 未確認 | SUPA-00/SUPA-02成果 | 外部設定 | 不要 | あり | 必須 | 本番Secret/プロジェクト作成 | 人間承認後のみ実施 | 未実施 | 外部設定を戻す | MIG-03 |
| MIG-03 | 試験移行 | 20 | 限定データで移行検証 | 移行スクリプト / Supabase | 未確認 | MIG-02成果 | scripts候補 | 不要 | あり | 必要 | Supabase接続 | 数店舗/数地域/口コミ有無/料金有無を試験 | テストDB/ステージング確認 | 試験データ削除 | CMS-01 |
| CMS-01 | WordPress風CMS構築 | 21 | WP依存を減らす管理画面 | Next.js UI / Supabase | 移行後運用 | `headless/app/dashboard/*`, `docs/fable-final/63`, `docs/fable-final/68` | dashboard | 不要 | あり | 必要 | Supabase schema未確定 | 店舗/エリア/口コミ/FAQ/SEO編集が可能 | UI/権限確認 | feature flagで戻す | CUTOVER-01 |
| CUTOVER-01 | 本番切替 | 22 | 読み取り元をSupabaseへ切替 | 運用 / Supabase / Next.js data fetching | 移行完了後 | すべて | config/routes | WordPress停止前の差分同期のみ | あり | 必須 | 本番切替日未承認 | sitemap/canonical/cache/redirect/監視/rollbackが定義 | 本番前チェック | 読み取り元をWPに戻す | WP-OFF-01 |
| WP-OFF-01 | WordPress停止 | 23 | WordPress依存を停止 | 運用 | 完全移行後 | CUTOVER結果 | 外部設定 | 必要な停止操作のみ | あり | 必須 | 安定稼働未確認 | WP更新停止/公開停止/redirectが完了 | 監視 | WP復旧 | 完了 |

## Stop時フォーマット

```text
blocking_reason:
必要な人間判断:
代替タスク:
次に進める安全な作業:
確認用質問:
保留状態の記録:
fallback_task_id:
```

## 2026-07-11 更新: Q-01 地名流用ミス修正
- 状態: 実装済み（検証コマンド実行待ち）
- 対象: Next.js側のエリア本文、FAQ、メタdescription、店舗詳細リード、店舗メタtitle
- 次タスク: Q-02 0円・料金未確認表示修正

### 2026-07-11 Q-01 検証更新
- 状態: 検証済み
- 検証: lint / typecheck / test / build 成功

## 2026-07-11 更新: Q-02 0円・料金未確認表示修正
- 状態: 実装済み（検証コマンド実行待ち）
- 対象: 価格正規化、一覧/ランキング/Hub/店舗詳細/schema/安い順ソート
- 次タスク: Q-03 ランキング表現・星評価修正

## TECH-01 Next.js middlewareからproxyへの移行調査
- 優先度: P3
- 状態: 未着手
- 理由: Q-02とは無関係で、混在させると変更範囲が広がるため

### 2026-07-11 Q-02 検証更新
- 状態: 検証済み
- 検証: lint / typecheck / test / build / 生成結果0円検索 成功

## 2026-07-11 更新: Q-03 ランキング表現・星評価修正
- 状態: 実装済み（検証コマンド実行待ち）
- 対象: 星評価、口コミ件数、AggregateRating条件、PR自然順位除外、ランキング根拠整理
- 次タスク: Q-04 口コミと編集部コメントの区別整理

### 2026-07-11 Q-03 検証更新
- 状態: 検証済み
- 検証: lint / typecheck / test / build / 生成物固定評価検索 成功

## 2026-07-11 Q-04 口コミと編集部コメントの区別整理

- 状態: 実装中
- 対応: content-provenance共通判定、ACF手入力口コミ件数の実口コミ除外、AreaLatestReviews安全化、店舗詳細の掲載情報コメント/ユーザー口コミ分離、再発防止テスト追加。
- R-01へ送る: reviews CPTの承認済み公開取得、承認/却下/削除/匿名化/スパム/通報/変更履歴/承認者/承認日時。
- Q-05へ送る: PR文章、sponsored/promotionフラグ、PRラベル、広告枠、ランキングとの分離、schema/metadata扱い。

- [x] Q-05 PR・広告枠表記整理: 実装・テスト追加・schema分離・PM記録まで完了。文言最終決定は人間確認。

- [x] UI-FINAL-01 完成形デザイン監査資料作成とトップ画像アコーディオン維持実装。
- [ ] UI-FINAL-02 都道府県エリアページを主要エリア・詳細エリア・近隣導線中心に再構成。
- [ ] UI-FINAL-03 地域詳細ページのフィルターUI、PR枠、自然ランキング、店舗一覧を完成形へ統合。
- [ ] UI-FINAL-04 店舗詳細ページの画像ギャラリー、CTA、料金、口コミ、出自別セクションを完成形へ統合。

## UI-FINAL-02 エリア詳細ページ完成形UI移行

- 状態: 完了
- 対象: `AreaHubPageTemplate`, `AreaPageView`, `globals.css`, `check-final-design-preservation.mjs`
- 完了条件: エリアページ上部が完成形の画像・本文・統計・導線カードに近づき、既存SEO/店舗/口コミ/料金ロジックを変更しない

## UI-FINAL-03 店舗詳細ページ完成形UI移行

- 状態: 未着手
- 次の対象: `ShopDetail` と店舗詳細上部UI

## UI-FINAL-03 店舗詳細ページ完成形UI移行

- 状態: 完了
- 対象: `ShopDetail`, `ShopContactCta`, `globals.css`, `check-final-design-preservation.mjs`
- 完了条件: 店舗詳細上部が完成形の画像・本文・統計・CTA構成に近づき、既存SEO/料金/口コミ/PR表示ロジックを変更しない

## UI-FINAL-04 全体の共通ヘッダー/フッター/細部整合

- 状態: 未着手
- 次の対象: 公開ページ全体の余白、カード、導線、モバイル時の統一確認

## UI-FINAL-04 共通ヘッダー/フッター/細部整合

- 状態: 完了
- 対象: `SiteHeader`, `SiteFooter`, `globals.css`, `check-final-design-preservation.mjs`
- 完了条件: 公開ページ共通のブランド、主要導線、出自分離ポリシー、配色トーンが完成形デザインに近づく

## UI-FINAL-05 最終横断確認とデプロイ前整理

- 状態: 未着手
- 次の対象: トップ、エリア、店舗詳細、共通ヘッダー/フッターの横断ブラウザ確認、残差分整理、デプロイ判断材料の提示

## UI-FINAL-05 最終横断確認とデプロイ前整理

- 状態: 完了
- 対象: トップ、エリア、店舗詳細、共通ヘッダー/フッター、ダッシュボード分離
- 完了条件: lint/typecheck/test/build/Playwright横断確認が通り、本番反映前の残確認事項がPMに記録されている

## UI-FINAL-06 本番反映判断

- 状態: 未着手
- 次の対象: 差分確認、既存未コミット変更の分類、本番反映可否判断、必要ならデプロイ手順実行

## UI-FINAL-06 本番反映判断

- 状態: 完了
- 判断: `UI_READY_BUT_DEPLOY_BLOCKED_BY_SCOPE`
- 理由: UI移行以外のダッシュボード、GitHub Actions、Fable資料、SEO品質修正が未コミット差分に混在している
- 次の対象: `UI-FINAL-07` UI-FINAL差分の反映単位分離

## UI-FINAL-07 UI-FINAL差分の反映単位分離

- 状態: 未着手
- 内容: UI-FINALだけを本番反映できる単位に分け、再検証後に本番反映可否を決める

## UI-FINAL-07 UI-FINAL差分の反映単位分離

- 状態: 完了
- ブランチ: 
- ワークツリー: 
- 検証: lint/typecheck/test/build/Playwright成功
- 次の対象: preview deployまたは本番反映判断

## UI-FINAL-07 UI-FINAL差分の反映単位分離 corrected

- 状態: 完了
- ブランチ: codex/ui-final-ready-20260712-041607
- ワークツリー: /tmp/escomi-ui-final-worktree-041607
- 検証: lint/typecheck/test/build/Playwright成功
- 次の対象: preview deployまたは本番反映判断
