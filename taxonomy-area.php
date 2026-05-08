<?php
/**
 * Escomi - エリア一覧ページ (完全版)
 * SWELL子テーマ対応・仕様書v2.0準拠
 */
get_header();

// エリア情報の取得
$current_term = get_queried_object();
$term_id      = $current_term->term_id;
$term_name    = $current_term->name;
$term_slug    = $current_term->slug;
$parent_id    = $current_term->parent; 
$child_terms  = get_terms(array('taxonomy' => 'area', 'parent' => $term_id, 'hide_empty' => false));
$is_parent_area = ($parent_id === 0);

$parent_term = null;
if (!$is_parent_area) {
    $parent_term = get_term($parent_id, 'area');
}

/* 画像設定 */
$header_images = [
    'osaka' => 'http://mens-esthe-kuchikomi.com/wp-content/uploads/2026/01/photo-1590559899731-a382839e5549.jpeg',
    'kyoto' => 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    'hyogo' => 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=800',
];
// functions.php の escomi_area_parent_map_embed_url() と同一 URL

$term_bg_url = '';
if ( function_exists('get_term_meta') ) {
    $thumb_id = get_term_meta( $term_id, 'thumbnail_id', true );
    if( $thumb_id ) $term_bg_url = wp_get_attachment_image_url( $thumb_id, 'full' );
}
if ( empty($term_bg_url) && isset($header_images[$term_slug]) ) $term_bg_url = $header_images[$term_slug];
if ( empty($term_bg_url) && !$is_parent_area && $parent_term ) $term_bg_url = $header_images[$parent_term->slug] ?? '';
?>

<main id="main_content" class="l-main_content l-article">
    <div class="area-archive-header" style="<?php if($term_bg_url) echo 'background-image: url(' . esc_url($term_bg_url) . ');'; ?>">
        <div class="area-header-overlay"><h1 class="archive-title"><?php echo esc_html($term_name); ?>のメンズエステ</h1></div>
    </div>

    <div class="l-main_content__inner">
        <div class="area-breadcrumb u-mb-40">
            <a href="<?php echo home_url('/'); ?>">TOP</a> &gt; 
            <a href="<?php echo home_url('/shops/'); ?>">エリア一覧</a> &gt; 
            <?php if(!$is_parent_area && $parent_term): ?>
                <a href="<?php echo get_term_link($parent_term); ?>"><?php echo esc_html($parent_term->name); ?></a> &gt; 
            <?php endif; ?>
            <span class="current-area"><?php echo esc_html($term_name); ?></span>
        </div>

        <?php /* SECTION 1: 地図と子エリア一覧 */ ?>
        <?php if ( $is_parent_area ): ?>
            <?php 
            $map_url = function_exists( 'escomi_area_parent_map_embed_url' ) ? escomi_area_parent_map_embed_url( $term_slug ) : '';
            if ( $map_url && ! empty( $child_terms ) ) :
            ?>
                <section class="area-map-section u-mb-50">
                    <div class="lux-area-nav lux-area-nav--map-focus">
                        <div class="lux-map-section">
                            <h2 class="lux-heading"><span class="en">MAP SEARCH</span><span class="jp">周辺の位置関係（地図の範囲で目安）</span></h2>
                            <div class="lux-map-frame">
                                <iframe
                                    class="lux-map-iframe"
                                    src="<?php echo esc_url($map_url); ?>"
                                    title="<?php echo esc_attr($term_name); ?>の地図"
                                    loading="lazy"
                                    referrerpolicy="no-referrer-when-downgrade"
                                    allowfullscreen
                                ></iframe>
                            </div>
                        </div>
                    </div>
                </section>
            <?php endif; ?>

            <?php if ( !empty($child_terms) ): ?>
                <section class="child-area-select-section u-mb-50">
                    <h2 class="lux-heading-small">詳細エリアを選択</h2>
                    <div class="es-area-scroll-container sp-only">
                        <p class="scroll-hint">横にスクロールできます ➡</p>
                        <div class="es-area-scroll-wrapper">
                            <div class="es-area-scroll-list">
                                <?php foreach( $child_terms as $child ): ?>
                                    <a href="<?php echo get_term_link($child); ?>" class="es-area-scroll-item">
                                        <span class="es-area-name"><?php echo esc_html($child->name); ?></span>
                                        <span class="es-area-count"><?php echo $child->count; ?>件</span>
                                    </a>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                    <div class="es-area-grid u-pc-only">
                        <?php foreach( $child_terms as $child ): ?>
                            <a href="<?php echo get_term_link($child); ?>" class="es-area-link-item">
                                <span class="es-area-name"><?php echo esc_html($child->name); ?></span>
                                <span class="es-area-count"><?php echo $child->count; ?>件</span>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endif; ?>
        <?php endif; ?>

        <?php /* SECTION 2: ランキング (親エリア連動型) */ ?>
        <?php 
        $ranking_source_id = $is_parent_area ? $term_id : $parent_id;
        $parent_ranking = get_field('area_ranking_pickup', 'term_' . $ranking_source_id);
        $display_ranking = array();

        if ($parent_ranking && is_array($parent_ranking)) {
            foreach ($parent_ranking as $p_post) {
                if ($is_parent_area) {
                    $display_ranking[] = $p_post;
                } else {
                    if (has_term($term_id, 'area', $p_post->ID)) {
                        $display_ranking[] = $p_post;
                    }
                }
            }
        }

        if ( !empty($display_ranking) ) : 
        ?>
            <section class="ranking-section wolfman-style es-ranking-section u-mb-50">
               <h2 class="sec-title es-sec-title-large">
                    <span class="es-sec-title__en">AREA RANKING</span>
                    <span class="main ranking-main-wrapper">
                        <span class="ranking-date-label">
                            【<?php echo date_i18n('Y年n月'); ?>最新】
                        </span>
                        <?php echo esc_html($term_name); ?>の<span class="highlight-gold">おすすめ</span>ランキング
                    </span>
                    <span class="sub">RECOMMENDED SHOPS</span>
                </h2>
                <div class="ranking-list">
                    <?php 
                    $rank_num = 1;
                    foreach( $display_ranking as $post ): 
                        setup_postdata($post); 
                        $rank_class = ($rank_num <= 3) ? 'rank-' . $rank_num : 'rank-other';
                        $access = get_field('shop_address', $post->ID);  
                        $price  = get_field('basic_price', $post->ID);   
                        $hours  = get_field('shop_hours', $post->ID);    
                        $tel    = get_field('shop_tel', $post->ID);      
                        $catch  = get_field('shop_catch', $post->ID);    
                        $rate   = get_field('review_star', $post->ID);
                        $cats   = get_the_terms($post->ID, 'shop_category');
                        $feats  = get_the_terms($post->ID, 'shop_feature');
                    ?>
                        <article class="ranking-item <?php echo $rank_class; ?>">
                            <div class="rank-badge"><span class="num">No.<?php echo $rank_num; ?></span></div>
                            <div class="ranking-main-visual">
                                <?php $r_thumb = get_the_post_thumbnail_url($post->ID, 'large');
                                      echo '<img src="'.esc_url($r_thumb ?: get_theme_file_uri('/assets/img/no-image.png')).'" alt="'.esc_attr($post->post_title).'">'; ?>
                            </div>
                            <div class="ranking-body">
                                <div class="ranking-title-area">
                                    <h3 class="ranking-name"><a href="<?php echo get_permalink($post->ID); ?>"><?php echo esc_html($post->post_title); ?></a></h3>
                                    <?php if($cats && !is_wp_error($cats)): ?><div class="ranking-cats"><?php foreach($cats as $cat) echo '<span>'.esc_html($cat->name).'</span>'; ?></div><?php endif; ?>
                                </div>
                                <div class="ranking-header-row">
                                    <div class="ranking-stars"><span class="star-icon">★★★★☆</span><span class="rate-num"><?php echo esc_html($rate ?: '4.0'); ?></span></div>
                                </div>
                                <dl class="ranking-spec-list">
                                    <div class="spec-row"><dt><i class="icon-pin">📍</i>アクセス</dt><dd><?php echo esc_html($access); ?></dd></div>
                                    <div class="spec-row"><dt><i class="icon-clock">🕒</i>営業時間</dt><dd><?php echo esc_html($hours); ?></dd></div>
                                    <div class="spec-row"><dt><i class="icon-yen">💴</i>料金</dt><dd><?php echo number_format((int)$price); ?>円〜</dd></div>
                                </dl>
                                <h4 class="ranking-catch"><?php echo esc_html($catch); ?></h4>
                                <div class="ranking-actions">
                                    <a href="tel:<?php echo esc_attr(preg_replace('/[^0-9]/', '', $tel)); ?>" class="btn-action btn-tel">電話する</a>
                                    <a href="<?php echo get_permalink($post->ID); ?>" class="btn-action btn-detail">お店の詳細を見る</a>
                                </div>
                            </div>
                        </article>
                    <?php $rank_num++; endforeach; wp_reset_postdata(); ?>
                </div>
            </section>
        <?php endif; ?>

        <?php
        /*
         * ACF（area_characteristics）：エリア専用テンプレ内で一意に出力。
         * get_the_archive_description 経由とは併用しない（二重表示防止）。
         */
        $acf_term_key = 'term_' . $term_id;
        $area_characteristics = get_field( 'area_characteristics', $acf_term_key );
        if ( $area_characteristics ) {
            ?>
            <div class="area-characteristics-box u-mb-50" style="background: linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(26,35,50,0.05) 100%); border-left: 4px solid #d4af37; padding: 24px 28px; border-radius: 8px; line-height: 1.9; color: #e5e5e5;">
                <div class="characteristics-content" style="font-size: 15px;">
                    <?php echo wp_kses_post( $area_characteristics ); ?>
                </div>
            </div>
            <?php
        }
        ?>

        <?php /* SECTION 3: 店舗一覧 */ ?>
        <section class="shop-list-section">
            <h2 class="sec-title es-sec-title-large u-mb-20">
                <span class="es-sec-title__en">SHOP LIST</span>
                <span class="main"><?php echo esc_html($term_name); ?>の店舗一覧</span>
            </h2>
            <?php if ( have_posts() ) : ?>
                <div class="wolfman-list-container">
                    <?php while ( have_posts() ) : the_post(); 
                        $hours  = get_field('shop_hours');
                        $price  = get_field('basic_price');
                        $time   = get_field('basic_time'); 
                        $cats   = get_the_terms(get_the_ID(), 'shop_category');
                        $feats  = get_the_terms(get_the_ID(), 'shop_feature');
                    ?>
                        <article class="shop-list-row">
                            <a href="<?php the_permalink(); ?>" class="shop-row-img">
                                <?php if( has_post_thumbnail() ) { the_post_thumbnail('medium'); } else { echo '<img src="'.get_theme_file_uri('/assets/img/no-image.png').'" alt="No Image">'; } ?>
                            </a>
                            <div class="shop-row-info">
                                <h3 class="shop-row-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
                                <?php if($cats): ?><div class="shop-list-cats"><?php foreach($cats as $cat) echo '<span>'.esc_html($cat->name).'</span>'; ?></div><?php endif; ?>
                                <?php if($feats): ?><div class="shop-row-tags"><?php foreach($feats as $feat) echo '<span class="list-tag tag-gray">'.esc_html($feat->name).'</span>'; ?></div><?php endif; ?>
                            </div>
                            <div class="shop-row-meta">
                                <?php if($hours): ?><div class="meta-box hours"><?php echo esc_html($hours); ?></div><?php endif; ?>
                                <div class="meta-box price-area">
                                    <?php if($time): ?><span class="meta-time"><?php echo esc_html($time); ?>分</span><?php endif; ?>
                                    <span class="meta-price"><?php echo number_format((int)$price); ?><span class="unit">円</span></span>
                                </div>
                            </div>
                        </article>
                    <?php endwhile; ?>
                </div>
                <?php 
                // ページネーション（余分なラッパーなし・最適化版）
                the_posts_pagination(array(
                    'mid_size' => 2,
                    'prev_text' => '« 前へ',
                    'next_text' => '次へ »',
                )); 
                ?>
            <?php else: ?>
                <p class="no-shops-message">現在登録されている店舗はありません。</p>
            <?php endif; ?>
        </section>

        <?php
        $area_column = get_field( 'area_column_content', $acf_term_key );
        if ( $area_column ) {
            ?>
            <div class="area-column-content u-mt-50 u-mb-50">
                <h2 class="sec-title es-sec-title-large"><?php echo esc_html( $term_name ); ?>エリアのメンズエステ情報</h2>
                <div class="area-column-content__body"><?php echo wp_kses_post( $area_column ); ?></div>
            </div>
            <?php
        }

        $faqs_raw = get_field( 'area_faq_content', $acf_term_key );
        $faq_rows = array();
        if ( $faqs_raw && is_array( $faqs_raw ) ) {
            foreach ( $faqs_raw as $faq ) {
                if ( ! is_array( $faq ) ) {
                    continue;
                }
                $q = isset( $faq['question'] ) ? $faq['question'] : '';
                $a = isset( $faq['answer'] ) ? $faq['answer'] : '';
                if ( ! $q || ! $a ) {
                    continue;
                }
                $faq_rows[] = array(
                    'question' => $q,
                    'answer'   => $a,
                );
            }
        }

        if ( ! empty( $faq_rows ) ) {
            ?>
            <div class="area-faq-box u-mt-50 u-mb-50">
                <h2 class="sec-title es-sec-title-large">よくある質問</h2>
                <dl class="area-faq-box__dl">
                    <?php foreach ( $faq_rows as $row ) : ?>
                        <dt><?php echo esc_html( $row['question'] ); ?></dt>
                        <dd><?php echo wp_kses_post( $row['answer'] ); ?></dd>
                    <?php endforeach; ?>
                </dl>
            </div>
            <?php
            $faq_ld = array(
                '@context'   => 'https://schema.org',
                '@type'      => 'FAQPage',
                'mainEntity' => array(),
            );
            foreach ( $faq_rows as $row ) {
                $faq_ld['mainEntity'][] = array(
                    '@type'          => 'Question',
                    'name'           => $row['question'],
                    'acceptedAnswer' => array(
                        '@type' => 'Answer',
                        'text'  => wp_strip_all_tags( $row['answer'] ),
                    ),
                );
            }
            ?>
            <script type="application/ld+json"><?php echo wp_json_encode( $faq_ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ); ?></script>
            <?php
        }
        ?>

        <?php /* SECTION 4: 他エリアへのリンク */ ?>
        <?php 
        if (!$is_parent_area && $parent_term):
            $sibling_terms = get_terms(array('taxonomy' => 'area', 'parent' => $parent_id, 'hide_empty' => false, 'exclude' => array($term_id)));
            if ($sibling_terms && !is_wp_error($sibling_terms) && !empty($sibling_terms)):
        ?>
        <section class="es-sibling-area-section u-mt-50">
            <h2 class="sec-title-simple es-sec-title">
                <span class="es-sec-title__en">OTHER AREAS</span>
                <span class="es-sec-title__ja"><?php echo esc_html($parent_term->name); ?>の他のエリア</span>
            </h2>
            <div class="es-area-grid pc-only">
                <a href="<?php echo esc_url(get_term_link($parent_term)); ?>" class="es-area-link-item es-area-link-all"><span class="es-area-name"><?php echo esc_html($parent_term->name); ?>すべて</span><span class="es-area-count">(<?php echo esc_html($parent_term->count); ?>件)</span></a>
                <?php foreach($sibling_terms as $sibling): ?><a href="<?php echo esc_url(get_term_link($sibling)); ?>" class="es-area-link-item"><span class="es-area-name"><?php echo esc_html($sibling->name); ?></span><span class="es-area-count">(<?php echo esc_html($sibling->count); ?>件)</span></a><?php endforeach; ?>
            </div>
            <div class="es-area-scroll-container sp-only">
                <p class="scroll-hint">横にスクロールできます ➡</p>
                <div class="es-area-scroll-wrapper"><div class="es-area-scroll-list">
                    <a href="<?php echo esc_url(get_term_link($parent_term)); ?>" class="es-area-scroll-item es-area-link-all"><span class="es-area-name">すべて</span><span class="es-area-count"><?php echo esc_html($parent_term->count); ?>件</span></a>
                    <?php foreach($sibling_terms as $sibling): ?><a href="<?php echo esc_url(get_term_link($sibling)); ?>" class="es-area-scroll-item"><span class="es-area-name"><?php echo esc_html($sibling->name); ?></span><span class="es-area-count"><?php echo esc_html($sibling->count); ?>件</span></a><?php endforeach; ?>
                </div></div>
            </div>
        </section>
        <?php endif; endif; ?>
    </div>
</main>
<?php get_footer(); ?>