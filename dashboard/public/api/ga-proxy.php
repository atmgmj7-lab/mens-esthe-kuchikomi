<?php
/**
 * GA4 Data API プロキシ
 * 設定: wp-config.php に以下を追加
 *   define('GA4_PROPERTY_ID', 'properties/XXXXXXXXX');
 *   define('GA4_CREDENTIALS_PATH', '/path/to/service-account.json');
 * 未設定時はモックデータを返す
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = $_GET['action'] ?? 'daily';

// GA4設定確認
$configured = defined('GA4_PROPERTY_ID') && defined('GA4_CREDENTIALS_PATH')
    && file_exists(GA4_CREDENTIALS_PATH);

if (!$configured) {
    echo json_encode(get_mock_data($action));
    exit;
}

try {
    $token = get_access_token(GA4_CREDENTIALS_PATH);
    $data  = fetch_ga4_data($action, GA4_PROPERTY_ID, $token);
    echo json_encode($data);
} catch (Exception $e) {
    // エラー時はモックにフォールバック（本番障害を防ぐ）
    echo json_encode(get_mock_data($action));
}

// ─────────────────────────────────────────────
// GA4 認証（JWT → アクセストークン）
// ─────────────────────────────────────────────
function get_access_token(string $credentials_path): string
{
    $creds = json_decode(file_get_contents($credentials_path), true);
    $now   = time();

    $header  = rtrim(strtr(base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
    $payload = rtrim(strtr(base64_encode(json_encode([
        'iss'   => $creds['client_email'],
        'scope' => 'https://www.googleapis.com/auth/analytics.readonly',
        'aud'   => 'https://oauth2.googleapis.com/token',
        'iat'   => $now,
        'exp'   => $now + 3600,
    ])), '+/', '-_'), '=');

    $unsigned = "$header.$payload";
    $key      = openssl_pkey_get_private($creds['private_key']);
    openssl_sign($unsigned, $sig, $key, 'sha256WithRSAEncryption');
    $jwt = $unsigned . '.' . rtrim(strtr(base64_encode($sig), '+/', '-_'), '=');

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion'  => $jwt,
        ]),
        'timeout' => 10,
    ]]);

    $res = file_get_contents('https://oauth2.googleapis.com/token', false, $ctx);
    if ($res === false) {
        throw new Exception('token request failed');
    }
    $json = json_decode($res, true);
    if (empty($json['access_token'])) {
        throw new Exception('no access_token in response');
    }
    return $json['access_token'];
}

// ─────────────────────────────────────────────
// GA4 Data API v1beta runReport
// ─────────────────────────────────────────────
function fetch_ga4_data(string $action, string $property, string $token): array
{
    $url  = "https://analyticsdata.googleapis.com/v1beta/{$property}:runReport";
    $body = build_report_body($action);

    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\nAuthorization: Bearer $token",
        'content' => json_encode($body),
        'timeout' => 15,
    ]]);

    $res = file_get_contents($url, false, $ctx);
    if ($res === false) {
        throw new Exception('GA4 API request failed');
    }

    return parse_ga4_response($action, json_decode($res, true));
}

function build_report_body(string $action): array
{
    $today = date('Y-m-d');
    $d30   = date('Y-m-d', strtotime('-29 days'));

    switch ($action) {
        case 'totals':
            return [
                'dateRanges' => [['startDate' => $d30, 'endDate' => $today]],
                'metrics'    => [
                    ['name' => 'screenPageViews'],
                    ['name' => 'sessions'],
                    ['name' => 'bounceRate'],
                    ['name' => 'averageSessionDuration'],
                ],
            ];
        case 'pages':
            return [
                'dateRanges' => [['startDate' => $d30, 'endDate' => $today]],
                'dimensions' => [['name' => 'pagePath'], ['name' => 'pageTitle']],
                'metrics'    => [['name' => 'screenPageViews']],
                'orderBys'   => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
                'limit'      => 10,
            ];
        default: // daily
            return [
                'dateRanges' => [['startDate' => $d30, 'endDate' => $today]],
                'dimensions' => [['name' => 'date']],
                'metrics'    => [['name' => 'screenPageViews'], ['name' => 'sessions']],
                'orderBys'   => [['dimension' => ['dimensionName' => 'date']]],
            ];
    }
}

function parse_ga4_response(string $action, array $raw): array
{
    $rows = $raw['rows'] ?? [];

    if ($action === 'totals') {
        $v = $rows[0]['metricValues'] ?? [];
        return [
            'pageviews'   => (int)($v[0]['value'] ?? 0),
            'sessions'    => (int)($v[1]['value'] ?? 0),
            'bounceRate'  => round((float)($v[2]['value'] ?? 0) * 100, 1),
            'avgDuration' => (int)($v[3]['value'] ?? 0),
        ];
    }

    if ($action === 'pages') {
        return array_map(fn($r) => [
            'path'      => $r['dimensionValues'][0]['value'] ?? '/',
            'title'     => $r['dimensionValues'][1]['value'] ?? '',
            'pageviews' => (int)($r['metricValues'][0]['value'] ?? 0),
        ], $rows);
    }

    // daily
    return array_map(fn($r) => [
        'date'      => $r['dimensionValues'][0]['value'] ?? '',
        'pageviews' => (int)($r['metricValues'][0]['value'] ?? 0),
        'sessions'  => (int)($r['metricValues'][1]['value'] ?? 0),
    ], $rows);
}

// ─────────────────────────────────────────────
// モックデータ（GA4未設定時・エラー時）
// ─────────────────────────────────────────────
function get_mock_data(string $action): array
{
    if ($action === 'totals') {
        return [
            'pageviews'   => 28450,
            'sessions'    => 19320,
            'bounceRate'  => 42.3,
            'avgDuration' => 187,
            '_mock'       => true,
        ];
    }

    if ($action === 'pages') {
        $pages = [
            ['/shop/genie/', 'ジーニー（渋谷）', 3240],
            ['/shop/relax-men/', 'RELAX MEN（新宿）', 2870],
            ['/shop/bliss-tokyo/', 'BLISS TOKYO', 2310],
            ['/area/tokyo/', '東京エリアのメンズエステ', 2100],
            ['/shop/angel-spa/', 'エンジェルスパ（池袋）', 1890],
            ['/area/osaka/', '大阪エリアのメンズエステ', 1720],
            ['/shop/serene-touch/', 'セリーンタッチ（梅田）', 1540],
            ['/ranking/', '人気ランキング', 1380],
            ['/shop/pure-hands/', 'ピュアハンズ（横浜）', 1260],
            ['/', 'メンズエステ口コミランキング TOP', 1140],
        ];
        return array_map(fn($p) => [
            'path' => $p[0], 'title' => $p[1], 'pageviews' => $p[2],
        ], $pages);
    }

    // daily: 30日分
    $data = [];
    $base_pv  = 900;
    $base_ses = 620;
    for ($i = 29; $i >= 0; $i--) {
        $noise   = (int)(sin($i * 0.7) * 150 + cos($i * 1.3) * 80);
        $weekend = in_array(date('N', strtotime("-{$i} days")), ['6', '7']) ? 200 : 0;
        $data[]  = [
            'date'      => date('Ymd', strtotime("-{$i} days")),
            'pageviews' => max(200, $base_pv + $noise + $weekend + rand(-50, 50)),
            'sessions'  => max(130, $base_ses + (int)($noise * 0.7) + (int)($weekend * 0.7) + rand(-30, 30)),
        ];
    }
    return $data;
}
