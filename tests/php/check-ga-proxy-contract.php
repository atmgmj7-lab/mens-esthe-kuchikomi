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
    "http_response_code(503)",
    "'status' => 'live'",
    "'source' => 'ga4'",
    "'data' => \$data",
    "'status' => 'unavailable'",
    "'data' => null",
    "'reason' => 'not-configured'",
    "ESKOMI_GA_PROXY_LIBRARY_ONLY",
];
foreach ($required as $needle) {
    if (strpos($source, $needle) === false) {
        fwrite(STDERR, "Missing GA proxy contract marker: {$needle}\n");
        exit(1);
    }
}

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
