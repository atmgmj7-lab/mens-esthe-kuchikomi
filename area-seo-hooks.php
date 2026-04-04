<?php
/**
 * =====================================================
 * エリアアーカイブページ SEO最適化（Ecire流ハイブリッド構成）
 * =====================================================
 * 
 * 構成順序（競合圧倒型）:
 * ① H1 + エリア特性文（LSIキーワード強化）
 * ② 編集部厳選3店舗（権威性・差別化）
 * ③ SWELL標準店舗一覧（網羅性）
 * ④ 地域ガイドコラム + 著者情報（EEAT）
 * ⑤ FAQセクション + JSON-LD（CTR向上）
 * 
 * デザイン: SWELLの既存クラスを活用し、サイトデザインと完全調和
 */

// =====================================================
// ① H1直後：エリア特性文（LSIキーワード強化）
// =====================================================
add_filter('get_the_archive_description', 'escomi_area_characteristics_text');
function escomi_area_characteristics_text($description) {
    if (!is_tax('area')) return $description;

    $current_term = get_queried_object();
    $term_key = 'term_' . $current_term->term_id;
    $characteristics = get_field('area_characteristics', $term_key);

    if ($characteristics) {
        // SWELLのキャプションボックススタイルを活用（c-capbox はSWELL標準クラス）
        return '<div class="area-characteristics-box swell-block-capbox c-capbox u-mb-40" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(212,175,55,0.2); border-radius: 8px; padding: 24px 28px;">
            <div class="capbox_content c-capbox__content" style="color: #ddd; line-height: 1.9; font-size: 15px;">
                ' . wp_kses_post($characteristics) . '
            </div>
        </div>';
    }
    return $description;
}

// =====================================================
// ② 店舗一覧直前：編集部厳選3店舗（権威性・差別化）
// =====================================================
add_action('swell_before_post_list', 'escomi_editorial_picks_section');
function escomi_editorial_picks_section() {
    if (!is_tax('area')) return;

    $current_term = get_queried_object();
    $term_id = $current_term->term_id;
    $term_key = 'term_' . $term_id;
    $term_name = $current_term->name;
    $parent_id = $current_term->parent;

    // 優先: area_editorial_picks（編集部厳選用）
    $picks = get_field('area_editorial_picks', $term_key);

    // フォールバック: area_ranking_shops から上位3つ
    if (!$picks) {
        $ranking_source_key = ($parent_id !== 0) ? 'term_' . $parent_id : $term_key;
        $all_ranking = get_field('area_ranking_shops', $ranking_source_key);
        
        if ($all_ranking && is_array($all_ranking)) {
            // 子エリアの場合：親のリストから現在エリアに属する店舗のみ抽出
            if ($parent_id !== 0) {
                $filtered = array();
                foreach ($all_ranking as $shop) {
                    if (has_term($term_id, 'area', $shop->ID)) {
                        $filtered[] = $shop;
                        if (count($filtered) >= 3) break;
                    }
                }
                $picks = $filtered;
            } else {
                // 親エリアの場合：上位3つ
                $picks = array_slice($all_ranking, 0, 3);
            }
        }
    }

    if (empty($picks)) return;

    // 3店舗に制限
    $picks = array_slice($picks, 0, 3);
    ?>
    <section class="editorial-picks-section u-mb-60" style="background: rgba(212,175,55,0.03); border: 1px solid rgba(212,175,55,0.2); border-radius: 12px; padding: 35px 30px;">
        
        <!-- セクションヘッダー（taxonomy-area の sec-title 構造に合わせる） -->
        <div class="editorial-header u-mb-30" style="text-align: center;">
            <h2 class="sec-title es-sec-title es-sec-title-large" style="margin: 0 0 10px; border: none; padding: 0;">
                <span class="es-sec-title__en">EDITOR'S CHOICE</span>
                <span class="main"><?php echo esc_html($term_name); ?>で<span class="highlight-gold">編集部が厳選</span>した3店舗</span>
            </h2>
            <p class="editorial-subtitle u-mt-10" style="color: #999; font-size: 13px; margin-top: 6px;">
                <?php echo date_i18n('Y年n月'); ?>更新｜実際に取材した信頼できる店舗のみ掲載
            </p>
        </div>

        <!-- 3店舗カード -->
        <div class="editorial-picks-grid" style="display: grid; gap: 20px;">
            <?php 
            $pick_num = 1;
            foreach ($picks as $shop):
                setup_postdata($shop);
                $shop_id = $shop->ID;
                $thumb = get_the_post_thumbnail_url($shop_id, 'large') ?: get_theme_file_uri('/assets/img/no-image.png');
                $address = get_field('shop_address', $shop_id) ?: '詳細はお店ページで確認';
                $price = get_field('basic_price', $shop_id);
                $hours = get_field('shop_hours', $shop_id);
                $tel = get_field('shop_tel', $shop_id);
                $catch = get_field('shop_catch', $shop_id);
                $cats = get_the_terms($shop_id, 'shop_category');
                
                $badge_bg = ($pick_num === 1) ? '#d4af37' : '#6b7280';
            ?>
                <article class="editorial-pick-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; position: relative;">
                    
                    <!-- ランクバッジ -->
                    <div class="pick-rank-badge" style="position: absolute; top: 12px; left: 12px; z-index: 10; background: <?php echo $badge_bg; ?>; color: #fff; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">
                        <?php echo $pick_num; ?>
                    </div>
                    
                    <!-- サムネイル -->
                    <div class="pick-thumbnail" style="position: relative; padding-top: 60%; overflow: hidden;">
                        <img src="<?php echo esc_url($thumb); ?>" 
                             alt="<?php echo esc_attr($shop->post_title); ?>" 
                             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    
                    <!-- カード本体 -->
                    <div class="pick-body" style="padding: 20px;">
                        
                        <!-- カテゴリ -->
                        <?php if ($cats && !is_wp_error($cats)): ?>
                            <div class="pick-cats u-mb-10" style="display: flex; gap: 6px;">
                                <?php foreach (array_slice($cats, 0, 2) as $cat): ?>
                                    <span style="background: rgba(212,175,55,0.15); color: #d4af37; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                        <?php echo esc_html($cat->name); ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                        
                        <!-- 店舗名 -->
                        <h3 class="pick-name" style="font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 10px; line-height: 1.4;">
                            <a href="<?php echo get_permalink($shop_id); ?>" style="color: inherit; text-decoration: none;">
                                <?php echo esc_html($shop->post_title); ?>
                            </a>
                        </h3>
                        
                        <!-- キャッチコピー -->
                        <?php if ($catch): ?>
                            <p class="pick-catch u-mb-15" style="color: #d4af37; font-size: 13px; font-weight: 600; margin: 0 0 14px; line-height: 1.5;">
                                <?php echo esc_html($catch); ?>
                            </p>
                        <?php endif; ?>
                        
                        <!-- 店舗情報 -->
                        <dl class="pick-info-list u-mb-20" style="display: grid; gap: 8px; margin: 0 0 18px; padding: 0; font-size: 12px;">
                            <div style="display: grid; grid-template-columns: 70px 1fr; gap: 8px;">
                                <dt style="color: #888; font-weight: 600;">📍 アクセス</dt>
                                <dd style="color: #ccc; margin: 0;"><?php echo esc_html($address); ?></dd>
                            </div>
                            <?php if ($hours): ?>
                            <div style="display: grid; grid-template-columns: 70px 1fr; gap: 8px;">
                                <dt style="color: #888; font-weight: 600;">🕒 営業時間</dt>
                                <dd style="color: #ccc; margin: 0;"><?php echo esc_html($hours); ?></dd>
                            </div>
                            <?php endif; ?>
                            <?php if ($price): ?>
                            <div style="display: grid; grid-template-columns: 70px 1fr; gap: 8px;">
                                <dt style="color: #888; font-weight: 600;">💴 料金</dt>
                                <dd style="color: #d4af37; font-weight: 700; margin: 0;">
                                    <?php echo number_format((int)$price); ?>円〜
                                </dd>
                            </div>
                            <?php endif; ?>
                        </dl>
                        
                        <!-- アクションボタン -->
                        <div class="pick-actions" style="display: grid; grid-template-columns: <?php echo $tel ? '1fr 1fr' : '1fr'; ?>; gap: 10px;">
                            <?php if ($tel): ?>
                                <a href="tel:<?php echo esc_attr(preg_replace('/[^0-9]/', '', $tel)); ?>" 
                                   class="btn-tel" 
                                   style="display: flex; align-items: center; justify-content: center; gap: 4px; background: transparent; border: 2px solid #d4af37; color: #d4af37; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 700; text-decoration: none;">
                                    📞 電話
                                </a>
                            <?php endif; ?>
                            <a href="<?php echo get_permalink($shop_id); ?>" 
                               class="btn-detail" 
                               style="display: flex; align-items: center; justify-content: center; gap: 4px; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #1a2332; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 700; text-decoration: none;">
                                詳細を見る →
                            </a>
                        </div>
                    </div>
                </article>
            <?php 
                $pick_num++;
            endforeach;
            wp_reset_postdata();
            ?>
        </div>
        
        <!-- フッター -->
        <div class="editorial-footer u-mt-25" style="text-align: center; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #999; font-size: 13px; margin: 0;">
                ⬇ <?php echo esc_html($term_name); ?>の全店舗を網羅的に見る
            </p>
        </div>
    </section>
    <?php
}

// =====================================================
// ③ 店舗一覧直後：地域ガイドコラム + 著者情報（EEAT）
// =====================================================
add_action('swell_after_post_list', 'escomi_area_column_with_author', 5);
function escomi_area_column_with_author() {
    if (!is_tax('area')) return;

    $current_term = get_queried_object();
    $term_key = 'term_' . $current_term->term_id;
    $term_name = $current_term->name;
    $column_content = get_field('area_column_content', $term_key);

    if (!$column_content) return;
    ?>
    <section class="area-column-section u-mt-60" style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 35px 30px;">
        
        <!-- セクションヘッダー（sec-title 構造でSWELLデザインに統一） -->
        <div class="column-header u-mb-25" style="border-bottom: 2px solid rgba(212,175,55,0.3); padding-bottom: 14px;">
            <h2 class="sec-title es-sec-title" style="margin: 0; font-size: 22px; border: none; padding: 0;">
                <span class="es-sec-title__en">AREA GUIDE</span>
                <span class="es-sec-title__ja"><?php echo esc_html($term_name); ?>エリアのメンズエステ完全ガイド</span>
            </h2>
            <p class="column-subtitle" style="color: #999; font-size: 12px; margin-top: 6px;">
                地域特性・アクセス・料金相場など、利用前に知っておきたい情報
            </p>
        </div>

        <!-- コンテンツ本体 -->
        <div class="column-content is-style-indent" style="color: #ddd; line-height: 1.9; font-size: 15px;">
            <?php echo wp_kses_post($column_content); ?>
        </div>

        <!-- 著者情報（EEAT強化） -->
        <div class="author-info-box u-mt-30" style="background: rgba(212,175,55,0.08); border-left: 4px solid #d4af37; padding: 16px 20px; border-radius: 6px;">
            <div class="author-label" style="font-size: 11px; color: #d4af37; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px;">
                ✍️ この記事を書いた人
            </div>
            <div class="author-text" style="font-size: 13px; color: #ccc; line-height: 1.7;">
                <p style="margin: 0; font-weight: 600; color: #fff;">Escomi編集部</p>
                <p style="margin: 4px 0 0; font-size: 12px;">メンズエステ業界歴5年以上のライター陣が、実際に店舗を取材・体験して執筆しています。</p>
            </div>
        </div>
    </section>
    <?php
}

// =====================================================
// ④ FAQセクション + JSON-LD構造化データ（CTR向上）
// =====================================================
add_action('swell_after_post_list', 'escomi_area_faq_with_schema', 10);
function escomi_area_faq_with_schema() {
    if (!is_tax('area')) return;

    $current_term = get_queried_object();
    $term_key = 'term_' . $current_term->term_id;
    $term_name = $current_term->name;
    $faq_content = get_field('area_faq_content', $term_key);

    if (!$faq_content || !is_array($faq_content)) return;

    // JSON-LD構造化データ準備
    $faq_schema = array(
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array()
    );
    ?>
    <section class="area-faq-section u-mt-60" style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 35px 30px;">
        
        <!-- セクションヘッダー（sec-title 構造でSWELLデザインに統一） -->
        <div class="faq-header u-mb-25" style="text-align: center;">
            <h2 class="sec-title es-sec-title" style="margin: 0; font-size: 22px; border: none; padding: 0;">
                <span class="es-sec-title__en">FAQ</span>
                <span class="es-sec-title__ja"><?php echo esc_html($term_name); ?>のメンズエステに関するよくある質問</span>
            </h2>
        </div>

        <!-- FAQ一覧 -->
        <div class="p-faqList" style="max-width: 900px; margin: 0 auto;">
            <?php 
            foreach ($faq_content as $index => $faq):
                $question = isset($faq['question']) ? $faq['question'] : '';
                $answer = isset($faq['answer']) ? $faq['answer'] : '';
                
                if (!$question || !$answer) continue;
                
                // JSON-LDにデータ追加
                $faq_schema['mainEntity'][] = array(
                    '@type' => 'Question',
                    'name' => $question,
                    'acceptedAnswer' => array(
                        '@type' => 'Answer',
                        'text' => strip_tags($answer)
                    )
                );
                
                $faq_id = 'faq-' . $current_term->term_id . '-' . $index;
            ?>
                <div class="faq-item u-mb-15" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden;">
                    <button class="faq-question" 
                            aria-expanded="false" 
                            aria-controls="<?php echo esc_attr($faq_id); ?>" 
                            style="width: 100%; background: none; border: none; padding: 18px 22px; display: flex; align-items: center; gap: 12px; cursor: pointer; text-align: left;">
                        <span class="faq-q-icon" style="flex-shrink: 0; width: 32px; height: 32px; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">Q</span>
                        <span class="faq-q-text" style="flex: 1; font-size: 15px; font-weight: 600; color: #fff; line-height: 1.6;">
                            <?php echo esc_html($question); ?>
                        </span>
                        <span class="faq-toggle-icon" style="flex-shrink: 0; color: #d4af37; font-size: 12px; transition: transform 0.3s ease;">▼</span>
                    </button>
                    <div id="<?php echo esc_attr($faq_id); ?>" 
                         class="faq-answer" 
                         style="display: none; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.1); padding: 18px 22px;">
                        <div style="display: flex; gap: 12px;">
                            <span class="faq-a-icon" style="flex-shrink: 0; width: 32px; height: 32px; background: rgba(212,175,55,0.2); color: #d4af37; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">A</span>
                            <div class="faq-a-text" style="flex: 1; color: #ccc; line-height: 1.8; font-size: 14px;">
                                <?php echo wp_kses_post($answer); ?>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- JSON-LD構造化データ出力 -->
    <?php if (!empty($faq_schema['mainEntity'])): ?>
    <script type="application/ld+json">
    <?php echo wp_json_encode($faq_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>
    </script>
    <?php endif; ?>

    <!-- FAQアコーディオンJS -->
    <script>
    (function() {
        'use strict';
        document.addEventListener('DOMContentLoaded', function() {
            const faqQuestions = document.querySelectorAll('.faq-question');
            faqQuestions.forEach(function(button) {
                button.addEventListener('click', function() {
                    const isExpanded = this.getAttribute('aria-expanded') === 'true';
                    const answerId = this.getAttribute('aria-controls');
                    const answer = document.getElementById(answerId);
                    const toggleIcon = this.querySelector('.faq-toggle-icon');
                    
                    if (!answer) return;
                    
                    if (isExpanded) {
                        this.setAttribute('aria-expanded', 'false');
                        answer.style.display = 'none';
                        if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
                    } else {
                        this.setAttribute('aria-expanded', 'true');
                        answer.style.display = 'block';
                        if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
                    }
                });
            });
        });
    })();
    </script>
    <?php
}

// =====================================================
// エリアページ専用CSS（インライン出力でキャッシュ回避）
// =====================================================
add_action('wp_head', 'escomi_area_inline_styles', 9999);
function escomi_area_inline_styles() {
    if (!is_tax('area')) return;
    ?>
    <style id="escomi-area-pagination-fix">
    /* =====================================================
       ページネーション横並び修正（display: flex完全版）
       キャッシュ回避のためインライン出力
       ===================================================== */
    
    /* nav-links を display: flex で横並びに */
    .l-main_content .l-main_content__inner .navigation.pagination .nav-links,
    .l-article .l-main_content__inner .navigation.pagination .nav-links {
        display: flex !important;
        flex-direction: row !important;
        justify-content: center !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        padding: 0 !important;
        margin: 0 !important;
        list-style: none !important;
    }
    
    /* page-numbers を横並びのボタンに */
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers,
    .l-article .l-main_content__inner .navigation.pagination .page-numbers {
        flex: 0 0 auto !important;
        display: inline-block !important;
        min-width: 44px !important;
        width: auto !important;
        max-width: 80px !important;
        height: 44px !important;
        padding: 0 14px !important;
        margin: 0 !important;
        background: rgba(255, 255, 255, 0.05) !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        border-radius: 6px !important;
        color: #ddd !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        text-align: center !important;
        line-height: 44px !important;
        text-decoration: none !important;
        transition: all 0.2s ease !important;
        box-sizing: border-box !important;
        float: none !important;
        clear: none !important;
    }
    
    /* ホバー時 */
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers:hover {
        background: rgba(212, 175, 55, 0.15) !important;
        border-color: #d4af37 !important;
        color: #d4af37 !important;
        transform: translateY(-2px) !important;
    }
    
    /* 現在のページ */
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers.current {
        background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%) !important;
        border-color: #d4af37 !important;
        color: #1a2332 !important;
        font-weight: 700 !important;
    }
    
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers.current:hover {
        transform: none !important;
    }
    
    /* 前へ・次へボタン */
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers.prev,
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers.next {
        background: rgba(212, 175, 55, 0.1) !important;
        border-color: rgba(212, 175, 55, 0.3) !important;
        color: #d4af37 !important;
    }
    
    /* ドット */
    .l-main_content .l-main_content__inner .navigation.pagination .page-numbers.dots {
        background: transparent !important;
        border: none !important;
        color: #666 !important;
    }
    
    /* レスポンシブ */
    @media (max-width: 767px) {
        .l-main_content .l-main_content__inner .navigation.pagination .nav-links {
            gap: 8px !important;
        }
        
        .l-main_content .l-main_content__inner .navigation.pagination .page-numbers {
            min-width: 40px !important;
            height: 40px !important;
            line-height: 40px !important;
            font-size: 14px !important;
        }
    }
    
    /* 編集部厳選3店舗：PC 3カラム、SP 1カラム */
    @media (min-width: 768px) {
        .editorial-picks-grid {
            grid-template-columns: repeat(3, 1fr) !important;
        }
    }
    @media (max-width: 767px) {
        .editorial-picks-section,
        .area-column-section,
        .area-faq-section {
            padding: 25px 20px !important;
        }
        .sec-title.es-sec-title,
        .sec-title.es-sec-title-large {
            font-size: 20px !important;
        }
        .pick-actions {
            grid-template-columns: 1fr !important;
        }
    }
    
    /* コラム内の見出しスタイル */
    .area-column-section h3,
    .area-column-section h4 {
        color: #fff;
        font-weight: 700;
        margin-top: 28px;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 2px solid rgba(212,175,55,0.3);
    }
    .area-column-section h3 {
        font-size: 18px;
    }
    .area-column-section h4 {
        font-size: 16px;
    }
    .area-column-section ul,
    .area-column-section ol {
        margin: 1em 0 1.5em 1.5em;
    }
    .area-column-section li {
        margin-bottom: 0.6em;
    }
    </style>
    <?php
}