<?php
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

    // escomi/v1/update — AI エージェント用 REST エンドポイント
    // ai-update-log.php でも登録しているが、FTP sync のズレで古いバージョンが残るケースへの保険
    if ( function_exists( 'handle_ai_shop_update_final' ) ) {
        register_rest_route( 'escomi/v1', '/update', array(
            'methods'             => array( 'POST' ),
            'callback'            => 'handle_ai_shop_update_final',
            'permission_callback' => function () {
                return current_user_can( 'edit_posts' );
            },
        ) );
    }
});

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

// ====================================================
// CloudSecure proxy-app-passwords.php 干渉対策
// mu-plugins/proxy-app-passwords.php が rest_authentication_errors に
// "Missing API key." エラーを注入するため、Authorization ヘッダー付き
// リクエストに限りそのエラーを無効化して WordPress の標準認証へ通す。
// ====================================================
add_filter( 'rest_authentication_errors', function ( $result ) {
    if ( ! is_wp_error( $result ) ) {
        return $result;
    }
    if ( $result->get_error_code() !== 'rest_forbidden' ) {
        return $result;
    }
    if ( strpos( $result->get_error_message(), 'Missing API key' ) === false ) {
        return $result;
    }
    // Authorization ヘッダーが存在する場合は proxy の遮断を解除し
    // WordPress の Application Password 認証に委ねる
    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['HTTP_X_AUTHORIZATION']
        ?? ( function_exists( 'apache_request_headers' )
            ? ( apache_request_headers()['Authorization'] ?? '' )
            : '' );
    if ( ! empty( $auth ) ) {
        return null;
    }
    return $result;
}, 99999 );

// ====================================================
// AI店舗自動更新・カスタム REST（escomi/v1/update）は ai-update-log.php で登録
// ※ escomi_get_latest_ai_log_for_shop が必要になるコードより前に読み込むこと
// ====================================================
$ai_update_log_file = get_stylesheet_directory() . '/ai-update-log.php';
if ( file_exists( $ai_update_log_file ) && is_readable( $ai_update_log_file ) ) {
	require_once $ai_update_log_file;
} else {
	$hint = '[Escomi] ai-update-log.php が読み込めません — REST escomi/v1/update は未定義になります — 対象パス: ' . $ai_update_log_file;
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

    if (empty(trim((string) $shop_today_analysis)) && empty($shop_today_therapists)) {
        return '';
    }

    $availability_text = !empty(trim((string) $shop_availability)) ? $shop_availability : '本日すぐご案内可能';

    $html = '<div class="escomi-today-box">';
    $html .= '<div class="escomi-today-box__header">';
    $html .= '<div class="escomi-today-box__header-left">';
    $html .= '<span class="escomi-today-box__label">Today\'s Analysis</span>';
    if (!empty(trim((string) $shop_today_analysis))) {
        $html .= '<div class="escomi-today-box__analysis">' . wp_kses_post(nl2br($shop_today_analysis)) . '</div>';
    }
    $html .= '</div>';
    $html .= '<div class="escomi-today-box__header-right">';
    $html .= '<span class="escomi-today-box__badge escomi-today-box__badge--pulse">';
    $html .= '<span class="escomi-today-box__badge-dot"></span> ' . esc_html($availability_text);
    $html .= '</span>';
    $html .= '</div>';
    $html .= '</div>';

    if (!empty($shop_today_therapists)) {
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
        $html .= '<div class="escomi-today-box__placeholder">';
        $html .= '<p class="escomi-today-box__placeholder-text">現在、最新の出勤情報を確認中です。しばらく経ってから再度ご確認ください。</p>';
        $html .= '</div>';
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
