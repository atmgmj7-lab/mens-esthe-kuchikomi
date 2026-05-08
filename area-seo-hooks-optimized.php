<?php
/**
 * =====================================================
 * エリアアーカイブページ SEO最適化版（競合圧倒仕様）
 * =====================================================
 * 
 * SEO構成順序:
 * ① H1・エリア特性・コラム・FAQ・JSON-LD → taxonomy-area.php（エリア専用テンプレで一意に出力）
 * ② 編集部厳選3店舗 → 本ファイル（swell_before_post_list）
 * ③ SWELL標準店舗一覧（網羅性）
 * 
 * フック戦略:
 * - swell_before_post_list: 編集部厳選3店舗
 * （コラム・FAQ は taxonomy-area.php のみ。swell_after_post_list では出さず二重表示を防ぐ）
 */

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
