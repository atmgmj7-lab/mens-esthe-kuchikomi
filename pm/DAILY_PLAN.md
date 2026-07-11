# Daily Plan

日付: 2026-07-11

## 今日の作業

| 順 | 作業 | 状態 |
|---:|---|---|
| 1 | 実リポジトリ構造の確認 | done |
| 2 | Next.jsとWordPressの依存関係確認 | done |
| 3 | Supabase存在確認 | done |
| 4 | Q-00監査レポートの構成修正 | done |
| 5 | CODEX_TASKSのタスク体系修正 | done |
| 6 | ACCEPTANCE修正 | done |
| 7 | BLOCKERS / DECISIONS / RISKS更新 | done |
| 8 | Q-01〜Q-07の実装対象ファイル候補を特定 | done |
| 9 | 次に実装する1タスクを明確化 | done |

## 今日の結論

公開画面の正本はNext.js。WordPressは改善対象ではなく、一時的なデータ供給元として扱う。

## 次にやること

`Q-01` 地名流用ミス修正。

## 今日やらないこと

- 本番コード修正。
- WordPressテーマ改修。
- Supabase作成。
- DB schema適用。
- Secret変更。
- 本番切替。

## 2026-07-11 Q-01 実施
- 完了: 地名流用ミスをNext.js側で抑止する実装
- 次: Q-02 0円・料金未確認表示修正

## 2026-07-11 Q-02 実施
- 完了: 0円・料金未確認表示のNext.js側修正
- 次: Q-02検証後、Q-03 ランキング表現・星評価修正

## 2026-07-11 Q-03 実施
- 完了: ランキング表現・星評価のNext.js側修正
- 次: Q-03検証後、Q-04 口コミと編集部コメントの区別整理

## 2026-07-11 Q-04

1. content-provenanceで出自判定を共通化。
2. 口コミ件数・評価・AreaLatestReviews・店舗詳細を安全側へ接続。
3. lint/typecheck/test/buildと生成物検索で確認。

- Q-05 PR・広告枠表記整理: 判定ロジック、表示分離、リンクrel、schema分離、テスト、PM記録を実施。

## 2026-07-12 完成形UI Phase 1/2

1. デザインZIPと現行コード対応表を作成。
2. トップページの画像アコーディオンと重点エリア画像セクションを安全に更新。
3. lint/typecheck/test/buildでQ-01〜Q-05の後退を確認。
