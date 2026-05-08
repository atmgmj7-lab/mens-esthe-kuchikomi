# エリア（`area`）ACF 仕様書 — 受け皿（器）定義

**正本（canonical）:** 本ファイル。外部コンテンツ AI（Antigravity 等）が WP 管理画面・REST・自動化で値を流し込む際の、**フィールド名・保存場所・出力先・JSON 形式**の参照とする。

**実装のソースオブジェクトトゥルース:**

| ファイル | 役割 |
|----------|------|
| `taxonomy-area.php` | エリアアーカイブのレイアウト。特性・コラム・FAQ・ランキングブロック・店舗一覧カードで ACF を参照。 |
| `area-seo-hooks-optimized.php` | `swell_before_post_list` で編集部厳選3店のみ（コラム／FAQはここでは出力しない）。 |
| `functions.php` | `register_taxonomy('area', …)`（`show_in_rest` true）、エリア用メタディスクリプション補完（Yoast / Rank Math）、店舗側 REST 拡張。 |

**取得キー規約（ACF）:** タームでは必ず `get_field( 'フィールド名', 'term_' . $term_id )` を用いる。

---

## 1. タクソノミー `area` — ACF フィールド一覧（コードで使用中）

フィールドキー（`field_xxxxx`）は環境ごとに異なる。**WP 管理画面 → フィールドグループ → 対象フィールドの「フィールドキー」**、または DB の `wp_termmeta` で `_フィールド名` を確認すること。

| フィールド名 | 推奨タイプ（実装前提） | 参照テンプレ／処理 | 備考 |
|----------------|----------------------|---------------------|------|
| `area_ranking_pickup` | Relationship（`shop`・複数・投稿オブジェクト） | `taxonomy-area.php` — 「AREA RANKING」セクション。ソース ID は親なら当該 `$term_id`、子エリアなら **親ターム ID** のフィールドを読む。子では `has_term(子ID)` でフィルタ。 | 既存ランキング用途。未設定なら当該セクション非表示。 |
| `area_characteristics` | Textarea または Wysiwyg（HTML可） | `taxonomy-area.php`（ランキングの直後〜店舗一覧の直前）。`functions.php` のメタ補完がプレーン文を生成。 | 本文は `wp_kses_post`。インラインスタイル付きラッパーあり（下記マークアップ）。 |
| `area_column_content` | Wysiwyg | `taxonomy-area.php` — 店舗一覧セクションの直後。 | `wp_kses_post`。 |
| `area_faq_content` | Repeater（子: `question` テキスト、`answer` Wysiwyg） | `taxonomy-area.php` — コラムの後。FAQ HTML + `FAQPage` JSON-LD。 | 空の Q/A 行はスキップ。 |
| `area_editorial_picks` | Relationship（`shop`・最大3・投稿オブジェクト） | `area-seo-hooks-optimized.php` — `swell_before_post_list`。 | 未設定時は `area_ranking_shops` から親子継承ロジックで最大3件。 |
| `area_ranking_shops` | Relationship（`shop`・複数・投稿オブジェクト） | `area-seo-hooks-optimized.php` — 編集部厳選のフォールバック用（親に設定、子は親リストからエリアでフィルタ）。 | マスターランキング継承仕様はプロジェクトルールと整合。 |

### レガシー（現行テーマで未参照）

| フィールド名 | 備考 |
|--------------|------|
| `area_intro_text` | 旧ルート `ACF-FIELDS-SETUP.md` にのみ記載。**現在の `taxonomy-area.php` / optimized では未使用**。新規投入は `area_characteristics` / `area_column_content` で代替すること。 |

---

## 2. ターム標準メタ（ACF 外）

| メタキー | 用途 |
|----------|------|
| `thumbnail_id` | アーカイブヘッダ背景画像（メディア ID）。`taxonomy-area.php` で参照。 |

---

## 3. フロント出力マークアップ仕様（エリアターム）

### 3.1 `area_characteristics`

- **ラッパー:** `<div class="area-characteristics-box u-mb-50" style="background: linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(26,35,50,0.05) 100%); border-left: 4px solid #d4af37; padding: 24px 28px; border-radius: 8px; line-height: 1.9; color: #e5e5e5;">`
- **内側:** `<div class="characteristics-content" style="font-size: 15px;">` + `wp_kses_post(値)`

### 3.2 `area_column_content`

- `<div class="area-column-content u-mt-50 u-mb-50">`
- `<h2 class="sec-title es-sec-title-large">{$term_name}エリアのメンズエステ情報</h2>`
- `<div class="area-column-content__body">` + `wp_kses_post`

### 3.3 `area_faq_content`

- `<div class="area-faq-box u-mt-50 u-mb-50">`
- `<h2 class="sec-title es-sec-title-large">よくある質問</h2>`
- `<dl class="area-faq-box__dl">` / `<dt>` は `esc_html(question)` / `<dd>` は `wp_kses_post(answer)`
- `<script type="application/ld+json">` — Schema.org `FAQPage`（回答は `wp_strip_all_tags` でテキスト化）

### 3.4 `area_ranking_pickup`（表示ブロック）

- セクションクラス: `ranking-section wolfman-style es-ranking-section u-mb-50` 等（詳細は `taxonomy-area.php`）
- 各行は店舗投稿の ACF: `shop_address`, `basic_price`, `shop_hours`, `shop_tel`, `shop_catch`, `review_star` を参照

### 3.5 編集部厳選（`area_editorial_picks` / `area_ranking_shops`）

- `area-seo-hooks-optimized.php` 内の `.editorial-picks-section` およびインラインスタイル（詳細は当該ファイル）

---

## 4. メタディスクリプション（Yoast / Rank Math）

- **`get_the_archive_description` には特性 HTML を載せない**（二重表示防止のため削除済み）。
- `functions.php` の `escomi_maybe_tax_area_metadesc_from_acf` が、**プラグイン側のメタ文字列が空のときのみ** `area_characteristics` をプレーン化し約155文字で設定。
- **Yoast/Rank Math で手動メタを書いた場合は上書きしない**。

---

## 5. REST API・外部エンジン連携

### 5.1 ターム一覧・単体（WordPress コア）

`functions.php` で `area` は `'show_in_rest' => true`。通常:

- **一覧:** `GET /wp-json/wp/v2/area`
- **単体:** `GET /wp-json/wp/v2/area/{term_id}`

`{term_id}` は数値ターム ID（例: 日本橋は環境ごとに異なる）。

編集系は **Application Password** 等が必要。

### 5.2 ACF 値の READ / WRITE

ACF が「REST API に表示」を有効にしている場合、レスポンスに **`acf` オブジェクト**が付くことが多い（ACF バージョン・設定依存）。

- **読み取り:** `GET .../wp/v2/area/{id}` の `acf` 配下。
- **更新:** `acf` キーにフィールド名で値を載せるパターンがある一方、**リピーターは `field_xxxxx` 形式が必要な場合あり**。  
  → 必ず本番/検証環境の GET レスポンスと [ACF REST API Integration](https://www.advancedcustomfields.com/resources/wp-rest-api-integration/) を照合すること。

### 5.3 外部自動化での代替

1. **WP-CLI** — `wp term meta`（ACF のシリアライズ形式に注意）
2. **管理画面**入力 — `pm/RUNBOOK.md` の **C**
3. **カスタム REST**（将来）— 明示バリデーション付き

### 5.4 店舗（`shop`）参考

`functions.php` で `official_url`・`area_slug` を `register_rest_field` 済み。

---

## 6. エリア一覧テンプレ内の店舗カード（参照のみ）

`taxonomy-area.php` のループで参照: `shop_hours`, `basic_price`, `basic_time`（店舗投稿）。

---

## 7. コンテンツ AI 向けチェックリスト（日本橋等）

- [ ] 対象ターム ID・スラッグを環境で確認
- [ ] `area_characteristics` に LSI を含む本文
- [ ] `area_column_content` に長文コラム
- [ ] `area_faq_content` の `question` / `answer`
- [ ] 編集部厳選は `area_editorial_picks` または親の `area_ranking_shops` フォールバック
- [ ] ランキング枠は `area_ranking_pickup`（親子ロジックに注意）
- [ ] メタはプラグイン手動 or 自動（特性から）の二重を避ける

---

## 8. 関連ドキュメント

- `SEO-OPTIMIZATION-GUIDE.md` — 競合視点の構成（コード・本ファイルと矛盾する場合はコード優先）
- `pm/CONTENT-IMPLEMENTATION-GUIDE.md`
- `pm/RUNBOOK.md`
- ルート `ACF-FIELDS-SETUP.md` — **短いインデックス**（詳細は本 `pm/ACF-FIELDS-SETUP.md`）
