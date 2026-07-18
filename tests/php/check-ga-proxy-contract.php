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
];
foreach ($required as $needle) {
    if (strpos($source, $needle) === false) {
        fwrite(STDERR, "Missing GA proxy contract marker: {$needle}\n");
        exit(1);
    }
}

echo "GA proxy contract: PASS\n";
