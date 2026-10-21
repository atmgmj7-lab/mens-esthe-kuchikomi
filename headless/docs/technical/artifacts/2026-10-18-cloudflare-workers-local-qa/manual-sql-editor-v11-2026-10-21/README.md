# Eskomi v1.1: Supabase SQL Editor 手動適用パケット

対象プロジェクトは **`goeagrxjsjcbbatpotbu`** です。このフォルダは、すでに正常記録された15件を再実行せず、残り35件だけを5段階で適用するためのものです。秘密値、顧客・店舗データ、キー、接続文字列は含みません。

> このパケットを作成した側は本番SQLを実行していません。実行者はSupabase SQL Editorを操作するユーザーです。

## 実行前（必須）

1. Supabase Dashboardで project ref が **`goeagrxjsjcbbatpotbu`** であることを確認します。
2. SQL Editorで `00-checkpoint.sql` を実行します。開始条件は、`directory_anchor_exact=true`、`initial_exact=15`、`remaining_recorded=0`、`next_version_recorded=false` です。
3. 一つでも異なる値なら、**このフォルダのstage SQLを実行しません**。結果を保存して作業を止めます。

## 実行順

各stageは、source SQL とその同一sourceのmigration ledger記録を一つの `BEGIN ... COMMIT` に入れています。stageのどこかで失敗するとCOMMITに到達せず、そのstageのSQLとledger挿入はまとめてロールバックされます。SQL Editorがエラーを表示したら後続stageを押さないため、後続が自動実行されることはありません。

| 順 | ファイル | source version範囲 | 件数 |
| ---: | --- | --- | ---: |
| 01-stage-01.sql | `20261017144000` ～ `20261017145000` ～ `20261017146000` ～ `20261017147000` ～ `20261017148000` ～ `20261017149000` ～ `20261017150000` | 7 |
| 02-stage-02.sql | `20261017151000` ～ `20261017152000` ～ `20261017153000` ～ `20261017154000` ～ `20261017155000` ～ `20261017156000` ～ `20261017157000` | 7 |
| 03-stage-03.sql | `20261017158000` ～ `20261017159000` ～ `20261017160000` ～ `20261017161000` ～ `20261017162000` ～ `20261017163000` ～ `20261017164000` | 7 |
| 04-stage-04.sql | `20261017165000` ～ `20261017166000` ～ `20261017167000` ～ `20261017168000` ～ `20261017169000` ～ `20261017170000` ～ `20261017171000` | 7 |
| 05-stage-05.sql | `20261017172000` ～ `20261017173000` ～ `20261017174000` ～ `20261017175000` ～ `20261018100000` ～ `20261020030000` ～ `20261021000000` | 7 |

各ファイルは **全文を1回だけ** 新規SQL queryへ貼り付けてRunします。成功したら出力JSONが `status: COMMITTED` で、`records` がそのstageの7件すべてを持つことを確認して、次のstageへ進みます。

## エラー時

1. **同じstageを直ちに再実行せず、後続stageも実行しません。**
2. エラー文と実行時刻を保存し、`00-checkpoint.sql` を実行します（読取のみ）。
3. checkpointの値とエラーを担当者へ渡します。中途半端なledger、手動のledger INSERT、versionの飛ばし、sourceの改変はしません。

stageがCOMMIT済みなら、そのstageを再実行すると二重実行防止guardが停止します。これは期待どおりの安全動作です。`00-checkpoint.sql`の `remaining_recorded` を確認して、次に必要な判断を行います。

## 完了確認

5段階がすべて成功した後、`99-final-readonly-verification.sql`を実行します。成功条件は `packet_exact=50`、`packet_expected=50`、`packet_mismatch_or_missing=0`、`four_public_review_rpcs_present=4` です。これはmigration/ledgerと4つのpublic review RPCの存在確認であり、mapping、runtime secret、Cloudflare deploy、DNS、Auth/Storage/Mailの実運用確認を意味しません。

## 生成根拠

`headless/scripts/generate-eskomi-v11-sql-editor-packet.mjs` が checked-in migration sourceからSHA-256を算出してこのフォルダを生成します。各stageのpreflightは、既存15件のversion/name/source SHA-256、読み取り確認済みdirectory基準migrationのversion/name/source SHA-256、当該stageの未記録を照合します。source SQLは変更せず、各sourceの直後に同じsource textをledgerへ記録するINSERTだけを付加しています。
