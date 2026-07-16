# Blockers

更新日: 2026-07-15

## 2026-07-15 公開状態

- 重点5地域のSEO・視認性改善は `main` から本番公開済み。
- 公開データの取得元はWordPress。Supabase公開切替とWordPress停止は未実施。
- Vercel認証ブロッカー `BLOCK-006` は解除済み。現在の運用ブロッカーは `pm/BLOCKER.md` を正本とする。

## Active

| ID | blocking_reason | 必要な人間判断 | 代替タスク | 次に進める安全な作業 | fallback_task_id |
|---|---|---|---|---|---|
| BLK-Q-PR | PR表記・広告枠・ランキング根拠が未確定 | PR文言、自然順位、編集部おすすめ、口コミランキングの定義 | Q-02/Q-04など表示安全化 | PR候補箇所と必要条件の整理 | Q-05 |
| BLK-Q-REVIEW | 口コミ承認基準が未確定 | 承認基準、低評価口コミ、却下基準 | 編集部コメントとの分離だけ先行 | Q-04の表示/データ分離 | Q-04 |
| BLK-SUPA-00 | Supabase本番プロジェクト/Secretの実状態が未確認 | 既存利用か新規作成か、Secret登録先 | 静的な存在確認と論理設計 | SUPA-00 / SUPA-02 | SUPA-00 |
| BLK-WP-OFF | WordPress更新停止日・公開停止日が未確定 | 停止日、本番切替日、ロールバック条件 | MIG-00で依存調査 | WordPress依存一覧作成 | MIG-00 |
| BLK-SLUG | 日本橋slug、堺/堺東URL構造が未確定 | `nihonbashi` 維持か、堺/堺東分離方針 | 表示文言とcanonical監査 | Q-06 | Q-06 |
| BLK-SECRET | GA4/GSC/WordPress/Supabaseの認証情報は扱わない | 必要時は人間がSecret登録 | Secret不要の設計/監査 | docs更新、静的確認 | Q-06 |

## Notes

- WordPressは改善対象CMSではなく、一時的なデータ供給元。
- WordPressテーマ全面改修、投稿一括更新、DB操作、Secret表示、本番デプロイ、git pushは未実施。

## 2026-07-11 Q-01 注意点
- WordPress元データ自体は未変更。禁止地名を含む本文・FAQはNext.js側で安全化しているが、元データ修正は別作業。
- 本番反映・デプロイは未実施。

## 2026-07-11 Q-02 注意点
- WordPress元データ自体は未変更。代表料金・コース料金に入った `0` / `0円` / 空文字 / 未確認文字列はNext.js側で吸収している。
- Supabase移行時には、コース料金と無料手数料系フィールドの意味を分けて移行する必要がある。
- 本番デプロイと本番キャッシュ削除は未実施。

## 2026-07-11 Q-03 注意点
- WordPress REST上の `review_star` は実口コミ3件以上の承認済み集計と証明できないため、公開評価表示には使わない。
- `review_count` / `shop_review_count` は件数表示に限定。実口コミレコードとの一致確認はQ-04以降で必要。
- PR枠の表示文言・別枠デザインはQ-05で人間判断が必要。

## 2026-07-11 Q-04 BLOCKER

- WordPress reviews CPTの承認済み公開取得経路が未接続。
- 既存ACFの review_count / shop_review_count は実口コミレコードと一致確認できない。
- shop_ai_summary の最終表示方針は人間確認が必要。
- PR/広告文章の最終ラベルと別枠UIはQ-05で判断が必要。

- Q-05 広告契約フィールド未確定: WordPress/ACFの正規フィールド名、契約終了後の扱い、広告表記文言は運用判断が必要。

## DASH-DESIGN-00 運用ダッシュボード・分析ダッシュボードの完成デザイン不足

- 状態: BLOCKED
- 理由: 添付デザインHTMLには 1e / 1f の案内はあるが、実画面デザインが存在しないため、今回の公開UI移行では実装しない。
- 必要資料: Desktop、Tablet、主要KPI、テーブル、タスクキュー、分析グラフ、フィルター、空状態、未接続状態、権限状態。
