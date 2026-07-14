# Decisions

更新日: 2026-07-11

| ID | 決定 | 理由 | 参照 |
|---|---|---|---|
| DEC-001 | v6設計の正本は `docs/fable-final/` とする | Fable 00の正本ルール | `docs/fable-final/00-master-index-and-integration-policy.md` |
| DEC-002 | 公開画面の正本はNext.js App Routerとする | 現在公開画面がNext.jsで構築されているため | `headless/app` |
| DEC-003 | WordPressは改善対象CMSではなく一時的なデータ供給元とする | 最終目的がWordPress依存廃止のため | `headless/lib/wp/*` |
| DEC-004 | WordPressテーマ全面改修は行わない | 移行後に捨てるコードへ過剰投資しないため | Q-00指示 |
| DEC-005 | 料金/地名/口コミ/PR/schema事故は移行完了を待たずNext.js側で止める | 現在公開中の品質事故を防ぐため | `docs/seo-audits/q-00-quality-audit-2026-07-10.md` |
| DEC-006 | `Q-10` は廃止し、内容を `Q-03` と `Q-07` に分割統合する | 星評価とschema条件を分けて扱うため | Q-00指示 |
| DEC-007 | `S-10`〜`S-14` と `S-40` は現行Next.jsサイト改善タスクとする | WordPressテーマ改善ではないため | `pm/CODEX_TASKS.md` |
| DEC-008 | 完全移行は `MIG-00` → `SUPA-00` → `MIG-01` → `SUPA-02` → `MIG-02` → `SUPA-01` → `MIG-03` → `CMS-01` → `CUTOVER-01` → `WP-OFF-01` の順に進める | Supabase作成前に依存とデータを確定するため | Q-00指示 |
| DEC-009 | 最初のSupabase構成は店舗・地域・料金・営業時間・画像・出典・本文・口コミ・取込履歴に限定する | 41テーブルの一括移行を避け、SEOに必要な確認済み情報から蓄積するため | `docs/superpowers/specs/2026-07-14-supabase-seo-safe-migration-design.md` |
| DEC-010 | 公開表示はWordPressを既定値とし、shadow比較を経てから別承認でSupabaseへ切り替える | URL、canonical、sitemap、公開HTMLを移行準備だけで変えないため | `headless/lib/content-source/config.ts` |
| DEC-011 | Supabase Data APIは `api` schemaの公開済み読み取りviewだけに限定し、ブラウザからの書き込みを許可しない | 審査前口コミ、取込履歴、管理情報の漏えいを防ぐため | `supabase/migrations/20260714020257_seo_safe_content_core.sql` |

## 未決定

| 項目 | 状態 |
|---|---|
| ランキング根拠 | 人間判断待ち |
| PR表記 | 人間判断待ち |
| 口コミ承認基準 | 人間判断待ち |
| Supabase本番プロジェクト作成 | 人間判断待ち |
| 日本橋slug | 人間判断待ち |
| 堺/堺東URL構造 | 人間判断待ち |
| WordPress更新停止日 | 人間判断待ち |
| 本番切替日 | 人間判断待ち |
| Supabase本番接続とSecret登録 | ローカルDB実適用確認後の人間判断待ち |

## 2026-07-11 Q-01 決定
- WordPress元データは変更せず、Next.js表示層で地名混入を抑止する。
- 長文SEO本文の新規作成はQ-01では行わず、S-10以降のHub改善タスクへ分離する。
- 固定の日本橋文言は廃止し、店舗所属エリア名から表示を作る。

## 2026-07-11 Q-02 決定
- 代表料金・コース料金の `0` / `0円` / `無料` は確認済み料金として扱わない。
- fee/context 系では、明示的な `無料` または文字列の `0円` のみ無料として扱い、数値0は未確認扱いにする。
- 一覧・ランキング系の未確認表示は `料金未確認` に統一する。
- 店舗詳細の未確認表示は `料金は店舗へお問い合わせください。` にする。
- JSON-LDは確認済み代表料金がある場合だけ `priceRange` を出力する。

## 2026-07-11 Q-03 決定
- `review_star` は公開評価表示・schemaに使用しない。
- 口コミ0件は `口コミ募集中`、口コミ1件以上は件数表示に留める。
- AggregateRatingは、承認済みユーザー口コミ3件以上かつ有効評価が3件以上で、画面表示と一致する場合だけ許可する。
- 現在のランキングは `manual` + `data-completeness` ベースであり、口コミ評価順ではない。
- PR店舗は自然順位TOPから除外する。PR枠の最終表記はQ-05へ送る。

## 2026-07-11 Q-04 判断

- 出自を証明できない文章はユーザー口コミとして扱わない。
- ACF review_count / shop_review_count は実口コミ件数として使わない。
- 店舗詳細の shop_ai_summary は口コミではなく掲載情報コメントとして表示する。
- AggregateRatingは引き続き出力しない。
- WordPress、Supabase、DB、本番環境は変更しない。

- Q-05 PR/広告は自然ランキングから分離: is_pr/sponsored/paid_placement/affiliate/promotion_type はPR/広告として自然順位番号を付けず、別枠表示する。featured/recommended はPR断定しないが自然順位番号も付けない。

- UI-FINAL 写真アコーディオン維持: 完成形HTMLの白い都道府県カードだけへ置換せず、現行の画像アコーディオンを主役として維持し、完成形の配色・件数・状態表示を統合する。
