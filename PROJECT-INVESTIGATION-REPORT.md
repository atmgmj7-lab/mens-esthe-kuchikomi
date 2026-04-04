# プロジェクト調査レポート

**調査日**: 2026年2月22日  
**対象**: SWELL子テーマ（Escomi SEO Project）

---

## 1. プロジェクトディレクトリ構成

```
swell_child/
├── area-seo-hooks.php          # エリアSEO用フック（メイン・読み込み中）
├── area-seo-hooks-optimized.php # エリアSEO最適化版（未読み込み）
├── taxonomy-area.php           # エリアアーカイブテンプレート
├── single-shop.php             # 店舗詳細テンプレート
├── archive-shop.php             # 店舗アーカイブテンプレート
├── front-page.php              # トップページテンプレート
├── functions.php                # メイン設定・ショートコード
├── import-shops-web.php         # インポート用
├── css/
│   ├── base.css                # 全ページ共通
│   ├── front-page.css          # トップページ
│   └── single.css              # 店舗・アーカイブ
├── js/
│   └── front-page-editorial.js # トップページ用JS
├── style.css                   # テーマ情報（空）
└── ACF-FIELDS-SETUP.md         # ACF設定ドキュメント
```

**注意**: `archive-area.php` は存在しません。WordPressの仕様上、タクソノミー `area` のアーカイブは `taxonomy-area.php` で正しく処理されます。

---

## 2. ACF（Advanced Custom Fields）のカスタムフィールド設定

### 2.1 functions.php 内のACF登録

**結論**: `functions.php` および関連PHPファイル内に、ACFフィールドの**PHPコードによる登録**は存在しません。

ACFのフィールドは通常、WordPress管理画面（ACFプラグイン）から作成するか、ACFのJSONエクスポート/インポートで管理されます。

### 2.2 使用されているACFフィールド一覧

| フィールド名 | 使用箇所 | 用途 |
|-------------|---------|------|
| `area_characteristics` | area-seo-hooks.php, area-seo-hooks-optimized.php | エリア特性文（LSIキーワード） |
| `area_editorial_picks` | area-seo-hooks.php, area-seo-hooks-optimized.php | 編集部厳選3店舗 |
| `area_column_content` | area-seo-hooks.php, area-seo-hooks-optimized.php | 地域ガイドコラム |
| `area_faq_content` | area-seo-hooks.php, area-seo-hooks-optimized.php | FAQ（リピーター） |
| `area_ranking_shops` | area-seo-hooks.php（フォールバック用） | マスターランキング |
| `area_ranking_pickup` | taxonomy-area.php, single-shop.php | ランキング表示用 |
| `area_avg_90/120/150` | single-shop.php | エリア平均料金 |

### 2.3 ACF-FIELDS-SETUP.md との差異

| ドキュメント記載 | 実際のコード使用 | 対応 |
|-----------------|-----------------|------|
| `area_intro_text` | `area_characteristics` | **ドキュメント更新が必要** |
| `area_ranking_shops` | `area_editorial_picks`（優先）→ `area_ranking_shops`（フォールバック） | 両方必要 |
| `area_column_content` | ✅ 一致 | - |
| `area_faq_content` | ✅ 一致 | - |

**推奨**: ACF-FIELDS-SETUP.md を `area_characteristics` と `area_editorial_picks` を含む形で更新するか、新規ドキュメントを作成してください。

---

## 3. タクソノミー（エリア）でのACF値の取得・出力ロジック

### 3.1 `.cursorrules` の仕様

> **ACF Data Fetching**: タクソノミーのフィールド取得は必ず `get_field('field_name', 'term_' . $term_id)` 形式を使用すること。（※`area_` プレフィックスではなく `term_` が標準）

### 3.2 正しい実装（`term_` 形式）

| ファイル | 行 | 記述 |
|---------|-----|------|
| area-seo-hooks.php | 24-26 | `$term_key = 'term_' . $current_term->term_id` |
| area-seo-hooks.php | 47-51 | `$term_key = 'term_' . $term_id` |
| area-seo-hooks.php | 56, 58 | `get_field('area_editorial_picks', $term_key)` |
| area-seo-hooks.php | 223, 271 | `get_field('area_column_content', $term_key)` |
| area-seo-hooks-optimized.php | 全般 | 同様に `term_` 形式で正しく実装 |

### 3.3 修正が必要な箇所（`area_` 形式）

| ファイル | 行 | 現状 | 修正案 |
|---------|-----|------|--------|
| **taxonomy-area.php** | 110 | `get_field('area_ranking_pickup', 'area_' . $ranking_source_id)` | `get_field('area_ranking_pickup', 'term_' . $ranking_source_id)` |
| **single-shop.php** | 71-73 | `get_field('area_avg_90', 'area_' . $target_area_id)` | `get_field('area_avg_90', 'term_' . $target_area_id)` |
| **single-shop.php** | 77-79 | `get_field('area_avg_90', 'area_' . $parent_term_id)` | `get_field('area_avg_90', 'term_' . $parent_term_id)` |
| **single-shop.php** | 354, 365 | `get_field('area_ranking_pickup', 'area_' . ...)` | `get_field('area_ranking_pickup', 'term_' . ...)` |

**重要**: ACFのタクソノミー用フィールドは、WordPressの標準仕様に従い `term_{term_id}` 形式で取得する必要があります。`area_` プレフィックスは一部の環境では動作しない可能性があります。

---

## 4. SWELL子テーマのCSSファイルにおけるアクセントカラー

### 4.1 ゴールド（#d4af37）の適用状況

| ファイル | 使用箇所 | 備考 |
|---------|---------|------|
| **single.css** | `.sec-title` | `border-bottom: 2px solid #d4af37` |
| **single.css** | `.sec-title .sub` | `color: #d4af37` |
| **single.css** | `.wolfman-style .ranking-item` | `border: 1px solid #d4af37` |
| **single.css** | `.scroll-area-btn` | `border: 1px solid #d4af37` |
| **single.css** | `.lux-heading-small` | `color: #c5a059`（別のゴールド） |
| **single.css** | ページネーション | `#d4af37` でホバー・現在ページ |
| **area-seo-hooks.php** | インラインスタイル | `#d4af37` を多用 |

### 4.2 ゴールドカラーの不統一

| カラー | 使用箇所 | 用途 |
|-------|---------|------|
| `#d4af37` | `.cursorrules` 指定、単一.css、area-seo-hooks | 標準ゴールド |
| `#BFAE6B` | single.css `:root` | `--es-gold` |
| `#c5a059` | `.lux-heading-small` | 見出し |
| `#A89A5A` | `--es-gold-dark` | 濃いゴールド |

**推奨**: アクセントカラーを `#d4af37` に統一するため、`:root` に以下を追加し、変数で参照することを推奨します。

```css
:root {
  --accent-gold: #d4af37;
  --accent-gold-light: #f4d03f;
  --accent-gold-dark: #b8962e;
}
```

### 4.3 装飾用CSSクラス

| クラス | 用途 |
|--------|------|
| `.highlight-gold` | ゴールド強調テキスト |
| `.editorial-badge` | 編集部厳選バッジ |
| `.column-badge` | コラムバッジ |
| `.faq-badge` | FAQバッジ |
| `.es-sec-title__en` | 英語見出し（ゴールド） |
| `.ranking-date-label` | ランキング日付 |

---

## 5. 不足しているファイル・修正が必要な記述

### 5.1 必須修正（PHP）

#### taxonomy-area.php（110行目）

```php
// 修正前
$parent_ranking = get_field('area_ranking_pickup', 'area_' . $ranking_source_id);

// 修正後
$parent_ranking = get_field('area_ranking_pickup', 'term_' . $ranking_source_id);
```

#### single-shop.php（71-79行目、354行目、365行目）

```php
// 修正前
$val_90  = get_field('area_avg_90', 'area_' . $target_area_id);
$val_120 = get_field('area_avg_120', 'area_' . $target_area_id);
$val_150 = get_field('area_avg_150', 'area_' . $target_area_id);
// ...
$val_90  = get_field('area_avg_90', 'area_' . $parent_term_id);
// ...

// 修正後
$val_90  = get_field('area_avg_90', 'term_' . $target_area_id);
$val_120 = get_field('area_avg_120', 'term_' . $target_area_id);
$val_150 = get_field('area_avg_150', 'term_' . $target_area_id);
// ...
$val_90  = get_field('area_avg_90', 'term_' . $parent_term_id);
// ...
```

同様に、354行目・365行目の `area_ranking_pickup` も `term_` に変更してください。

### 5.2 推奨修正（CSS）

#### base.css または single.css の先頭に追加

```css
/* アクセントカラー統一（.cursorrules準拠） */
:root {
  --accent-gold: #d4af37;
  --accent-gold-light: #f4d03f;
  --accent-gold-dark: #b8962e;
}

/* 既存の --es-gold を統一する場合 */
:root {
  --es-gold: #d4af37;
  --es-gold-light: #f4d03f;
  --es-gold-dark: #b8962e;
}
```

### 5.3 area-seo-hooks-optimized.php について

`functions.php` では `area-seo-hooks.php` のみ読み込まれています。`area-seo-hooks-optimized.php` は別のデザイン（白背景・ライト系）の最適化版です。

- 現状のダーク系デザインを維持する場合 → `area-seo-hooks.php` のまま
- ライト系デザインに切り替える場合 → `functions.php` の `require_once` を `area-seo-hooks-optimized.php` に変更

---

## 6. まとめ

| 項目 | 状態 | 対応 |
|------|------|------|
| ACFフィールド（area_characteristics等） | コード内で使用 | 管理画面でフィールド作成を確認 |
| ACF取得形式（term_） | taxonomy-area.php, single-shop.php で `area_` 使用 | **上記のPHP修正を実施** |
| アクセントカラー（#d4af37） | 一部で不統一 | 変数で統一することを推奨 |
| archive-area.php | 不要 | taxonomy-area.php で正しく処理 |
| ACF-FIELDS-SETUP.md | フィールド名の差異あり | ドキュメント更新を推奨 |

---

## 7. 修正用コードのサンプル（完全版）

### taxonomy-area.php 修正

```php
// 修正箇所: 109-110行目付近
$parent_ranking = get_field('area_ranking_pickup', 'term_' . $ranking_source_id);
```

### single-shop.php 修正

```php
// 修正箇所: 71-79行目
$val_90  = get_field('area_avg_90', 'term_' . $target_area_id);
$val_120 = get_field('area_avg_120', 'term_' . $target_area_id);
$val_150 = get_field('area_avg_150', 'term_' . $target_area_id);

if (!$val_90 && $parent_term_id) {
    $val_90  = get_field('area_avg_90', 'term_' . $parent_term_id);
    $val_120 = get_field('area_avg_120', 'term_' . $parent_term_id);
    $val_150 = get_field('area_avg_150', 'term_' . $parent_term_id);
}

// 修正箇所: 354行目、365行目
$parent_ranking = get_field('area_ranking_pickup', 'term_' . $parent_term_id);
$ranking_data = get_field('area_ranking_pickup', 'term_' . $current_term_id);
```

---

*本レポートはプロジェクト調査に基づき作成されています。*
