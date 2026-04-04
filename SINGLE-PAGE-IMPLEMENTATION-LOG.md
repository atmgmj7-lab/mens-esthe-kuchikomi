# シングルページ実装ログ

店舗詳細ページ（single-shop.php）および関連するAI・スクレイピングシステムの改修内容を整理し、今後の開発基準とするためのドキュメント。

---

## 1. データ構造の分離

| フィールド | 用途 | 更新頻度 | 内容 |
|------------|------|----------|------|
| **shop_ai_summary** | 上段（編集部 Review） | 月1回 | 40代編集部視点のリライト文。HPの事実（アクセス、在籍層、料金、設備、コンセプト）を抽出し、自然な紹介文に再構成したもの。 |
| **shop_today_analysis** | 下段（本日の出勤ボックス） | 毎日 | 本日の出勤状況の煽り・分析コメント。新人・レア出勤のピックアップなど、予約意欲を高める1〜2行のテキスト。 |
| **shop_today_therapists** | 下段（本日の出勤ボックス） | 毎日 | 本日の出勤配列データ。各要素: `name`（名前）, `time`（出勤時間）, `tags`（新人・レア等）, `status`（すぐご案内可など）。 |

**重要**: 上段と下段は完全に分離しており、`shop_ai_summary` と `shop_today_*` を混在させない。

---

## 2. 表示ロジック（single-shop.php / functions.php）

### 上段：編集部 Review（旧 AIインテリジェンス・ビュー）

| 項目 | 定義 |
|------|------|
| **参照フィールド** | `shop_ai_summary`, `shop_latest_news` のみ。`shop_today_analysis` は絶対に使用しない。 |
| **ラベル** | 「🖋 Escomi編集部 Review」 |
| **小見出し** | 「店舗コンセプト・総評」 |
| **フッター注釈** | 「※ Escomi編集部が独自の視点で店舗の魅力を分析しています。」 |
| **デザインコンセプト** | 絵文字排除、高級Webマガジン風。AI感を消し、編集部レビューとしてのオリジナル感を演出。 |
| **テキストスタイル** | `line-height: 1.8`, `color: #444`。コラム風の読み物として上品に表示。 |

### 下段：本日の出勤＆空き状況ボックス

| 項目 | 定義 |
|------|------|
| **参照フィールド** | `shop_today_analysis`, `shop_availability`, `shop_today_therapists` のみ。`shop_ai_summary` は絶対に混ぜない。 |
| **関数** | `escomi_get_today_therapists_html()` |
| **レイアウト** | バッジ重なり解消のため `display: flex; justify-content: space-between`。左に分析テキスト、右に空き状況バッジ。 |
| **デザインコンセプト** | シャンパンゴールド（#D4AF37）の細い実線ボーダー。横スクロールのキャストカード。新人・レアは四角いシャープなラベル。 |
| **アバター** | 無地のグラデーション円 + 「Cast」プレースホルダー（絵文字・ダミーアイコン排除）。 |

---

## 3. AIプロンプトの指針

### 月1回更新（ai_monthly_updater.py）

| 指針 | 内容 |
|------|------|
| **ペルソナ** | メンズエステ情報サイトの熟練ライター |
| **事実ベース** | HP内のキーワード（〇〇駅徒歩5分、30代中心、完全個室など）を正確に抽出 |
| **リライト** | HPの文章をそのままコピーせず、独自の語順で自然な紹介文（3〜4行）に再構成 |
| **造語・ポエム禁止** | AI特有の抽象表現、大げさな装飾語、勝手な解釈は禁止 |
| **具体性** | 立地、セラピスト傾向、営業時間、部屋のこだわりなど判断材料となる情報を必ず含める |
| **健全な表現** | 際どい言葉は避け、「癒やし」「リラクゼーション」等に置き換え |
| **文体** | 「〜です/ます」調。絵文字・「！」禁止。 |

### 毎日更新（ai_auto_updater.py）

| 指針 | 内容 |
|------|------|
| **対象** | 本日の出勤スケジュールのみ。店舗の紹介・コンセプトは絶対に書かない。 |
| **today_analysis** | 新人・レア出勤を熱くピックアップする1〜2行の煽りコメント |
| **絵文字排除** | 出力に絵文字（✨や🔰など）を一切使用しない。上品で落ち着いたトーン。 |
| **日変動情報の排除** | 本日の出勤情報・空き状況は today_analysis には含めず、別フィールドで管理。 |

---

## 4. データベース（SQLite）の役割

**ファイル**: `ai-site-monitor/escomi_crawler.db`

### shop_logs テーブル

| カラム | 型 | 用途 |
|--------|-----|------|
| shop_id | INTEGER PRIMARY KEY | 店舗投稿ID |
| last_hash | TEXT NOT NULL | ページテキストの SHA256 ハッシュ |
| last_updated | DATETIME NOT NULL | 最終更新日時 |

**役割**: 差分検知（Hashチェック）。テキストが変わっていなければ Gemini API 呼び出しと WordPress POST をスキップし、APIコストを削減。`ai_auto_updater.py` のみ使用。`ai_monthly_updater.py` では使用しない（月1回強制更新のため）。

### therapist_logs テーブル

| カラム | 型 | 用途 |
|--------|-----|------|
| id | INTEGER PRIMARY KEY | 自動採番 |
| shop_id | INTEGER NOT NULL | 店舗ID |
| name | TEXT NOT NULL | キャスト名 |
| date | TEXT NOT NULL | 出勤日（YYYY-MM-DD） |
| UNIQUE(shop_id, name, date) | - | 同日同名の重複防止 |

**役割**: 過去30日間の出勤回数をカウント。3回以下のキャストに「レア」タグを自動付与して WordPress へ送信。`ai_auto_updater.py` で使用。

---

## 5. スクリプト一覧と役割

| スクリプト | 更新対象 | 頻度 | Gemini | Playwright | SQLite |
|------------|----------|------|--------|------------|--------|
| **ai_monthly_updater.py** | shop_ai_summary | 月1回 | ○ | ○ | × |
| **ai_auto_updater.py** | shop_today_* | 毎日 | ○ | ○ | ○ |
| **hourly_schedule_updater.py** | shop_today_therapists, shop_availability | 1時間に1回 | × | × | × |

---

## 6. 次のステップ：ルートC（hourly_schedule_updater.py）

**実装準備が整いました。**

- `hourly_schedule_updater.py` は既に作成済み。
- Gemini API・Playwright を使用せず、`requests` と `BeautifulSoup4` のみの超軽量ルールベーススクレイピング。
- `SCRAPING_RULES` にドメインごとのCSSセレクタを追加することで、対象店舗を拡張可能。
- `shop_today_therapists` と `shop_availability` のみ送信。`shop_ai_summary` / `shop_today_analysis` は上書きしない。

---

*最終更新: 2026年2月*
