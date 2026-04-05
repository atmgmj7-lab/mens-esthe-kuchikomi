# エリアページ・店舗ページ コンテンツ実装指示

テーマ側のフック・テンプレは **既に本番向けに接続済み**（`area-seo-hooks-optimized.php` 等）。このドキュメントは **WordPress 管理画面での入力・運用** と **AI 連携の役割分担** を指示する。

---

## 1. 全体像

| 区分 | URL 例 | 主な作業場所 | テーマ側の入口 |
|------|--------|--------------|----------------|
| エリア詳細 | `/area/nihonbashi/` | タクソノミー `area` の**各ターム編集** | `taxonomy-area.php` ＋ `area-seo-hooks-optimized.php` |
| 店舗詳細 | `/shop/xxx/` | 投稿タイプ `shop` の**各店舗編集** | `single-shop.php` |

**ACF の取得形式:** タームは必ず `get_field( 'フィールド名', 'term_' . $term_id )`（`area_` プレフィックスではない）。

---

## 2. エリア詳細ページ（コンテンツ作成の手順）

### 2.1 作業場所

1. WP 管理画面 → **投稿** → **エリア一覧**（または **タクソノミー area**）
2. 対象エリア（例: **日本橋**）を開く  
   URL 例: `/wp-admin/term.php?taxonomy=area&tag_ID=…`

### 2.2 画面上の表示順（SEO 設計どおり）

子テーマ `area-seo-hooks-optimized.php` の構成:

1. **H1**（テンプレ側）…「◯◯のメンズエステ」
2. **エリア特性（LSI）** … `area_characteristics`
3. **編集部厳選 3 店** … `area_editorial_picks`（未設定時は親の `area_ranking_shops` から抽出）
4. **店舗一覧**（SWELL 標準）
5. **地域コラム** … `area_column_content`
6. **FAQ ＋ JSON-LD** … `area_faq_content`（リピーター `question` / `answer`）

### 2.3 入力するフィールド一覧（優先度順）

| フィールド名 | 型 | 役割 |
|--------------|-----|------|
| `area_characteristics` | テキストエリア | H1 直後のエリア特性・LSI 用（**日本橋 オタロード** 等の自然文） |
| `area_editorial_picks` | リレーション（shop・最大3） | 編集部厳選。空なら `area_ranking_shops` からフォールバック |
| `area_ranking_shops` | リレーション（shop・複数） | **親エリア**にマスター一覧。子エリアはここから自エリアのみ抽出 |
| `area_column_content` | Wysiwyg | コラム（EEAT・長文 SEO） |
| `area_faq_content` | リピーター（q/a） | FAQ と構造化データ |

**レガシー:** `area_intro_text` は最適化版の主ラインでは使わない。混在する場合は `SEO-OPTIMIZATION-GUIDE.md` と `ACF-FIELDS-SETUP.md` を参照。

### 2.4 推奨オペレーション

1. **親エリア（例: 大阪）** に `area_ranking_shops` を厚めに登録（20〜30 店など）
2. **優先子エリア（例: 日本橋）** に `area_characteristics` → `area_editorial_picks`（またはフォールバック確認）→ `area_column_content` → `area_faq_content` の順で埋める
3. 公開後、該当 URL で **構造化データ**（FAQ）と **表示崩れ** を確認

**詳細な例文・FAQ サンプル:** `SEO-OPTIMIZATION-GUIDE.md`  
**ACF フィールド作成手順:** `ACF-FIELDS-SETUP.md`

---

## 3. 店舗ページ（手動と AI の分担）

### 3.1 作業場所

WP 管理画面 → **店舗（shop）** → 各投稿を編集。

### 3.2 人が主にメンテする項目（例）

`single-shop.php` で参照されるフィールドの一例:

- 基本情報: `shop_catch`, `shop_tel`, `shop_hours`, `shop_address`, `shop_holiday`, `shop_booking`, `shop_parking`, `shop_line`, `official_url`
- 料金: `basic_price`, `price_90`, `price_120`, `price_150`, `price_textarea`
- 評価・おすすめ: `review_star`, `recommend_text`
- **月次の固定コピー:** `shop_ai_summary`（店舗コンセプト・**月1回程度の手動 or 別フロー**。日次 Python は上書きしない設計）
- セラピスト枠: `therapist_*` などテンプレで参照しているフィールド

### 3.3 AI（自動更新）の対象

- `ai-site-monitor/ai_auto_updater.py` … 公式サイト巡回 → Gemini で **本日出勤**等を抽出 → REST で POST
- `ai-update-log.php` の `POST /wp-json/ai-engine/v1/update` が受け取るメタ例:

  `shop_today_analysis`, `shop_availability`, `shop_today_therapists`, `age_*`, `shop_address`, `shop_tel`, …（`meta_mapping` 参照）

**注意（テンプレコメントより）:**

- **店舗紹介の本文として `shop_today_analysis` を流用しない**（日次の出勤コメント用）。コンセプト文は `shop_ai_summary` 側。
- 本番で自動 POST する前に **BLOCKER の REST 権限強化**（`pm/BLOCKER.md`）を検討すること。

### 3.4 動作確認

- 店舗ページで **電話・住所・料金・出勤ブロック**が意図どおり出るか
- `GET /wp-json/ai-engine/v1/update` が 200 で疎通するか（`DEPLOY-AI-UPDATE.md`）

---

## 4. 完了チェックリスト（抜粋）

**エリア**

- [ ] 対象タームで `area_characteristics` が一覧上部に出る
- [ ] 編集部厳選 or ランキングフォールバックが 3 件以内で出る
- [ ] コラム・FAQ が出る。FAQ が JSON-LD としてソースに含まれる（検証ツールで確認）

**店舗**

- [ ] 必須に近い項目（連絡先・営業時間等）が空でない
- [ ] `shop_ai_summary` と本日の出勤系メタの役割が混ざっていない

---

## 5. 参照ファイル（リポジトリ）

| ファイル | 内容 |
|----------|------|
| `SEO-OPTIMIZATION-GUIDE.md` | 最適化版エリアフィールド・構成図 |
| `ACF-FIELDS-SETUP.md` | 従来4フィールド＋設定手順 |
| `area-seo-hooks-optimized.php` | 実際に読んでいるフィールド名の正 |
| `single-shop.php` | 店舗ページの get_field 一覧 |
| `ai-update-log.php` | REST で更新する post_meta 一覧 |
| `DEPLOY-AI-UPDATE.md` | REST 疎通・パーマリンク |
| `pm/BLOCKER.md` | REST 権限・未整備タスク |

---

**まとめ:** 次工程は **コードではなく WP 上の ACF 入力が中心**です。優先キーワードに合わせて **子エリア（例: 日本橋）から** `area_characteristics` → 厳選/ランキング → コラム → FAQ の順で埋めるのがおすすめです。
