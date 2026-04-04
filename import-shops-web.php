<?php
/**
 * import-shops-web.php
 * ブラウザから shops.csv を読み込み、店舗（カスタム投稿）を登録/更新する。
 *
 * - Xserver想定
 * - wp-load.php を読み込む（同階層優先、見つからなければ上位も探索）
 * - 管理者以外は実行不可
 */

set_time_limit(0);
ignore_user_abort(true);

header('Content-Type: text/html; charset=UTF-8');

// 可能な限りリアルタイム出力
while (ob_get_level() > 0) {
    @ob_end_flush();
}
@ob_implicit_flush(true);

echo "<!doctype html><html lang='ja'><head><meta charset='utf-8'><title>CSV Import (shops)</title>";
echo "<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Kaku Gothic ProN',Meiryo,sans-serif;background:#0b0d10;color:#e9eef5;margin:0;padding:24px;}
.wrap{max-width:1100px;margin:0 auto;}
.box{background:#121621;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 18px 14px;}
h1{font-size:18px;margin:0 0 10px 0;letter-spacing:.04em;}
.meta{opacity:.8;font-size:12px;margin:0 0 14px 0;}
pre{white-space:pre-wrap;word-break:break-word;background:#0f1320;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;line-height:1.55;margin:0;}
.ok{color:#74f6b1;}
.warn{color:#ffd36a;}
.ng{color:#ff7a7a;}
</style></head><body><div class='wrap'><div class='box'>";
echo "<h1>shops.csv インポート（Web実行）</h1>";

// ---------------------------------------
// wp-load.php を読み込む
// ---------------------------------------
$wp_load_candidates = array(
    __DIR__ . '/wp-load.php',              // 同階層（要件）
    dirname(__DIR__) . '/wp-load.php',
    dirname(__DIR__, 2) . '/wp-load.php',
    dirname(__DIR__, 3) . '/wp-load.php',  // テーマ配下に置いた場合の救済
    dirname(__DIR__, 4) . '/wp-load.php',
    dirname(__DIR__, 5) . '/wp-load.php',
);

$wp_load = null;
foreach ($wp_load_candidates as $cand) {
    if (is_file($cand)) {
        $wp_load = $cand;
        break;
    }
}

if (!$wp_load) {
    echo "<p class='ng'>wp-load.php が見つかりません（同階層 or 上位階層）。</p>";
    echo "</div></div></body></html>";
    exit;
}

require_once $wp_load;

// ---------------------------------------
// Security: 管理者のみ
// ---------------------------------------
if (!is_user_logged_in() || !current_user_can('manage_options')) {
    die('Access Denied');
}

echo "<p class='meta'>wp-load: <code>" . esc_html($wp_load) . "</code></p>";

// ---------------------------------------
// CSV 読み込み
// ---------------------------------------
$csv_path = __DIR__ . '/shops.csv';
if (!is_file($csv_path)) {
    echo "<pre class='ng'>ERROR: shops.csv が見つかりません: " . esc_html($csv_path) . "</pre>";
    echo "</div></div></body></html>";
    exit;
}

$fh = fopen($csv_path, 'r');
if (!$fh) {
    echo "<pre class='ng'>ERROR: shops.csv を開けませんでした。</pre>";
    echo "</div></div></body></html>";
    exit;
}

// 1行目（ヘッダー）を取得
$header = fgetcsv($fh);
if (!$header || !is_array($header)) {
    fclose($fh);
    echo "<pre class='ng'>ERROR: CSVヘッダーが取得できません。</pre>";
    echo "</div></div></body></html>";
    exit;
}

// 列名 -> index
$col_index = array();
foreach ($header as $i => $name) {
    $name = trim((string)$name);
    if ($name === '') continue;
    $col_index[$name] = $i;
}

// 必須列チェック（足りなくても処理は続行し、空扱いにする）
$required_cols = array(
    'post_title',
    'post_content',
    'tax_area',
    'shop_catch',
    'shop_tel',
    'shop_hours',
    'shop_address',
    'shop_line',
    'official_url',
    'shop_holiday',
    'shop_booking',
    'basic_price',
    'price_textarea',
    'price_90',
    'price_120',
    'price_150',
    'price_extension',
    'price_nomination',
);
foreach ($required_cols as $c) {
    if (!isset($col_index[$c])) {
        echo "<pre class='warn'>WARN: CSVに列が見つかりません（空として扱います）: {$c}</pre>";
        @ob_flush(); @flush();
    }
}

// Post Type（要件は shops。存在しない場合は shop にフォールバック）
$post_type = post_type_exists('shops') ? 'shops' : (post_type_exists('shop') ? 'shop' : 'shops');
if ($post_type !== 'shops') {
    echo "<pre class='warn'>WARN: post_type 'shops' が未登録のため '{$post_type}' を使用します。</pre>";
    @ob_flush(); @flush();
}

// ACF フィールドマッピング
// 注意: プロジェクト内に field_... の「フィールドキー」が見当たらないため、
//       ここではフィールド名をそのまま update_field の第1引数に渡しています。
//       もし field_... キーが分かっている場合、この配列の値を差し替えてください。
$acf_field_keys = array(
    'shop_catch'       => 'shop_catch',
    'shop_tel'         => 'shop_tel',
    'shop_hours'       => 'shop_hours',
    'shop_address'     => 'shop_address',
    'shop_line'        => 'shop_line',
    'official_url'     => 'official_url',
    'shop_holiday'     => 'shop_holiday',
    'shop_booking'     => 'shop_booking',
    'basic_price'      => 'basic_price',
    'price_textarea'   => 'price_textarea',
    'price_90'         => 'price_90',
    'price_120'        => 'price_120',
    'price_150'        => 'price_150',
    'price_extension'  => 'price_extension',
    'price_nomination' => 'price_nomination',
);

// CSV1行 -> 値取得
$get = function(array $row, string $col) use ($col_index): string {
    if (!isset($col_index[$col])) return '';
    $idx = $col_index[$col];
    return isset($row[$idx]) ? (string)$row[$idx] : '';
};

// ---------------------------------------
// 実行
// ---------------------------------------
$created = 0;
$updated = 0;
$failed  = 0;
$row_no  = 1; // header=1

echo "<pre>";
echo "START: " . date_i18n('Y-m-d H:i:s') . "\n";
echo "CSV: {$csv_path}\n";
echo "POST_TYPE: {$post_type}\n";
echo "TAXONOMY: area (CSV: tax_area)\n";
echo "----------------------------------------\n";
@ob_flush(); @flush();

while (($row = fgetcsv($fh)) !== false) {
    $row_no++;

    // 空行スキップ（全列空）
    $all_empty = true;
    foreach ($row as $v) {
        if (trim((string)$v) !== '') { $all_empty = false; break; }
    }
    if ($all_empty) {
        echo "[{$row_no}] SKIP: empty row\n";
        @ob_flush(); @flush();
        continue;
    }

    $title   = trim($get($row, 'post_title'));
    $content = (string)$get($row, 'post_content');
    $area    = trim($get($row, 'tax_area'));

    if ($title === '') {
        $failed++;
        echo "[{$row_no}] ERROR: post_title が空のためスキップ\n";
        @ob_flush(); @flush();
        continue;
    }

    // 同タイトルがあれば更新、なければ新規
    $existing = get_page_by_title($title, OBJECT, $post_type);
    $post_id = $existing ? (int)$existing->ID : 0;

    $post_arr = array(
        'post_type'    => $post_type,
        'post_title'   => $title,
        'post_content' => $content, // 空でもOK
        'post_status'  => 'publish',
    );

    if ($post_id > 0) {
        $post_arr['ID'] = $post_id;
        $res = wp_update_post($post_arr, true);
        if (is_wp_error($res)) {
            $failed++;
            echo "[{$row_no}] ERROR: update failed: {$title} / " . $res->get_error_message() . "\n";
            @ob_flush(); @flush();
            continue;
        }
        $updated++;
        echo "[{$row_no}] UPDATE: #{$post_id} {$title}\n";
    } else {
        $res = wp_insert_post($post_arr, true);
        if (is_wp_error($res) || !$res) {
            $failed++;
            $msg = is_wp_error($res) ? $res->get_error_message() : 'unknown error';
            echo "[{$row_no}] ERROR: insert failed: {$title} / {$msg}\n";
            @ob_flush(); @flush();
            continue;
        }
        $post_id = (int)$res;
        $created++;
        echo "[{$row_no}] CREATE: #{$post_id} {$title}\n";
    }

    // タクソノミー（area）
    // - 階層は無視
    // - 無ければ作成
    if ($area !== '') {
        $term = term_exists($area, 'area');
        if (!$term) {
            $term = wp_insert_term($area, 'area');
        }
        if (!is_wp_error($term) && isset($term['term_id'])) {
            wp_set_object_terms($post_id, array((int)$term['term_id']), 'area', false);
        } else {
            $msg = is_wp_error($term) ? $term->get_error_message() : 'term create failed';
            echo "  - WARN: taxonomy set failed ({$area}): {$msg}\n";
        }
    } else {
        // 空の場合も「空で更新OK」という要件に合わせ、タームを外す
        wp_set_object_terms($post_id, array(), 'area', false);
    }

    // ACF（空でも更新する）
    if (function_exists('update_field')) {
        foreach ($acf_field_keys as $csv_col => $field_key) {
            $val = (string)$get($row, $csv_col);
            update_field($field_key, $val, $post_id);
        }
    } else {
        echo "  - WARN: ACF update_field() が使えません（ACF未有効？）\n";
    }

    @ob_flush(); @flush();
}

fclose($fh);

echo "----------------------------------------\n";
echo "DONE: created={$created}, updated={$updated}, failed={$failed}\n";
echo "END: " . date_i18n('Y-m-d H:i:s') . "\n";
echo "</pre>";

echo "</div></div></body></html>";

