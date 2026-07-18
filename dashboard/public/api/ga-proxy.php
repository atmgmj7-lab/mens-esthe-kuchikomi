<?php
/**
 * GA4 Data API proxy.
 * Query: action=daily|totals|pages|creatives|cta & days=7|30|90|all
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond_ga4_error(string $reason, int $status): void
{
    http_response_code($status);
    echo json_encode([
        'status' => 'unavailable',
        'source' => 'ga4',
        'data' => null,
        'reason' => $reason,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = $_GET['action'] ?? 'daily';
$days = $_GET['days'] ?? '30';
$allowed_actions = ['daily', 'totals', 'pages', 'creatives', 'cta'];

if (!in_array($action, $allowed_actions, true)) {
    respond_ga4_error('invalid-action', 400);
}

$configured = defined('GA4_PROPERTY_ID') && defined('GA4_CREDENTIALS_PATH')
    && is_string(GA4_PROPERTY_ID) && GA4_PROPERTY_ID !== ''
    && is_string(GA4_CREDENTIALS_PATH) && file_exists(GA4_CREDENTIALS_PATH);

if (!$configured) {
    http_response_code(503);
    echo json_encode([
        'status' => 'unavailable',
        'source' => 'ga4',
        'data' => null,
        'reason' => 'not-configured',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $token = get_access_token(GA4_CREDENTIALS_PATH);
    $data = fetch_ga4_data($action, GA4_PROPERTY_ID, $token, $days);
    echo json_encode([
        'status' => 'live',
        'source' => 'ga4',
        'data' => $data,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    error_log('[Eskomi dashboard] GA4 request failed');
    respond_ga4_error('request-failed', 503);
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
        'endDate' => $today,
    ];
}

function get_access_token(string $credentials_path): string
{
    $contents = file_get_contents($credentials_path);
    $creds = is_string($contents) ? json_decode($contents, true) : null;
    if (!is_array($creds) || empty($creds['client_email']) || empty($creds['private_key'])) {
        throw new RuntimeException('invalid credentials file');
    }
    $now = time();

    $header = rtrim(strtr(base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
    $payload = rtrim(strtr(base64_encode(json_encode([
        'iss' => $creds['client_email'],
        'scope' => 'https://www.googleapis.com/auth/analytics.readonly',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ])), '+/', '-_'), '=');

    $unsigned = "$header.$payload";
    $key = openssl_pkey_get_private($creds['private_key']);
    if ($key === false || !openssl_sign($unsigned, $signature, $key, 'sha256WithRSAEncryption')) {
        throw new RuntimeException('credential signing failed');
    }
    $jwt = $unsigned . '.' . rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]),
        'timeout' => 10,
        'ignore_errors' => true,
    ]]);

    $response = file_get_contents('https://oauth2.googleapis.com/token', false, $context);
    $json = is_string($response) ? json_decode($response, true) : null;
    if (!is_array($json) || empty($json['access_token'])) {
        throw new RuntimeException('token request failed');
    }
    return $json['access_token'];
}

function fetch_ga4_data(string $action, string $property, string $token, string $days): array
{
    $url = "https://analyticsdata.googleapis.com/v1beta/{$property}:runReport";
    $body = build_report_body($action, $days);
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\nAuthorization: Bearer $token",
        'content' => json_encode($body),
        'timeout' => 15,
        'ignore_errors' => true,
    ]]);

    $response = file_get_contents($url, false, $context);
    $json = is_string($response) ? json_decode($response, true) : null;
    if (!is_array($json) || isset($json['error'])) {
        throw new RuntimeException('GA4 API request failed');
    }
    return parse_ga4_response($action, $json);
}

function build_report_body(string $action, string $days): array
{
    $range = get_date_range($days);
    switch ($action) {
        case 'totals':
            return [
                'dateRanges' => [$range],
                'metrics' => [
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
                'metrics' => [['name' => 'screenPageViews'], ['name' => 'sessions']],
                'orderBys' => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
                'limit' => 10,
            ];
        case 'creatives':
            return [
                'dateRanges' => [$range],
                'dimensions' => [
                    ['name' => 'sessionManualAdContent'],
                    ['name' => 'sessionCampaignName'],
                ],
                'metrics' => [
                    ['name' => 'screenPageViews'],
                    ['name' => 'sessions'],
                    ['name' => 'totalUsers'],
                    ['name' => 'bounceRate'],
                    ['name' => 'averageSessionDuration'],
                ],
                'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
                'limit' => 20,
            ];
        case 'cta':
            return [
                'dateRanges' => [$range],
                'dimensions' => [['name' => 'eventName']],
                'metrics' => [['name' => 'eventCount'], ['name' => 'sessions']],
                'orderBys' => [['metric' => ['metricName' => 'eventCount'], 'desc' => true]],
                'limit' => 50,
            ];
        default:
            return [
                'dateRanges' => [$range],
                'dimensions' => [['name' => 'date']],
                'metrics' => [['name' => 'screenPageViews'], ['name' => 'sessions']],
                'orderBys' => [['dimension' => ['dimensionName' => 'date']]],
            ];
    }
}

function parse_ga4_response(string $action, array $raw): array
{
    $rows = isset($raw['rows']) && is_array($raw['rows']) ? $raw['rows'] : [];
    if ($action === 'totals') {
        $values = $rows[0]['metricValues'] ?? [];
        return [
            'pageviews' => (int) ($values[0]['value'] ?? 0),
            'sessions' => (int) ($values[1]['value'] ?? 0),
            'bounceRate' => round((float) ($values[2]['value'] ?? 0) * 100, 1),
            'avgDuration' => (int) ($values[3]['value'] ?? 0),
        ];
    }
    if ($action === 'pages') {
        return array_map(fn($row) => [
            'path' => $row['dimensionValues'][0]['value'] ?? '/',
            'title' => $row['dimensionValues'][1]['value'] ?? '',
            'pageviews' => (int) ($row['metricValues'][0]['value'] ?? 0),
            'sessions' => (int) ($row['metricValues'][1]['value'] ?? 0),
        ], $rows);
    }
    if ($action === 'creatives') {
        return array_map(function ($row) {
            $creative = $row['dimensionValues'][0]['value'] ?? '(not set)';
            $campaign = $row['dimensionValues'][1]['value'] ?? '(not set)';
            return [
                'creative' => $creative === '(not set)' || $creative === '' ? '(クリエイティブ未設定)' : $creative,
                'campaign' => $campaign,
                'pageviews' => (int) ($row['metricValues'][0]['value'] ?? 0),
                'sessions' => (int) ($row['metricValues'][1]['value'] ?? 0),
                'users' => (int) ($row['metricValues'][2]['value'] ?? 0),
                'bounceRate' => round((float) ($row['metricValues'][3]['value'] ?? 0) * 100, 1),
                'avgDuration' => (int) ($row['metricValues'][4]['value'] ?? 0),
            ];
        }, $rows);
    }
    if ($action === 'cta') {
        return array_map(fn($row) => [
            'eventName' => $row['dimensionValues'][0]['value'] ?? '',
            'count' => (int) ($row['metricValues'][0]['value'] ?? 0),
            'sessions' => (int) ($row['metricValues'][1]['value'] ?? 0),
        ], $rows);
    }
    return array_map(fn($row) => [
        'date' => $row['dimensionValues'][0]['value'] ?? '',
        'pageviews' => (int) ($row['metricValues'][0]['value'] ?? 0),
        'sessions' => (int) ($row['metricValues'][1]['value'] ?? 0),
    ], $rows);
}
