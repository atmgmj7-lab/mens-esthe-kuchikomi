# Eskomi 総合実装設計 v1.1 — 実装正本と対応表

承認済み原本: 2026-10-17 提供の「Eskomi 総合実装設計・最終承認案 v1.1」。本書は原本の実装規約を保存し、実装状況を追跡するためのリポジトリ上の対応表である。原本の要求が既存コードと矛盾する場合は原本を優先する。

## 不変の実装規約

- 正規店舗は `app.shops.id`。WordPress ID/添付 ID は新規登録・投稿・公開の必須条件にしない。
- 口コミ入口は登録不要で、店舗と任意の担当者を一度に評価する。ニックネーム、共通コメント、各評価は任意だが、少なくとも一つの回答を必要とする。
- 公開前に Eskomi と店舗 HP へ掲載され得ることを明示する。公開 handle、編集控え、特典コードを共用しない。
- 特典は有効受付時に、運営承認済みの条件版にだけ発行する。星、批判、人物評価の有無、公開・取り下げだけでは取消さない。発行停止と既発行コードの利用可否は別状態で扱う。
- 店舗情報は申請・版管理、運営者の直接編集は監査付き。削除は復元可能な状態変更で、未公開編集 draft が既存 WP 公開を消してはならない。
- 公開 read は公開中店舗と承認済み投影だけ。draft/review/archived 店舗の入口、投稿、公開 read を拒否する。
- 自動メール・LINE・顧客台帳・価格や順位の未確定値は追加しない。広告は通常順位から分離する。

## 要件→実装→試験

| 要件 | 現在の実装 | 試験/状態 |
|---|---|---|
| E01/E02 正規店舗・WP非依存 | `app.shops`、`managed_shops.app_shop_id`、canonical 作成 RPC | canonical foundation SQL。要 local Supabase 実行 |
| E03 workspace と店舗一致 | `(workspace_id, shop_id)` 複合 FK | integrity SQL に不一致 insert 拒否 |
| E04–E06 人物・案内リンク | `therapists`、assignments、entry link resolver | 人物写真権利版・一般リンクからの担当選択は未実装 |
| E07–E10 受付と共通回答 | `submit_review_experience_v2`、任意 nickname/評価/0–400 コメント | 要 DB transaction/E2E |
| E11 公開投影 | 公開 read RPC と withdrawal archive | 現行は assessment 単位 publication で、1体験1公開IDへの統合は未完了 |
| E12 編集控え | hash は保存済み | 顧客へ返す操作セッション、期限、再送は未実装 |
| E13/E14 審査・返信 | moderation audit は保存済み | v2 管理審査 UI、承認返信は未完了 |
| E15–E18 特典 | 受付時に条件済み program から発行、withdrawal は公開投影のみ archive | immutable version、期限、消込 session/結果回復は未完了 |
| UI 1/2→2/2→受付 | `/r/{handle}` 互換 resolver と `/reviews/entry/[handle]` | PC/SP 実ブラウザと本物の entry fixture は未実行 |
| 公開境界 | resolver/read/submit は `app.shops.publication_status='published'` | draft/review/archived DB 境界を local SQL へ追加予定 |
| 削除 tombstone | archive event 又は過去 publication の unlisted のみ WP 抑制 | draft import 非抑制・archive/restore 抑制を local SQL へ追加予定 |
| B01–B10 バナー | 素材取得失敗のため未使用 | 画像取得後に権利・PC/SP・配置を実装 |
| 訂正/情報交換 E30–E32 | 既存申請を再利用候補 | community、reaction、通報は未実装 |

## リリース境界

本書は G0/G1 の実装正本であり、G3 の特典条件・保存/同意・鍵設定、G4 の全受入、G5 の本番承認を代替しない。10/08 duplicate migration の no-op 化は fresh reset の修正であり、既存DB migration ledger の読取り照合を本番前ゲートとして残す。
