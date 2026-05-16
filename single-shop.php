<?php 
/**
 * Escomi - 店舗詳細ページ (完全版)
 * SWELL子テーマ対応・仕様書v2.0準拠
 */
get_header(); 
?>

<main id="main_content" class="l-mainContent l-article">
    <div class="l-mainContent__inner">

        <?php if (have_posts()) : while (have_posts()) : the_post(); 
            /* ==================================================
               データ取得処理
               ================================================== */
            $post_id = get_the_ID();

            // 1. 基本情報・スペック
            $shop_catch   = get_field('shop_catch');
            $shop_tel     = get_field('shop_tel');
            $shop_hours   = get_field('shop_hours');
            $shop_address = get_field('shop_address');
            $shop_line    = get_field('shop_line');
            $official_url = get_field('official_url');
            $rate         = get_field('review_star');
            $recommend    = get_field('recommend_text');
            $shop_holiday = get_field('shop_holiday') ?: '不定休';
            $shop_booking = get_field('shop_booking') ?: '完全予約制';
            $shop_parking = get_field('shop_parking') ?: 'なし';

            // 2. 料金データ（絶対にエラーが起きない強制数値化：カンマ・円・空文字を除去）
            $raw_basic = get_field('basic_price');
            $basic_price = floatval(preg_replace('/[^0-9.]/', '', (string)($raw_basic ?? '')));

            $raw_90  = get_field('price_90');
            $raw_120 = get_field('price_120');
            $raw_150 = get_field('price_150');

            $p90  = floatval(preg_replace('/[^0-9.]/', '', (string)($raw_90 ?? '')));
            $p120 = floatval(preg_replace('/[^0-9.]/', '', (string)($raw_120 ?? '')));
            $p150 = floatval(preg_replace('/[^0-9.]/', '', (string)($raw_150 ?? '')));

            $price_90  = ($p90 > 0)  ? (int)$p90  : (int)round($basic_price);
            $price_120 = ($p120 > 0) ? (int)$p120 : (int)round($basic_price * 1.3);
            $price_150 = ($p150 > 0) ? (int)$p150 : (int)round($basic_price * 1.6);

            $price_textarea = get_field('price_textarea');

            // 3. エリア情報の取得（親・子判定）
            $current_term_id = 0;   // 小エリアID
            $current_term_name = '';
            $parent_term_id = 0;    // 親エリアID
            $parent_term_obj = null;

            $terms = get_the_terms($post_id, 'area');
            if ($terms && !is_wp_error($terms)) {
                foreach($terms as $term) {
                    if($term->parent != 0) { 
                        // 子エリアを発見
                        $current_term_id = $term->term_id;
                        $current_term_name = $term->name;
                        $parent_term_id = $term->parent; 
                        $parent_term_obj = get_term($parent_term_id, 'area');
                        break; 
                    }
                }
                // 子エリアがない場合（大阪のみ属している場合など）のフォールバック
                if (!$current_term_id && !empty($terms)) {
                    $current_term_id = $terms[0]->term_id;
                    $current_term_name = $terms[0]->name;
                    if ($terms[0]->parent == 0) {
                        $parent_term_id = $terms[0]->term_id;
                        $parent_term_obj = $terms[0];
                    }
                }
            }

            // 4. エリア平均料金の取得（60分: area_average_60min を優先、なければ term の area_avg_60）
            $target_area_id = $current_term_id;
            $shop_price_60min = get_field('shop_price_60min', $post_id) ?: get_post_meta($post_id, 'shop_price_60min', true);
            $area_average_60min = get_field('area_average_60min', $post_id) ?: get_post_meta($post_id, 'area_average_60min', true);
            if (!$area_average_60min && $target_area_id) {
                $area_average_60min = get_field('area_avg_60', 'term_' . $target_area_id);
            }
            if (!$area_average_60min && $parent_term_id) {
                $area_average_60min = get_field('area_avg_60', 'term_' . $parent_term_id);
            }
            $area_avg_60 = $area_average_60min ? (int)$area_average_60min : 12000; 
            $val_90  = get_field('area_avg_90', 'term_' . $target_area_id);
            $val_120 = get_field('area_avg_120', 'term_' . $target_area_id);
            $val_150 = get_field('area_avg_150', 'term_' . $target_area_id);

            // 親エリアの値をフォールバックとして使用
            if (!$val_90 && $parent_term_id) {
                $val_90  = get_field('area_avg_90', 'term_' . $parent_term_id);
                $val_120 = get_field('area_avg_120', 'term_' . $parent_term_id);
                $val_150 = get_field('area_avg_150', 'term_' . $parent_term_id);
            }

            $avg_90  = $val_90 ? (int)$val_90 : 16000;
            $avg_120 = $val_120 ? (int)$val_120 : 20000;
            $avg_150 = $val_150 ? (int)$val_150 : 24000;

            // 5. 年齢層データ（新ACF: age_18_19〜age_45_plus を優先、なければ旧 age_18〜age_40）
            $age_18_19 = (int)(get_field('age_18_19', $post_id) ?: get_post_meta($post_id, 'age_18_19', true));
            $age_20_24 = (int)(get_field('age_20_24', $post_id) ?: get_post_meta($post_id, 'age_20_24', true));
            $age_25_29 = (int)(get_field('age_25_29', $post_id) ?: get_post_meta($post_id, 'age_25_29', true));
            $age_30_34 = (int)(get_field('age_30_34', $post_id) ?: get_post_meta($post_id, 'age_30_34', true));
            $age_35_39 = (int)(get_field('age_35_39', $post_id) ?: get_post_meta($post_id, 'age_35_39', true));
            $age_40_44 = (int)(get_field('age_40_44', $post_id) ?: get_post_meta($post_id, 'age_40_44', true));
            $age_45_plus = (int)(get_field('age_45_plus', $post_id) ?: get_post_meta($post_id, 'age_45_plus', true));
            $has_new_ages = ($age_18_19 + $age_20_24 + $age_25_29 + $age_30_34 + $age_35_39 + $age_40_44 + $age_45_plus) > 0;
            if ($has_new_ages) {
                $ages = [
                    "18〜19歳" => $age_18_19,
                    "20〜24歳" => $age_20_24,
                    "25〜29歳" => $age_25_29,
                    "30〜34歳" => $age_30_34,
                    "35〜39歳" => $age_35_39,
                    "40〜44歳" => $age_40_44,
                    "45歳〜" => $age_45_plus,
                ];
            } else {
                $ages = [
                    "18〜19歳" => (int)get_field('age_18'),
                    "20〜24歳" => (int)get_field('age_20'),
                    "25〜29歳" => (int)get_field('age_25'),
                    "30〜34歳" => (int)get_field('age_30'),
                    "35〜39歳" => (int)get_field('age_35'),
                    "40〜44歳" => (int)get_field('age_40'),
                ];
            }
            $max_age_count = max($ages) ?: 1;

            $cats = get_the_terms($post_id, 'shop_category');
            $feats = get_the_terms($post_id, 'shop_feature');

            // 6. AI生成情報（完全分離）
            // 上段：shop_ai_summary のみ（月1回の店舗コンセプト）。shop_today_analysis は絶対に使用しない。
            // 下段：shop_today_analysis + shop_today_therapists（escomi_get_today_therapists_html で表示）
            $shop_ai_summary  = get_field('shop_ai_summary', $post_id) ?: get_post_meta($post_id, 'shop_ai_summary', true);
            $shop_latest_news = get_field('shop_latest_news', $post_id);
            if (empty($shop_latest_news)) {
                $shop_latest_news = array();
            }
            if (!is_array($shop_latest_news)) {
                $shop_latest_news = $shop_latest_news ? [['news' => $shop_latest_news]] : [];
            }
            $display_update_date = (function_exists('escomi_get_shop_update_date') ? escomi_get_shop_update_date($post_id) : '')
                ?: get_the_modified_date('Y年n月j日', $post_id);
            $has_ai_content = !empty(trim((string) $shop_ai_summary)) || (!empty($shop_latest_news) && count($shop_latest_news) > 0);
        ?>

            <article class="shop-detail-container">
                <header class="shpc-header-box">
                    <div class="shpc-top-bar"></div>
                    <div class="shpc-header-content">
                        <div class="shpc-header-top-row">
                            <div class="shpc-header-left">
                                <div class="shpc-shop-name-row">
                                    <span class="shpc-badge-open">OPEN</span>
                                    <h1 class="shpc-shop-name"><?php the_title(); ?></h1>
                                </div>
                                <?php if($cats && !is_wp_error($cats)): ?>
                                <div class="shpc-cats">
                                    <?php foreach($cats as $cat) echo '<span>'.esc_html($cat->name).'</span>'; ?>
                                </div>
                                <?php endif; ?>
                            </div>
                            <div class="shpc-header-right">
                                <?php if($official_url): ?>
                                    <a href="<?php echo esc_url($official_url); ?>" class="shpc-link-btn" target="_blank">WEB</a>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="shpc-intro-section">
                    <div class="shpc-intro-image">
                        <?php if(has_post_thumbnail()) { the_post_thumbnail('large'); } else { echo '<img src="'.get_theme_file_uri('/assets/img/no-image.png').'" alt="No Image">'; } ?>
                    </div>
                    <div class="shpc-intro-content">
                        <div class="shpc-stars">
                            <span class="star-icon">★★★★☆</span>
                            <span class="rate-num"><?php echo esc_html($rate ?: '4.0'); ?></span>
                        </div>
                        <div class="shpc-intro-heading"><?php echo esc_html($shop_catch); ?></div>
                        <div class="shpc-intro-text"><?php the_content(); ?></div>
                        <div class="shpc-cta-row">
                            <a href="tel:<?php echo esc_attr(preg_replace('/[^0-9]/', '', $shop_tel)); ?>" class="shpc-btn-tel"><i class="fas fa-phone"></i> 電話予約</a>
                            <?php if($shop_line): ?>
                                <a href="<?php echo esc_url($shop_line); ?>" class="shpc-btn-line" target="_blank"><i class="fab fa-line"></i> LINE予約</a>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <?php if ($has_ai_content): ?>
                <section class="shop-info-section ai-intelligence-view u-mt-40 u-mb-50">
                    <div class="ai-intel-wrapper">
                        <div class="ai-intel-header">
                            <span class="ai-intel-badge">
                                <span class="ai-intel-icon" aria-hidden="true">🖋</span>
                                Escomi編集部 Review
                            </span>
                            <span class="ai-intel-update">更新：<?php echo esc_html($display_update_date); ?></span>
                        </div>
                        <?php if ($shop_ai_summary): ?>
                        <div class="ai-intel-summary">
                            <h3 class="ai-intel-subtitle">
                                <span class="ai-intel-subicon"></span>
                                店舗コンセプト・総評
                            </h3>
                            <div class="ai-intel-summary-content">
                                <?php echo wp_kses_post(nl2br($shop_ai_summary)); ?>
                            </div>
                        </div>
                        <?php endif; ?>
                        <?php 
                        if ($shop_latest_news): 
                            $news_items = is_array($shop_latest_news) ? $shop_latest_news : [['news' => $shop_latest_news]];
                            if (!empty($news_items)):
                        ?>
                        <div class="ai-intel-news">
                            <h3 class="ai-intel-subtitle">
                                <span class="ai-intel-subicon"></span>
                                最新ニュース・動向
                            </h3>
                            <ul class="ai-intel-news-list">
                                <?php foreach ($news_items as $item): 
                                    $news_text = isset($item['news']) ? $item['news'] : (isset($item['news_text']) ? $item['news_text'] : (isset($item['title']) ? $item['title'] : (is_string($item) ? $item : '')));
                                    $news_date = isset($item['date']) ? $item['date'] : (isset($item['news_date']) ? $item['news_date'] : '');
                                    $news_memo = '';
                                    if (is_array($item)) {
                                        foreach (array('memo', 'note', 'status', 'meta', 'label', 'detail') as $memo_key) {
                                            if (!empty($item[$memo_key])) {
                                                $news_memo = is_scalar($item[$memo_key]) ? (string) $item[$memo_key] : '';
                                                break;
                                            }
                                        }
                                    }
                                    if (empty($news_text) && empty($news_date) && $news_memo === '') {
                                        continue;
                                    }
                                ?>
                                <li class="ai-intel-news-item<?php echo $news_memo !== '' ? ' ai-intel-news-item--has-meta' : ''; ?>">
                                    <?php if ($news_date): ?>
                                    <span class="ai-intel-news-date"><?php echo esc_html(is_numeric($news_date) ? date_i18n('Y.m.d', $news_date) : $news_date); ?></span>
                                    <?php endif; ?>
                                    <?php if ($news_text !== ''): ?>
                                    <span class="ai-intel-news-text"><?php echo wp_kses_post(nl2br($news_text)); ?></span>
                                    <?php endif; ?>
                                    <?php if ($news_memo !== ''): ?>
                                    <span class="ai-intel-news-meta"><?php echo esc_html($news_memo); ?></span>
                                    <?php endif; ?>
                                </li>
                                <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; endif; ?>
                        <p class="ai-intel-footer-note">※ Escomi編集部が独自の視点で店舗の魅力を分析しています。</p>
                    </div>
                </section>
                <?php endif; ?>

                <?php 
                $has_therapist = false;
                for($i=1; $i<=3; $i++) { if(get_field('therapist_'.$i.'_name')) $has_therapist = true; }
                
                if($has_therapist): 
                ?>
                <section class="shop-info-section">
                    <h2 class="mod-customColor es-sec-title">
                        <span class="es-sec-title__en">THERAPIST</span>
                        <span class="es-sec-title__ja"><?php the_title(); ?>のおすすめセラピスト</span>
                    </h2>
                    <div class="ts-therapist-box-wrapper">
                        <?php for($i=1; $i<=3; $i++): 
                            $t_name = get_field('therapist_'.$i.'_name');
                            if( ! $t_name ) continue;
                            $t_img_id = get_field('therapist_'.$i.'_img');
                            $t_text   = get_field('therapist_'.$i.'_text');
                            $t_url    = get_field('therapist_'.$i.'_url');
                            $t_img_src = '';
                            if($t_img_id) {
                                $img_arr = wp_get_attachment_image_src($t_img_id, 'medium');
                                $t_img_src = $img_arr ? $img_arr[0] : '';
                            } else {
                                $t_img_src = get_theme_file_uri('/assets/img/no-image.png');
                            }
                        ?>
                        <div class="ts-therapist-box">
                            <span class="ts-ribbon">おすすめ</span>
                            <a href="<?php echo esc_url($t_url ?: '#'); ?>" class="ts-therapist-image-link" <?php if($t_url) echo 'target="_blank"'; ?>>
                                <div class="ts-therapist-image">
                                    <img src="<?php echo esc_url($t_img_src); ?>" alt="<?php echo esc_attr($t_name); ?>">
                                    <div class="ts-therapist-overlay">
                                        <div class="ts-therapist-name"><?php echo esc_html($t_name); ?></div>
                                        <div class="ts-therapist-text"><?php echo mb_strimwidth(strip_tags($t_text), 0, 60, '...'); ?></div>
                                    </div>
                                </div>
                            </a>
                            <a href="<?php echo esc_url($t_url ?: '#'); ?>" class="ts-therapist-link" <?php if($t_url) echo 'target="_blank"'; ?>>出勤情報を見る</a>
                        </div>
                        <?php endfor; ?>
                    </div>
                </section>
                <?php endif; ?>

                <?php 
                $today_box_html = function_exists('escomi_get_today_therapists_html') ? escomi_get_today_therapists_html($post_id) : '';
                if ($today_box_html): 
                ?>
                <section class="shop-info-section u-mt-40 u-mb-50">
                    <h2 class="mod-customColor es-sec-title">
                        <span class="es-sec-title__en">TODAY'S STAFF</span>
                        <span class="es-sec-title__ja">本日の出勤＆空き状況</span>
                    </h2>
                    <?php echo $today_box_html; ?>
                </section>
                <?php endif; ?>

                <section class="shop-info-section">
                    <h2 class="mod-customColor es-sec-title">
                        <span class="es-sec-title__en">AGE RANGE</span>
                        <span class="es-sec-title__ja">在籍セラピスト年齢層</span>
                    </h2>
                    <div class="es-age-graph-container">
                        <?php 
                        $age_index = 0;
                        foreach($ages as $label => $count): 
                            $bar_width = ($max_age_count > 0) ? ($count / $max_age_count) * 100 : 0;
                        ?>
                            <div class="es-age-bar-row">
                                <div class="es-age-label"><?php echo esc_html($label); ?></div>
                                <div class="es-bar-container">
                                    <div class="es-bar es-bar-gold-<?php echo $age_index % 5; ?>" style="width: <?php echo esc_attr($bar_width); ?>%;"></div>
                                </div>
                                <div class="es-bar-count"><?php echo esc_html($count); ?>名</div>
                            </div>
                        <?php 
                            $age_index++;
                        endforeach; 
                        ?>
                    </div>
                </section>

                <section class="shop-info-section">
                    <h2 class="mod-customColor es-sec-title">
                        <span class="es-sec-title__en">PRICE COMPARISON</span>
                        <span class="es-sec-title__ja">エリア平均料金との比較</span>
                    </h2>
                    <div class="es-price-legend">
                        <span class="es-legend-item es-legend-avg"><span class="es-legend-color"></span><?php echo esc_html($current_term_name ?: 'エリア'); ?>平均</span>
                        <span class="es-legend-item es-legend-shop"><span class="es-legend-color"></span>当店</span>
                    </div>
                    <div class="es-price-comparison">
                        <?php
                        $use_60min = !empty($shop_price_60min) && (int)$shop_price_60min > 0;
                        if ($use_60min):
                            $comp_60 = ['min' => 60, 'avg' => $area_avg_60, 'shop' => (int)$shop_price_60min];
                            $max_price = max($comp_60['avg'], $comp_60['shop']);
                            $avg_height = ($max_price > 0) ? ($comp_60['avg'] / $max_price) * 100 : 0;
                            $shop_height = ($max_price > 0) ? ($comp_60['shop'] / $max_price) * 100 : 0;
                            $diff = $comp_60['avg'] - $comp_60['shop'];
                            $diff_class = ($diff > 0) ? 'es-price-cheaper' : (($diff < 0) ? 'es-price-higher' : '');
                        ?>
                        <div class="es-comp-group">
                            <h4 class="es-comp-time">60分</h4>
                            <div class="es-comp-bars">
                                <div class="es-comp-bar es-comp-bar-avg" style="height: <?php echo esc_attr($avg_height); ?>%;"><span class="es-comp-bar-val">¥<?php echo number_format($comp_60['avg']); ?></span></div>
                                <div class="es-comp-bar es-comp-bar-shop" style="height: <?php echo esc_attr($shop_height); ?>%;"><span class="es-comp-bar-val">¥<?php echo number_format($comp_60['shop']); ?></span></div>
                            </div>
                            <?php if($diff != 0): ?>
                            <div class="es-comp-diff <?php echo esc_attr($diff_class); ?>"><?php echo ($diff > 0) ? '−' : '+'; ?>¥<?php echo number_format(abs($diff)); ?></div>
                            <?php endif; ?>
                        </div>
                        <?php else:
                        $compare_times = [
                            ['min' => 90,  'avg' => $avg_90,  'shop' => (int)$price_90],
                            ['min' => 120, 'avg' => $avg_120, 'shop' => (int)$price_120],
                            ['min' => 150, 'avg' => $avg_150, 'shop' => (int)$price_150],
                        ];
                        $max_price = max(array_merge(array_column($compare_times, 'avg'), array_column($compare_times, 'shop')));
                        foreach($compare_times as $comp):
                            if($comp['shop'] <= 0) continue;
                            $avg_height = ($max_price > 0) ? ($comp['avg'] / $max_price) * 100 : 0;
                            $shop_height = ($max_price > 0) ? ($comp['shop'] / $max_price) * 100 : 0;
                            $diff = $comp['avg'] - $comp['shop'];
                            $diff_class = ($diff > 0) ? 'es-price-cheaper' : (($diff < 0) ? 'es-price-higher' : '');
                        ?>
                        <div class="es-comp-group">
                            <h4 class="es-comp-time"><?php echo esc_html($comp['min']); ?>分</h4>
                            <div class="es-comp-bars">
                                <div class="es-comp-bar es-comp-bar-avg" style="height: <?php echo esc_attr($avg_height); ?>%;"><span class="es-comp-bar-val">¥<?php echo number_format($comp['avg']); ?></span></div>
                                <div class="es-comp-bar es-comp-bar-shop" style="height: <?php echo esc_attr($shop_height); ?>%;"><span class="es-comp-bar-val">¥<?php echo number_format($comp['shop']); ?></span></div>
                            </div>
                            <?php if($diff != 0): ?>
                            <div class="es-comp-diff <?php echo esc_attr($diff_class); ?>"><?php echo ($diff > 0) ? '−' : '+'; ?>¥<?php echo number_format(abs($diff)); ?></div>
                            <?php endif; ?>
                        </div>
                        <?php endforeach; endif; ?>
                    </div>
                </section>

                <?php 
        /* ============================================================
           [修正] 基本料金詳細テーブル (入力がある項目のみ表示)
           ============================================================ */
        
        // ▼ 表示したい項目とフィールド名の定義リスト
        $price_list_items = [
            'price_50'         => '50分',
            'price_60'         => '60分',
            'price_70'         => '70分',
            'price_80'         => '80分',
            'price_90'         => '90分',
            'price_100'        => '100分',
            'price_120'        => '120分',
            'price_150'        => '150分',
            'price_180'        => '180分',
            'price_200'        => '200分',
            'price_210'        => '210分',
            'price_extension'  => '延長料金 (30分)',
            'price_nomination' => '指名料金',
        ];

        // データが入っているかチェックするためのフラグ
        $has_price_data = false;
        foreach ($price_list_items as $field => $label) {
            if ( get_field($field) ) {
                $has_price_data = true;
                break;
            }
        }
        ?>

        <?php if ( $has_price_data ) : ?>
        <section class="shop-price-section u-mb-50">
            <h2 class="sec-title-simple shop-sec-title">
                <span class="en">PRICE LIST</span>
                <span class="ja">基本料金詳細</span>
            </h2>

            <div class="shop-detail-price-table-wrap">
                <table class="shop-detail-price-table">
                    <thead>
                        <tr>
                            <th class="col-course">コース・時間</th>
                            <th class="col-price">料金</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $price_list_items as $field_key => $label_text ) : ?>
                            <?php 
                                // 値を取得
                                $price_value = get_field($field_key); 
                            ?>
                            <?php if ( $price_value ) : // 値がある場合のみ行を出力 ?>
                                <tr>
                                    <td class="cell-course"><?php echo esc_html($label_text); ?></td>
                                    <td class="cell-price">
                                        <span class="course-price"><?php echo number_format((int)$price_value); ?></span>
                                        <span class="unit">円</span>
                                    </td>
                                </tr>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>
        <?php endif; ?>
                <?php if($recommend): ?>
                <section class="shop-info-section">
                    <h2 class="mod-customColor es-sec-title"><span class="es-sec-title__en">RECOMMEND</span><span class="es-sec-title__ja">この店舗の推しポイント</span></h2>
                    <div class="recommend-box"><?php echo nl2br(esc_html($recommend)); ?></div>
                </section>
                <?php endif; ?>

                <section class="shop-info-section">
                    <h2 class="mod-customColor es-sec-title"><span class="es-sec-title__en">SHOP INFO</span><span class="es-sec-title__ja">店舗詳細データ</span></h2>
                    <table class="shop-data-table">
                        <?php if($official_url): ?>
                        <tr><th>公式サイト</th><td><a href="<?php echo esc_url($official_url); ?>" target="_blank">公式サイトを見る <i class="fas fa-external-link-alt"></i></a></td></tr>
                        <?php endif; ?>
                        <tr><th>住所</th><td><?php echo esc_html($shop_address); ?></td></tr>
                        <tr><th>電話番号</th><td><a href="tel:<?php echo esc_attr(preg_replace('/[^0-9]/', '', $shop_tel)); ?>"><?php echo esc_html($shop_tel); ?></a></td></tr>
                        <tr><th>営業時間</th><td><?php echo esc_html($shop_hours); ?></td></tr>
                        <tr><th>定休日</th><td><?php echo esc_html($shop_holiday); ?></td></tr>
                        <tr><th>予約</th><td><?php echo esc_html($shop_booking); ?></td></tr>
                        <tr><th>駐車場</th><td><?php echo esc_html($shop_parking); ?></td></tr>
                        <tr><th>こだわり</th>
                            <td>
                                <div class="shop-feat-tags">
                                    <?php if($feats && !is_wp_error($feats)): foreach($feats as $feat) echo '<span>'.esc_html($feat->name).'</span>'; endif; ?>
                                </div>
                            </td>
                        </tr>
                    </table>
                </section>

                <?php 
                $display_ranking = array();
                if ($parent_term_id) {
                    $parent_ranking = get_field('area_ranking_pickup', 'term_' . $parent_term_id);
                    if ($parent_ranking && is_array($parent_ranking)) {
                        foreach ($parent_ranking as $p_post) {
                            if ($current_term_id != $parent_term_id) {
                                if (has_term($current_term_id, 'area', $p_post->ID)) $display_ranking[] = $p_post;
                            } else {
                                $display_ranking[] = $p_post;
                            }
                        }
                    }
                } elseif ($current_term_id) {
                    $ranking_data = get_field('area_ranking_pickup', 'term_' . $current_term_id);
                    if ($ranking_data && is_array($ranking_data)) $display_ranking = $ranking_data;
                }

                if(!empty($display_ranking)):
                ?>
                <section class="ranking-section es-ranking-section u-mt-60">
                    <h2 class="sec-title es-sec-title">
                    <span class="es-sec-title__en">AREA RANKING</span>
                    <span class="main ranking-main-wrapper">
                        <span class="ranking-date-label">
                            【<?php echo date_i18n('Y年n月'); ?>最新】
                        </span>
                        <?php echo esc_html($current_term_name); ?>で<span class="highlight-gold">後悔しない</span>おすすめメンズエステ3選
                    </span>
                </h2>
                    <div class="ranking-list">
                        <?php 
                        $rank_num = 1;
                        foreach($display_ranking as $r_post): 
                            setup_postdata($r_post);
                            if($rank_num > 3) break; 
                            $r_catch  = get_field('shop_catch', $r_post->ID);
                            $r_rate   = get_field('review_star', $r_post->ID);
                            $r_access = get_field('shop_address', $r_post->ID);
                            $r_price  = get_field('basic_price', $r_post->ID);
                        ?>
                        <article class="ranking-item rank-<?php echo $rank_num; ?>">
                            <div class="rank-badge"><span class="crown-icon" aria-hidden="true"></span><span class="num"><?php echo $rank_num; ?>位</span></div>
                            <div class="ranking-body">
                                <h3 class="ranking-name"><a href="<?php echo get_permalink($r_post->ID); ?>"><?php echo esc_html($r_post->post_title); ?></a></h3>
                                <div class="ranking-flex">
                                    <div class="ranking-img">
                                        <a href="<?php echo get_permalink($r_post->ID); ?>">
                                            <?php $r_thumb = get_the_post_thumbnail_url($r_post->ID, 'medium'); ?>
                                            <img src="<?php echo esc_url($r_thumb ?: get_theme_file_uri('/assets/img/no-image.png')); ?>" alt="<?php echo esc_attr($r_post->post_title); ?>">
                                        </a>
                                    </div>
                                    <div class="ranking-info">
                                        <div class="ranking-stars">★★★★☆ <?php echo esc_html($r_rate ?: '4.0'); ?></div>
                                        <p class="ranking-catch"><?php echo esc_html($r_catch); ?></p>
                                        <div class="ranking-meta">
                                            <span>💴 <?php echo number_format((int)$r_price); ?>円〜</span>
                                            <span>📍 <?php echo mb_strimwidth(esc_html($r_access), 0, 30, '...'); ?></span>
                                        </div>
                                        <a href="<?php echo get_permalink($r_post->ID); ?>" class="btn-action btn-detail u-mt-10">詳細を見る</a>
                                    </div>
                                </div>
                            </div>
                        </article>
                        <?php $rank_num++; endforeach; wp_reset_postdata(); ?>
                    </div>
                </section>
                <?php endif; ?>

                <?php 
                $target_parent_id = 0;
                $target_parent_name = '';
                $terms = get_the_terms($post_id, 'area');
                if ($terms && !is_wp_error($terms)) {
                    foreach($terms as $term) {
                        if($term->parent == 0) {
                            $target_parent_id = $term->term_id;
                            $target_parent_name = $term->name;
                            break;
                        } else {
                            $target_parent_id = $term->parent;
                            $parent_obj = get_term($target_parent_id, 'area');
                            $target_parent_name = $parent_obj->name;
                            break;
                        }
                    }
                }
                if($target_parent_id):
                    $child_terms = get_terms(array('taxonomy' => 'area', 'parent' => $target_parent_id, 'hide_empty' => false));
                    if($child_terms && !is_wp_error($child_terms) && !empty($child_terms)):
                ?>
                <section class="area-link-section es-area-link-section u-mt-50">
                    <h2 class="sec-title-simple es-sec-title">
                        <span class="es-sec-title__en">AREA LIST</span>
                        <span class="es-sec-title__ja"><?php echo esc_html($target_parent_name); ?>のエリア一覧</span>
                    </h2>
                    <div class="es-area-grid pc-only">
                        <?php foreach($child_terms as $child): ?>
                            <a href="<?php echo esc_url(get_term_link($child)); ?>" class="es-area-link-item <?php echo ($child->term_id == $current_term_id) ? 'is-current' : ''; ?>">
                                <span class="es-area-name"><?php echo esc_html($child->name); ?></span>
                                <span class="es-area-count">(<?php echo esc_html($child->count); ?>件)</span>
                            </a>
                        <?php endforeach; ?>
                    </div>
                    <div class="es-area-scroll-container sp-only">
                        <p class="scroll-hint">横にスクロールできます ➡</p>
                        <div class="es-area-scroll-wrapper">
                            <div class="es-area-scroll-list">
                                <?php foreach($child_terms as $child): ?>
                                    <a href="<?php echo esc_url(get_term_link($child)); ?>" class="es-area-scroll-item <?php echo ($child->term_id == $current_term_id) ? 'is-current' : ''; ?>">
                                        <span class="es-area-name"><?php echo esc_html($child->name); ?></span>
                                        <span class="es-area-count"><?php echo esc_html($child->count); ?>件</span>
                                    </a>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                </section>
                <?php endif; endif; ?>

            </article>

        <?php endwhile; endif; ?>
    </div>
</main>
<?php get_footer(); ?>