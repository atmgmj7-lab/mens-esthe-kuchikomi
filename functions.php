<?php
// v2026-05-16
require_once __DIR__ . '/shop-public-meta.php';
$coverage_batch_writer = __DIR__ . '/coverage-batch-writer.php';
if (is_readable($coverage_batch_writer)) {
    require_once $coverage_batch_writer;
}
/**
 * =====================================================
 * CSS分割読み込み（安全版）
 * =====================================================
 * 
 * base.css       → 全ページ共通（変数、ヘッダー、フッター、フォント）
 * front-page.css → トップページ関連スタイル
 * single.css     → 店舗詳細・アーカイブ関連スタイル
 * 
 * ※ デザイン崩れ防止のため、全CSSを全ページで読み込みます
 * ※ 条件分岐が必要な場合は下記コメントを参照してください
 * 
 * 読み込み順序:
 * 1. 親テーマのスタイル（SWELLが自動で読み込み）
 * 2. base.css
 * 3. front-page.css
 * 4. single.css
 * 5. style.css（緊急の上書き用、通常は空）
 */
add_action('wp_enqueue_scripts', function() {
    $theme_dir = get_stylesheet_directory();
    $theme_uri = get_stylesheet_directory_uri();
    
    // キャッシュバスター用タイムスタンプを取得
    $get_timestamp = function($file) use ($theme_dir) {
        $path = $theme_dir . $file;
        return file_exists($path) ? filemtime($path) : time();
    };

    // =====================================================
    // Editorial Grid (トップページ演出用) リソース
    // - Google Fonts: Shippori Mincho / Playfair Display
    // - GSAP (Core + ScrollTrigger): CDN
    // =====================================================
    wp_enqueue_style(
        'mep-editorial-fonts',
        'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Playfair+Display:opsz,wght@5..1200,400;500;600;700&display=swap',
        array(),
        null
    );
    
    // 1. base.css（全ページ共通）
    wp_enqueue_style(
        'child-base',
        $theme_uri . '/css/base.css',
        array(),
        $get_timestamp('/css/base.css')
    );
    
    // 2. front-page.css（全ページで読み込み - 安全のため）
    wp_enqueue_style(
        'child-front-page',
        $theme_uri . '/css/front-page.css',
        array('child-base'),
        $get_timestamp('/css/front-page.css')
    );
    
    // 3. single.css（全ページで読み込み - 安全のため）
    wp_enqueue_style(
        'child-single',
        $theme_uri . '/css/single.css',
        array('child-front-page'),
        $get_timestamp('/css/single.css')
    );
    
    // 4. style.css（テーマ情報＋緊急上書き用）
    wp_enqueue_style(
        'child-style',
        $theme_uri . '/style.css',
        array('child-single'),
        $get_timestamp('/style.css')
    );

    // GSAP + ScrollTrigger + トップページ専用JS（フロントページのみ）
    if ( is_front_page() ) {
        wp_enqueue_script(
            'gsap',
            'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
            array(),
            '3.12.5',
            true
        );
        wp_enqueue_script(
            'gsap-scrolltrigger',
            'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
            array('gsap'),
            '3.12.5',
            true
        );
        wp_enqueue_script(
            'mep-front-page-editorial',
            $theme_uri . '/js/front-page-editorial.js',
            array('gsap-scrolltrigger'),
            $get_timestamp('/js/front-page-editorial.js'),
            true
        );
    }
    
}, 11);

// Google Fonts のプリコネクト（レンダリングの体感速度改善）
add_filter('wp_resource_hints', function($urls, $relation_type) {
    if ($relation_type !== 'preconnect') return $urls;
    $urls[] = 'https://fonts.googleapis.com';
    $urls[] = array(
        'href' => 'https://fonts.gstatic.com',
        'crossorigin' => 'anonymous',
    );
    return $urls;
}, 10, 2);

/*
 * =====================================================
 * 【オプション】パフォーマンス最適化版
 * =====================================================
 * サイトが安定してきたら、以下のコードで条件分岐に変更可能です。
 * その場合、上記のコードをコメントアウトして、下記を有効にしてください。
 * 
 * add_action('wp_enqueue_scripts', function() {
 *     $theme_dir = get_stylesheet_directory();
 *     $theme_uri = get_stylesheet_directory_uri();
 *     
 *     $get_timestamp = function($file) use ($theme_dir) {
 *         $path = $theme_dir . $file;
 *         return file_exists($path) ? filemtime($path) : time();
 *     };
 *     
 *     wp_enqueue_style('child-base', $theme_uri . '/css/base.css', array(), $get_timestamp('/css/base.css'));
 *     
 *     if (is_front_page() || is_home()) {
 *         wp_enqueue_style('child-front-page', $theme_uri . '/css/front-page.css', array('child-base'), $get_timestamp('/css/front-page.css'));
 *     } else {
 *         wp_enqueue_style('child-single', $theme_uri . '/css/single.css', array('child-base'), $get_timestamp('/css/single.css'));
 *     }
 *     
 *     wp_enqueue_style('child-style', $theme_uri . '/style.css', array('child-base'), $get_timestamp('/style.css'));
 * }, 11);
 */


/* 1. カスタム投稿タイプ・タクソノミー登録 */
add_action('init', function() {
    // 店舗 (shops)
    register_post_type('shop', array(
        'labels' => array('name' => '店舗情報', 'singular_name' => '店舗'),
        'public' => true,
        'has_archive' => true,
        'rewrite' => array('slug' => 'shops'),
        'supports' => array('title', 'editor', 'thumbnail', 'excerpt'),
        'show_in_rest' => true,
    ));
    // エリア (area)
    register_taxonomy('area', 'shop', array(
        'labels' => array('name' => 'エリア'),
        'hierarchical' => true,
        'public' => true,
        'show_in_rest' => true,
        'rewrite' => array('slug' => 'area'),
    ));
});

/* 1.5 REST API: shop に official_url を公開（Python巡回スクリプト用） */
add_action('rest_api_init', function() {
    register_rest_field('shop', 'official_url', array(
        'get_callback' => function($object) {
            $id = 0;
            if (is_array($object) && isset($object['id'])) {
                $id = (int) $object['id'];
            } elseif (is_object($object) && isset($object->ID)) {
                $id = (int) $object->ID;
            }
            if ($id <= 0) return '';
            if (function_exists('get_field')) {
                $val = get_field('official_url', $id);
                return is_string($val) ? $val : (string) ($val ?: '');
            }
            $val = get_post_meta($id, 'official_url', true);
            return is_string($val) ? $val : '';
        },
        'schema' => array(
            'description' => '公式サイトURL',
            'type'        => 'string',
        ),
        'context' => array('view', 'embed', 'edit'),
    ));
    // エリアスラッグ（ai_monthly_updater の area_average_60min 動的設定用）
    register_rest_field('shop', 'area_slug', array(
        'get_callback' => function($object) {
            $id = is_array($object) && isset($object['id']) ? (int)$object['id'] : (isset($object->ID) ? (int)$object->ID : 0);
            if ($id <= 0) return '';
            $terms = get_the_terms($id, 'area');
            if (!$terms || is_wp_error($terms)) return '';
            foreach ($terms as $t) {
                if ($t->parent != 0) return $t->slug;
            }
            return $terms[0]->slug ?? '';
        },
        'schema' => array('description' => 'エリアスラッグ（子エリア優先）', 'type' => 'string'),
        'context' => array('view', 'embed', 'edit'),
    ));

});

/* 1.6 トップページ「大阪の特集エリア」管理設定 + REST公開 */
function escomi_default_home_featured_areas() {
    return array(
        array(
            'enabled'     => true,
            'slug'        => 'sakaisuji-hommachi',
            'href'        => '/area/sakaisuji-hommachi/',
            'subtitle'    => '堺筋本町エリア特集',
            'title'       => '堺筋本町メンズエステおすすめ一覧',
            'description' => '堺筋本町・本町・北浜周辺で探しやすい店舗を、料金・営業時間・アクセス・口コミの見方で比較できます。',
            'btnText'     => '堺筋本町の店舗を見る',
            'image'       => '/images/area-feature/sakaisuji-hommachi-senba.jpg',
            'imageAlt'    => '堺筋本町・船場センタービル周辺の夜景',
        ),
        array(
            'enabled'     => true,
            'slug'        => 'shinosaka',
            'href'        => '/area/shinosaka/',
            'subtitle'    => '新大阪エリア特集',
            'title'       => '新大阪メンズエステおすすめ一覧',
            'description' => '新大阪・東三国・西中島南方周辺の候補を、出張前後や夜の利用もしやすい条件で比較できます。',
            'btnText'     => '新大阪の店舗を見る',
            'image'       => 'https://images.unsplash.com/photo-1731676354015-46244f4a70df?auto=format&fit=crop&w=1400&q=80',
            'imageAlt'    => '大阪の通り沿いの街並み',
        ),
        array(
            'enabled'     => true,
            'slug'        => 'nihonbashi',
            'href'        => '/area/nihonbashi/',
            'subtitle'    => '日本橋エリア特集',
            'title'       => '大阪日本橋メンズエステおすすめ一覧',
            'description' => '大阪・日本橋エリアのメンズエステを店舗一覧・口コミ・料金・営業時間・駅近・深夜営業で比較できます。',
            'btnText'     => '日本橋の店舗を見る',
            'image'       => 'https://images.unsplash.com/photo-1593327478947-d530033a86ff?auto=format&fit=crop&w=1400&q=80',
            'imageAlt'    => '大阪日本橋周辺の夜の繁華街',
        ),
        array(
            'enabled'     => true,
            'slug'        => 'umeda',
            'href'        => '/area/umeda/',
            'subtitle'    => '梅田エリア特集',
            'title'       => '大阪梅田メンズエステおすすめ一覧',
            'description' => '梅田・大阪駅・東梅田・西梅田周辺の店舗を、駅近・深夜営業・料金目安で比較できます。',
            'btnText'     => '梅田の店舗を見る',
            'image'       => '/images/area-feature/umeda-street-night.jpg',
            'imageAlt'    => '大阪梅田の夜の飲食街',
        ),
        array(
            'enabled'     => true,
            'slug'        => 'sakai',
            'href'        => '/area/sakai/',
            'subtitle'    => '堺エリア特集',
            'title'       => '堺メンズエステおすすめ一覧',
            'description' => '堺・堺東・三国ヶ丘周辺で探す方向けに、料金・営業時間・アクセスを見比べやすく整理しています。',
            'btnText'     => '堺の店舗を見る',
            'image'       => 'https://images.unsplash.com/photo-1678489819868-9a8136044b00?auto=format&fit=crop&w=1400&q=80',
            'imageAlt'    => '大阪の路地の街並み',
        ),
    );
}

function escomi_normalize_home_featured_area( $item, $fallback = array() ) {
    $item = is_array( $item ) ? $item : array();
    $fallback = is_array( $fallback ) ? $fallback : array();

    $slug = sanitize_title( $item['slug'] ?? ( $fallback['slug'] ?? '' ) );
    $href = trim( (string) ( $item['href'] ?? ( $fallback['href'] ?? '' ) ) );
    if ( $href === '' && $slug !== '' ) {
        $href = '/area/' . $slug . '/';
    }

    return array(
        'enabled'     => ! empty( $item['enabled'] ),
        'slug'        => $slug,
        'href'        => esc_url_raw( $href ),
        'subtitle'    => sanitize_text_field( $item['subtitle'] ?? ( $fallback['subtitle'] ?? '' ) ),
        'title'       => sanitize_text_field( $item['title'] ?? ( $fallback['title'] ?? '' ) ),
        'description' => sanitize_textarea_field( $item['description'] ?? ( $fallback['description'] ?? '' ) ),
        'btnText'     => sanitize_text_field( $item['btnText'] ?? ( $fallback['btnText'] ?? '' ) ),
        'image'       => esc_url_raw( $item['image'] ?? ( $fallback['image'] ?? '' ) ),
        'imageAlt'    => sanitize_text_field( $item['imageAlt'] ?? ( $fallback['imageAlt'] ?? '' ) ),
    );
}

function escomi_sanitize_home_featured_areas( $items ) {
    $defaults = escomi_default_home_featured_areas();
    $items = is_array( $items ) ? array_values( $items ) : array();
    $normalized = array();
    $count = max( count( $defaults ), count( $items ) );

    for ( $i = 0; $i < $count; $i++ ) {
        $normalized[] = escomi_normalize_home_featured_area( $items[ $i ] ?? array(), $defaults[ $i ] ?? array() );
    }

    return $normalized;
}

function escomi_get_home_featured_areas() {
    $stored = get_option( 'escomi_home_featured_areas', array() );
    $items = ! empty( $stored ) && is_array( $stored )
        ? escomi_sanitize_home_featured_areas( $stored )
        : escomi_default_home_featured_areas();

    $items = array_values( array_filter( $items, function ( $item ) {
        return ! empty( $item['enabled'] ) && ! empty( $item['slug'] ) && ! empty( $item['title'] );
    } ) );

    return ! empty( $items ) ? $items : escomi_default_home_featured_areas();
}

add_action( 'admin_init', function () {
    register_setting(
        'escomi_home_featured_areas_group',
        'escomi_home_featured_areas',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'escomi_sanitize_home_featured_areas',
            'default'           => escomi_default_home_featured_areas(),
        )
    );
} );

add_action( 'admin_menu', function () {
    add_options_page(
        'トップ特集エリア',
        'トップ特集エリア',
        'manage_options',
        'escomi-home-featured-areas',
        'escomi_render_home_featured_areas_admin'
    );
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( $hook !== 'settings_page_escomi-home-featured-areas' ) {
        return;
    }

    wp_enqueue_media();
    wp_enqueue_script( 'jquery' );
    wp_add_inline_script(
        'jquery',
        <<<'JS'
jQuery(function($){
  $('.escomi-media-picker').on('click', function(e){
    e.preventDefault();
    var target = $($(this).data('target'));
    var frame = wp.media({
      title: '画像を選択',
      button: { text: 'この画像を使う' },
      multiple: false
    });
    frame.on('select', function(){
      var attachment = frame.state().get('selection').first().toJSON();
      target.val(attachment.url).trigger('change');
    });
    frame.open();
  });
});
JS
    );
} );

function escomi_render_home_featured_areas_admin() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $items = get_option( 'escomi_home_featured_areas', array() );
    $items = ! empty( $items ) && is_array( $items ) ? escomi_sanitize_home_featured_areas( $items ) : escomi_default_home_featured_areas();
    ?>
    <div class="wrap">
        <h1>トップ特集エリア</h1>
        <p>トップページ「大阪の特集エリア」スライダーに表示する地域・画像・文言を設定します。</p>
        <form method="post" action="options.php">
            <?php settings_fields( 'escomi_home_featured_areas_group' ); ?>
            <table class="widefat striped" style="max-width: 1280px;">
                <thead>
                    <tr>
                        <th style="width:70px;">表示</th>
                        <th style="width:150px;">エリアslug</th>
                        <th>タイトル・説明</th>
                        <th style="width:280px;">画像URL</th>
                        <th style="width:160px;">リンク</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $items as $index => $item ) : ?>
                    <tr>
                        <td>
                            <label>
                                <input type="checkbox" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][enabled]" value="1" <?php checked( ! empty( $item['enabled'] ) ); ?>>
                                表示
                            </label>
                        </td>
                        <td>
                            <input type="text" class="regular-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][slug]" value="<?php echo esc_attr( $item['slug'] ); ?>" placeholder="nihonbashi">
                            <p class="description">例: nihonbashi</p>
                        </td>
                        <td>
                            <input type="text" class="large-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][subtitle]" value="<?php echo esc_attr( $item['subtitle'] ); ?>" placeholder="日本橋エリア特集">
                            <input type="text" class="large-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][title]" value="<?php echo esc_attr( $item['title'] ); ?>" placeholder="大阪日本橋メンズエステおすすめ一覧" style="margin-top:6px;">
                            <textarea class="large-text" rows="3" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][description]" style="margin-top:6px;"><?php echo esc_textarea( $item['description'] ); ?></textarea>
                            <input type="text" class="large-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][btnText]" value="<?php echo esc_attr( $item['btnText'] ); ?>" placeholder="日本橋の店舗を見る" style="margin-top:6px;">
                            <input type="text" class="large-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][imageAlt]" value="<?php echo esc_attr( $item['imageAlt'] ); ?>" placeholder="画像の説明" style="margin-top:6px;">
                        </td>
                        <td>
                            <?php $image_id = 'escomi_featured_image_' . $index; ?>
                            <input id="<?php echo esc_attr( $image_id ); ?>" type="url" class="large-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][image]" value="<?php echo esc_url( $item['image'] ); ?>">
                            <button type="button" class="button escomi-media-picker" data-target="#<?php echo esc_attr( $image_id ); ?>" style="margin-top:6px;">画像を選択</button>
                        </td>
                        <td>
                            <input type="text" class="regular-text" name="escomi_home_featured_areas[<?php echo esc_attr( $index ); ?>][href]" value="<?php echo esc_attr( $item['href'] ); ?>" placeholder="/area/nihonbashi/">
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php submit_button( '保存する' ); ?>
        </form>
    </div>
    <?php
}

add_action( 'rest_api_init', function () {
    register_rest_route( 'escomi/v1', '/home-featured-areas', array(
        'methods'             => array( 'GET' ),
        'callback'            => function () {
            return rest_ensure_response( array(
                'items' => escomi_get_home_featured_areas(),
            ) );
        },
        'permission_callback' => '__return_true',
    ) );
}, PHP_INT_MAX );

/* 1.7 エリア別おすすめランキング管理設定 + REST公開 */
function escomi_default_area_shop_ranking_slugs() {
    return array( 'osaka', 'sakaisuji-hommachi', 'shinosaka', 'nihonbashi', 'umeda', 'sakai' );
}

function escomi_area_shop_ranking_split_slugs( $value ) {
    if ( is_array( $value ) ) {
        $parts = $value;
    } else {
        $parts = preg_split( '/[\r\n,、]+/', (string) $value );
    }

    $slugs = array();
    foreach ( $parts as $part ) {
        $slug = sanitize_title( trim( (string) $part ) );
        if ( $slug === '' || in_array( $slug, $slugs, true ) ) {
            continue;
        }
        $slugs[] = $slug;
        if ( count( $slugs ) >= 5 ) {
            break;
        }
    }

    return $slugs;
}

function escomi_sanitize_area_shop_rankings( $items ) {
    $items = is_array( $items ) ? $items : array();
    $normalized = array();

    foreach ( $items as $area_slug => $item ) {
        $area_slug = sanitize_title( (string) $area_slug );
        if ( $area_slug === '' ) {
            continue;
        }

        $item = is_array( $item ) ? $item : array();
        $shop_slugs = escomi_area_shop_ranking_split_slugs( $item['shopSlugs'] ?? ( $item['shop_slugs'] ?? array() ) );

        $normalized[ $area_slug ] = array(
            'enabled'   => ! empty( $item['enabled'] ),
            'shopSlugs' => $shop_slugs,
        );
    }

    return $normalized;
}

function escomi_get_area_shop_ranking_rows() {
    $stored = get_option( 'escomi_area_shop_rankings', array() );
    $stored = is_array( $stored ) ? escomi_sanitize_area_shop_rankings( $stored ) : array();
    $slugs = escomi_default_area_shop_ranking_slugs();

    $terms = get_terms( array(
        'taxonomy'   => 'area',
        'hide_empty' => false,
    ) );

    if ( ! is_wp_error( $terms ) ) {
        foreach ( $terms as $term ) {
            if ( ! empty( $term->slug ) && ! in_array( $term->slug, $slugs, true ) ) {
                $slugs[] = $term->slug;
            }
        }
    }

    foreach ( array_keys( $stored ) as $slug ) {
        if ( ! in_array( $slug, $slugs, true ) ) {
            $slugs[] = $slug;
        }
    }

    $rows = array();
    foreach ( $slugs as $slug ) {
        $term = get_term_by( 'slug', $slug, 'area' );
        $rows[] = array(
            'slug'  => $slug,
            'name'  => $term && ! is_wp_error( $term ) ? $term->name : $slug,
            'value' => $stored[ $slug ] ?? array(
                'enabled'   => true,
                'shopSlugs' => array(),
            ),
        );
    }

    return $rows;
}

function escomi_get_area_shop_rankings() {
    $stored = get_option( 'escomi_area_shop_rankings', array() );
    $stored = is_array( $stored ) ? escomi_sanitize_area_shop_rankings( $stored ) : array();
    $rankings = array();

    foreach ( $stored as $area_slug => $item ) {
        if ( empty( $item['enabled'] ) || empty( $item['shopSlugs'] ) ) {
            continue;
        }

        $rankings[ $area_slug ] = array();
        foreach ( array_values( $item['shopSlugs'] ) as $index => $shop_slug ) {
            $rankings[ $area_slug ][] = array(
                'rank'     => $index + 1,
                'shopSlug' => $shop_slug,
            );
        }
    }

    return $rankings;
}

add_action( 'admin_init', function () {
    register_setting(
        'escomi_area_shop_rankings_group',
        'escomi_area_shop_rankings',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'escomi_sanitize_area_shop_rankings',
            'default'           => array(),
        )
    );
} );

add_action( 'admin_menu', function () {
    add_options_page(
        'エリア別ランキング',
        'エリア別ランキング',
        'manage_options',
        'escomi-area-shop-rankings',
        'escomi_render_area_shop_rankings_admin'
    );
} );

function escomi_render_area_shop_rankings_admin() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $rows = escomi_get_area_shop_ranking_rows();
    ?>
    <div class="wrap">
        <h1>エリア別ランキング</h1>
        <p>各エリアページのおすすめランキング1〜5位を店舗slugで指定します。未入力のエリアは、公開情報・料金・営業時間・アクセス情報をもとにしたおすすめ順の上位5件を自動表示します。</p>
        <form method="post" action="options.php">
            <?php settings_fields( 'escomi_area_shop_rankings_group' ); ?>
            <table class="widefat striped" style="max-width: 1120px;">
                <thead>
                    <tr>
                        <th style="width:90px;">手動指定</th>
                        <th style="width:220px;">エリア</th>
                        <th>1〜5位の店舗slug</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $rows as $row ) : ?>
                        <?php
                        $slug = $row['slug'];
                        $value = is_array( $row['value'] ) ? $row['value'] : array();
                        $enabled = array_key_exists( 'enabled', $value ) ? ! empty( $value['enabled'] ) : true;
                        $shop_slugs = implode( "\n", $value['shopSlugs'] ?? array() );
                        ?>
                        <tr>
                            <td>
                                <label>
                                    <input type="checkbox" name="escomi_area_shop_rankings[<?php echo esc_attr( $slug ); ?>][enabled]" value="1" <?php checked( $enabled ); ?>>
                                    使う
                                </label>
                            </td>
                            <td>
                                <strong><?php echo esc_html( $row['name'] ); ?></strong>
                                <p class="description">slug: <code><?php echo esc_html( $slug ); ?></code></p>
                            </td>
                            <td>
                                <textarea
                                    class="large-text code"
                                    rows="5"
                                    name="escomi_area_shop_rankings[<?php echo esc_attr( $slug ); ?>][shopSlugs]"
                                    placeholder="1行目: 1位の店舗slug&#10;2行目: 2位の店舗slug&#10;最大5件"
                                ><?php echo esc_textarea( $shop_slugs ); ?></textarea>
                                <p class="description">店舗詳細URLの末尾にあるslugを、1位から順に1行ずつ入力します。カンマ区切りでも保存できます。</p>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php submit_button( 'ランキングを保存する' ); ?>
        </form>
    </div>
    <?php
}

add_action( 'update_option_escomi_area_shop_rankings', function () {
    if ( function_exists( 'escomi_headless_queue_revalidate' ) ) {
        escomi_headless_queue_revalidate( 'area_shop_rankings_update' );
    }
}, 10, 0 );

add_action( 'rest_api_init', function () {
    register_rest_route( 'escomi/v1', '/area-shop-rankings', array(
        'methods'             => array( 'GET' ),
        'callback'            => function () {
            return rest_ensure_response( array(
                'rankings' => escomi_get_area_shop_rankings(),
            ) );
        },
        'permission_callback' => '__return_true',
    ) );
}, PHP_INT_MAX );

/* 2. ショートコード：店舗数表示 [shop_count] */
add_shortcode('shop_count', function() {
    $count = wp_count_posts('shop');
    return number_format(isset($count->publish) ? intval($count->publish) : 0);
});

/* 3. ショートコード：エリア別店舗数 [area_shop_count area="osaka"] */
add_shortcode('area_shop_count', function($atts) {
    $atts = shortcode_atts(array('area' => ''), $atts);
    $term = get_term_by('slug', $atts['area'], 'area');
    return $term ? number_format($term->count) : '0';
});

/* 4. ショートコード：検索フォーム [shop_search_form] */
add_shortcode('shop_search_form', function() {
    ob_start(); ?>
    <form class="shop-search-form" method="get" action="<?php echo esc_url(home_url('/')); ?>">
        <input type="hidden" name="post_type" value="shop">
        <div class="search-form-row">
            <input type="text" name="s" placeholder="キーワード検索">
            <button type="submit" class="search-submit-btn">検索</button>
        </div>
    </form>
    <?php return ob_get_clean();
});

/* --------------------------------------------------
   関西エリア一覧表示用ショートコード（タイトルON/OFF機能付き）
   使い方: 
     通常（タイトルあり）: [kansai_area_list]
     タイトルなし      : [kansai_area_list show_title="false"]
   -------------------------------------------------- */
add_shortcode('kansai_area_list', function($atts) {
    // 引数の設定（デフォルトはタイトル表示）
    $atts = shortcode_atts(array(
        'show_title' => 'true', 
    ), $atts);

    ob_start(); 
    ?>
    
    <div class="mep-area-section">
        <div class="mep-container">
            
            <?php /* show_title="false" が指定されていない場合のみタイトルを表示 */ ?>
            <?php if($atts['show_title'] !== 'false'): ?>
            <h2 class="mep-section-title">
                <span class="mep-section-title__icon">⭐</span>
                人気エリアから探す
            </h2>
            <?php endif; ?>

            <div class="sooon-wrapper">
                <div class="sooon-row">
                    <?php 
                    $row1 = [
                        ['slug' => 'osaka', 'name' => '大阪', 'sub' => '梅田・難波・心斎橋'],
                        ['slug' => 'kyoto', 'name' => '京都', 'sub' => '河原町・四条・祇園'],
                        ['slug' => 'hyogo', 'name' => '兵庫', 'sub' => '三宮・元町・西宮'],
                    ];
                    foreach($row1 as $data):
                        $slug = $data['slug'];
                        $term = get_term_by('slug', $slug, 'area');
                        $link = $term ? get_term_link($term) : home_url('/area/' . $slug . '/');
                        $count = $term ? $term->count : 0;
                    ?>
                    <a href="<?php echo esc_url($link); ?>" class="sooon-item bg-<?php echo esc_attr($slug); ?>">
                        <div class="sooon-overlay"></div>
                        <div class="sooon-content">
                            <p class="sooon-en"><?php echo strtoupper($slug); ?></p>
                            <h2 class="sooon-title"><?php echo esc_html($data['name']); ?></h2>
                            <p class="sooon-sub"><?php echo esc_html($data['sub']); ?></p>
                            <div class="sooon-view-more">
                                <span>View more</span>
                                <span class="count-bubble"><?php echo $count; ?>件</span>
                            </div>
                        </div>
                    </a>
                    <?php endforeach; ?>
                </div>

                <div class="sooon-row">
                    <?php 
                    $row2 = [
                        ['slug' => 'nara', 'name' => '奈良', 'sub' => '近鉄奈良・新大宮'],
                        ['slug' => 'shiga', 'name' => '滋賀', 'sub' => '大津・草津'],
                        ['slug' => 'wakayama', 'name' => '和歌山', 'sub' => '和歌山駅・市駅'],
                    ];
                    foreach($row2 as $data):
                        $slug = $data['slug'];
                        $term = get_term_by('slug', $slug, 'area');
                        $link = $term ? get_term_link($term) : home_url('/area/' . $slug . '/');
                        $count = $term ? $term->count : 0;
                    ?>
                    <a href="<?php echo esc_url($link); ?>" class="sooon-item bg-<?php echo esc_attr($slug); ?>">
                        <div class="sooon-overlay"></div>
                        <div class="sooon-content">
                            <p class="sooon-en"><?php echo strtoupper($slug); ?></p>
                            <h2 class="sooon-title"><?php echo esc_html($data['name']); ?></h2>
                            <p class="sooon-sub"><?php echo esc_html($data['sub']); ?></p>
                            <div class="sooon-view-more">
                                <span>View more</span>
                                <span class="count-bubble"><?php echo $count; ?>件</span>
                            </div>
                        </div>
                    </a>
                    <?php endforeach; ?>
                </div>
            </div>

        </div>
    </div>
    <?php
    return ob_get_clean();
});
/* --------------------------------------------------
   新着ブログ記事表示ショートコード
   使い方: [latest_blog_posts count="3"]
   -------------------------------------------------- */
add_shortcode('latest_blog_posts', function($atts) {
    extract(shortcode_atts(array(
        'count' => 3, // 表示件数
    ), $atts));

    // 記事を取得
    $args = array(
        'post_type' => 'post',
        'posts_per_page' => $count,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC',
    );
    $query = new WP_Query($args);

    ob_start();
    ?>
    
    <div class="mep-blog-grid">
        <?php if ($query->have_posts()) : ?>
            <?php while ($query->have_posts()) : $query->the_post(); ?>
                <a href="<?php the_permalink(); ?>" class="mep-blog-card">
                    <div class="mep-blog-card__thumb">
                        <?php if (has_post_thumbnail()) : ?>
                            <?php the_post_thumbnail('medium'); ?>
                        <?php else : ?>
                            <img src="https://via.placeholder.com/600x400/eeeeee/cccccc?text=No+Image" alt="No Image">
                        <?php endif; ?>
                        
                        <?php
                            $categories = get_the_category();
                            if ( ! empty( $categories ) ) {
                                echo '<span class="mep-blog-card__cat">' . esc_html( $categories[0]->name ) . '</span>';
                            }
                        ?>
                    </div>
                    
                    <div class="mep-blog-card__body">
                        <time class="mep-blog-card__date"><?php echo get_the_date('Y.m.d'); ?></time>
                        <h3 class="mep-blog-card__title"><?php the_title(); ?></h3>
                        <p class="mep-blog-card__excerpt">
                            <?php echo wp_trim_words( get_the_excerpt(), 40, '...' ); ?>
                        </p>
                    </div>
                </a>
            <?php endwhile; ?>
            <?php wp_reset_postdata(); ?>
        <?php else : ?>
            <p>記事はまだありません。</p>
        <?php endif; ?>
    </div>

    <?php
    return ob_get_clean();
});
/* --------------------------------------------------
   【Sooon風】メディアセクション用ショートコード
   使い方: [escomi_column count="6"]
   -------------------------------------------------- */
add_shortcode('escomi_column', function($atts) {
    extract(shortcode_atts(array(
        'count' => 6, // 表示件数
    ), $atts));

    $args = array(
        'post_type' => 'post',
        'posts_per_page' => $count,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'DESC',
    );
    $query = new WP_Query($args);

    ob_start();
    ?>
    
    <div class="sooon-media-grid">
        <?php if ($query->have_posts()) : ?>
            <?php while ($query->have_posts()) : $query->the_post(); ?>
                <?php 
                    // カテゴリ取得
                    $categories = get_the_category();
                    $cat_name = !empty($categories) ? $categories[0]->name : 'Column';
                    
                    // 日付フォーマット（例：2026.01.10 Saturday）
                    $date_day = get_the_date('Y.m.d l'); 
                ?>
                <a href="<?php the_permalink(); ?>" class="sooon-media-card">
                    
                    <div class="sooon-media-thumb">
                        <?php if (has_post_thumbnail()) : ?>
                            <?php the_post_thumbnail('large'); ?>
                        <?php else : ?>
                            <img src="https://via.placeholder.com/800x500/f0f0f0/cccccc?text=No+Image" alt="No Image">
                        <?php endif; ?>
                    </div>
                    
                    <div class="sooon-media-body">
                        <div class="sooon-media-meta">
                            <span class="sooon-media-cat"><?php echo esc_html($cat_name); ?></span>
                            <time class="sooon-media-date"><?php echo $date_day; ?></time>
                        </div>
                        
                        <h3 class="sooon-media-title"><?php the_title(); ?></h3>
                        
                        <p class="sooon-media-excerpt">
                            <?php echo wp_trim_words( get_the_excerpt(), 40, '...' ); ?>
                        </p>
                    </div>
                </a>
            <?php endwhile; ?>
            <?php wp_reset_postdata(); ?>
        <?php else : ?>
            <p>記事はまだありません。</p>
        <?php endif; ?>
    </div>

    <?php
    return ob_get_clean();
});
/* --------------------------------------------------
   【Luxury版】エリアマップ＆リスト自動表示
   使い方: [area_map_nav] または [area_map_nav list="1"]
   list="1" でショートコード内の AREA LIST を表示（既定は非表示。taxonomy 側の「詳細エリアを選択」と重複しがちなため）
   -------------------------------------------------- */
/**
 * 親エリアスラッグ用の Google Maps 埋め込み URL。
 * 府県名クエリより座標＋ズームで範囲を絞り、表示をエリア中心に寄せる。
 * 無料の output=embed では地図上のラベル完全非表示は不可（Maps JS API + スタイルが必要）。
 */
function escomi_area_parent_map_embed_url( $slug ) {
    $maps = [
        'osaka'    => 'https://www.google.com/maps?q=34.6937,135.5023&z=11&hl=ja&output=embed',
        'hyogo'    => 'https://www.google.com/maps?q=34.6901,135.1835&z=11&hl=ja&output=embed',
        'kyoto'    => 'https://www.google.com/maps?q=35.0116,135.7681&z=11&hl=ja&output=embed',
        'nara'     => 'https://www.google.com/maps?q=34.6851,135.8048&z=11&hl=ja&output=embed',
        'shiga'    => 'https://www.google.com/maps?q=35.0045,135.8686&z=11&hl=ja&output=embed',
        'wakayama' => 'https://www.google.com/maps?q=34.2304,135.1706&z=11&hl=ja&output=embed',
    ];
    return isset( $maps[ $slug ] ) ? $maps[ $slug ] : '';
}

add_shortcode( 'area_map_nav', function ( $atts ) {
    $atts = shortcode_atts(
        [
            'list' => '0',
        ],
        $atts,
        'area_map_nav'
    );
    $show_list = ( $atts['list'] === '1' || $atts['list'] === 'true' );

    $term = get_queried_object();

    // エリアページ以外、または子エリアの場合は表示しない
    if ( ! isset( $term->term_id ) || $term->parent != 0 ) {
        return '';
    }

    $slug    = $term->slug;
    $map_url = escomi_area_parent_map_embed_url( $slug );
    if ( empty( $map_url ) ) {
        return '';
    }

    $children = get_terms(
        [
            'taxonomy'   => 'area',
            'parent'     => $term->term_id,
            'hide_empty' => false,
        ]
    );

    ob_start();
    ?>
    <div class="lux-area-nav lux-area-nav--shortcode lux-area-nav--map-focus">
        
        <div class="lux-map-section">
            <h2 class="lux-heading">
                <span class="en">MAP SEARCH</span>
                <span class="jp">周辺の位置関係（地図の範囲で目安）</span>
            </h2>
            <div class="lux-map-frame">
                <iframe
                    class="lux-map-iframe"
                    src="<?php echo esc_url( $map_url ); ?>"
                    title="<?php echo esc_attr( $term->name ); ?>の地図"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    allowfullscreen
                ></iframe>
            </div>
        </div>

        <?php if ( $show_list && ! empty( $children ) && ! is_wp_error( $children ) ) : ?>
        <div class="lux-list-section">
            <h2 class="lux-heading-small">AREA LIST</h2>
            <div class="lux-grid">
                <?php foreach ( $children as $child ) : ?>
                <a href="<?php echo esc_url( get_term_link( $child ) ); ?>" class="lux-list-item">
                    <span class="name"><?php echo esc_html( $child->name ); ?></span>
                    <span class="arrow">View</span>
                </a>
                <?php endforeach; ?>
            </div>
        </div>
        <?php endif; ?>

    </div>
    <?php
    return ob_get_clean();
} );
/* ==================================================
   店舗保存時、子エリア選択で親エリアを自動チェック
   ================================================== */
function auto_check_parent_area_terms( $post_id ) {
    // 1. 対象のタクソノミーと投稿タイプ
    $taxonomy = 'area';
    $post_type = 'shop';

    // 2. 自動保存や権限のチェック
    if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
    if ( get_post_type($post_id) !== $post_type ) return;

    // 3. 現在選択されているターム（エリア）を取得
    $terms = wp_get_post_terms( $post_id, $taxonomy );
    if ( is_wp_error( $terms ) ) return;

    // 4. 保存するタームIDのリストを作成
    $terms_to_save = array();

    foreach ( $terms as $term ) {
        // 選ばれているターム自体を追加
        $terms_to_save[] = (int) $term->term_id;

        // 親がいる場合、その親IDも追加
        if ( $term->parent != 0 ) {
            $terms_to_save[] = (int) $term->parent;
            
            // (念のため) 孫→子→親の3階層ある場合、さらに上の親も追加
            $parent = get_term( $term->parent, $taxonomy );
            if ( $parent && ! is_wp_error( $parent ) && $parent->parent != 0 ) {
                $terms_to_save[] = (int) $parent->parent;
            }
        }
    }

    // 5. 重複を削除して保存（無限ループ防止のためフックを一時解除）
    $terms_to_save = array_unique( $terms_to_save );
    
    remove_action( 'save_post', 'auto_check_parent_area_terms' );
    wp_set_object_terms( $post_id, $terms_to_save, $taxonomy );
    add_action( 'save_post', 'auto_check_parent_area_terms' );
}
add_action( 'save_post', 'auto_check_parent_area_terms' );

/**
 * 特定の店舗IDを指定して、リッチな店舗カードを表示するショートコード
 * 使用法: [pickup_shops ids="123, 456, 789"]
 */
add_shortcode('pickup_shops', 'escomi_pickup_shops_shortcode');
function escomi_pickup_shops_shortcode($atts) {
    // 属性の取得（IDリスト）
    $atts = shortcode_atts(array(
        'ids' => '', // カンマ区切りの投稿ID
    ), $atts);

    if (empty($atts['ids'])) return '';

    // IDを配列化して空白を除去
    $post_ids = array_map('trim', explode(',', $atts['ids']));

    // クエリ作成
    $args = array(
        'post_type' => 'shop', // カスタム投稿タイプ名
        'post__in'  => $post_ids,
        'orderby'   => 'post__in', // 指定した順番通りに表示
        'posts_per_page' => -1,
    );

    $query = new WP_Query($args);
    ob_start();

    if ($query->have_posts()) : ?>
        <div class="wolfman-list-container" style="margin-top:20px;">
        <?php while ($query->have_posts()) : $query->the_post(); 
            // 必要なデータを取得
            $shop_id = get_the_ID();
            $price = get_field('basic_price'); // カスタムフィールド名に合わせて変更
            $access = get_field('access');     // カスタムフィールド名に合わせて変更
            $shop_terms = get_the_terms($shop_id, 'area'); // タクソノミー名
            $area_name = !empty($shop_terms) ? $shop_terms[0]->name : 'エリア未定';
        ?>
            <div class="shop-list-row">
                <a href="<?php the_permalink(); ?>" class="shop-row-img">
                    <?php if (has_post_thumbnail()) : ?>
                        <?php the_post_thumbnail('medium'); ?>
                    <?php else : ?>
                        <img src="<?php echo get_theme_file_uri('/assets/img/no-image.png'); ?>" alt="No Image">
                    <?php endif; ?>
                </a>
                <div class="shop-row-info">
                    <div class="shop-list-cats">
                        <span><?php echo esc_html($area_name); ?></span>
                    </div>
                    <h3 class="shop-row-title">
                        <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
                    </h3>
                    <div class="shop-row-tags">
                        <span class="list-tag tag-gray">完全個室</span>
                        <span class="list-tag tag-gray">シャワー完備</span>
                    </div>
                </div>
                <div class="shop-row-meta">
                    <div class="meta-box price">
                        <span class="meta-sub">最安</span>
                        <span class="price-red"><?php echo number_format((int)$price); ?></span>円〜
                    </div>
                    <div class="meta-box hours">
                        <?php echo esc_html($access); ?>
                    </div>
                </div>
            </div>
        <?php endwhile; ?>
        </div>
    <?php else: ?>
        <p>指定された店舗が見つかりませんでした。</p>
    <?php endif;
    wp_reset_postdata();
    return ob_get_clean();
}
// ====================================================
// 年月を自動表示するショートコード [auto_date]
// ====================================================
add_shortcode('auto_date', function() {
    // 現在の年月を取得（例：- 2026年1月更新 -）
    $date_text = '- ' . date_i18n('Y年n月') . '更新 -';
    
    // HTMLとして出力
    return '<span class="ranking-date-label">' . $date_text . '</span>';
});

// ====================================================
// エリアアーカイブページ SEO最適化（Ecire流ハイブリッド構成）
// ====================================================
// 構成: ① taxonomy-area.php（H1・特性・ランキング・一覧・コラム・FAQ・JSON-LD）② swell_before_post_list（編集部厳選3店）
// get_the_archive_description で特性HTMLを差す方式は廃止済み（二重表示防止）。
//
// Yoast SEO / Rank Math でメタディスクリプションが空のとき、ACF area_characteristics のプレーン要約を供給
// （WP 標準ターム説明だけでは足りないケースの補完。管理画面で個別メタを入れた場合は上書きしない）
function escomi_get_area_characteristics_metadesc_text( $term_id ) {
    $term_id = (int) $term_id;
    if ( $term_id < 1 || ! function_exists( 'get_field' ) ) {
        return '';
    }
    $raw = get_field( 'area_characteristics', 'term_' . $term_id );
    if ( ! is_string( $raw ) || $raw === '' ) {
        return '';
    }
    $plain = wp_strip_all_tags( $raw );
    $plain = preg_replace( '/\s+/u', ' ', trim( $plain ) );
    if ( $plain === '' ) {
        return '';
    }
    $max = 155;
    if ( function_exists( 'mb_strlen' ) && function_exists( 'mb_substr' ) ) {
        if ( mb_strlen( $plain ) > $max ) {
            return mb_substr( $plain, 0, $max - 1 ) . '…';
        }
        return $plain;
    }
    if ( strlen( $plain ) > $max ) {
        return substr( $plain, 0, $max - 1 ) . '…';
    }
    return $plain;
}

function escomi_maybe_tax_area_metadesc_from_acf( $metadesc ) {
    if ( ! is_tax( 'area' ) ) {
        return $metadesc;
    }
    $term = get_queried_object();
    if ( ! $term || empty( $term->term_id ) ) {
        return $metadesc;
    }
    if ( is_string( $metadesc ) && trim( $metadesc ) !== '' ) {
        return $metadesc;
    }
    $fallback = escomi_get_area_characteristics_metadesc_text( (int) $term->term_id );
    return $fallback !== '' ? $fallback : $metadesc;
}

add_filter( 'wpseo_metadesc', 'escomi_maybe_tax_area_metadesc_from_acf', 15 );
add_filter( 'wpseo_opengraph_desc', 'escomi_maybe_tax_area_metadesc_from_acf', 15 );
add_filter( 'rank_math/frontend/description', 'escomi_maybe_tax_area_metadesc_from_acf', 15 );

// 最適化版（編集部厳選3店のみ）。差し替え前は area-seo-hooks.php
require_once get_stylesheet_directory() . '/area-seo-hooks-optimized.php';
require_once get_stylesheet_directory() . '/reviews-cpt.php';
require_once get_stylesheet_directory() . '/reviews-public-rest.php';

// ====================================================
// AI店舗自動更新・カスタム REST（escomi/v1/update）は ai-update-log.php で登録
// ※ escomi_get_latest_ai_log_for_shop が必要になるコードより前に読み込むこと
// ====================================================
$ai_update_log_file = get_stylesheet_directory() . '/ai-update-log.php';
if ( file_exists( $ai_update_log_file ) && is_readable( $ai_update_log_file ) ) {
	require_once $ai_update_log_file;
} else {
	$hint = '[Eskomi] ai-update-log.php が読み込めません — REST escomi/v1/update は未定義になります — 対象パス: ' . $ai_update_log_file;
	if ( function_exists( 'error_log' ) ) {
		error_log( $hint );
	}
	add_action(
		'admin_notices',
		function () use ( $ai_update_log_file ) {
			echo '<div class="error"><p>AIログファイルが見つかりませんまたは読めません: ' . esc_html( $ai_update_log_file ) . '</p></div>';
		}
	);
}

/**
 * ai_update_log のDB肥大化対策: 最新1000件を残し、それより古いログを1日1回自動削除
 */
add_action('init', function() {
    if (!wp_next_scheduled('escomi_prune_ai_update_log')) {
        wp_schedule_event(time(), 'daily', 'escomi_prune_ai_update_log');
    }
}, 20);
add_action('escomi_prune_ai_update_log', 'escomi_prune_ai_update_log_callback');
function escomi_prune_ai_update_log_callback() {
    $keep = 1000;
    global $wpdb;
    // AI 自動更新ログは publish で作成。ゴミ箱等を除外し OFFSET 暴走を避けるため status を限定する。
    $ids = $wpdb->get_col(
        $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
            WHERE post_type = 'ai_update_log' AND post_status = 'publish'
            ORDER BY post_date DESC
            LIMIT 99999 OFFSET %d",
            $keep
        )
    );
    foreach ( $ids ?: [] as $id ) {
        wp_delete_post( (int) $id, true );
    }
}

// ====================================================
// 店舗詳細：AIサマリーボックス表示（確実動作版）
// ① init でショートコード登録 ② SWELLフック ③ get_post_meta フォールバック
// ====================================================
add_action('init', function() {
    add_shortcode('ai_shop_summary', 'escomi_render_ai_shop_summary_shortcode');
}, 5);

add_action('swell_before_post_content', 'escomi_display_ai_shop_summary', 5);
add_action('swell_post_content_top', 'escomi_display_ai_shop_summary', 5);
add_action('wp_head', 'escomi_ai_summary_premium_styles', 25);

/**
 * 本日の出勤＆空き状況ボックス（毎日更新・shop_ai_summary は絶対に混ぜない）
 * シャンパンゴールドボーダー、空き状況バッジ、横スクロールキャストカード
 */
function escomi_get_today_therapists_html($post_id) {
    $post_id = (int) $post_id;
    if (!$post_id || get_post_type($post_id) !== 'shop') {
        return '';
    }

    // 毎日更新データのみ（shop_ai_summary は使用しない）
    $shop_today_analysis = get_field('shop_today_analysis', $post_id) ?: get_post_meta($post_id, 'shop_today_analysis', true);
    $shop_availability = get_field('shop_availability', $post_id) ?: get_post_meta($post_id, 'shop_availability', true);
    $shop_today_therapists = get_field('shop_today_therapists', $post_id);
    if (empty($shop_today_therapists)) {
        $shop_today_therapists = get_post_meta($post_id, 'shop_today_therapists', true);
    }
    if (!is_array($shop_today_therapists)) {
        $shop_today_therapists = [];
    }

    // JSON形式で保存されている場合は早期にテキスト抽出（以降の全判定に使用）
    $display_analysis = trim((string) $shop_today_analysis);
    if (!empty($display_analysis) && (strpos($display_analysis, '{') === 0 || strpos($display_analysis, '```') === 0)) {
        $cleaned = preg_replace('/```(?:json)?\s*/', '', $display_analysis);
        $cleaned = str_replace('```', '', $cleaned);
        $json_data = json_decode(trim($cleaned), true);
        if (is_array($json_data)) {
            $extracted = trim((string)($json_data['today_analysis'] ?? $json_data['summary'] ?? ''));
            $display_analysis = !empty($extracted) ? $extracted : '';
        } else {
            $display_analysis = '';
        }
    }
    $has_analysis = !empty($display_analysis) && strlen($display_analysis) > 10;
    $has_therapists = !empty($shop_today_therapists);

    // データが完全にない場合のみ非表示（JSON空の場合はプレースホルダーを表示するため通過）
    if (!$has_analysis && !$has_therapists && empty(trim((string) $shop_today_analysis))) {
        return '';
    }

    $raw_availability = trim((string) $shop_availability);
    if (empty($raw_availability) || $raw_availability === 'なし' || strpos($raw_availability, '{') === 0) {
        $availability_text = '本日すぐご案内可能';
    } else {
        $availability_text = $raw_availability;
    }

    $html = '<div class="escomi-today-box">';
    $html .= '<div class="escomi-today-box__header">';
    $html .= '<div class="escomi-today-box__header-left">';
    $html .= '<span class="escomi-today-box__label">Today\'s Analysis</span>';
    if ($has_analysis) {
        $html .= '<div class="escomi-today-box__analysis">' . wp_kses_post(nl2br($display_analysis)) . '</div>';
    }
    $html .= '</div>';
    $html .= '<div class="escomi-today-box__header-right">';
    $html .= '<span class="escomi-today-box__badge escomi-today-box__badge--pulse">';
    $html .= '<span class="escomi-today-box__badge-dot"></span> ' . esc_html($availability_text);
    $html .= '</span>';
    $html .= '</div>';
    $html .= '</div>';

    if ($has_therapists) {
        $html .= '<div class="escomi-today-box__cast-scroll">';
        $html .= '<div class="escomi-today-box__cast-list">';
        foreach ($shop_today_therapists as $t) {
            $name = isset($t['name']) ? esc_html($t['name']) : '';
            $time = isset($t['time']) ? esc_html($t['time']) : '';
            $tags = isset($t['tags']) && is_array($t['tags']) ? $t['tags'] : [];
            $html .= '<div class="escomi-today-box__cast-card">';
            $html .= '<div class="escomi-today-box__cast-avatar"><span class="escomi-today-box__cast-placeholder">Cast</span></div>';
            foreach ($tags as $tag) {
                $tag_s = esc_html((string) $tag);
                $cls = (strpos((string) $tag, '新人') !== false) ? 'escomi-today-box__tag--new' : ((strpos((string) $tag, 'レア') !== false) ? 'escomi-today-box__tag--rare' : 'escomi-today-box__tag');
                $html .= '<span class="escomi-today-box__tag ' . esc_attr($cls) . '">' . $tag_s . '</span>';
            }
            $html .= '<div class="escomi-today-box__cast-name">' . $name . '</div>';
            $html .= '<div class="escomi-today-box__cast-time">' . $time . '</div>';
            $html .= '</div>';
        }
        $html .= '</div></div>';
    } else {
        if (!$has_analysis) {
            $html .= '<div class="escomi-today-box__placeholder">';
            $html .= '<p class="escomi-today-box__placeholder-text">現在、最新の出勤情報を確認中です。しばらく経ってから再度ご確認ください。</p>';
            $html .= '</div>';
        }
    }

    $update_date = function_exists('escomi_get_shop_update_date') ? escomi_get_shop_update_date($post_id) : '';
    if ($update_date) {
        $html .= '<div class="escomi-today-box__update">最終更新: ' . esc_html($update_date) . '</div>';
    }
    $html .= '</div>';
    return $html;
}

/**
 * @deprecated 下段は escomi_get_today_therapists_html を使用。ショートコード互換のため残す。
 */
function escomi_get_ai_intel_box_html($post_id) {
    return escomi_get_today_therapists_html($post_id);
}

function escomi_display_ai_shop_summary() {
    if (!is_singular('shop')) return;
    $post_id = get_the_ID() ?: get_queried_object_id();
    if (!$post_id) return;
    $html = escomi_get_ai_intel_box_html($post_id);
    if ($html) {
        echo $html;
    } else {
        echo '<!-- [escomi] display_ai_shop_summary: no content for post_id=' . (int)$post_id . ' -->';
    }
}

function escomi_render_ai_shop_summary_shortcode($atts) {
    $atts = shortcode_atts(['id' => 0], $atts ?? [], 'ai_shop_summary');
    $post_id = (int) ($atts['id'] ?? 0);
    if (!$post_id) {
        $post_id = get_the_ID() ?: get_queried_object_id();
    }
    if (!$post_id) {
        return '<!-- [escomi] shortcode: post_id=0 -->';
    }
    $html = escomi_get_ai_intel_box_html($post_id);
    if ($html) {
        if (!is_singular('shop')) {
            $html = escomi_ai_summary_inline_styles() . $html;
        }
        return '<!-- [escomi] ai_shop_summary SHORTCODE OK -->' . $html;
    }
    return '<!-- [escomi] shortcode: no content for post_id=' . $post_id . ' -->';
}

function escomi_ai_summary_inline_styles() {
    return '<style id="escomi-ai-intel-styles-inline">' . escomi_ai_intel_box_css() . '</style>';
}

function escomi_ai_intel_box_css() {
    $today_box = '.escomi-today-box{background:#FDFBF6;border:1px solid #D4AF37;border-radius:8px;padding:24px 28px 28px;margin-bottom:28px;box-shadow:0 2px 12px rgba(212,175,55,0.12)}
.escomi-today-box__header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.escomi-today-box__header-left{flex:1;min-width:0}
.escomi-today-box__header-right{flex-shrink:0}
.escomi-today-box__label{display:block;font-size:.7rem;font-weight:600;letter-spacing:.15em;color:#D4AF37;margin-bottom:6px;text-transform:uppercase}
.escomi-today-box__badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#2e7d32 0%,#1b5e20 100%);color:#fff;font-size:.75rem;font-weight:600;padding:6px 14px;letter-spacing:.05em;box-shadow:0 1px 4px rgba(46,125,50,0.3)}
.escomi-today-box__badge-dot{width:6px;height:6px;background:rgba(255,255,255,.9);animation:escomi-badge-pulse 2s ease-in-out infinite}
@keyframes escomi-badge-pulse{0%,100%{opacity:1}50%{opacity:.5}}
.escomi-today-box__analysis{font-size:1.05rem;font-weight:500;color:#5a4a3a;line-height:1.65}
.escomi-today-box__cast-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:12px 0 0}
.escomi-today-box__cast-list{display:flex;gap:14px;width:max-content;padding:4px 0}
.escomi-today-box__cast-card{position:relative;flex-shrink:0;width:96px;text-align:center;background:#fff;border:1px solid #D4AF37;border-radius:4px;padding:14px 10px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.escomi-today-box__cast-avatar{width:52px;height:52px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(145deg,#f5f0e8 0%,#e8e0d4 100%);display:flex;align-items:center;justify-content:center;border:1px solid rgba(212,175,55,.3)}
.escomi-today-box__cast-placeholder{font-size:.55rem;font-weight:500;letter-spacing:.2em;color:rgba(90,74,58,.35);font-style:italic}
.escomi-today-box__cast-name{font-size:.85rem;font-weight:600;color:#333;margin-bottom:4px}
.escomi-today-box__cast-time{font-size:.65rem;color:#888;letter-spacing:.02em}
.escomi-today-box__tag{position:absolute;top:0;left:0;font-size:.55rem;font-weight:600;padding:3px 8px;letter-spacing:.08em;background:#5a4a3a;color:#fff}
.escomi-today-box__tag--new{background:linear-gradient(135deg,#8b6f47,#6b5344);color:#fff}
.escomi-today-box__tag--rare{background:linear-gradient(135deg,#D4AF37,#b8962e);color:#fff}
.escomi-today-box__tag:not(.escomi-today-box__tag--new):not(.escomi-today-box__tag--rare){background:#5a4a3a;color:#fff}
.escomi-today-box__placeholder{padding:24px 20px;text-align:center;background:rgba(212,175,55,.06);border:1px dashed rgba(212,175,55,.35);border-radius:6px;margin-top:12px}
.escomi-today-box__placeholder-text{font-size:.9rem;color:#6b5b4a;line-height:1.6;margin:0;letter-spacing:.03em}
@media (max-width:767px){.escomi-today-box{padding:20px 20px 24px}.escomi-today-box__header{flex-direction:column;gap:12px}.escomi-today-box__header-right{order:-1}.escomi-today-box__badge{align-self:flex-start}.escomi-today-box__analysis{font-size:.95rem}.escomi-today-box__cast-card{width:88px}}';
    $ai_intel = '.ai-intel-icon::before,.ai-intel-subicon::before{content:"";display:inline-block;width:6px;height:6px;background:#D4AF37;margin-right:8px;vertical-align:middle}
.ai-intel-subicon::before{width:4px;height:4px;background:#b8962e}
.crown-icon{display:none}';
    return $today_box . $ai_intel;
}

function escomi_ai_summary_premium_styles() {
    if (!is_singular('shop')) return;
    echo '<style id="escomi-ai-intel-styles">' . escomi_ai_intel_box_css() . '</style>';
}

// ============================================================
// 店舗表示強化: ヘルパー関数（2026-05-17 追加）
// ============================================================

/**
 * 店舗コンセプトHTMLを返す
 */
function escomi_get_shop_concept($post_id) {
    $summary = get_field('shop_ai_summary', $post_id) ?: get_post_meta($post_id, 'shop_ai_summary', true);
    if (empty($summary) || strlen(trim((string)$summary)) < 10) {
        return '';
    }
    $display_summary = trim((string)$summary);
    // JSON形式ガード
    if (strpos($display_summary, '{') === 0 || strpos($display_summary, '```') === 0) {
        $cleaned = preg_replace('/```(?:json)?\s*/', '', $display_summary);
        $cleaned = str_replace('```', '', $cleaned);
        $json_data = json_decode(trim($cleaned), true);
        if (is_array($json_data)) {
            $extracted = trim((string)($json_data['summary'] ?? $json_data['concept'] ?? $json_data['ai_summary'] ?? ''));
            $display_summary = !empty($extracted) ? $extracted : '';
        } else {
            $display_summary = '';
        }
    }
    if (empty($display_summary) || strlen($display_summary) < 10) {
        return '';
    }
    $html = '<div class="escomi-shop-concept">';
    $html .= '<h3 class="escomi-shop-concept__title">店舗の特徴・コンセプト</h3>';
    $html .= '<div class="escomi-shop-concept__content">' . wp_kses_post(nl2br($display_summary)) . '</div>';
    $html .= '</div>';
    return $html;
}

/**
 * 最終更新日を返す
 */
function escomi_get_shop_update_date($post_id) {
    $last_check = get_field('shop_last_ai_check', $post_id) ?: get_post_meta($post_id, 'shop_last_ai_check', true);
    if (empty($last_check)) return '';
    $timestamp = strtotime($last_check);
    if (!$timestamp) return '';
    return date_i18n('Y年n月j日', $timestamp);
}

/**
 * 最安価格を返す
 */
function escomi_get_shop_price($post_id) {
    $price = get_field('basic_price', $post_id) ?: get_post_meta($post_id, 'basic_price', true);
    if (empty($price)) return '';
    $price = (int) $price;
    if ($price <= 0) return '';
    return '¥' . number_format($price) . '〜';
}

/**
 * 本日出勤情報があるか判定
 */
function escomi_has_today_staff($post_id) {
    $therapists = get_field('shop_today_therapists', $post_id);
    if (empty($therapists)) {
        $therapists = get_post_meta($post_id, 'shop_today_therapists', true);
    }
    if (!is_array($therapists) || empty($therapists)) return false;
    $first = reset($therapists);
    return is_array($first) && !empty($first['name']);
}


// ============================================================
// ショートコード登録
// ============================================================

add_shortcode('shop_concept', function($atts) {
    $atts = shortcode_atts(['id' => 0], $atts ?? []);
    $post_id = (int)($atts['id'] ?? 0) ?: (get_the_ID() ?: get_queried_object_id());
    return $post_id ? escomi_get_shop_concept($post_id) : '';
});

add_shortcode('shop_update_date', function($atts) {
    $atts = shortcode_atts(['id' => 0], $atts ?? []);
    $post_id = (int)($atts['id'] ?? 0) ?: (get_the_ID() ?: get_queried_object_id());
    return $post_id ? esc_html(escomi_get_shop_update_date($post_id)) : '';
});

add_shortcode('shop_price', function($atts) {
    $atts = shortcode_atts(['id' => 0], $atts ?? []);
    $post_id = (int)($atts['id'] ?? 0) ?: (get_the_ID() ?: get_queried_object_id());
    return $post_id ? esc_html(escomi_get_shop_price($post_id)) : '';
});

add_shortcode('shop_today_badge', function($atts) {
    $atts = shortcode_atts(['id' => 0], $atts ?? []);
    $post_id = (int)($atts['id'] ?? 0) ?: (get_the_ID() ?: get_queried_object_id());
    if (!$post_id) return '';
    if (escomi_has_today_staff($post_id)) {
        return '<span class="escomi-badge escomi-badge--active">出勤速報あり</span>';
    }
    return '<span class="escomi-badge escomi-badge--pending">出勤情報確認中</span>';
});

// ============================================================
// 店舗一覧・アーカイブページ用フィルター
// ============================================================

add_filter('the_content', 'escomi_add_shop_archive_badges', 20);
function escomi_add_shop_archive_badges($content) {
    if (is_singular('shop')) return $content;
    if (!is_post_type_archive('shop') && !is_tax('area') && !is_tax('shop_category')) {
        return $content;
    }
    global $post;
    if (!$post || $post->post_type !== 'shop') return $content;

    $post_id = $post->ID;
    $badge_html = '';
    $price_html = '';
    $update_html = '';

    if (escomi_has_today_staff($post_id)) {
        $badge_html = '<span class="escomi-archive-badge escomi-archive-badge--active">出勤速報あり</span>';
    } else {
        $badge_html = '<span class="escomi-archive-badge escomi-archive-badge--pending">出勤情報確認中</span>';
    }

    $price = escomi_get_shop_price($post_id);
    if ($price) {
        $price_html = '<span class="escomi-archive-price">' . esc_html($price) . '</span>';
    }

    $last_check = get_field('shop_last_ai_check', $post_id) ?: get_post_meta($post_id, 'shop_last_ai_check', true);
    if ($last_check) {
        $timestamp = strtotime($last_check);
        if ($timestamp) {
            $update_html = '<span class="escomi-archive-update">更新: ' . date_i18n('n/j', $timestamp) . '</span>';
        }
    }

    if ($badge_html || $price_html || $update_html) {
        $badge_block = '<div class="escomi-archive-shop-meta">' . $badge_html . $price_html . $update_html . '</div>';
        $content = $badge_block . $content;
    }

    return $content;
}

// ============================================================
// Headless Next.js キャッシュ再検証（WordPress 更新 → Next 即時反映）
// ============================================================

if (!function_exists('escomi_headless_revalidate_get_url')) {
    function escomi_headless_revalidate_get_url() {
        $url = (defined('ESCOMI_HEADLESS_REVALIDATE_URL') && ESCOMI_HEADLESS_REVALIDATE_URL)
            ? ESCOMI_HEADLESS_REVALIDATE_URL
            : 'https://mens-esthe-kuchikomi.com/api/revalidate/';

        $query_pos = strpos($url, '?');
        if ($query_pos !== false) {
            $url = substr($url, 0, $query_pos);
        }

        return trailingslashit($url);
    }
}

if (!function_exists('escomi_headless_revalidate_get_secret')) {
    function escomi_headless_revalidate_get_secret() {
        if (defined('ESCOMI_REVALIDATE_SECRET') && ESCOMI_REVALIDATE_SECRET) {
            return (string) ESCOMI_REVALIDATE_SECRET;
        }
        $env = getenv('ESCOMI_REVALIDATE_SECRET');
        if (is_string($env) && $env !== '') {
            return $env;
        }
        $opt = get_option('escomi_revalidate_secret', '');
        return is_string($opt) ? $opt : '';
    }
}

if (!function_exists('escomi_headless_revalidate_skip_post')) {
    function escomi_headless_revalidate_skip_post($post_id) {
        $post_id = (int) $post_id;
        if ($post_id <= 0) {
            return true;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return true;
        }
        if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
            return true;
        }
        return false;
    }
}

if (!function_exists('escomi_headless_revalidate_is_relevant_post_type')) {
    function escomi_headless_revalidate_is_relevant_post_type($post_type) {
        return in_array($post_type, array('shop', 'post', 'page', 'reviews'), true);
    }
}

if (!function_exists('escomi_headless_send_revalidate')) {
    function escomi_headless_send_revalidate($reason = 'content_update') {
        $url = escomi_headless_revalidate_get_url();
        $secret = escomi_headless_revalidate_get_secret();

        if ($secret === '') {
            if (defined('WP_DEBUG') && WP_DEBUG) {
                error_log('[escomi_headless] revalidate secret not configured; request skipped');
            }
            return;
        }

        $headers = array(
            'Content-Type' => 'application/json',
            'x-revalidate-secret' => $secret,
        );
        $body = wp_json_encode(array(
            'tag' => 'wp',
            'reason' => (string) $reason,
        ));

        $response = wp_remote_post($url, array(
            'timeout' => 0.1,
            'blocking' => false,
            'headers' => $headers,
            'body' => $body,
        ));

        if (!defined('WP_DEBUG') || !WP_DEBUG) {
            return;
        }

        if (is_wp_error($response)) {
            error_log('[escomi_headless] revalidate failed: ' . $response->get_error_message() . ' reason=' . $reason);
            return;
        }

        error_log('[escomi_headless] revalidate queued request reason=' . $reason);
    }
}

if (!function_exists('escomi_headless_queue_revalidate')) {
    function escomi_headless_queue_revalidate($reason = 'content_update') {
        $reason = (string) $reason;

        static $queued_reason = null;
        if ($queued_reason !== null) {
            return;
        }
        $queued_reason = $reason;

        add_action('shutdown', function () use ($queued_reason) {
            escomi_headless_send_revalidate($queued_reason);
        }, 20);
    }
}

if (!function_exists('escomi_headless_on_save_post')) {
    function escomi_headless_on_save_post($post_id, $post, $update) {
        unset($update);
        if (escomi_headless_revalidate_skip_post($post_id)) {
            return;
        }
        if (!($post instanceof WP_Post)) {
            return;
        }
        if ($post->post_status === 'auto-draft') {
            return;
        }
        if (!escomi_headless_revalidate_is_relevant_post_type($post->post_type)) {
            return;
        }
        if ('reviews' === $post->post_type && ('publish' !== $post->post_status || 'approved' !== get_post_meta($post_id, 'approval_status', true))) {
            return;
        }
        escomi_headless_queue_revalidate('save_' . $post->post_type . ':' . $post_id);
    }
}

if (!function_exists('escomi_headless_on_trashed_post')) {
    function escomi_headless_on_trashed_post($post_id) {
        if (escomi_headless_revalidate_skip_post($post_id)) {
            return;
        }
        $post_type = get_post_type($post_id);
        if (!$post_type || !escomi_headless_revalidate_is_relevant_post_type($post_type)) {
            return;
        }
        if ('reviews' === $post_type) {
            return;
        }
        escomi_headless_queue_revalidate('trashed_' . $post_type . ':' . $post_id);
    }
}

if (!function_exists('escomi_headless_on_untrashed_post')) {
    function escomi_headless_on_untrashed_post($post_id) {
        if (escomi_headless_revalidate_skip_post($post_id)) {
            return;
        }
        $post_type = get_post_type($post_id);
        if (!$post_type || !escomi_headless_revalidate_is_relevant_post_type($post_type)) {
            return;
        }
        if ('reviews' === $post_type) {
            return;
        }
        escomi_headless_queue_revalidate('untrashed_' . $post_type . ':' . $post_id);
    }
}

if (!function_exists('escomi_headless_on_before_delete_post')) {
    function escomi_headless_on_before_delete_post($post_id, $post = null) {
        if (escomi_headless_revalidate_skip_post($post_id) || !($post instanceof WP_Post)) {
            return;
        }
        if ('reviews' !== $post->post_type || 'publish' !== $post->post_status || 'approved' !== get_post_meta($post_id, 'approval_status', true)) {
            return;
        }
        escomi_headless_queue_revalidate('deleted_reviews:' . $post_id);
    }
}

if (!function_exists('escomi_headless_on_deleted_post')) {
    function escomi_headless_on_deleted_post($post_id, $post = null) {
        if (escomi_headless_revalidate_skip_post($post_id)) {
            return;
        }
        $post_type = ($post instanceof WP_Post) ? $post->post_type : get_post_type($post_id);
        if (!$post_type || !escomi_headless_revalidate_is_relevant_post_type($post_type)) {
            return;
        }
        if ('reviews' === $post_type) {
            return;
        }
        escomi_headless_queue_revalidate('deleted_' . $post_type . ':' . $post_id);
    }
}

if (!function_exists('escomi_headless_on_area_relationship_added')) {
    function escomi_headless_on_area_relationship_added($object_id, $tt_id, $taxonomy) {
        unset($tt_id);
        if ('area' === $taxonomy && 'shop' === get_post_type($object_id)) {
            escomi_headless_queue_revalidate('area_shop_relation_added:' . (int) $object_id);
        }
    }
}

if (!function_exists('escomi_headless_on_area_relationship_deleted')) {
    function escomi_headless_on_area_relationship_deleted($object_id, $tt_ids, $taxonomy) {
        unset($tt_ids);
        if ('area' === $taxonomy && 'shop' === get_post_type($object_id)) {
            escomi_headless_queue_revalidate('area_shop_relation_deleted:' . (int) $object_id);
        }
    }
}

if (!function_exists('escomi_headless_on_area_taxonomy_change')) {
    function escomi_headless_on_area_taxonomy_change($term_id, $tt_id = 0) {
        unset($tt_id);
        escomi_headless_queue_revalidate('area_term:' . (int) $term_id);
    }
}

if (!function_exists('escomi_headless_on_area_taxonomy_delete')) {
    function escomi_headless_on_area_taxonomy_delete($term, $tt_id, $taxonomy, $deleted_term) {
        unset($tt_id, $taxonomy, $deleted_term);
        $term_id = is_object($term) && isset($term->term_id) ? (int) $term->term_id : 0;
        escomi_headless_queue_revalidate('delete_area:' . $term_id);
    }
}

if (!function_exists('escomi_headless_on_primary_area_meta_change')) {
    function escomi_headless_on_primary_area_meta_change($meta_id, $object_id, $meta_key, $meta_value = null) {
        unset($meta_id, $meta_value);
        if (
            'shop_primary_area_term_id' === $meta_key
            && 'shop' === get_post_type($object_id)
            && 'publish' === get_post_status($object_id)
        ) {
            escomi_headless_queue_revalidate('shop_primary_area:' . (int) $object_id);
        }
    }
}

add_action('save_post_shop', 'escomi_headless_on_save_post', 20, 3);
add_action('save_post_post', 'escomi_headless_on_save_post', 20, 3);
add_action('save_post_page', 'escomi_headless_on_save_post', 20, 3);
add_action('save_post_reviews', 'escomi_headless_on_save_post', 20, 3);
add_action('trashed_post', 'escomi_headless_on_trashed_post', 20, 1);
add_action('untrashed_post', 'escomi_headless_on_untrashed_post', 20, 1);
add_action('before_delete_post', 'escomi_headless_on_before_delete_post', 20, 2);
add_action('deleted_post', 'escomi_headless_on_deleted_post', 20, 2);
add_action('edited_area', 'escomi_headless_on_area_taxonomy_change', 20, 2);
add_action('created_area', 'escomi_headless_on_area_taxonomy_change', 20, 2);
add_action('delete_area', 'escomi_headless_on_area_taxonomy_delete', 20, 4);
add_action('added_term_relationship', 'escomi_headless_on_area_relationship_added', 20, 3);
add_action('deleted_term_relationships', 'escomi_headless_on_area_relationship_deleted', 20, 3);
add_action('added_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4);
add_action('updated_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4);
add_action('deleted_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4);
