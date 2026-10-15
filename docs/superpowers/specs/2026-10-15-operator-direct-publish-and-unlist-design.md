# Operator Direct Publish and Reversible Unlist Design

## Intent

運営管理者は、店舗新規追加・既存店舗編集・掲載停止・再掲載を管理ダッシュボードから直接反映できるようにする。店舗側の自店編集だけは、下書き保存と運営承認を必要とする既存フローを維持する。

## Goals

- 管理者の新規店舗は「保存して公開」で直ちに公開する。
- 管理者の既存店舗編集は「保存して公開」で直ちに公開する。
- 未取込の WordPress 既存店も、掲載停止操作で管理対象へ取り込み、物理削除せず公開一覧・エリア・検索・sitemap・詳細から外す。
- 再掲載時は同じ managed identity、WordPress ID、slug、口コミを維持する。
- すべての管理者直接操作は revision と review history を残し、expected revision 不一致は conflict にする。
- 掲載停止は対象店舗名を画面で明示し、完全一致の確認入力を要求する。
- Partner は自店の既存申請 API だけを利用し、運営の直接公開 API や他店情報には到達できない。

## Non-goals

- WordPress 投稿・既存レビュー・Storage object の物理削除。
- 既存運営アカウント、Partner membership、Auth、RLS の公開拡大。
- 都道府県カードのレイアウト変更。
- 本番データ更新、migration 適用、PR merge、deploy。

## Architecture

既存の `private.managed_shops`、revision、publication、publication_state を再利用する。新しい `private` / `api` service-role-only RPC は、管理者の create/import/save-and-publish 操作を1 revisionとして `approved` と publication projection へ即時反映する。既存の visibility RPC は published/unlisted の可逆切替を継続して使用する。

管理ダッシュボード route が dashboard credential と CSRF を検証してから service-role RPC を呼ぶ。Partner routes は既存の session workspace 検証を変更せず、運営 route の認可条件を共有しない。

## Database and Permission Scope

- 新 migration: private direct-publication functions と API wrapper の追加のみ。
- private table は RLS 継続、`anon` / `authenticated` への table/function grant は追加しない。
- wrapper は `service_role` のみに execute grant を付与する。
- 掲載停止は publication row を消さず `publication_state='unlisted'` にする。再掲載は同じ identity と publication row を再利用する。

## UX Copy

- 一覧入口: 「新規店舗を追加」「掲載を停止する」。
- 管理者編集: 「保存して公開」。
- 掲載停止確認: 対象店舗名を示し、同じ店舗名の入力が一致したときのみ「掲載を停止する」を有効にする。
- Partner: 「下書きを保存」「変更申請を送信」を維持し、公開は運営承認後だけ。

## Acceptance Evidence

- local Supabase で管理者新規直接公開、既存直接編集、未取込既存店の掲載停止/再掲載、ID/slug 維持、履歴、409 conflict を確認する。
- Partner の未承認変更が public projection に反映されないこと、他 workspace と operator API の拒否を確認する。
- Chromium → Next → local Supabase/private Storage の画面導線で確認する。
- lint、typecheck、build、npm test と 58/25/394 existing baseline を確認する。
