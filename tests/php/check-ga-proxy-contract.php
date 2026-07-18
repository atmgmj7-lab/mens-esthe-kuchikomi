<?php

$source = file_get_contents(__DIR__ . '/../../dashboard/public/api/ga-proxy.php');

if ($source === false) {
    fwrite(STDERR, "GA proxy source is missing\n");
    exit(1);
}

$forbidden = ['get_mock_data', 'mock_day_count', "'_mock'", 'rand('];
foreach ($forbidden as $needle) {
    if (strpos($source, $needle) !== false) {
        fwrite(STDERR, "Forbidden GA proxy mock marker: {$needle}\n");
        exit(1);
    }
}

$required = [
    "PHP_SAPI === 'cli'",
    "http_response_code(404)",
    "header('Cache-Control: no-store')",
    "header('X-Robots-Tag: noindex, nofollow')",
    "'source' => 'ga4'",
    "'status' => 'unavailable'",
    "'data' => null",
    "'reason' => 'disabled'",
    "ESKOMI_GA_PROXY_LIBRARY_ONLY",
];
foreach ($required as $needle) {
    if (strpos($source, $needle) === false) {
        fwrite(STDERR, "Missing GA proxy contract marker: {$needle}\n");
        exit(1);
    }
}

$forbidden_runtime_markers = [
    'Access-Control-Allow-Origin',
    'run_ga4_proxy',
    'get_access_token',
    'fetch_ga4_data',
    'GA4_CREDENTIALS_PATH',
    'analyticsdata.googleapis.com',
    'oauth2.googleapis.com',
];
foreach ($forbidden_runtime_markers as $needle) {
    if (strpos($source, $needle) !== false) {
        fwrite(STDERR, "Forbidden public GA runtime marker: {$needle}\n");
        exit(1);
    }
}

$document_root = realpath(__DIR__ . '/../../dashboard/public');
if (!is_string($document_root)) {
    fwrite(STDERR, "Dashboard public directory is missing\n");
    exit(1);
}

$socket = stream_socket_server('tcp://127.0.0.1:0', $socket_error_number, $socket_error_message);
if ($socket === false) {
    fwrite(STDERR, "Unable to reserve a PHP test server port\n");
    exit(1);
}
$socket_name = stream_socket_get_name($socket, false);
fclose($socket);
$port = (int) substr(strrchr((string) $socket_name, ':'), 1);
$server_command = [PHP_BINARY, '-S', "127.0.0.1:{$port}", '-t', $document_root];
$server_process = proc_open(
    $server_command,
    [STDIN, ['file', '/dev/null', 'a'], ['file', '/dev/null', 'a']],
    $server_pipes
);
if (!is_resource($server_process)) {
    fwrite(STDERR, "Unable to start PHP test server\n");
    exit(1);
}

$http_response = false;
$http_headers = [];
try {
    $context = stream_context_create(['http' => [
        'ignore_errors' => true,
        'timeout' => 1,
    ]]);
    for ($attempt = 0; $attempt < 30; $attempt++) {
        $http_response_header = [];
        $http_response = @file_get_contents(
            "http://127.0.0.1:{$port}/api/ga-proxy.php?action=totals&days=30",
            false,
            $context
        );
        if ($http_response !== false) {
            $http_headers = $http_response_header;
            break;
        }
        usleep(50_000);
    }
} finally {
    proc_terminate($server_process);
    proc_close($server_process);
}

if ($http_response === false) {
    fwrite(STDERR, "GA proxy HTTP behavior could not be observed\n");
    exit(1);
}

$status_line = $http_headers[0] ?? '';
if (!preg_match('/\s404\s/', $status_line)) {
    fwrite(STDERR, "Public GA runtime must return HTTP 404\nActual: {$status_line}\n");
    exit(1);
}
$normalized_headers = array_map('strtolower', $http_headers);
$joined_headers = implode("\n", $normalized_headers);
if (strpos($joined_headers, 'cache-control: no-store') === false) {
    fwrite(STDERR, "Public GA runtime must return Cache-Control: no-store\n");
    exit(1);
}
if (strpos($joined_headers, 'x-robots-tag: noindex, nofollow') === false) {
    fwrite(STDERR, "Public GA runtime must return X-Robots-Tag: noindex, nofollow\n");
    exit(1);
}
if (strpos($joined_headers, 'access-control-allow-origin:') !== false) {
    fwrite(STDERR, "Public GA runtime must not allow cross-origin access\n");
    exit(1);
}
$runtime_body = json_decode($http_response, true);
assert_same_value(
    [
        'status' => 'unavailable',
        'source' => 'ga4',
        'data' => null,
        'reason' => 'disabled',
    ],
    $runtime_body,
    'Public GA runtime must return only the disabled envelope'
);

define('ESKOMI_GA_PROXY_LIBRARY_ONLY', true);
require __DIR__ . '/../../dashboard/public/api/ga-proxy.php';

function assert_same_value($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, $message . "\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

function assert_runtime_exception(callable $callback, string $message): void
{
    try {
        $callback();
    } catch (RuntimeException $error) {
        return;
    }
    fwrite(STDERR, $message . "\n");
    exit(1);
}

assert_same_value(
    ['pageviews' => 0, 'sessions' => 0, 'bounceRate' => 0.0, 'avgDuration' => 0],
    parse_ga4_response('totals', ['rows' => []]),
    'Empty totals rows must remain a live zero result'
);
assert_same_value([], parse_ga4_response('pages', ['rows' => []]), 'Empty list rows must remain live');
assert_runtime_exception(
    fn() => parse_ga4_response('totals', ['rows' => 'invalid']),
    'A malformed rows container must not be treated as live zero'
);
assert_same_value(
    [['date' => '20260718', 'pageviews' => 0, 'sessions' => 0]],
    parse_ga4_response('daily', [
        'rows' => [[
            'dimensionValues' => [['value' => '20260718']],
            'metricValues' => [['value' => '0'], ['value' => '0']],
        ]],
    ]),
    'Numeric zero strings must be accepted'
);
assert_runtime_exception(
    fn() => parse_ga4_response('daily', [
        'rows' => [[
            'dimensionValues' => [['value' => '20260718']],
            'metricValues' => [['value' => '1']],
        ]],
    ]),
    'Missing required metric must throw'
);
assert_runtime_exception(
    fn() => parse_ga4_response('totals', [
        'rows' => [[
            'metricValues' => [
                ['value' => 'not-a-number'],
                ['value' => '0'],
                ['value' => '0'],
                ['value' => '0'],
            ],
        ]],
    ]),
    'Non-numeric metric must throw'
);
assert_runtime_exception(
    fn() => parse_ga4_response('pages', [
        'rows' => [[
            'dimensionValues' => [['value' => '/shops/example/']],
            'metricValues' => [['value' => '1'], ['value' => '1']],
        ]],
    ]),
    'Missing required dimension must throw'
);

echo "GA proxy contract: PASS\n";
