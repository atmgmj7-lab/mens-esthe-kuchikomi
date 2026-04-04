<?php
/**
 * shop-ai-display.php
 * 【非ロード】AIサマリー表示は functions.php に統合済み（2026-02）
 * このファイルは参照用。functions.php で直接 escomi_get_ai_shop_summary_html 等を定義しています。
 */
return; // 以下は未使用（functions.php が優先）

/** 同一リクエスト内で1回のみ表示（アクションフックとショートコードの重複防止） */
$_escomi_ai_summary_shown = false;

/**
 * AIサマリーのHTMLを生成（共通）
 * @param int $post_id 店舗投稿ID
 * @return string HTML または 空文字
 */
function escomi_get_ai_shop_summary_html($post_id) {
    if (!$post_id || get_post_type($post_id) !== 'shop') {
        return '';
    }

    $shop_ai_summary = '';

    // ai_update_log を優先
    if (function_exists('escomi_get_latest_ai_log_for_shop')) {
        $ai_log = escomi_get_latest_ai_log_for_shop($post_id);
        if ($ai_log && $ai_log->post_status === 'publish') {
            $shop_ai_summary = get_field('log_ai_summary', $ai_log->ID);
            if (empty($shop_ai_summary)) {
                $shop_ai_summary = $ai_log->post_content;
            }
        }
    }

    if (empty($shop_ai_summary)) {
        $shop_ai_summary = get_field('shop_ai_summary', $post_id);
    }

    if (empty(trim((string) $shop_ai_summary))) {
        return '';
    }

    $shop_availability = get_field('shop_availability', $post_id);
    $availability_text = !empty(trim((string) $shop_availability)) ? $shop_availability : '本日すぐご案内可能';

    $html = '<div class="ai-summary-premium-box">';
    $html .= '<span class="ai-summary-premium-box__badge ai-summary-premium-box__badge--pulse">🟢 ' . esc_html($availability_text) . '</span>';
    $html .= '<h3 class="ai-summary-premium-box__title">✨ AIがピックアップ！このお店の魅力</h3>';
    $html .= '<div class="ai-summary-premium-box__content">' . wp_kses_post(nl2br($shop_ai_summary)) . '</div>';
    $html .= '</div>';

    return $html;
}

/**
 * SWELL専用アクションフックでの強制挿入（echo）
 */
function display_ai_shop_summary() {
    global $_escomi_ai_summary_shown;
    if (!is_singular('shop') || $_escomi_ai_summary_shown) {
        return;
    }
    $post_id = get_the_ID();
    $html = escomi_get_ai_shop_summary_html($post_id);
    if ($html) {
        $_escomi_ai_summary_shown = true;
        echo $html;
    }
}

// SWELL専用フック（複数登録でフォールバック）
add_action('swell_before_post_content', 'display_ai_shop_summary', 5);
add_action('swell_post_content_top', 'display_ai_shop_summary', 5);

/**
 * ショートコード [ai_shop_summary]（保険）
 * 使用例: [ai_shop_summary] または [ai_shop_summary id="123"]
 */
function render_ai_shop_summary_shortcode($atts) {
    global $_escomi_ai_summary_shown;
    if ($_escomi_ai_summary_shown) {
        return '';
    }
    $atts = shortcode_atts(array('id' => 0), $atts, 'ai_shop_summary');
    $post_id = (int) $atts['id'];
    if (!$post_id) {
        $post_id = get_the_ID();
    }
    $html = escomi_get_ai_shop_summary_html($post_id);
    if ($html) {
        $_escomi_ai_summary_shown = true;
        // ショートコードが他ページで使われた場合、wp_head は既に通過済みのため
        // インラインでスタイルを付与（1回のみ）
        if (!is_singular('shop') && empty($GLOBALS['_escomi_ai_summary_styles_output'])) {
            $GLOBALS['_escomi_ai_summary_styles_output'] = true;
            $html = escomi_ai_summary_inline_styles() . $html;
        }
    }
    return $html;
}
add_shortcode('ai_shop_summary', 'render_ai_shop_summary_shortcode');

/**
 * AIサマリー用CSSを返す（ショートコード他ページ用のインライン出力）
 */
function escomi_ai_summary_inline_styles() {
    ob_start();
    ?>
<style id="escomi-ai-summary-styles-inline">
.ai-summary-premium-box{position:relative;background:#FDFBF6;border:1px solid #D4C3A3;border-radius:8px;padding:28px 32px 32px;margin-bottom:28px;box-shadow:0 4px 20px rgba(180,160,120,0.15),0 1px 3px rgba(0,0,0,0.05)}
.ai-summary-premium-box__badge{position:absolute;top:16px;right:20px;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#c46b7a 0%,#b85c6b 100%);color:#fff;font-size:.8rem;font-weight:700;letter-spacing:.04em;padding:8px 16px;border-radius:20px;box-shadow:0 2px 8px rgba(184,92,107,0.35)}
.ai-summary-premium-box__badge--pulse{animation:ai-summary-badge-pulse 2s ease-in-out infinite}
@keyframes ai-summary-badge-pulse{0%,100%{box-shadow:0 2px 8px rgba(184,92,107,0.35);opacity:1}50%{box-shadow:0 0 0 6px rgba(184,92,107,0.2);opacity:.95}}
.ai-summary-premium-box__title{font-size:1.1rem;font-weight:700;color:#6B5344;letter-spacing:.05em;margin:0 0 12px 0;padding:0;padding-right:140px;line-height:1.4}
.ai-summary-premium-box__content{font-size:.95rem;line-height:1.8;letter-spacing:.05em;color:#333;padding:4px 0 0}
@media (max-width:767px){.ai-summary-premium-box{padding:24px 20px 20px;margin-bottom:22px}.ai-summary-premium-box__badge{position:static;display:inline-block;margin-bottom:14px;font-size:.75rem;padding:6px 12px}.ai-summary-premium-box__title{font-size:1rem;padding-right:0;margin-bottom:14px}.ai-summary-premium-box__content{font-size:.9rem;line-height:1.8}}
</style>
    <?php
    return ob_get_clean();
}

/**
 * AIサマリーボックスのスタイルを wp_head で直接出力
 * shop ページでは常に出力。ショートコード用に他ページでもフラグがあれば出力
 */
add_action('wp_head', 'escomi_ai_summary_premium_styles', 25);

function escomi_ai_summary_premium_styles() {
    if (!is_singular('shop')) {
        return;
    }
    ?>
<style id="escomi-ai-summary-styles">
/* AIサマリー プレミアムボックス（ベージュ・くすみゴールド系） */
.ai-summary-premium-box {
    position: relative;
    background: #FDFBF6;
    border: 1px solid #D4C3A3;
    border-radius: 8px;
    padding: 28px 32px 32px;
    margin-bottom: 28px;
    box-shadow: 0 4px 20px rgba(180,160,120,0.15), 0 1px 3px rgba(0,0,0,0.05);
}
.ai-summary-premium-box__badge {
    position: absolute;
    top: 16px;
    right: 20px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #c46b7a 0%, #b85c6b 100%);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 8px 16px;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(184,92,107,0.35);
}
.ai-summary-premium-box__badge--pulse {
    animation: ai-summary-badge-pulse 2s ease-in-out infinite;
}
@keyframes ai-summary-badge-pulse {
    0%, 100% {
        box-shadow: 0 2px 8px rgba(184,92,107,0.35);
        opacity: 1;
    }
    50% {
        box-shadow: 0 0 0 6px rgba(184,92,107,0.2);
        opacity: 0.95;
    }
}
.ai-summary-premium-box__title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #6B5344;
    letter-spacing: 0.05em;
    margin: 0 0 12px 0;
    padding: 0;
    padding-right: 140px;
    line-height: 1.4;
}
.ai-summary-premium-box__content {
    font-size: 0.95rem;
    line-height: 1.8;
    letter-spacing: 0.05em;
    color: #333;
    padding: 4px 0 0;
}
@media (max-width: 767px) {
    .ai-summary-premium-box {
        padding: 24px 20px 20px;
        margin-bottom: 22px;
    }
    .ai-summary-premium-box__badge {
        position: static;
        display: inline-block;
        margin-bottom: 14px;
        font-size: 0.75rem;
        padding: 6px 12px;
    }
    .ai-summary-premium-box__title {
        font-size: 1rem;
        padding-right: 0;
        margin-bottom: 14px;
    }
    .ai-summary-premium-box__content {
        font-size: 0.9rem;
        line-height: 1.8;
    }
}
</style>
    <?php
}
