<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);
require_once $root . '/coverage-batch-writer.php';

$fixture = json_decode(
    (string) file_get_contents($root . '/tests/fixtures/coverage-batch-hash-golden.json'),
    true,
    512,
    JSON_THROW_ON_ERROR
);

foreach ($fixture['current_hash_cases'] as $case) {
    $value = [
        'field' => $case['field'],
        'exists' => $case['exists'],
        'value' => $case['value'],
    ];
    if (escomi_coverage_canonical_json($value) !== $case['canonical']) {
        throw new RuntimeException('Canonical current value mismatch: ' . $case['name']);
    }
    if (escomi_coverage_current_hash($case['field'], $case['exists'], $case['value']) !== $case['sha256']) {
        throw new RuntimeException('Current hash mismatch: ' . $case['name']);
    }
}

foreach ($fixture['payload_hash_cases'] as $case) {
    if (escomi_coverage_canonical_json($case['payload']) !== $case['canonical']) {
        throw new RuntimeException('Canonical payload mismatch: ' . $case['name']);
    }
    if (escomi_coverage_payload_hash($case['payload']) !== $case['sha256']) {
        throw new RuntimeException('Payload hash mismatch: ' . $case['name']);
    }
}

echo "Coverage batch hash contract PASS\n";
