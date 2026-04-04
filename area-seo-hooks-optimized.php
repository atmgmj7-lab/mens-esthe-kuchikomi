<?php
/**
 * =====================================================
 * エリアアーカイブページ SEO最適化版（競合圧倒仕様）
 * =====================================================
 * 
 * SEO構成順序:
 * ① H1（taxonomy-area.php）
 * ② エリア特性（LSIキーワード強化）
 * ③ 編集部厳選3店舗（差別化・権威性）
 * ④ SWELL標準店舗一覧（網羅性）
 * ⑤ 地域密着コラム（専門性・EEAT）
 * ⑥ FAQ構造化データ（CTR向上）
 * 
 * フック戦略:
 * - get_the_archive_description フィルター: エリア特性挿入
 * - swell_before_post_list: 編集部厳選3店舗
 * - swell_after_post_list: 地域コラム + FAQ
 */

// =====================================================
// ① H1直後：エリア特性テキスト（LSIキーワード強化）
// =====================================================
add_filter('get_the_archive_description', 'escomi_area_characteristics', 10);
function escomi_area_characteristics($description) {
    // エリアページ以外は処理しない
    if (!is_tax('area')) return $description;
    
    $current_term = get_queried_object();
    if (!$current_term) return $description;
    
    $term_key = 'term_' . $current_term->term_id;
    $characteristics = get_field('area_characteristics', $term_key);
    
    // ACFフィールドがない場合、デフォルトの説明文を使用
    if (!$characteristics) return $description;
    
    // LSIキーワードを含むエリア特性テキストを挿入
    ob_start();
    ?>
    <div class="area-characteristics-box u-mb-50" style="background: linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(26,35,50,0.05) 100%); border-left: 4px solid #d4af37; padding: 24px 28px; border-radius: 8px; line-height: 1.9; color: #e5e5e5;">
        <div class="characteristics-content" style="font-size: 15px;">
            <?php echo wp_kses_post($characteristics); ?>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

// =====================================================
// ② 店舗一覧直前：編集部厳選3店舗（権威性・差別化）
// =====================================================
add_action('swell_before_post_list', 'escomi_editorial_picks_3shops');
function escomi_editorial_picks_3shops() {
    // エリアページ以外は処理しない
    if (!is_tax('area')) return;
    
    $current_term = get_queried_object();
    if (!$current_term) return;
    
    $term_id = $current_term->term_id;
    $term_key = 'term_' . $term_id;
    $term_name = $current_term->name;
    $parent_id = $current_term->parent;
    $is_child = ($parent_id !== 0);
    
    // データ取得ロジック：
    // 優先度1: area_editorial_picks（新規：編集部厳選用）
    // 優先度2: area_ranking_shops（既存：マスターランキング用）
    $editorial_picks = get_field('area_editorial_picks', $term_key);
    
    if (!$editorial_picks) {
        // フォールバック：既存のマスターランキングから取得
        $ranking_source_key = $is_child ? 'term_' . $parent_id : $term_key;
        $all_ranking = get_field('area_ranking_shops', $ranking_source_key);
        
        if ($all_ranking && is_array($all_ranking)) {
            // 子エリアの場合：親のリストから現在エリアに属する店舗のみ抽出
            if ($is_child) {
                $filtered = array();
                foreach ($all_ranking as $shop) {
                    if (has_term($term_id, 'area', $shop->ID)) {
                        $filtered[] = $shop;
                        if (count($filtered) >= 3) break;
                    }
                }
                $editorial_picks = $filtered;
            } else {
                // 親エリアの場合：上位3つを取得
                $editorial_picks = array_slice($all_ranking, 0, 3);
            }
        }
    }
    
    if (empty($editorial_picks)) return;
    
    // 3店舗に制限（念のため）
    $editorial_picks = array_slice($editorial_picks, 0, 3);
    
    ?>
    <section class="editorial-picks-section u-mb-60" style="background: #0f1320; border: 1px solid rgba(212,175,55,0.2); border-radius: 12px; padding: 40px 30px;">
        <!-- セクションヘッダー：権威性訴求 -->
        <div class="editorial-header u-mb-30" style="text-align: center;">
            <div class="editorial-badge" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #1a2332; padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px;">
                ⭐ EDITOR'S CHOICE
            </div>
            <h2 class="editorial-title" style="font-size: 26px; font-weight: 700; color: #fff; margin: 0; line-height: 1.5;">
                <?php echo esc_html($term_name); ?>で<span style="color: #d4af37;">編集部が厳選</span>した3店舗
            </h2>
            <p class="editorial-subtitle" style="color: #aaa; font-size: 14px; margin-top: 8px; line-height: 1.6;">
                <?php echo date_i18n('Y年n月'); ?>更新｜実際に取材した信頼できる店舗のみ掲載
            </p>
        </div>
        
        <!-- 3店舗カード -->
        <div class="editorial-picks-grid" style="display: grid; gap: 24px;">
            <?php 
            $pick_num = 1;
            foreach ($editorial_picks as $shop):
                setup_postdata($shop);
                
                // データ取得
                $shop_id = $shop->ID;
                $thumb = get_the_post_thumbnail_url($shop_id, 'large') ?: get_theme_file_uri('/assets/img/no-image.png');
                $address = get_field('shop_address', $shop_id) ?: '詳細はお店ページで確認';
                $price = get_field('basic_price', $shop_id);
                $hours = get_field('shop_hours', $shop_id);
                $tel = get_field('shop_tel', $shop_id);
                $catch = get_field('shop_catch', $shop_id) ?: '';
                $cats = get_the_terms($shop_id, 'shop_category');
                
                // バッジカラー（1位ゴールド、2-3位シルバー）
                $badge_bg = ($pick_num === 1) ? 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)' : 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)';
            ?>
                <article class="editorial-pick-card" style="background: #1a2332; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: all 0.3s ease; position: relative;">
                    
                    <!-- ランクバッジ -->
                    <div class="pick-rank-badge" style="position: absolute; top: 16px; left: 16px; z-index: 10; background: <?php echo $badge_bg; ?>; color: #fff; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                        <?php echo $pick_num; ?>
                    </div>
                    
                    <!-- サムネイル -->
                    <div class="pick-thumbnail" style="position: relative; padding-top: 60%; overflow: hidden;">
                        <img src="<?php echo esc_url($thumb); ?>" 
                             alt="<?php echo esc_attr($shop->post_title); ?>" 
                             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    
                    <!-- カード本体 -->
                    <div class="pick-body" style="padding: 24px;">
                        
                        <!-- カテゴリ -->
                        <?php if ($cats && !is_wp_error($cats)): ?>
                            <div class="pick-cats" style="display: flex; gap: 8px; margin-bottom: 12px;">
                                <?php foreach (array_slice($cats, 0, 2) as $cat): ?>
                                    <span style="background: rgba(212,175,55,0.15); color: #d4af37; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                        <?php echo esc_html($cat->name); ?>
                                    </span>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                        
                        <!-- 店舗名 -->
                        <h3 class="pick-name" style="font-size: 20px; font-weight: 700; color: #fff; margin: 0 0 12px; line-height: 1.4;">
                            <a href="<?php echo get_permalink($shop_id); ?>" style="color: inherit; text-decoration: none;">
                                <?php echo esc_html($shop->post_title); ?>
                            </a>
                        </h3>
                        
                        <!-- キャッチコピー -->
                        <?php if ($catch): ?>
                            <p class="pick-catch" style="color: #d4af37; font-size: 14px; font-weight: 600; margin: 0 0 16px; line-height: 1.6;">
                                <?php echo esc_html($catch); ?>
                            </p>
                        <?php endif; ?>
                        
                        <!-- 店舗情報 -->
                        <dl class="pick-info-list" style="display: grid; gap: 10px; margin: 0 0 20px; padding: 0;">
                            <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; font-size: 13px;">
                                <dt style="color: #888; font-weight: 600;">📍 アクセス</dt>
                                <dd style="color: #ccc; margin: 0;"><?php echo esc_html($address); ?></dd>
                            </div>
                            <?php if ($hours): ?>
                            <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; font-size: 13px;">
                                <dt style="color: #888; font-weight: 600;">🕒 営業時間</dt>
                                <dd style="color: #ccc; margin: 0;"><?php echo esc_html($hours); ?></dd>
                            </div>
                            <?php endif; ?>
                            <?php if ($price): ?>
                            <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; font-size: 13px;">
                                <dt style="color: #888; font-weight: 600;">💴 料金</dt>
                                <dd style="color: #d4af37; font-weight: 700; margin: 0;">
                                    <?php echo number_format((int)$price); ?>円〜
                                </dd>
                            </div>
                            <?php endif; ?>
                        </dl>
                        
                        <!-- アクションボタン -->
                        <div class="pick-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <?php if ($tel): ?>
                                <a href="tel:<?php echo esc_attr(preg_replace('/[^0-9]/', '', $tel)); ?>" 
                                   class="btn-tel" 
                                   style="display: flex; align-items: center; justify-content: center; gap: 6px; background: #1a2332; border: 2px solid #d4af37; color: #d4af37; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 700; text-decoration: none; transition: all 0.2s ease;">
                                    📞 電話
                                </a>
                            <?php endif; ?>
                            <a href="<?php echo get_permalink($shop_id); ?>" 
                               class="btn-detail" 
                               style="display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #1a2332; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 700; text-decoration: none; transition: all 0.2s ease;">
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
        
        <!-- フッター：網羅性への導線 -->
        <div class="editorial-footer u-mt-30" style="text-align: center; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #aaa; font-size: 14px; margin: 0; line-height: 1.7;">
                ⬇ <?php echo esc_html($term_name); ?>の全店舗を網羅的に見る
            </p>
        </div>
    </section>
    
    <!-- レスポンシブ対応CSS -->
    <style>
    @media (min-width: 768px) {
        .editorial-picks-grid {
            grid-template-columns: repeat(3, 1fr) !important;
        }
    }
    @media (max-width: 767px) {
        .editorial-picks-section {
            padding: 30px 20px !important;
        }
        .editorial-title {
            font-size: 20px !important;
        }
        .pick-actions {
            grid-template-columns: 1fr !important;
        }
    }
    </style>
    <?php
}

// =====================================================
// ③ 店舗一覧直後：地域密着コラム（EEAT強化）
// =====================================================
add_action('swell_after_post_list', 'escomi_area_column_eeat', 5);
function escomi_area_column_eeat() {
    // エリアページ以外は処理しない
    if (!is_tax('area')) return;
    
    $current_term = get_queried_object();
    if (!$current_term) return;
    
    $term_key = 'term_' . $current_term->term_id;
    $term_name = $current_term->name;
    $column_content = get_field('area_column_content', $term_key);
    
    if (!$column_content) return;
    ?>
    <section class="area-column-eeat u-mt-60 u-mb-60" style="background: #fff; border-radius: 12px; padding: 40px 35px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
        
        <!-- セクションヘッダー：専門性訴求 -->
        <div class="column-header u-mb-30" style="border-bottom: 3px solid #d4af37; padding-bottom: 16px;">
            <div class="column-badge" style="display: inline-block; background: #1a2332; color: #d4af37; padding: 6px 16px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 10px;">
                📝 AREA GUIDE
            </div>
            <h2 class="column-title" style="font-size: 24px; font-weight: 700; color: #1a2332; margin: 0; line-height: 1.5;">
                <?php echo esc_html($term_name); ?>エリアのメンズエステ完全ガイド
            </h2>
            <p class="column-subtitle" style="color: #666; font-size: 13px; margin-top: 8px;">
                地域特性・アクセス・料金相場など、利用前に知っておきたい情報をまとめました
            </p>
        </div>
        
        <!-- コンテンツ本体 -->
        <div class="column-content" style="color: #333; line-height: 1.9; font-size: 15px;">
            <?php echo wp_kses_post($column_content); ?>
        </div>
        
        <!-- 著者情報（EEAT強化） -->
        <div class="column-author u-mt-30" style="background: #f9fafb; border-left: 4px solid #d4af37; padding: 16px 20px; border-radius: 6px; font-size: 13px; color: #555; line-height: 1.7;">
            <strong style="color: #1a2332;">✍️ この記事を書いた人：</strong> Escomi編集部（メンズエステ業界歴5年以上のライター陣が、実際に店舗を取材・体験して執筆しています）
        </div>
    </section>
    
    <style>
    .area-column-eeat h3,
    .area-column-eeat h4 {
        color: #1a2332;
        font-weight: 700;
        margin-top: 32px;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #f0f0f0;
    }
    .area-column-eeat h3 {
        font-size: 20px;
    }
    .area-column-eeat h4 {
        font-size: 17px;
    }
    .area-column-eeat ul,
    .area-column-eeat ol {
        margin: 1.2em 0 1.5em 1.8em;
    }
    .area-column-eeat li {
        margin-bottom: 0.8em;
    }
    .area-column-eeat p {
        margin-bottom: 1.2em;
    }
    @media (max-width: 767px) {
        .area-column-eeat {
            padding: 30px 24px !important;
        }
        .column-title {
            font-size: 20px !important;
        }
    }
    </style>
    <?php
}

// =====================================================
// ④ FAQ構造化データ（CTR向上）
// =====================================================
add_action('swell_after_post_list', 'escomi_area_faq_schema', 10);
function escomi_area_faq_schema() {
    // エリアページ以外は処理しない
    if (!is_tax('area')) return;
    
    $current_term = get_queried_object();
    if (!$current_term) return;
    
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
    <section class="area-faq-schema u-mt-60" style="background: #f9fafb; border-radius: 12px; padding: 40px 35px;">
        
        <!-- セクションヘッダー：CTR訴求 -->
        <div class="faq-header u-mb-30" style="text-align: center;">
            <div class="faq-badge" style="display: inline-block; background: #1a2332; color: #d4af37; padding: 6px 16px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 10px;">
                ❓ FAQ
            </div>
            <h2 class="faq-title" style="font-size: 24px; font-weight: 700; color: #1a2332; margin: 0; line-height: 1.5;">
                <?php echo esc_html($term_name); ?>のメンズエステに関するよくある質問
            </h2>
        </div>
        
        <!-- FAQ一覧 -->
        <div class="faq-list" style="max-width: 900px; margin: 0 auto;">
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
                <div class="faq-item u-mb-16" style="background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <button class="faq-question" 
                            aria-expanded="false" 
                            aria-controls="<?php echo esc_attr($faq_id); ?>" 
                            style="width: 100%; background: none; border: none; padding: 20px 24px; display: flex; align-items: center; gap: 14px; cursor: pointer; text-align: left; transition: background 0.2s ease;">
                        <span class="faq-q-icon" style="flex-shrink: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;">Q</span>
                        <span class="faq-q-text" style="flex: 1; font-size: 16px; font-weight: 600; color: #1a2332; line-height: 1.6;">
                            <?php echo esc_html($question); ?>
                        </span>
                        <span class="faq-toggle-icon" style="flex-shrink: 0; color: #d4af37; font-size: 14px; transition: transform 0.3s ease;">▼</span>
                    </button>
                    <div id="<?php echo esc_attr($faq_id); ?>" 
                         class="faq-answer" 
                         style="display: none; background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 24px; gap: 14px;">
                        <div style="display: flex; gap: 14px;">
                            <span class="faq-a-icon" style="flex-shrink: 0; width: 36px; height: 36px; background: #1a2332; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;">A</span>
                            <div class="faq-a-text" style="flex: 1; color: #333; line-height: 1.8; font-size: 15px;">
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
    <?php echo wp_json_encode($faq_schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT); ?>
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
    
    <style>
    @media (max-width: 767px) {
        .area-faq-schema {
            padding: 30px 20px !important;
        }
        .faq-title {
            font-size: 20px !important;
        }
        .faq-question {
            padding: 16px 18px !important;
        }
        .faq-answer {
            padding: 16px 18px !important;
        }
        .faq-q-icon,
        .faq-a-icon {
            width: 32px !important;
            height: 32px !important;
            font-size: 14px !important;
        }
    }
    </style>
    <?php
}
