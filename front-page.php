<?php
/**
 * Escomi - トップページ (ショートコード活用・不要セクション削除版)
 */
get_header();

// 店舗総数を取得（ヒーローエリア用）
$shop_count_obj = wp_count_posts('shop');
$total_shops = isset($shop_count_obj->publish) ? intval($shop_count_obj->publish) : 0;
?>

<main id="main_content" class="l-mainContent">

    <?php /* Night Luxury (2025) - scoped wrapper */ ?>
    <div class="mep-homeNightLux">

    <div class="mep-hero-estama mep-hero-nightlux">
        <div class="mep-container">
            <div class="mep-hero-glass">
                <div class="mep-hero-flex">
                    <div class="mep-hero-left">
                        <p class="mep-hero-sub">関西メンズエステの口コミ情報サイト【エスコミ】</p>
                        
                        <h1 class="mep-hero-logo">
                            <img src="http://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png" alt="Eskomi（エスコミ）| 関西メンズエステ口コミナビ" width="400" height="auto">
                        </h1>
                        
                        <div class="mep-hero-count-box">
                            <span class="label">現在の掲載店舗数</span>
                            <span class="number" id="shopCounter" data-target="<?php echo esc_attr($total_shops); ?>">0</span><span class="unit">店</span>
                        </div>

                        <!-- <div class="mep-hero-actions">
                            <div class="mep-hero-search">
                                <?php echo do_shortcode('[shop_search_form]'); ?>
                            </div>
                        </div> -->
                    </div>

                    <div class="mep-hero-right">
                        <div class="mep-hero-ad-slot">
                            <span>広告掲載枠<br>（300×250）</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
<?php
/* ============================================================
   [追加] エリア特集セクション (固定ページ連動・スライダー対応版)
   ============================================================ */

// ▼ 表示させたい「固定ページのID」と「サブタイトル」を定義
$target_pages = [
    [
        'id'       => 343, // 日本橋特集のページID（スクショで確認済み）
        'subtitle' => '日本橋エリア特集',
        'btn_text' => '日本橋エリアの特集を見る',
    ],
    // ★ 将来追加するときはここに追記
    // [ 'id' => 999, 'subtitle' => '心斎橋エリア特集', 'btn_text' => '心斎橋を見る' ],
];

// ▼ 定義したIDから実際のデータを取得して配列を作成
$area_features = [];

foreach ($target_pages as $page_data) {
    $p_id = $page_data['id'];    // ページID
    $post_obj = get_post($p_id); // 記事オブジェクト取得

    // 記事が存在し、かつ「公開」されている場合のみデータをセット
    if ($post_obj && $post_obj->post_status === 'publish') {
        
        // 画像：アイキャッチ画像を取得（なければダミー）
        $thumb_url = get_the_post_thumbnail_url($p_id, 'large');
        if (!$thumb_url) {
            // テーマフォルダ内のno-image.png、または任意の画像URL
            $thumb_url = get_theme_file_uri('/assets/img/no-image.png'); 
        }

        // 説明文：「抜粋」があればそれを使用、なければ本文を80文字で丸める
        $description = has_excerpt($p_id) ? get_the_excerpt($p_id) : wp_trim_words($post_obj->post_content, 80, '...');

        $area_features[] = [
            'slug'        => $post_obj->post_name,
            'subtitle'    => $page_data['subtitle'],
            'title'       => get_the_title($p_id), // 記事タイトル
            'description' => $description,         // 抜粋 or 本文
            'link'        => get_permalink($p_id), // リンク
            'btn_text'    => $page_data['btn_text'],
            'image'       => $thumb_url,           // アイキャッチ画像
        ];
    }
}
?>

<?php /* ▼ データがある場合のみ表示 */ ?>
<?php if ( !empty($area_features) ): ?>
<section class="l-section p-areaFeature">
    <div class="l-container">
        
        <div class="p-areaFeature__header">
            <h2 class="c-secTitle -center">
                <span class="c-secTitle__en">AREA FEATURE</span>
                <span class="c-secTitle__jp">エリア特集</span>
            </h2>
        </div>

        <div class="p-areaFeature__list">
            <?php foreach ( $area_features as $feature ): ?>
                <div class="p-areaFeature__item">
                    
                    <div class="p-areaFeature__img">
                        <a href="<?php echo esc_url($feature['link']); ?>" class="c-card__thumb">
                            <img src="<?php echo esc_url($feature['image']); ?>" alt="<?php echo esc_attr($feature['title']); ?>">
                        </a>
                    </div>

                    <div class="p-areaFeature__body">
                        <span class="p-areaFeature__sub"><?php echo esc_html($feature['subtitle']); ?></span>
                        <h3 class="p-areaFeature__title"><?php echo esc_html($feature['title']); ?></h3>
                        <p class="p-areaFeature__desc">
                            <?php echo wp_kses_post($feature['description']); ?>
                        </p>
                       <div class="p-areaFeature__btnWrap">
                            <a href="<?php echo esc_url($feature['link']); ?>" class="p-areaFeature__richBtn">
                                <span class="richBtn-text"><?php echo esc_html($feature['btn_text']); ?></span>
                                <i class="icon-chevron-right"></i>
                            </a>
                        </div>
                    </div>

                </div>
            <?php endforeach; ?>
        </div>

    </div>
</section>
<?php else: ?>
    <?php endif; ?>

    <?php echo do_shortcode('[kansai_area_list]'); ?>

    <div class="mep-white-section">
        <div class="mep-container">
            <h2 class="mep-section-title mep-section-title--center">
                <span class="mep-section-title__icon">🆕</span>
                新着店舗
            </h2>
            
            <?php
            $new_shops = new WP_Query([
                'post_type' => 'shop',
                'posts_per_page' => 6,
                'orderby' => 'date',
                'order' => 'DESC',
            ]);
            
            if ($new_shops->have_posts()) :
            ?>
            <div class="mep-feature-cards">
                <?php while ($new_shops->have_posts()) : $new_shops->the_post();
                    $shop_price = get_field('basic_price');
                    $shop_area = get_the_terms(get_the_ID(), 'area');
                    $area_name = !empty($shop_area) && !is_wp_error($shop_area) ? $shop_area[0]->name : '';
                ?>
                <a href="<?php the_permalink(); ?>" class="mep-feature-card mep-shop-link">
                    <div class="mep-card-img">
                        <?php if (has_post_thumbnail()) : ?>
                            <?php the_post_thumbnail('medium'); ?>
                        <?php else : ?>
                            <img src="<?php echo get_theme_file_uri('/assets/img/no-image.png'); ?>" alt="No Image">
                        <?php endif; ?>
                        <span class="mep-badge mep-badge--new">NEW</span>
                    </div>
                    <div class="mep-card-body">
                        <span class="mep-area-label"><?php echo esc_html($area_name); ?></span>
                        <h3 class="mep-card-title"><?php the_title(); ?></h3>
                        <p class="mep-card-price">
                            <?php if($shop_price) echo '¥' . number_format($shop_price) . '〜'; ?>
                        </p>
                    </div>
                </a>
                <?php endwhile; wp_reset_postdata(); ?>
            </div>
            <div class="mep-center">
                <a href="/shops/" class="mep-cta-btn mep-cta-btn--outline">新着店舗をもっと見る</a>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="mep-blog-section">
        <div class="mep-container">
            
            <h2 class="mep-section-title">
                <span class="mep-section-title__icon">📖</span>
                新着コラム・体験レポート
            </h2>
            
            <?php echo do_shortcode('[escomi_column count="6"]'); ?>
            
            <div class="mep-center">
                <a href="/column/" class="mep-cta-btn mep-cta-btn--solid">コラム一覧を見る</a>
            </div>
            
        </div>
    </div>

    <div class="mep-about-section">
        <div class="mep-container mep-about-container">
            <h2 class="mep-about-title">関西メンズエステ口コミ（エスコミ）について</h2>
            <p class="mep-about-lead">
                当サイトは、大阪・京都・神戸を中心に、関西エリアのメンズエステ情報を厳選して掲載しています。<br>
                実際の利用者によるリアルな情報と、詳細な店舗データであなたにぴったりのサロン探しをサポートします。
            </p>
            
            <div class="mep-cta-panel">
                <h3 class="mep-cta-title">店舗オーナー様へ</h3>
                <p class="mep-cta-text">当サイトへの掲載をご希望の店舗様は、こちらよりお問い合わせください。</p>
                <a href="/contact/" class="mep-cta-btn mep-cta-btn--inverse">掲載のお問い合わせ</a>
            </div>
        </div>
    </div>

    </div><?php /* /.mep-homeNightLux */ ?>

</main>

<script>
// 店舗数カウンターアニメーション
document.addEventListener('DOMContentLoaded', function() {
    const counter = document.getElementById('shopCounter');
    if (counter) {
        const target = parseInt(counter.getAttribute('data-target'), 10);
        
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(counter, target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        observer.observe(counter);
    }

    function animateCounter(el, max) {
        let current = 0;
        const timer = setInterval(() => {
            current += Math.ceil(max / 50);
            if (current >= max) {
                current = max;
                clearInterval(timer);
            }
            el.textContent = current.toLocaleString();
        }, 20);
    }
});
</script>

<?php get_footer(); ?>
