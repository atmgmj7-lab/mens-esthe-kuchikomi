<?php
/**
 * GA4 Data API プロキシ
 * クエリ: action=daily|totals|pages|creatives & days=7|30|90|all
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
$days   = $_GET['days'] ?? '30';

$configured = defined('GA4_PROPERTY_ID') && defined('GA4_CREDENTIALS_PATH')
    && file_exists(GA4_CREDENTIALS_PATH);

if (!$configured) {
    echo json_encode(get_mock_data($action, $days));
    exit;
}

try {
    $token = get_access_token(GA4_CREDENTIALS_PATH);
    $data  = fetch_ga4_data($action, GA4_PROPERTY_ID, $token, $days);
    echo json_encode($data);
} catch (Exception $e) {
    echo json_encode(get_mock_data($action, $days));
}

function get_date_range(string $days): array
{
    $today = date('Y-m-d');
    if ($days === 'all') {
        return ['startDate' => '2020-01-01', 'endDate' => $today];
    }
    $n = max(1, min(366, (int) $days));
    return [
        'startDate' => date('Y-m-d', strtotime('-' . ($n - 1) . ' days')),
        'endDate'   => $today,
    ];
}

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

function fetch_ga4_data(string $action, string $property, string $token, string $days): array
{
    $url  = "https://analyticsdata.googleapis.com/v1beta/{$property}:runReport";
    $body = build_report_body($action, $days);

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

function build_report_body(string $action, string $days): array
{
    $range = get_date_range($days);

    switch ($action) {
        case 'totals':
            return [
                'dateRanges' => [$range],
                'metrics'    => [
                    ['name' => 'screenPageViews'],
                    ['name' => 'sessions'],
                    ['name' => 'bounceRate'],
                    ['name' => 'averageSessionDuration'],
                ],
            ];
        case 'pages':
            return [
                'dateRanges' => [$range],
                'dimensions' => [['name' => 'pagePath'], ['name' => 'pageTitle']],
                'metrics'    => [['name' => 'screenPageViews'], ['name' => 'sessions']],
                'orderBys'   => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
                'limit'      => 10,
            ];
        case 'creatives':
            return [
                'dateRanges' => [$range],
                'dimensions' => [
                    ['name' => 'sessionManualAdContent'],
                    ['name' => 'sessionCampaignName'],
                ],
                'metrics'    => [
                    ['name' => 'screenPageViews'],
                    ['name' => 'sessions'],
                    ['name' => 'totalUsers'],
                    ['name' => 'bounceRate'],
                    ['name' => 'averageSessionDuration'],
                ],
                'orderBys'   => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
                'limit'      => 20,
            ];
        default:
            return [
                'dateRanges' => [$range],
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
            'sessions'  => (int)($r['metricValues'][1]['value'] ?? 0),
        ], $rows);
    }

    if ($action === 'creatives') {
        return array_map(function ($r) {
            $creative = $r['dimensionValues'][0]['value'] ?? '(not set)';
            $campaign = $r['dimensionValues'][1]['value'] ?? '(not set)';
            if ($creative === '(not set)' || $creative === '') {
                $creative = '(クリエイティブ未設定)';
            }
            return [
                'creative'    => $creative,
                'campaign'    => $campaign,
                'pageviews'   => (int)($r['metricValues'][0]['value'] ?? 0),
                'sessions'    => (int)($r['metricValues'][1]['value'] ?? 0),
                'users'       => (int)($r['metricValues'][2]['value'] ?? 0),
                'bounceRate'  => round((float)($r['metricValues'][3]['value'] ?? 0) * 100, 1),
                'avgDuration' => (int)($r['metricValues'][4]['value'] ?? 0),
            ];
        }, $rows);
    }

    return array_map(fn($r) => [
        'date'      => $r['dimensionValues'][0]['value'] ?? '',
        'pageviews' => (int)($r['metricValues'][0]['value'] ?? 0),
        'sessions'  => (int)($r['metricValues'][1]['value'] ?? 0),
    ], $rows);
}

function mock_day_count(string $days): int
{
    if ($days === 'all') {
        return 90;
    }
    return max(1, min(366, (int) $days));
}

function get_mock_data(string $action, string $days): array
{
    if ($action === 'totals') {
        $daily = get_mock_data('daily', $days);
        $pv = array_sum(array_column($daily, 'pageviews'));
        $ses = array_sum(array_column($daily, 'sessions'));
        return [
            'pageviews'   => $pv,
            'sessions'    => $ses,
            'bounceRate'  => 42.3,
            'avgDuration' => 187,
            '_mock'       => true,
        ];
    }

    if ($action === 'pages') {
        $pages = [
            ['/shop/genie/', 'ジーニー（渋谷）', 3240, 2180],
            ['/shop/relax-men/', 'RELAX MEN（新宿）', 2870, 1920],
            ['/shop/bliss-tokyo/', 'BLISS TOKYO', 2310, 1540],
            ['/area/tokyo/', '東京エリアのメンズエステ', 2100, 1480],
            ['/shop/angel-spa/', 'エンジェルスパ（池袋）', 1890, 1260],
            ['/area/osaka/', '大阪エリアのメンズエステ', 1720, 1150],
            ['/shop/serene-touch/', 'セリーンタッチ（梅田）', 1540, 1030],
            ['/ranking/', '人気ランキング', 1380, 920],
            ['/shop/pure-hands/', 'ピュアハンズ（横浜）', 1260, 840],
            ['/', 'メンズエステ口コミランキング TOP', 1140, 760],
        ];
        return array_map(fn($p) => [
            'path' => $p[0], 'title' => $p[1], 'pageviews' => $p[2], 'sessions' => $p[3],
        ], $pages);
    }

    if ($action === 'creatives') {
        $items = [
            ['バナーA_日本橋', 'Search_関西', 4820, 3210, 2890, 38.4, 204],
            ['テキスト_初回割', 'Search_関西', 3910, 2680, 2410, 41.2, 178],
            ['リスティング_口コミ訴求', 'Search_東京', 3540, 2390, 2150, 44.8, 165],
            ['P-MAX_動画01', 'PMAX_全国', 2980, 2100, 1980, 52.1, 142],
            ['ディスプレイ_300x250', 'Display_リターゲ', 2210, 1540, 1420, 58.6, 118],
            ['バナーB_梅田', 'Search_関西', 1870, 1290, 1180, 46.3, 171],
            ['テキスト_24h営業', 'Search_名古屋', 1620, 1120, 1040, 49.7, 156],
            ['YouTube_15s', 'Video_認知', 1340, 980, 920, 61.2, 95],
        ];
        return array_map(fn($c) => [
            'creative' => $c[0], 'campaign' => $c[1], 'pageviews' => $c[2],
            'sessions' => $c[3], 'users' => $c[4], 'bounceRate' => $c[5], 'avgDuration' => $c[6],
        ], $items);
    }

    $count = mock_day_count($days);
    $data = [];
    $base_pv  = 900;
    $base_ses = 620;
    for ($i = $count - 1; $i >= 0; $i--) {
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
