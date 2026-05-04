# エスコミ 実装プロンプト集【最終版】
## ゴール: 「日本橋 メンズエステ」Google 1ページ目
## 実行順: STEP1（Cursor）→ STEP2（antiGRAVITY）→ STEP3（antiGRAVITY並列）
## 自動化基盤: GitHub Actions（無料・メンテ不要）

---

# 事前作業【あなた（人）がやること・5分】

Cursorを起動する前に、以下4つのSecretsをGitHubに登録してください。
登録場所: `github.com/atmgmj7-lab/mens-esthe-seo-tools` → Settings → Secrets and variables → Actions → New repository secret

| キー名 | 値 |
|--------|----|
| `GEMINI_API_KEY` | GeminiのAPIキー |
| `WP_APP_PASSWORD` | WPアプリケーションパスワード |
| `AI_ENGINE_API_KEY` | 今回実装したカスタムヘッダーキー（wp-config.phpのAI_ENGINE_API_KEY） |
| `WP_USER` | WordPressのログインユーザー名 |

登録完了後、Cursorに「Secrets登録完了しました。STEP1を開始してください」と伝えてください。

---

# STEP 1【Cursor用・SSH実行】
# パイロット実行 + GitHub Actions 日次自動化構築

## あなたの役割
シニアバックエンドエンジニアとして作業してください。
**絶対ルール: 前提を置かず、必ず実ファイルを確認してから実装・実行すること。存在未確認のファイル・変数を前提にしたコード変更は禁止。**

## プロジェクト情報
- リポジトリ: `~/Desktop/dev/mens-esthe-seo-tools`
- WordPress: `https://mens-esthe-kuchikomi.com`
- REST エンドポイント: `POST /wp-json/ai-engine/v1/update`
- 認証: カスタムヘッダー `X-AI-API-Key`
- 参照ドキュメント: `pm/RUNBOOK.md`（Bセクション）、`pm/BLOCKER.md`、`pm/SHOP-AI-ROLLOUT.md`

---

## Phase 0: ファイル実態の確認【省略禁止】

以下を上から順に確認し、結果をテーブルで報告してから次フェーズへ進むこと。

1. `ai-site-monitor/` 内の全 `.py` ファイルをリストアップ
2. `hourly_schedule_updater.py` の存在確認。あれば冒頭50行と役割を日本語で説明
3. `ai_auto_updater.py` の存在確認。あれば冒頭50行と `--help` 出力を表示し役割を日本語で説明
4. 両スクリプトの役割・実行頻度の違いを比較表で整理
5. `.env` または `.env.example` を確認し、以下のキーの有無をチェック:
   `WP_SITE_URL`, `WP_USER`, `WP_APP_PASSWORD`, `GEMINI_API_KEY`, `AI_ENGINE_API_KEY`
6. `ai-update-log.php`（子テーマ）の `permission_callback` を確認し、`X-AI-API-Key` 認証が実装されているか確認
7. `.github/workflows/` 内の既存ワークフローファイルを全てリストアップし、各ファイルのcronスケジュールと処理内容を確認
8. **不足・問題点を明示し、私（ユーザー）に確認が必要な事項があれば必ずここで質問してから次へ進む**

---

## Phase 1: 環境セットアップ確認

1. Python venv の存在確認。なければ作成
2. `requirements.txt` を確認し、`playwright`, `beautifulsoup4`, `python-dotenv`, `google-generativeai` が含まれるか確認。不足があれば `pip install` 実行
3. `playwright install chromium` 済みか確認。未実行なら実行

---

## Phase 2: REST API 疎通テスト

**未認証テスト（401を確認）:**
```bash
curl -sS -w "\nHTTP: %{http_code}" \
  -X GET "https://mens-esthe-kuchikomi.com/wp-json/ai-engine/v1/update"
```

**認証テスト（.envからキーを読み込んで実行）:**
```bash
set -a && source .env && set +a
curl -sS -w "\nHTTP: %{http_code}" \
  -X POST "https://mens-esthe-kuchikomi.com/wp-json/ai-engine/v1/update" \
  -H "Content-Type: application/json" \
  -H "X-AI-API-Key: $AI_ENGINE_API_KEY" \
  -d '{"shop_id": 0}'
```

期待値: 未認証=401、認証済み=400または200。それ以外なら原因を調査して修正してから次へ進む。

---

## Phase 3: パイロット実行（出勤情報更新・1件）

1. Phase 0 の確認結果を踏まえ、**出勤情報の日次更新に適したスクリプトを選定し理由を述べる**
2. 選定スクリプトを1件だけ実行:
```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
set -a && source .env && set +a
python [選定スクリプト] --limit 1
```
3. 実行ログから以下を確認して報告:
   - WPから店舗一覧取得: 成功/失敗
   - 公式URLへのアクセス: 成功/失敗
   - Geminiでコンテンツ生成: 成功/失敗
   - `ai-engine/v1/update` へのPOST: HTTPコード・レスポンスボディ
4. 失敗した場合はエラーを修正して再実行する

**WP反映確認:**
```bash
curl -sS "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop?slug=[更新した店舗スラッグ]&_fields=meta"
```
`shop_today_analysis`, `shop_availability`, `shop_today_therapists` に値が入っているか確認。

---

## Phase 4: GitHub Actions 日次自動化ワークフロー構築

**前提確認（実装前に必ず確認）:**
- Phase 0 で確認した既存ワークフローと重複・競合しないか確認
- `mens-esthe-seo-tools` リポジトリの `.github/workflows/` に既存の `daily_cron.yml` がある場合、その内容と今回作るワークフローの役割分担を私に説明して承認を得てから実装する

**実装内容: `shop_updater.yml` を新規作成**

要件:
```yaml
名前: Daily Shop Updater
トリガー:
  - schedule: 毎日 JST 10:00（cron: '0 1 * * *'）
  - workflow_dispatch（手動実行も可能にする）
実行内容:
  1. リポジトリをcheckout
  2. Python環境セットアップ（3.11推奨）
  3. requirements.txt から依存関係インストール
  4. playwright install chromium
  5. 選定スクリプトを --all で実行
     環境変数: SHOP_DELAY_SECONDS=3（負荷緩和）
  6. results/ の成果物をartifactとして保存（7日間保持）
Secrets参照（GitHub Secretsから注入）:
  - WP_SITE_URL: https://mens-esthe-kuchikomi.com
  - WP_USER
  - WP_APP_PASSWORD
  - AI_ENGINE_API_KEY
  - GEMINI_API_KEY
エラーハンドリング:
  - スクリプトが失敗してもワークフロー自体はexit 0で完了させる
    （1店舗の失敗で全体が止まらないように）
  - 失敗件数が全体の50%を超えた場合のみ exit 1 にする
```

**動作確認:**
```bash
gh workflow run "Daily Shop Updater" --ref main
gh run list --workflow="Daily Shop Updater" -L 1
gh run watch [RUN_ID] --exit-status
```

---

## Phase 5: 完了報告

以下をテーブル形式でまとめること:

| 項目 | 結果 |
|------|------|
| 採用スクリプト（選定理由含む） | |
| REST疎通（未認証/認証済みHTTPコード） | |
| パイロット実行結果（成功/失敗件数） | |
| WP反映確認（更新されたメタキー） | |
| GitHub Actions ワークフロー作成 | |
| Actions手動実行テスト結果 | |

`pm/PROGRESS.md` への追記内容をログ形式で提示すること。
`pm/BLOCKER.md` の BLOCK-004 が解除条件を満たしていれば解除済みに移動すること。
**次のSTEP2への移行条件（合格/不合格の判定）を明示すること。**

---

# STEP 2【antiGRAVITY用】
# 日本橋エリア ACF コンテンツ一括生成

## あなたの役割
SEOマーケター兼コンテンツストラテジストとして作業してください。
ターゲットキーワード: **「日本橋 メンズエステ」で Google 1ページ目**

## コンテンツ哲学（最重要・全出力物に適用）
**このサイトのユーザー像:**
「日本橋でメンズエステに行きたいが、どの店・どのセラピストが自分に合うか悩んでいる人」

- 店舗の実情報（公式HP・出勤情報・セラピストプロフィール）を見て「この子がいいな」「この店の雰囲気が合いそう」と感じさせる情報設計
- AI生成と判定されない文体：具体的な地名・価格・体験談的表現・比較視点を盛り込む
- 過度なキーワード詰め込み禁止。自然な文章の中にキーワードを溶け込ませる
- E-EAT（経験・専門性・権威性・信頼性）を感じさせること

---

## 生成物（WPにそのままコピペできる形式で出力）

### 出力1: area_characteristics（500〜700文字）
貼り付け先: WP管理画面 → タクソノミーarea → 日本橋 → ACFフィールド `area_characteristics`

構成:
- エリアの地理的特徴（なんば・心斎橋・道頓堀との位置関係、黒門市場・日本橋電気街）
- メンズエステ需要の背景（ビジネス街×歓楽街の混在、アクセス利便性）
- このページで分かること（店選び・セラピスト選び・料金相場）

含めるLSIキーワード（自然に溶け込ませる）:
日本橋, なんば, 心斎橋, 大阪市中央区, ビジネス街, 繁華街, アクセス, 道頓堀, 黒門市場, 初めて, おすすめ, セラピスト, 料金

文体: 「〜です・〜ます」調

---

### 出力2: area_column_content（1800〜2200文字・HTML形式）
貼り付け先: ACFフィールド `area_column_content`（Wysiwygエディタ）

使用タグ: `<h2>`, `<h3>`, `<p>` のみ（Gutenbergで崩れないシンプル構成）

必須見出し構成:
```
<h2>日本橋のメンズエステを選ぶ3つのポイント</h2>
→ 料金・セラピスト・雰囲気の比較視点。「悩んでいるユーザーが決め手にする要素」を具体的に

<h2>日本橋エリアのメンズエステ相場と特徴</h2>
→ 60分・90分・120分の価格帯目安。なんば・心斎橋との違い。「日本橋ならではの特徴」を言語化

<h2>初めて日本橋でメンズエステを利用する方へ</h2>
→ 予約方法・当日の流れ・持ち物・注意点。不安を取り除く情報設計

<h2>日本橋でセラピスト指名するメリット</h2>
→ リピート率・出勤確認の重要性・指名料の相場感。「指名したほうが満足度が高い理由」
```

SEO要件:
- 「日本橋 メンズエステ」を文中に自然に8〜12回含める
- 各段落200〜300文字を目安
- 最初の`<p>`に必ずターゲットキーワードを含める

---

### 出力3: area_faq_content（7問・JSON形式）
貼り付け先: ACFフィールド `area_faq_content`（リピーター）

出力フォーマット（ACFリピーターに直接貼れる形）:
```json
[
  {"question": "Q1テキスト", "answer": "A1テキスト（150文字以上・具体的に）"},
  ...
]
```

必須Q（この7問を必ず含める）:
1. 日本橋のメンズエステは何時まで営業していますか？
2. 日本橋のメンズエステの料金相場はどのくらいですか？
3. 予約なしで当日利用できますか？
4. 初めてでも入りやすい店はありますか？
5. セラピストを指名することはできますか？
6. 当日キャンセルは可能ですか？
7. 近くに駐車場はありますか？

注意:
- answerは必ず具体的に（「〜によります」で終わらせない）
- Googleリッチリザルト狙いのため回答を充実させる
- このJSONはFAQ JSON-LDとして構造化データに出力される

---

### 出力4: area_editorial_picks 選定基準メモ
貼り付け先: WP管理画面で `area_editorial_picks` に店舗を登録する際の判断基準として使用

「編集部厳選3店」として表示されるため、ユーザーが最初に見て安心できる店の選定基準を5点で箇条書き。
（例: 公式URLが設定されていて情報が最新か、料金が明示されているか、等）

---

### 出力末尾に必ず記載すること
**WP管理画面への貼り付け手順（番号付きで簡潔に）**
**Search Consoleでの効果測定タイミング（いつ、何を確認するか）**

---

# STEP 3【antiGRAVITY用・並列エージェント向け】
# 全店舗 shop_ai_summary 自動生成スクリプト実装 + GitHub Actions 月次自動化

## あなたの役割
SEOコンテンツライター兼Pythonエンジニアとして作業してください。
**絶対条件: AI生成と判定されない、店舗固有の情報を元にしたコンテンツを生成すること。テンプレートの使い回し厳禁。**

## このフェーズの前提理解（必ず把握してから実装へ）

このシステムには2種類の更新フローが存在します:

```
【日次フロー】shop_updater.yml（STEP1で構築済み）
  公式URL巡回 → Gemini → shop_today_therapists / shop_today_analysis / shop_availability 更新
  ↓ このデータが蓄積される
【月次フロー】shop_summary.yml（今回構築）← ここを作る
  蓄積された出勤データ + 公式URL情報 → Gemini → shop_ai_summary 更新
```

`shop_ai_summary` は `shop_today_analysis`（日次出勤コメント）と**別フィールド**です。
混同しないこと。`single-shop.php` では両方が異なる位置に表示されます。

---

## Phase 0: 現状確認【省略禁止・実装前に私への確認必須】

1. WP REST で全店舗一覧を取得し、以下を確認・報告する:
```bash
curl -sS "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop?per_page=100&_fields=id,slug,title,meta" \
  -H "X-AI-API-Key: $AI_ENGINE_API_KEY"
```

2. 以下を集計してテーブルで報告する:
   - 総店舗数
   - `official_url` が設定されている店舗数 / 未設定店舗数
   - `shop_ai_summary` が既に入っている店舗数 / 空の店舗数
   - `shop_today_therapists` にデータが入っている店舗数（日次フローの稼働状況確認）

3. **以下を私（ユーザー）に確認してから実装へ進むこと:**
   - `official_url` 未設定の店舗リストを提示し「これらは手動でURLを登録する必要があります。後で対応しますか、それとも今対応しますか？」と確認
   - `shop_today_therapists` にデータが入っていない場合「STEP1の日次フローが十分に稼働してからsummary生成を行うべきですが、今すぐ実行しますか？公式HPの情報のみで生成しますか？」と確認
   - 既存の `shop_ai_summary` がある店舗に対して「上書きしますか？スキップしますか？」と確認

---

## Phase 1: generate_shop_summary.py の実装

`ai-site-monitor/generate_shop_summary.py` を新規作成すること。

### スクリプト要件:
```
入力:
  WP REST から取得した店舗情報
  - id, title（店舗名）
  - meta: official_url, shop_address, shop_hours, shop_tel
  - meta: basic_price, price_90, price_120（料金）
  - meta: shop_today_therapists（日次フローで蓄積済みのセラピスト情報）
  - meta: shop_today_analysis（直近の出勤分析文）
  - meta: recommend_text（既存の推薦文があれば参考に）

処理フロー:
  1. official_url が存在する場合
     → Playwright でページ取得 → BeautifulSoupでテキスト抽出（本文・セラピスト情報優先）
  2. official_url がない場合
     → 既存メタ（料金・住所・セラピスト情報）のみで生成
  3. shop_today_therapists が空の場合
     → 公式HPのセラピスト情報のみ使用（警告ログを出す）
  4. Gemini API で shop_ai_summary を生成（下記プロンプト使用）
  5. ai-engine/v1/update に POST（shop_ai_summary フィールドのみ）
  6. 成功/失敗/スキップをログ記録
     results/summary_YYYYMMDD_HHMMSS.json に保存

CLI オプション:
  --limit N        N件だけ処理
  --all            全件処理
  --skip-existing  shop_ai_summary が既に入っている店舗をスキップ
  --overwrite      既存summaryも上書き
  --shop-id N      特定IDだけ処理（デバッグ用）
  --dry-run        WPへのPOSTをせず生成内容だけターミナルに出力

環境変数:
  SHOP_DELAY_SECONDS（デフォルト3）で負荷緩和
```

### Geminiへのプロンプト（スクリプト内に埋め込む）:
```python
SUMMARY_PROMPT = """
あなたはメンズエステ専門のコンテンツライターです。
以下の店舗情報を元に shop_ai_summary（店舗コンセプト紹介文）を生成してください。

【店舗情報】
店舗名: {shop_name}
住所: {shop_address}
営業時間: {shop_hours}
料金: 60分{price_60}円 / 90分{price_90}円 / 120分{price_120}円
公式サイト本文（抜粋）: {official_text}
現在活躍中のセラピスト: {therapist_info}
直近の出勤分析: {today_analysis}

【生成ルール】
- 400〜600文字
- 「どの店・どのセラピストが自分に合うか悩んでいるユーザー」が読んで「この店に行ってみよう」と思える文章
- AI生成と判定されない自然な文体（具体的な地名・価格・セラピストの雰囲気を盛り込む）
- 「どんな人にこの店が向いているか」を明確にする
- セラピストの特徴・雰囲気に必ず言及する（情報がある場合）
- キーワード「日本橋 メンズエステ」と「{shop_name}」を自然に含める
- 「〜です・〜ます」調。過度な絶賛は避け信頼感を重視
- テンプレの使い回し禁止。この店舗固有の情報を必ず1つ以上反映すること
- 出力: 本文テキストのみ（前置き・説明・JSONタグ不要）
"""
```

---

## Phase 2: パイロット実行（3件・dry-runで品質確認）

**まずdry-runで生成内容を確認する:**
```bash
cd ~/Desktop/dev/mens-esthe-seo-tools/ai-site-monitor
set -a && source .env && set +a
python generate_shop_summary.py --limit 3 --dry-run
```
- 生成された3件の全文をターミナルに出力
- 私（ユーザー）が目視で品質確認できる状態にすること
- **「この品質でWPに投入してよいですか？」と私に確認を取ること**

**承認後に実際に投入:**
```bash
python generate_shop_summary.py --limit 3 --skip-existing
```

**WP反映確認:**
```bash
curl -sS "https://mens-esthe-kuchikomi.com/wp-json/wp/v2/shop?slug=[スラッグ]&_fields=meta" \
  | python3 -m json.tool | grep shop_ai_summary
```

---

## Phase 3: GitHub Actions 月次自動化ワークフロー構築

`shop_summary.yml` を新規作成:

```yaml
名前: Monthly Shop Summary Generator
トリガー:
  - schedule: 毎月1日 JST 11:00（cron: '0 2 1 * *'）
  - workflow_dispatch（手動実行も可能）
実行内容:
  1. checkout
  2. Python 3.11 セットアップ
  3. requirements.txt インストール
  4. playwright install chromium
  5. generate_shop_summary.py --all --skip-existing 実行
     SHOP_DELAY_SECONDS=3
  6. results/ をartifactとして保存（30日保持）
Secrets: WP_SITE_URL, WP_USER, WP_APP_PASSWORD, AI_ENGINE_API_KEY, GEMINI_API_KEY
エラーハンドリング: STEP1と同様（1件の失敗で全体停止しない）
```

---

## Phase 4: 完了報告

以下を報告すること:

| 項目 | 結果 |
|------|------|
| 総店舗数 / official_url設定済み数 | |
| official_url未設定店舗リスト | |
| dry-run品質確認（私の承認済みか） | |
| パイロット投入結果（3件） | |
| WP反映確認 | |
| shop_summary.yml 作成・手動実行テスト | |

`pm/PROGRESS.md` への追記内容をログ形式で提示すること。
`pm/SHOP-AI-ROLLOUT.md` のフェーズC・DをCursor/antiGRAVITYで更新すること。
**全件実行コマンド（合格後に使うワンライナー）を提示すること。**

---

# ツール・役割分担 まとめ

| STEP | ツール | 作業 | 完了条件 |
|------|--------|------|----------|
| 事前 | **あなた（人）** | GitHub Secrets 4つ登録 | 5分・登録完了を確認 |
| STEP1 | **Cursor(SSH)** | スクリプト確認→REST疎通→パイロット1件→Actions日次自動化 | Actions手動実行成功 |
| STEP2 | **antiGRAVITY** | 日本橋ACFコンテンツ4項目生成 | WPにコピペして表示確認 |
| STEP3 | **antiGRAVITY(並列)** | shop_ai_summaryスクリプト実装→dry-run確認→投入→Actions月次自動化 | 3件パイロット成功→全件 |

# ゴール逆算チェック

```
「日本橋 メンズエステ」1ページ目
         ↑
エリアページのコンテンツ品質（STEP2）
         ↑
各店舗ページの固有コンテンツ（STEP3）
         ↑
リアルタイム出勤情報の自動更新（STEP1）
         ↑
GitHub Actions による無人・無料・継続運用
```

**3STEP完了後に必ずやること:**
Search Console で「日本橋 メンズエステ」の順位変動を2週間追う。
20位以内に入っていればコンテンツ量・内部リンク強化フェーズへ。
圏外のままならページ速度（Core Web Vitals）と被リンク戦略を見直す。
