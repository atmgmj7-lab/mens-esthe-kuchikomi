# `mens-esthe-kuchikomi` 作業ツリー統合台帳

調査日: 2026-07-14

## 結論

- 現時点で元フォルダを削除しない。
- 公開コードの基準は `codex/production-baseline-20260713` の `9b66731` とする。
- 最終的な正本フォルダは `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` に戻す。
- 元フォルダの未保存内容をバックアップ参照へ固定し、必要な差分だけを現在の公開コードへ移してから作業ツリーを1つにする。
- 本番デプロイ、push、元フォルダのファイル変更は、この調査では行わない。

## Git構成

| 項目 | 元フォルダ | production側 |
|---|---|---|
| パス | `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi` | `/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi-production` |
| 種別 | 親リポジトリに登録されたメイン作業ツリー | 同じGit履歴を使う追加作業ツリー |
| ブランチ | `main` | `codex/production-baseline-20260713` |
| HEAD | `10e0e33` | `9b66731` |
| `origin/main`との差 | 26コミット遅れ | 2コミット先 |
| 作業状態 | 未コミット変更あり | クリーン |

共通Gitディレクトリ:

```text
/Users/narikiyo/dev-all-projects/.git/modules/mens-esthe-kuchikomi
```

production側は独立した複製ではないため、元フォルダをFinderや `rm` で直接削除してはいけない。

## 差分集計

以下は、この台帳と実行計画をproduction側へ追加する前の調査開始時点の件数。ビルド生成物、`node_modules`、`.next`、`.vercel`、環境変数ファイル、`tmp` を実ファイル比較から除外した。

| 区分 | 件数 | 判断 |
|---|---:|---|
| 元フォルダの追跡済み変更 | 49 | 内容を個別判定 |
| うち `origin/main` と同一 | 15 | 統合不要 |
| うちproduction HEADと同一 | 14 | 統合不要 |
| どちらとも異なる追跡済み変更 | 34 | 履歴保存の有無を追加確認 |
| 34件のうちGit履歴内に同一内容あり | 20 | 履歴から復元可能 |
| 34件のうち履歴未保存 | 14 | 削除前に必ず保存 |
| 元フォルダだけにある実ファイル | 117 | 履歴保存の有無を追加確認 |
| 117件のうちGit履歴内に同一内容あり | 116 | 履歴から復元可能 |
| 117件のうち履歴未保存 | 1 | 削除前に必ず保存 |
| production側だけにある実ファイル | 20 | 現在の公開基準として維持 |

## 削除前に必ず保存する15ファイル

### ダッシュボード・配信設定

1. `.github/workflows/deploy.yml`
2. `dashboard/.env.example`
3. `dashboard/README.md`
4. `dashboard/app/analytics/page.tsx`
5. `dashboard/components/WPQuickLinks.tsx`
6. `dashboard/next.config.ts`
7. `dashboard/public/api/ga-proxy.php`
8. `headless/app/dashboard/analytics/page.tsx`
9. `headless/app/dashboard/layout.tsx`
10. `headless/app/dashboard/page.tsx`

`dashboard/.env.example` は `dashboard/.gitignore` の `.env*` によりignoredとなるため、通常の `git add -A` では一時indexに入らない。バックアップ作成時は同ファイルを明示的に `git add -f` する必要がある。

これらは公開画面へ即時統合しない。ダッシュボード完成デザイン不足とSecret未確認の既存Blockerがあるため、バックアップ参照へ保存した後、ダッシュボード単独タスクで採否を決める。

### 口コミ・エリア表示の試作

1. `headless/app/reviews/submit/page.tsx`
2. `headless/components/area/AreaLatestReviews.tsx`
3. `headless/components/area/area-hub-content.tsx`
4. `headless/components/area/hub/AreaShopList.tsx`
5. `headless/components/area/hub/RankingHeroCards.tsx`

これらはQ-04からQ-07、S-10の現在実装と同じファイルを変更している。今回の作業ツリー統合では採用せず、バックアップ参照だけに保存する。フォルダ統合後、差分の意図を個別に読み、現在の品質検査を維持できる変更だけを別タスクで検討する。

## すでに保存済みと判断できる内容

- 元フォルダで変更表示される49件のうち15件は、現在の `origin/main` と同一内容。
- 残る34件のうち20件は、現在参照可能なGitコミットに同一blobが存在する。
- 元フォルダだけにある設計資料、SEO資料、PDF、画像、ダッシュボード補助ファイルなど117件のうち116件は、現在参照可能なGit履歴に同一blobが存在する。
- `docs/fable*`、`docs/design/*`、旧完成デザイン画像は公開コードへ一括コピーしない。バックアップ参照を残し、必要な資料だけを後で選ぶ。

## 統合時の優先順位

1. `9b66731` の公開コードとQ-06、Q-07、S-10検査を維持する。
2. 履歴未保存の15ファイルをバックアップ参照へ固定する。
3. 口コミ・エリア表示の5ファイルはバックアップ参照だけに保存し、今回の統合では公開コードへ入れない。
4. ダッシュボード10ファイルは公開UIと分離して保留する。
5. `headless/` で lint、typecheck、test、buildを通す。
6. 明示確認後に元フォルダの `main` を統合済みコミットへ進める。
7. 元フォルダで再検証してからproduction作業ツリーをGit経由で削除する。

## 削除許可の条件

次の条件がすべて成立するまで、どちらのフォルダも削除しない。

- 元フォルダの非ignoredファイルを表すバックアップ参照が作成済み。
- バックアップ参照と元フォルダの一時indexが同一treeである。
- 採用する差分が現在の公開コードへコミット済み。
- `headless/` の lint、typecheck、test、buildが成功。
- 元フォルダの `main` が統合済みコミットを指している。
- 元フォルダ上で同じ検査が成功。
- production側にしかない必要ファイルが0件。
- ユーザーがproduction作業ツリー削除を明示承認。

## Task 1〜4 実施証拠

この節を作業ツリー統合の追跡済み正本とする。`.superpowers/sdd/` は実装中の補助記録であり、Gitのローカル除外対象のため、Task 5でproduction作業ツリーを削除する前に本節と `pm/PROGRESS.md` を確認する。

### バックアップ

- バックアップref: `backup/original-dirty-20260714` = `81884f9efca15395a744f64ff1dcf25130b80e14`。
- 親コミット: `d61598103f35b70ee8ee07dfc626b58b38d2f7f2`。
- 初回にignoredの `dashboard/.env.example` が対象外だったことを検出し、同ファイルだけを一時indexへ強制追加した。
- 修正後、削除前に保存する15ファイルを個別に `git cat-file -e` で確認し、すべてバックアップrefに存在することを確認した。
- 一時indexとバックアップrefのtree一致、`dashboard/.env.example` の元ファイルとのblob一致、元フォルダのHEAD・通常index・既存未コミット状態の不変を確認した。

### Task別コミットとレビュー

- Task 1: `72b1150`（統合計画・台帳・バックアップ記録）、`c0bb030`（ignoredファイルを含むバックアップ完全性修正）。実装後レビュー承認。
- Task 2: `b88bf02`（公開UI試作5件を今回適用しない判断）。実装後レビュー承認。
- Task 3: `88426d7`（ダッシュボード10件をBlocker解消まで保留する判断）。バックアップ修正後の再レビュー承認。
- Task 4: `c1600e8`（production側の統合済み基準を最終検証）。実装後レビュー承認。

### 品質検査

- 最終レビューのQ-07境界条件修正後に、以下の全検査を再実行した。
- `git diff --check`: 終了コード0。
- `headless/` の `npm run lint`: 終了コード0。
- `headless/` の `npm run typecheck`: 終了コード0。
- `headless/` の `npm test`: 終了コード0、11検査成功。
- `headless/` の `npm run build`: 終了コード0、440ページ生成成功。
- buildでは既存の `middleware` 非推奨警告と、WordPress APIの404による代替データ使用通知を確認した。

### 未実施

- Task 5は未実施。元フォルダの整理、`main` のfast-forward、production作業ツリー削除は行っていない。
- `git push` と本番デプロイは行っていない。

## Q-07 HTML空白文字参照の追加修正

### 修正内容

- FAQ専用の表示可能テキスト判定を追加し、`&nbsp;` の大文字小文字差、`&#160;`、`&#xA0;`、Unicode NBSPを通常空白へ正規化した。
- 質問と回答、`asFaqRows` と `faqJsonLd` の両方で同じ判定を使い、実質空のFAQ行とFAQPage schemaを除外した。
- `asFaqRows` が返す回答の表示用HTMLは変更せず維持した。

### RED / GREEN

- RED: 回帰テスト追加後の `npm run test:schema-output` は終了コード1。`answer: "&nbsp;"` の行が残り、期待する空配列との差で失敗した。
- GREEN: 共通判定の実装後、`npm run test:schema-output` は終了コード0で `schema output condition checks passed`。

### 最終検証

- `git diff --check`: 終了コード0。
- `headless/` の `npm run lint`: 終了コード0。
- `headless/` の `npm run typecheck`: 終了コード0。
- `headless/` の `npm test`: 終了コード0、11検査成功。
- `headless/` の `npm run build`: 終了コード0、440ページ生成成功。
- buildでは既存の `middleware` 非推奨警告、WordPress APIの404・タイムアウトによる代替データ使用通知、`useSearchParams()` のクライアント描画切替ログを確認した。

### 未実施

- Task 5、元フォルダの変更、`git push`、本番デプロイは実施していない。
