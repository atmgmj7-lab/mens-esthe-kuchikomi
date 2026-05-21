markdown
# Claude Code 修正プロンプト - 店舗詳細表示の完全修正

あなたは WordPress テーマ開発のエキスパートです。以下の修正を全て実行し、店舗詳細ページの AI 更新情報表示を完璧にしてください。

## 背景
- WordPress サイト: https://mens-esthe-kuchikomi.com
- 子テーマ: swell_child
- カスタム投稿タイプ: shop（店舗）
- REST API エンドポイント: /wp-json/escomi/v1/update（AIが本日出勤データをPOST）
- 保存フィールド: shop_today_analysis, shop_availability, shop_today_therapists
- 現在の問題:
  1. Gemini API がモデル未対応で ClientError（gemini-2.5-flash 等が使えない）
  2. today_analysis に JSON 文字列がそのまま保存され、画面に生JSONが表示される
  3. today_therapists が空のとき「確認中」のプレースホルダーしか出ない
  4. availability の表示が不十分


## 修正1: ai_auto_updater.py - Geminiモデル自動選択 + JSON保存防止

ファイル: ai-site-monitor/ai_auto_updater.py

### 1-1. generate_summary_with_gemini() 関数（1箇所目）

【検索】
```python
    models = [
        "models/gemini-2.5-flash",
        "models/gemini-2.0-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.5-flash",
        "models/gemini-flash-latest",
    ]

    for model_name in models:
        try:
            client = genai.Client(api_key=gemini_key)
【置換】

python
    # 利用可能なモデルを動的に取得（APIキーに応じて自動選択）
    try:
        client_temp = genai.Client(api_key=gemini_key)
        available = client_temp.models.list()
        model_names = [m.name for m in available if 'gemini' in m.name and 'flash' in m.name]
        if not model_names:
            model_names = [m.name for m in available if 'gemini' in m.name]
        model_names.sort(reverse=True)
        print(f"    [Gemini] 利用可能モデル: {model_names[:5]}...")
    except Exception:
        model_names = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]

    for model_name in model_names:
        try:
            client = genai.Client(api_key=gemini_key)
1-2. generate_analysis_only_from_therapists() 関数（2箇所目）
【検索】

python
    models = [
        "models/gemini-2.5-flash",
        "models/gemini-2.0-flash",
        "models/gemini-1.5-pro",
        "models/gemini-1.5-flash",
        "models/gemini-flash-latest",
    ]
    for model_name in models:
        try:
            client = genai.Client(api_key=gemini_key)
【置換】

python
    # 利用可能なモデルを動的に取得（APIキーに応じて自動選択）
    try:
        client_temp = genai.Client(api_key=gemini_key)
        available = client_temp.models.list()
        model_names = [m.name for m in available if 'gemini' in m.name and 'flash' in m.name]
        if not model_names:
            model_names = [m.name for m in available if 'gemini' in m.name]
        model_names.sort(reverse=True)
        print(f"    [Gemini] 利用可能モデル: {model_names[:5]}...")
    except Exception:
        model_names = [
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]

    for model_name in model_names:
        try:
            client = genai.Client(api_key=gemini_key)
1-3. _parse_gemini_json() 関数の改善 - 不完全なJSONを修復
【検索】

python
def _parse_gemini_json(raw: str) -> Optional[Dict[str, Any]]:
    """Gemini の応答から全フィールドをパース。失敗時は None"""
    raw = (raw or "").strip()
    if not raw:
        return None

    if "```" in raw:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        raw = m.group(1).strip() if m else raw

    try:
        data = json.loads(raw)
【置換】

python
def _parse_gemini_json(raw: str) -> Optional[Dict[str, Any]]:
    """Gemini の応答から全フィールドをパース。不完全なJSONは修復を試みる。失敗時は None"""
    raw = (raw or "").strip()
    if not raw:
        return None

    # マークダウンのコードブロックを除去
    if "```" in raw:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        raw = m.group(1).strip() if m else raw.replace("```", "").strip()

    # 末尾が不完全なJSONの場合、不足する閉じ括弧を補完
    if raw.endswith(',') or raw.endswith(',\n'):
        raw = raw.rstrip(',\n') + '\n}'

    # 閉じ括弧の数を数えて不足分を補完
    open_braces = raw.count('{')
    close_braces = raw.count('}')
    if open_braces > close_braces:
        raw += '\n' + '}' * (open_braces - close_braces)
    open_brackets = raw.count('[')
    close_brackets = raw.count(']')
    if open_brackets > close_brackets:
        raw = raw.rstrip() + '\n]' * (open_brackets - close_brackets)

    try:
        data = json.loads(raw)
1-4. update_shop_ai_summary() 関数 - JSONガード追加
【検索】

python
    meta = {
        "shop_today_analysis": today_analysis,
        "shop_availability": avail_value,
    }
【置換】

python
    # today_analysis がJSONそのものの場合は中身を抽出（GeminiがJSON全体を返した場合の保険）
    clean_analysis = today_analysis
    if clean_analysis and clean_analysis.strip().startswith('{'):
        try:
            parsed = json.loads(clean_analysis)
            inner = parsed.get('today_analysis', '') or parsed.get('summary', '')
            if inner and inner.strip():
                clean_analysis = inner.strip()
            else:
                clean_analysis = ''
        except Exception:
            pass

    meta = {
        "shop_today_analysis": clean_analysis,
        "shop_availability": avail_value,
    }
修正2: functions.php - 店舗詳細表示を完璧にする
ファイル: swell_child/functions.php

2-1. escomi_get_today_therapists_html() 関数内の analysis 表示部分を修正
【検索】

php
if (!empty(trim((string) $shop_today_analysis))) {
    $html .= '<div class="escomi-today-box__analysis">' . wp_kses_post(nl2br($shop_today_analysis)) . '</div>';
}
【置換】

php
$display_analysis = trim((string) $shop_today_analysis);
if (!empty($display_analysis)) {
    // JSON が直接保存された場合、today_analysis を抽出
    if (strpos($display_analysis, '{') === 0 || strpos($display_analysis, '```') === 0) {
        $display_analysis = preg_replace('/```(?:json)?\s*/', '', $display_analysis);
        $display_analysis = str_replace('```', '', $display_analysis);
        $display_analysis = trim($display_analysis);
        $json_data = json_decode($display_analysis, true);
        if (is_array($json_data)) {
            $extracted = $json_data['today_analysis'] ?? $json_data['summary'] ?? '';
            if (!empty($extracted)) {
                $display_analysis = $extracted;
            } else {
                $display_analysis = '';
            }
        }
    }
    // JSON のままの場合は表示しない
    if (!empty($display_analysis) && strpos($display_analysis, '{') !== 0 && strlen($display_analysis) > 10) {
        $html .= '<div class="escomi-today-box__analysis">' . wp_kses_post(nl2br($display_analysis)) . '</div>';
    }
}
2-2. today_therapists が空のときの表示を改善
【検索】

php
    } else {
        $html .= '<div class="escomi-today-box__placeholder">';
        $html .= '<p class="escomi-today-box__placeholder-text">現在、最新の出勤情報を確認中です。しばらく経ってから再度ご確認ください。</p>';
        $html .= '</div>';
    }
【置換】

php
    } else {
        // analysis があるのに therapists が空の場合、analysis は既に表示済みなので簡易メッセージ
        if (empty(trim((string) $shop_today_analysis))) {
            $html .= '<div class="escomi-today-box__placeholder">';
            $html .= '<p class="escomi-today-box__placeholder-text">現在、最新の出勤情報を確認中です。しばらく経ってから再度ご確認ください。</p>';
            $html .= '</div>';
        }
    }
2-3. availability バッジの表示改善
【検索】

php
    $availability_text = !empty(trim((string) $shop_availability)) ? $shop_availability : '本日すぐご案内可能';
【置換】

php
    $raw_availability = trim((string) $shop_availability);
    // 無効な値（JSON, "なし", 空）の場合はデフォルト表示
    if (empty($raw_availability) || $raw_availability === 'なし' || strpos($raw_availability, '{') === 0) {
        $availability_text = '本日すぐご案内可能';
    } else {
        $availability_text = $raw_availability;
    }
修正3: .htaccess 最終確認
ファイル: swell_child/.htaccess（リポジトリ内にあれば）

apache
SetEnvIf Request_URI ".*" Ngx_Cache_NoCacheMode=off
SetEnvIf Request_URI ".*" Ngx_Cache_AllCacheMode

SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1

# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
確認手順（修正完了後）
全修正を git add / commit / push

deploy.yml でサーバーにデプロイされるのを待つ

GitHub Actions → Daily Shop Update → Run workflow（max_shops 空欄 = 全店舗）

ログで以下を確認:

"[Gemini] 利用可能モデル: ..." が表示されること

"ClientError" が出ないこと

各店舗で today_analysis に自然な日本語テキストが入っていること

"✓ WordPress に保存完了" が多数表示されること

本番サイトで以下を確認:

店舗詳細ページ（/shops/xxx/）で「Today's Analysis」に自然な日本語が表示されること

JSONが生表示されないこと

空き状況バッジが適切に表示されること

出勤キャストがいればキャストカードが表示されること

text

---

このファイルを `CLAUDE_CODE_FIX_PROMPT.md` として保存し、Claude Code に「このファイルの内容を実行して」と指示すればOKです。