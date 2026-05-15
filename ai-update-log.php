<?php
/**
 * AI Agent Integration - Step 1 Final Version
 * @version 1.1.0 - namespace: escomi/v1 (AI Engine 競合回避済み)
 */

/**
 * 指定店舗の最新AI更新ログを1件取得
 * @param int $shop_post_id 店舗投稿ID
 * @return WP_Post|null
 */
function escomi_get_latest_ai_log_for_shop($shop_post_id) {
    if (!$shop_post_id) return null;
    $posts = get_posts([
        'post_type'      => 'ai_update_log',
        'posts_per_page' => 1,
        'post_status'    => 'publish',
        'meta_key'       => 'log_target_shop',
        'meta_value'     => (int) $shop_post_id,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ]);
    return !empty($posts) ? $posts[0] : null;
}

// 1. AI専用のカスタム投稿タイプ「更新ログ」を登録（オプション：履歴管理用）
add_action('init', function() {
    register_post_type('ai_update_log', [
        'label'        => 'AI更新ログ',
        'public'       => true,
        'show_in_rest' => true,
        'supports'     => ['title', 'editor', 'custom-fields'],
        'menu_icon'    => 'dashicons-media-text',
    ]);
});

// 2. REST API エンドポイントの登録（AI Engine プラグインの /wp-json/ai-engine/ と名前衝突回避のため escomi）
// フルURL: /wp-json/escomi/v1/update （パーマリンク「基本」の場合は ?rest_route=/escomi/v1/update）
// PHP_INT_MAX: mu-plugin が高優先度で上書き登録しても、テーマは後に読まれるため FIFO で必ず最後に実行され上書きできる
add_action('rest_api_init', function () {
    register_rest_route( 'escomi/v1', '/update', array(
        'methods'             => array( 'POST' ),
        'callback'            => 'handle_ai_shop_update_final',
        'permission_callback' => function () {
            return current_user_can( 'edit_posts' );
        },
    ) );
}, PHP_INT_MAX );

function handle_ai_shop_update_final($request) {
    $params = $request->get_params();
    $shop_id = $params['shop_post_id'] ?? null;

    if (!$shop_id) {
        return new WP_Error('no_id', '店舗IDがありません', ['status' => 400]);
    }

    // A. 店舗（shop）の情報を直接上書き（Python AI Agent から送信された meta を受け取り保存）
    // ※ 毎日のPythonクロールは shop_today_* のみ送信。shop_ai_summary は月1回の手動更新用（送信されない）
    $meta_mapping = [
        'shop_address'          => $params['meta']['shop_address'] ?? null,
        'shop_tel'              => $params['meta']['shop_tel'] ?? null,
        'shop_hours'            => $params['meta']['shop_hours'] ?? null,
        'basic_price'           => $params['meta']['basic_price'] ?? null,
        'official_url'          => $params['meta']['official_url'] ?? null,
        'shop_ai_summary'       => $params['meta']['shop_ai_summary'] ?? null,  // 月1回更新・Pythonは送信しない
        'shop_today_analysis'   => $params['meta']['shop_today_analysis'] ?? null,
        'shop_availability'     => $params['meta']['shop_availability'] ?? null,
        'shop_today_therapists' => $params['meta']['shop_today_therapists'] ?? null,  // 本日出勤キャスト
        'age_18'                => $params['meta']['age_18'] ?? null,
        'age_20'                => $params['meta']['age_20'] ?? null,
        'age_25'                => $params['meta']['age_25'] ?? null,
        'age_30'                => $params['meta']['age_30'] ?? null,
        'age_35'                => $params['meta']['age_35'] ?? null,
        'age_40'                => $params['meta']['age_40'] ?? null,
        'age_18_19'             => $params['meta']['age_18_19'] ?? null,
        'age_20_24'             => $params['meta']['age_20_24'] ?? null,
        'age_25_29'             => $params['meta']['age_25_29'] ?? null,
        'age_30_34'             => $params['meta']['age_30_34'] ?? null,
        'age_35_39'             => $params['meta']['age_35_39'] ?? null,
        'age_40_44'             => $params['meta']['age_40_44'] ?? null,
        'age_45_plus'           => $params['meta']['age_45_plus'] ?? null,
        'shop_price_60min'      => $params['meta']['shop_price_60min'] ?? null,
        'area_average_60min'    => $params['meta']['area_average_60min'] ?? null,
        'refl_menu_data'        => $params['meta']['refl_menu_data'] ?? null,  // wp_sync_menus.py 用
    ];

    foreach ($meta_mapping as $key => $value) {
        if ($value !== null) {
            update_post_meta($shop_id, $key, $value);
        }
    }

    // AI最終チェック日時を保存
    update_post_meta($shop_id, 'shop_last_ai_check', current_time('mysql'));

    // B. AI更新ログ（ai_update_log）として履歴を作成
    $log_id = wp_insert_post([
        'post_type'    => 'ai_update_log',
        'post_title'   => '【AI更新】' . get_the_title($shop_id),
        'post_content' => $params['summary'] ?? '',
        'post_status'  => 'publish',
    ]);

    if (!is_wp_error($log_id)) {
        update_post_meta($log_id, 'log_target_shop', $shop_id);
        update_post_meta($log_id, 'log_type', $params['log_type'] ?? 'update');
        update_post_meta($log_id, 'log_ai_summary', $params['summary'] ?? '');
    }

    return new WP_REST_Response([
        'status'  => 'success',
        'shop_id' => $shop_id,
        'log_id'  => $log_id
    ], 201);
}
