# エスコミ 主要5地域 Top10 SEO 実行プロンプト

更新日: 2026-07-14

## このプロンプトの使い方

このファイルを、エスコミのSEO改善を担当するCodexへそのまま渡す。
初回実行では **Phase 0からPhase 2まで** を行い、本番push・デプロイの直前で停止する。

---

## 実行指示

あなたは、関西メンズエステ口コミサイト「エスコミ」のSEO責任者兼Next.jsエンジニアです。

最終目標は、次の5地域のうち最低1地域で、Google検索クエリ
**「地名 メンズエステ」10位以内**を安定して獲得することです。

- 堺筋本町
- 堺東（堺市全域との検索意図を分離する）
- 大阪日本橋
- 新大阪
- 梅田

順位は保証せず、公開品質、実データ、内部リンク、検索結果の計測を積み重ねて達成確率を最大化してください。

## 1. 作業場所と禁止事項

正式な作業場所は、次のフォルダだけです。

```text
/Users/narikiyo/dev-all-projects/mens-esthe-kuchikomi
```

以下を厳守してください。

- 削除済みの `mens-esthe-kuchikomi-production` を再作成しない。
- `/private/tmp/escomi-*` の既存作業ツリーを変更しない。
- 親フォルダ `/Users/narikiyo/dev-all-projects` の他プロジェクトを変更しない。
- 親フォルダで `git submodule update` を実行しない。
- `backup/original-dirty-20260714` の内容を現在のmainへ一括コピーしない。
- Secretの値を表示、記録、コミットしない。
- WordPress本番データ、Supabase本番データを変更しない。
- ユーザーの明示承認なしに `git push`、本番デプロイ、外部サービスへの書き込みをしない。
- 本番デプロイ前に必ず差分、検証結果、戻し方を日本語で提示する。

## 2. 最初に読むファイル

次の順番で読み、現在のmainとの差分を確認してください。

1. `AGENTS.md`
2. `.cursorrules`
3. `pm/PROGRESS.md`
4. `pm/BLOCKERS.md`
5. `pm/CODEX_TASKS.md`
6. `pm/NEXT_ACTIONS.md`
7. `pm/ACCEPTANCE.md`
8. `pm/RUNBOOK.md`
9. `docs/technical/repository-consolidation-inventory-2026-07-14.md`
10. `docs/design/escomi-final-design-implementation-map.md`

過去のSEO計画はローカルの保全refにあります。存在を確認してから、次を読み取り専用で参照してください。

```bash
git show backup/original-dirty-20260714:docs/fable-final/69-five-area-top10-seo-execution-plan.md
git show backup/original-dirty-20260714:docs/fable-final/70-five-area-keyword-map.md
git show backup/original-dirty-20260714:docs/fable-final/71-serp-snapshot-2026-07-10.md
git show backup/original-dirty-20260714:docs/fable-final/72-five-area-page-architecture.md
git show backup/original-dirty-20260714:docs/fable-final/73-one-month-seo-sprint-plan.md
git show backup/original-dirty-20260714:docs/fable-final/74-seo-codex-task-backlog.md
git show backup/original-dirty-20260714:docs/fable-final/76-seo-feasibility-and-risk-analysis.md
```

過去計画は参考資料です。現在のコード、現在の公開ページ、現在の検索結果を優先し、古い記述をそのまま実装しないでください。

## 3. 現在の前提

作業開始時に必ず再確認し、変わっていれば現在値へ読み替えてください。

- 正式ブランチは `main`。
- 2026-07-14時点のHEADは `6d847060b30335c332bcef1890449fd0a6cbb963`。
- ローカル記録では `origin/main` より11コミット進んでいる。
- Q-01からQ-07、S-10、S-40相当の修正はローカルmainへ統合済み。
- `headless/` のlint、typecheck、11検査、build 440ページ生成は統合時に成功済み。
- push、本番デプロイは未実施。
- 親リポジトリのsubmodule参照は旧コミットのままで、現在の子リポジトリ位置が未記録。
- 公開中ページには、0円表示や他地域名の流用など、ローカルmainで修正済みの問題が残っている可能性がある。

## 4. 攻略方針

5地域を同じ強さで同時進行しないでください。順序は次の通りです。

1. **堺筋本町**: 現在の主対象。S-10実装済みで、URL判断なしに最短で公開できる。
2. **堺東**: 次点候補。競合は比較的弱いが、堺市全域とのURL分離判断が必要。
3. **大阪日本橋**: 東京日本橋との区別と、2つの既存ページの役割整理が必要。
4. **新大阪**: 出張、新幹線、ホテル、駅出口の検索意図に特化する。
5. **梅田**: 最難関。最初は深夜、駅、料金などの複合検索を狙う。

同時に本格改修する地域は最大2つまでとし、基本は堺筋本町へ集中してください。

## 5. 実行順序

### Phase 0: リポジトリ安全確認

次を実行し、結果を日本語で整理してください。

```bash
pwd
git rev-parse --show-toplevel
git status --short --branch
git branch --show-current
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/main
git rev-list --count origin/main..HEAD
git log --oneline origin/main..HEAD
git worktree list
```

`git fetch origin --prune` はリモート追跡情報の更新だけに使い、pull、merge、rebaseは自動実行しないでください。fetchできない場合は、`origin/main` がローカル記録であることを報告します。

続けて、親リポジトリでは読み取りだけを行います。

```bash
git -C /Users/narikiyo/dev-all-projects diff --submodule=short -- mens-esthe-kuchikomi
```

判定条件:

- 未確認の変更があれば、変更者を推測して消さず、内容を分類する。
- `main`、HEAD、`origin/main` の関係が前提と異なる場合は、計画を更新してから進む。
- 親リポジトリの参照更新は、このSEO作業と別の承認事項として扱う。

### Phase 1: 公開前の計測基準を保存

Search Consoleで、過去90日と過去28日のデータを保存してください。

対象検索語:

- `堺筋本町 メンズエステ`
- `堺東 メンズエステ`
- `堺 メンズエステ`
- `大阪 日本橋 メンズエステ`
- `日本橋 メンズエステ`
- `新大阪 メンズエステ`
- `梅田 メンズエステ`

記録項目:

- 表示回数
- クリック数
- CTR
- 平均掲載順位
- Googleが表示したページURL
- PCとモバイルの差
- インデックス状況
- Google選択canonical

Search Consoleへアクセスできない場合は、Secretやログイン情報を求めず、人間が行う手順を提示してください。代わりに現在の検索結果上位10件を調査し、調査日、検索語、URL、title、ページ種別、主な強みを `docs/seo/` 配下へ記録してください。手動検索結果を確定順位として扱わないでください。

### Phase 2: ローカルmainの公開前確認

`headless/` で以下を順番に実行してください。

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

生成HTMLとローカル表示で最低限、次を確認してください。

- `/area/sakaisujihonmachi/`
- `/area/sakai/`
- `/area/nihonbashi/`
- `/area/shinosaka/`
- `/area/umeda/`
- `/dashboard`
- `/dashboard/analytics`
- `/reviews/submit`

確認内容:

- 他地域名が本文、FAQ、title、description、schemaへ混入していない。
- 未確認料金が `0円`、`0円〜`、`¥0` と表示されない。
- canonicalが意図した自ページを指している。
- 公開対象ページに誤ったnoindexがなく、ダッシュボードと口コミ投稿ページはnoindexになっている。
- 口コミ0件、根拠不足時に星評価とAggregateRatingを出さない。
- FAQが空の場合はFAQ表示とFAQPage schemaを出さない。
- PR枠と自然順位が分かれている。
- 主要な内部リンクが実際の `<a href>` として存在する。
- PC幅とスマホ幅で文字、画像、ボタンが重ならない。

公開中ページとローカル版の差分も一覧にしてください。その後、以下をユーザーへ提示して停止してください。

1. 公開予定の11コミットと変更内容
2. 検証結果
3. 公開後に改善される問題
4. 残るリスク
5. ロールバック方法
6. push・本番デプロイを実行してよいかという確認

**初回実行では、明示承認を得るまでPhase 3へ進まないでください。**

### Phase 3: 承認後の公開と再登録

ユーザーが明示承認した場合だけ、承認された方法でpush・本番デプロイを行ってください。

公開後は次を確認します。

- 公開URLのHTTP状態
- title、description、canonical、robots
- 5地域の地域名整合
- 0円表示の不在
- schema出力条件
- PCとスマホの主要表示
- sitemapへの5地域URL掲載

問題がなければ、Search ConsoleのURL検査で5地域の再クロールを依頼します。Search Console操作は人間のログインが必要なら、正確な操作手順だけ提示してください。

### Phase 4: 堺筋本町の実データ強化

公開後の最優先タスクです。上位30店舗から、公式サイトなど確認可能な一次情報を使って次を整備してください。

- 正式店名
- 住所
- 最寄駅、出口、徒歩目安
- 営業時間、深夜対応
- 代表料金とコース料金
- 公式URL
- 電話、予約方法
- 情報確認日
- 情報出典
- 未確認項目

禁止事項:

- 料金、営業時間、口コミ、評価を推測しない。
- AI文章を利用者口コミとして扱わない。
- 店舗数や料金相場を固定値で捏造しない。
- 情報がない項目は「未確認」とする。

確認済みデータから、料金分布、営業時間傾向、駅出口別、初心者向け、深夜利用の比較情報を生成してください。本文を先に作文して数字を合わせるのではなく、データ集計を先に行います。

### Phase 5: 堺東のURL判断と完全網羅

実装前に、次のどちらを採用するかをユーザーへ1問だけ確認してください。

- `/area/sakai/` を堺東の正規ページとして継続利用する。
- `/area/sakaihigashi/` を新設し、堺市全域と堺東を分ける。

決定前にURL、canonical、redirectを変更しないでください。決定後は、堺東対象店舗18件を可能な限り全件確認し、堺市全域の説明と堺東駅周辺の説明を混在させないでください。

### Phase 6: 14日・30日判定と横展開

公開14日後と30日後に、Search Consoleで次を比較してください。

- 対象検索語の表示回数
- 平均掲載順位
- クリック数とCTR
- 表示されたページ
- 検索語とページの食い合い
- インデックスとcanonical

判断規則:

- インデックスされない: sitemap、robots、canonical、内部リンクを優先修正。
- 表示されるが30位以下: 検索意図、実データ量、情報鮮度を改善。
- 11位から20位: title、導入、比較表、内部リンク、CTRを改善。
- 堺東の伸びが堺筋本町を明確に上回る: 堺東を主対象へ切り替える。
- 堺筋本町または堺東がTop20へ入る: その地域へ作業量の70%以上を集中する。

その後に日本橋、新大阪、梅田の順で横展開してください。

## 6. 後回しにする作業

最低1地域のTop10達成に直接必要になるまで、次は優先しないでください。

- Supabase全面移行
- WordPress停止
- CMS大規模開発
- 広告管理機能の拡張
- 5地域の同時大量生成
- 根拠のないランキングや口コミ追加
- FAQ schemaだけを目的としたFAQ量産

## 7. 品質とコミット規則

- 実装前に現在のコードと既存テストを読む。
- 1タスク1目的を守り、無関係な整理を混ぜない。
- 再発可能な修正には先に失敗するテストを追加する。
- 各実装後に対象テストを実行し、最後にlint、typecheck、全test、buildを行う。
- `git diff --check` を実行する。
- コミット前に差分をレビューし、対象ファイルだけをstageする。
- コミットは可能だが、pushはユーザー承認まで行わない。
- 作業完了時に `pm/PROGRESS.md` を更新する。
- 次の1タスクを `pm/NEXT_ACTIONS.md` の最新セクションへ記録する。

## 8. 完了報告フォーマット

```text
実行したPhase:
変更ファイル:
コミット:
検証結果:
公開との差分:
Search Console基準値:
残る問題:
必要な人間判断:
未実施（push / deploy / 本番データ変更）:
次の1タスク:
```

報告は日本語で簡潔にし、実行していないことを実行済みと書かないでください。

## 9. 初回の開始指示

まずPhase 0からPhase 2まで実行してください。
本番push・デプロイは行わず、公開対象、検証結果、残るリスク、戻し方を提示して承認待ちで停止してください。
