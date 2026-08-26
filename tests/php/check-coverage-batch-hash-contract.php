<?php

declare(strict_types=1);

if (!class_exists('WP_Error')) {
    final class WP_Error {
        private string $code;
        private string $message;
        private array $data;
        public function __construct(string $code, string $message, array $data = []) {
            $this->code = $code;
            $this->message = $message;
            $this->data = $data;
        }
        public function get_error_code(): string { return $this->code; }
        public function get_error_message(): string { return $this->message; }
        public function get_error_data(): array { return $this->data; }
    }
}
if (!function_exists('is_wp_error')) {
    function is_wp_error($value): bool { return $value instanceof WP_Error; }
}

$root = dirname(__DIR__, 2);
require_once $root . '/coverage-batch-writer.php';

$fixture = json_decode(
    (string) file_get_contents($root . '/tests/fixtures/coverage-batch-hash-golden.json'),
    true,
    512,
    JSON_THROW_ON_ERROR
);

foreach ($fixture['current_hash_cases'] as $case) {
    if (escomi_coverage_current_canonical_json($case['field'], $case['exists'], $case['value']) !== $case['canonical']) {
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

foreach ($fixture['invalid_current_hash_cases'] as $case) {
    $result = escomi_coverage_current_hash($case['field'], $case['exists'], $case['value']);
    if (!is_wp_error($result) || $result->get_error_code() !== 'field_value_invalid') {
        fwrite(STDERR, "Invalid current hash case was accepted: {$case['name']}\n");
        exit(1);
    }
}

foreach ([null, true, 13000, 13.5, ['大阪'], ['city' => '大阪']] as $invalid_text) {
    $result = escomi_coverage_current_hash('shop_address', true, $invalid_text);
    if (!is_wp_error($result) || $result->get_error_code() !== 'field_value_invalid') {
        fwrite(STDERR, "Non-string text field value was accepted\n");
        exit(1);
    }
}

echo "Coverage batch hash contract PASS\n";
