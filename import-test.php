<?php
/**
 * import-test.php
 * JSON（refle_final_monitor_list.json）から店舗データを shop カスタム投稿に登録・更新する。
 *
 * 【テスト仕様】最初の5件のみ処理
 * 【実行方法】ブラウザ: https://example.com/wp-content/themes/swell_child/import-test.php
 *             WP-CLI: wp eval-file wp-content/themes/swell_child/import-test.php
 *
 * 管理者ログイン必須（ブラウザ実行時）
 */

// テスト用：処理する件数（5 = 最初の5件のみ。全件の場合は 0 に変更）
define('IMPORT_TEST_LIMIT', 0);

set_time_limit(0);
ignore_user_abort(true);

$is_cli = (php_sapi_name() === 'cli');

if (!$is_cli) {
    header('Content-Type: text/html; charset=UTF-8');
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
    @ob_implicit_flush(true);
}

if (!$is_cli) {
    echo "<!doctype html><html lang='ja'><head><meta charset='utf-8'><title>JSON Import Test (shops)</title>";
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
}
echo "refle_final_monitor_list.json インポート（テスト：最初の" . (IMPORT_TEST_LIMIT ?: '全') . "件）\n\n";

// ---------------------------------------
// wp-load.php を読み込む
// ---------------------------------------
$wp_load_candidates = array(
    __DIR__ . '/wp-load.php',
    dirname(__DIR__) . '/wp-load.php',
    dirname(__DIR__, 2) . '/wp-load.php',
    dirname(__DIR__, 3) . '/wp-load.php',
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
    echo "<pre class='ng'>ERROR: wp-load.php が見つかりません。</pre>";
    if (!$is_cli) echo "</div></div></body></html>";
    exit;
}

require_once $wp_load;

// ---------------------------------------
// Security: 管理者のみ（ブラウザ実行時）
// WP-CLI の場合は is_user_logged_in が false になるため、CLI 時はスキップ
// ---------------------------------------
if (php_sapi_name() !== 'cli' && (!is_user_logged_in() || !current_user_can('manage_options'))) {
    die('Access Denied. 管理者でログインしてください。');
}

echo "<p class='meta'>wp-load: <code>" . esc_html($wp_load) . "</code></p>";

// ---------------------------------------
// JSON 読み込み
// ---------------------------------------
$json_path = __DIR__ . '/ai-site-monitor/refle_final_monitor_list.json';
if (!is_file($json_path)) {
    echo "<pre class='ng'>ERROR: JSON が見つかりません: " . esc_html($json_path) . "</pre>";
    if (!$is_cli) echo "</div></div></body></html>";
    exit;
}

$json_raw = file_get_contents($json_path);
$shops = json_decode($json_raw, true);

if (!is_array($shops)) {
    echo "<pre class='ng'>ERROR: JSON のパースに失敗しました。</pre>";
    if (!$is_cli) echo "</div></div></body></html>";
    exit;
}

// テスト用：件数制限
if (IMPORT_TEST_LIMIT > 0) {
    $shops = array_slice($shops, 0, IMPORT_TEST_LIMIT);
}

echo "<p class='meta'>処理対象: " . count($shops) . " 件</p>";
echo "<pre>";

// ---------------------------------------
// area タクソノミーの全ターム取得（名前でマッチング用）
// ---------------------------------------
$area_terms = get_terms(array(
    'taxonomy'   => 'area',
    'hide_empty' => false,
));
if (is_wp_error($area_terms)) {
    $area_terms = array();
}

// 名前の長い順にソート（「堺筋本町」を「本町」より先にマッチさせる）
usort($area_terms, function ($a, $b) {
    return mb_strlen($b->name) - mb_strlen($a->name);
});

// ---------------------------------------
// 電話番号で既存投稿を検索
// ---------------------------------------
function find_shop_by_phone($phone) {
    if (empty(trim((string) $phone))) {
        return 0;
    }
    $posts = get_posts(array(
        'post_type'      => 'shop',
        'post_status'    => 'any',
        'posts_per_page' => 1,
        'meta_query'     => array(
            array(
                'key'     => 'shop_tel',
                'value'   => $phone,
                'compare' => '=',
            ),
        ),
    ));
    return !empty($posts) ? (int) $posts[0]->ID : 0;
}

// ---------------------------------------
// address からマッチする area タームIDを取得
// ---------------------------------------
function get_matching_area_term_ids($address, $area_terms) {
    $ids = array();
    $addr = (string) $address;
    foreach ($area_terms as $term) {
        if (mb_strpos($addr, $term->name) !== false) {
            $ids[] = (int) $term->term_id;
        }
    }
    return array_unique($ids);
}

// ---------------------------------------
// 実行
// ---------------------------------------
$created = 0;
$updated = 0;
$failed  = 0;
$index   = 0;

echo "START: " . date_i18n('Y-m-d H:i:s') . "\n";
echo "JSON: {$json_path}\n";
echo "POST_TYPE: shop\n";
echo "TAXONOMY: area\n";
echo "----------------------------------------\n";

foreach ($shops as $item) {
    $index++;

    $shop_name   = isset($item['shop_name']) ? trim((string) $item['shop_name']) : '';
    $official_url = isset($item['official_url']) ? trim((string) $item['official_url']) : '';
    $phone       = isset($item['phone']) ? trim((string) $item['phone']) : '';
    $address     = isset($item['address']) ? trim((string) $item['address']) : '';
    $hours       = isset($item['hours']) ? trim((string) $item['hours']) : '';

    if ($shop_name === '') {
        $failed++;
        echo "[{$index}] SKIP: shop_name が空\n";
        continue;
    }

    $post_id = find_shop_by_phone($phone);

    if ($post_id > 0) {
        // 更新
        $res = wp_update_post(array(
            'ID'         => $post_id,
            'post_title' => $shop_name,
            'post_type'  => 'shop',
            'post_status' => 'publish',
        ), true);

        if (is_wp_error($res)) {
            $failed++;
            echo "[{$index}] ERROR: update failed #{$post_id} {$shop_name} / " . $res->get_error_message() . "\n";
            continue;
        }
        $updated++;
        echo "[{$index}] UPDATE: #{$post_id} {$shop_name}\n";
    } else {
        // 新規作成
        $res = wp_insert_post(array(
            'post_type'   => 'shop',
            'post_title'  => $shop_name,
            'post_status' => 'publish',
        ), true);

        if (is_wp_error($res) || !$res) {
            $failed++;
            $msg = is_wp_error($res) ? $res->get_error_message() : 'unknown error';
            echo "[{$index}] ERROR: insert failed {$shop_name} / {$msg}\n";
            continue;
        }
        $post_id = (int) $res;
        $created++;
        echo "[{$index}] CREATE: #{$post_id} {$shop_name}\n";
    }

    // ACF フィールド更新
    if (function_exists('update_field')) {
        update_field('official_url', $official_url, $post_id);
        update_field('shop_tel', $phone, $post_id);
        update_field('shop_address', $address, $post_id);
        update_field('shop_hours', $hours, $post_id);
    } else {
        // ACF がない場合は post_meta に直接保存
        update_post_meta($post_id, 'official_url', $official_url);
        update_post_meta($post_id, 'shop_tel', $phone);
        update_post_meta($post_id, 'shop_address', $address);
        update_post_meta($post_id, 'shop_hours', $hours);
    }

    // エリア（area）の自動紐付け
    $term_ids = get_matching_area_term_ids($address, $area_terms);
    if (!empty($term_ids)) {
        wp_set_object_terms($post_id, $term_ids, 'area', false);
        echo "  -> area: " . implode(', ', array_map(function ($id) {
            $t = get_term($id, 'area');
            return $t && !is_wp_error($t) ? $t->name : '';
        }, $term_ids)) . "\n";
    } else {
        wp_set_object_terms($post_id, array(), 'area', false);
    }
}

echo "----------------------------------------\n";
echo "DONE: 新規作成={$created} 件, 更新={$updated} 件, 失敗={$failed} 件\n";
echo "END: " . date_i18n('Y-m-d H:i:s') . "\n";
echo "</pre>";

if (!$is_cli) {
    echo "</div></div></body></html>";
}
