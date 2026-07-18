<?php
/**
 * GA4 response parser library used only by the CLI behavior contract.
 * The former public origin proxy is permanently disabled.
 */

$is_library_contract = PHP_SAPI === 'cli'
    && defined('ESKOMI_GA_PROXY_LIBRARY_ONLY')
    && ESKOMI_GA_PROXY_LIBRARY_ONLY === true;

if (!$is_library_contract) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    http_response_code(404);
    echo json_encode([
        'status' => 'unavailable',
        'source' => 'ga4',
        'data' => null,
        'reason' => 'disabled',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

unset($is_library_contract);

function ga4_rows(array $raw): array
{
    if (!array_key_exists('rows', $raw)) {
        return [];
    }
    if (!is_array($raw['rows'])) {
        throw new RuntimeException('invalid GA4 rows');
    }
    $rows = $raw['rows'];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            throw new RuntimeException('invalid GA4 row');
        }
    }
    return $rows;
}

function ga4_dimension_value(array $row, int $index): string
{
    if (!isset($row['dimensionValues']) || !is_array($row['dimensionValues'])) {
        throw new RuntimeException('missing GA4 dimensions');
    }
    if (!array_key_exists($index, $row['dimensionValues'])) {
        throw new RuntimeException('missing GA4 dimension');
    }
    $entry = $row['dimensionValues'][$index];
    if (!is_array($entry) || !array_key_exists('value', $entry) || !is_string($entry['value'])) {
        throw new RuntimeException('invalid GA4 dimension');
    }
    return $entry['value'];
}

function ga4_metric_value(array $row, int $index): string
{
    if (!isset($row['metricValues']) || !is_array($row['metricValues'])) {
        throw new RuntimeException('missing GA4 metrics');
    }
    if (!array_key_exists($index, $row['metricValues'])) {
        throw new RuntimeException('missing GA4 metric');
    }
    $entry = $row['metricValues'][$index];
    if (!is_array($entry) || !array_key_exists('value', $entry) || !is_string($entry['value'])) {
        throw new RuntimeException('invalid GA4 metric');
    }
    if (!preg_match('/^\d+(?:\.\d+)?$/D', $entry['value'])) {
        throw new RuntimeException('non-numeric GA4 metric');
    }
    return $entry['value'];
}

function ga4_integer_metric(array $row, int $index): int
{
    $value = ga4_metric_value($row, $index);
    if (!preg_match('/^\d+$/D', $value)) {
        throw new RuntimeException('non-integer GA4 metric');
    }
    return (int) $value;
}

function ga4_float_metric(array $row, int $index): float
{
    return (float) ga4_metric_value($row, $index);
}

function parse_ga4_response(string $action, array $raw): array
{
    $rows = ga4_rows($raw);
    if ($action === 'totals') {
        if ($rows === []) {
            return [
                'pageviews' => 0,
                'sessions' => 0,
                'bounceRate' => 0.0,
                'avgDuration' => 0,
            ];
        }
        $row = $rows[0];
        return [
            'pageviews' => ga4_integer_metric($row, 0),
            'sessions' => ga4_integer_metric($row, 1),
            'bounceRate' => round(ga4_float_metric($row, 2) * 100, 1),
            'avgDuration' => (int) ga4_float_metric($row, 3),
        ];
    }
    if ($action === 'pages') {
        return array_map(fn(array $row) => [
            'path' => ga4_dimension_value($row, 0),
            'title' => ga4_dimension_value($row, 1),
            'pageviews' => ga4_integer_metric($row, 0),
            'sessions' => ga4_integer_metric($row, 1),
        ], $rows);
    }
    if ($action === 'creatives') {
        return array_map(function (array $row) {
            $creative = ga4_dimension_value($row, 0);
            $campaign = ga4_dimension_value($row, 1);
            return [
                'creative' => $creative === '(not set)' || $creative === '' ? '(クリエイティブ未設定)' : $creative,
                'campaign' => $campaign,
                'pageviews' => ga4_integer_metric($row, 0),
                'sessions' => ga4_integer_metric($row, 1),
                'users' => ga4_integer_metric($row, 2),
                'bounceRate' => round(ga4_float_metric($row, 3) * 100, 1),
                'avgDuration' => (int) ga4_float_metric($row, 4),
            ];
        }, $rows);
    }
    if ($action === 'cta') {
        return array_map(fn(array $row) => [
            'eventName' => ga4_dimension_value($row, 0),
            'count' => ga4_integer_metric($row, 0),
            'sessions' => ga4_integer_metric($row, 1),
        ], $rows);
    }
    return array_map(fn(array $row) => [
        'date' => ga4_dimension_value($row, 0),
        'pageviews' => ga4_integer_metric($row, 0),
        'sessions' => ga4_integer_metric($row, 1),
    ], $rows);
}
