# Supabase SEO安全移行 Runbook

作成日: 2026-07-14

## 現在の停止位置

- ローカルmigration: 作成済み
- schema契約検査: 成功
- WordPress公開382店舗の読み取り監査: 成功
- WordPress既定の参照先安全装置: 作成済み
- Dockerを使うローカルDB実適用: 初回適用、db reset、DB lint成功
- Supabase本番プロジェクト: 未作成・未接続
- 本番データ投入: 未実施
- 公開参照先切替: 未実施
- local Supabase: 検査後に停止済み
- push / deploy: 未実施

## 1. ローカル検査

リポジトリルート:

```bash
cd /Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi
git status --short --branch
```

Docker Desktopを起動した後:

```bash
supabase start
supabase db reset
supabase db lint --local
```

Next.js側:

```bash
cd headless
npm run test:supabase-content-schema
npm run test:wp-migration-audit
npm run test:content-source-config
npm run lint
npm run typecheck
npm test
npm run build
```

終了時:

```bash
cd ..
supabase stop
```

## 2. WordPress移行元の再監査

公開APIへの読み取りだけを行う。

```bash
cd headless
node scripts/audit-wp-migration-source.mjs
```

確認項目:

- 店舗総数と地域総数
- 本文、抜粋、地域説明
- 画像、公式URL、確認可能料金
- 住所要確認数
- 地域なし、複数地域
- 出典URL、確認日
- reviews公開API状態

このcommandはWordPressへ書き込まない。出力した382店舗分の生データをGitへ追加しない。

## 3. 本番Supabase準備前の承認

次をユーザーへ提示して、明示承認を得る。

1. migration差分。
2. RLS、公開view、anon/authenticated権限。
3. ローカル `supabase db reset` とlint結果。
4. 月額費用とプロジェクト所有者。
5. Secret登録場所。
6. 戻し方。

承認前に `supabase link`、`supabase db push`、本番SQL Editor、外部DB書き込みを行わない。

## 4. 試験投入

本番接続承認後も、最初から382店舗を入れない。

1. 堺筋本町の3店舗と地域1件だけを非公開で入れる。
2. WordPress ID、slug、正規パス、地域関係を比較する。
3. 料金0、住所/アクセス混在、画像なし、公式URLなしを含む店舗を最低1件ずつ試す。
4. 審査前口コミとprivate取込記録が公開APIから見えないことを確認する。
5. 問題がなければ30店舗へ広げる。
6. 382店舗全件は別承認後に入れる。

今回、投入scriptと本番接続は未実装である。

## 5. shadow比較

本番投入と内容確認が終わるまで有効化しない。

```text
CONTENT_DATA_SOURCE=shadow
SUPABASE_CONTENT_URL=<project URL>
SUPABASE_CONTENT_PUBLISHABLE_KEY=<publishable key>
SUPABASE_CONTENT_CUTOVER_APPROVED=false
```

shadowでも公開表示の正本はWordPressとする。Supabaseの結果は件数、slug、主要項目、HTML差分の比較だけに使う。

比較条件:

- 382店舗と34地域のID対応が100%。
- 現在の公開slugと正規パスが100%一致。
- 主要5地域の店舗所属が人間確認済み。
- 未確認料金が0円として出ない。
- 利用者口コミとAI/編集部文が混ざらない。
- title、description、canonical、robots、schema、sitemapに意図しない差がない。

## 6. 公開参照先切替

次の設定は、公開差分、ロールバック手順、切替日時の明示承認後だけ使う。

```text
CONTENT_DATA_SOURCE=supabase
SUPABASE_CONTENT_CUTOVER_APPROVED=true
```

設定moduleは承認フラグがないSupabase単独参照を拒否する。ただし、現在の公開routeへはまだ接続していないため、この設定だけで切替は起きない。

## 7. 戻し方

公開参照先をWordPressへ戻す。

```text
CONTENT_DATA_SOURCE=wordpress
SUPABASE_CONTENT_CUTOVER_APPROVED=false
```

同時に確認する。

- 主要5地域と店舗詳細のHTTP状態。
- canonicalとsitemap。
- 料金0表示の不在。
- 口コミ0件時の評価非表示。
- FAQとschemaの出力条件。

Supabase内のデータ削除、WordPress停止、URL変更は、原因確認と別承認なしに行わない。

## 8. 段階判定

| 段階 | 必須確認 | 承認 |
|---|---|---|
| ローカルmigration | db reset、lint、契約検査 | 不要 |
| 本番project接続 | 所有者、費用、Secret、migration | 必須 |
| 3店舗試験 | private投入、公開漏えいなし | 必須 |
| 30店舗試験 | 住所・料金・地域関係 | 必須 |
| 382店舗投入 | 件数、slug、欠損一覧 | 必須 |
| shadow | 公開HTML不変、差分記録 | 必須 |
| cutover | SEO全検査、戻し方、日時 | 必須 |
| WordPress停止 | 30日安定、未移行依存なし | 必須 |
