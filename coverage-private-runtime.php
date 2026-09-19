<?php

declare(strict_types=1);

/** Pure PHP private runtime reader. Optional paths are for internal tests only. */
function escomi_coverage_private_root(?string $wordpressRoot = null): string
{
    $wordpressRoot = $wordpressRoot ?? (defined('ABSPATH') ? ABSPATH : null);
    if (!is_string($wordpressRoot) || $wordpressRoot === '' || $wordpressRoot[0] !== '/') {
        throw new RuntimeException('coverage_private_root_invalid');
    }
    return dirname(rtrim($wordpressRoot, '/')) . '/private/escomi-coverage';
}

function escomi_coverage_private_reject(): void
{
    throw new RuntimeException('coverage_private_invalid');
}

/** PHP 8.0 fallback with the same key-order contract as array_is_list(). */
function escomi_array_is_list_fallback(array $value): bool
{
    $expected = 0;
    foreach ($value as $key => $_) {
        if ($key !== $expected++) { return false; }
    }
    return true;
}

function escomi_array_is_list_compat(array $value): bool
{
    return function_exists('array_is_list')
        ? array_is_list($value)
        : escomi_array_is_list_fallback($value);
}

/** Reject duplicate object keys, including escaped equivalents, at every depth. */
function escomi_coverage_private_unique_keys(string $json): void
{
    preg_match_all('/"(?:[^"\\\\]|\\\\.)*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/s', $json, $matches);
    $tokens = $matches[0];
    $index = 0;
    $walk = function () use (&$walk, &$tokens, &$index): void {
        $token = $tokens[$index++] ?? null;
        if ($token === '{') {
            $seen = [];
            if (($tokens[$index] ?? null) === '}') { $index++; return; }
            do {
                $key = json_decode($tokens[$index++], true, 512, JSON_THROW_ON_ERROR);
                if (isset($seen[$key])) { escomi_coverage_private_reject(); }
                $seen[$key] = true;
                $index++; // colon; JSON grammar already validated by json_decode.
                $walk();
                $separator = $tokens[$index++];
            } while ($separator === ',');
        } elseif ($token === '[') {
            if (($tokens[$index] ?? null) === ']') { $index++; return; }
            do { $walk(); $separator = $tokens[$index++]; } while ($separator === ',');
        }
    };
    $walk();
}

/** Filename is a literal basename; root must never originate in an HTTP request. */
function escomi_coverage_private_read_json(string $root, string $filename, ?string $digest = null): array
{
    if (!preg_match('/\A[A-Za-z0-9_.-]+\.json\z/', $filename) || $root === '' || $root[0] !== '/') {
        escomi_coverage_private_reject();
    }
    clearstatcache();
    $real = realpath($root);
    if ($real === false || $real !== rtrim($root, '/')) { escomi_coverage_private_reject(); }
    // All ancestors must be real directories, never symbolic links.
    for ($dir = $real; ; $dir = dirname($dir)) {
        $st = @lstat($dir);
        if (!$st || ($st['mode'] & 0170000) !== 0040000) { escomi_coverage_private_reject(); }
        if ($dir === '/') { break; }
    }
    if (defined('ABSPATH')) {
        $public = realpath(ABSPATH);
        if (!$public || $real === $public || str_starts_with($real, rtrim($public, '/') . '/')) { escomi_coverage_private_reject(); }
    }
    // The dedicated private parent is part of the production path contract.
    // Explicit fixture roots have no implied parent layout.
    if (basename($real) === 'escomi-coverage') {
        $parent = @lstat(dirname($real));
        if (!$parent || !in_array($parent['mode'] & 07777, [0700, 0500], true)
            || (function_exists('posix_geteuid') && $parent['uid'] !== posix_geteuid())) { escomi_coverage_private_reject(); }
    }
    $directory = @lstat($real);
    if (!$directory || !in_array($directory['mode'] & 07777, [0700, 0500], true)) { escomi_coverage_private_reject(); }
    if (function_exists('posix_geteuid') && $directory['uid'] !== posix_geteuid()) { escomi_coverage_private_reject(); }
    $path = $real . '/' . $filename;
    $before = @lstat($path);
    if (!$before || ($before['mode'] & 0170000) !== 0100000 || !in_array($before['mode'] & 07777, [0600, 0400], true)
        || $before['uid'] !== $directory['uid'] || $before['size'] > 1048576 || $before['nlink'] !== 1) { escomi_coverage_private_reject(); }
    $handle = @fopen($path, 'rb');
    if (!$handle) { escomi_coverage_private_reject(); }
    try {
        $opened = fstat($handle);
        if ($opened !== $before) { escomi_coverage_private_reject(); }
        $bytes = stream_get_contents($handle, 1048577);
        clearstatcache(true, $path);
        $after = @lstat($path);
        $final = fstat($handle);
        // Access time may legitimately change when reading.
        unset($before['atime'], $after['atime'], $final['atime'], $before[8], $after[8], $final[8]);
        if (!is_string($bytes) || strlen($bytes) > 1048576 || strlen($bytes) !== $before['size'] || $before !== $after || $before !== $final) { escomi_coverage_private_reject(); }
        clearstatcache();
        if (realpath($root) !== $real || @lstat($real) !== $directory) { escomi_coverage_private_reject(); }
    } finally { fclose($handle); }
    if ($digest !== null && !hash_equals($digest, hash('sha256', $bytes))) { escomi_coverage_private_reject(); }
    try {
        $object = json_decode($bytes, false, 64, JSON_THROW_ON_ERROR);
        if (!$object instanceof stdClass) { escomi_coverage_private_reject(); }
        escomi_coverage_private_unique_keys($bytes);
        // Preserve empty objects so strict schemas cannot mistake {} for [].
        $convert = function ($value) use (&$convert) {
            if ($value instanceof stdClass) {
                $members = get_object_vars($value);
                if ($members === []) { return $value; }
                return array_map($convert, $members);
            }
            return is_array($value) ? array_map($convert, $value) : $value;
        };
        $converted = $convert($object);
        if (!is_array($converted)) { escomi_coverage_private_reject(); }
        return $converted;
    } catch (JsonException $error) { escomi_coverage_private_reject(); }
}

function escomi_coverage_private_exact_keys(array $value, array $expected): void
{
    $actual = array_keys($value); sort($actual); sort($expected);
    if ($actual !== $expected) { escomi_coverage_private_reject(); }
}

function escomi_coverage_private_contracts(?string $root = null): array
{
    $data = escomi_coverage_private_read_json($root ?? escomi_coverage_private_root(), 'recovery-contracts.json');
    escomi_coverage_private_exact_keys($data, ['version', 'recoveryContracts']);
    if ($data['version'] !== 1 || !is_array($data['recoveryContracts']) || !escomi_array_is_list_compat($data['recoveryContracts']) || count($data['recoveryContracts']) !== 3) { escomi_coverage_private_reject(); }
    $schemas = [
        'retry_ready' => ['update', ['failure_audit_id', 'area_terms', 'provenance_exists']],
        'applied_create_relation' => ['create', ['applied_audit_id', 'required_area_terms', 'allowed_derived_area_terms']],
        'failed_create_provenance' => ['create', ['failure_audit_id', 'failure_audit_post_id', 'title', 'slug', 'area_terms', 'provenance_exists', 'provenance_value', 'failure_code']],
    ];
    $result = [];
    $seenKinds = [];
    foreach ($data['recoveryContracts'] as $record) {
        if (!is_array($record)) { escomi_coverage_private_reject(); }
        escomi_coverage_private_exact_keys($record, ['operation_id', 'contract']);
        $id = $record['operation_id']; $contract = $record['contract'];
        if (!is_string($id) || !preg_match('/\Acoverage-m[0-9]{4}-(update|create)\z/', $id, $operationMatch) || isset($result[$id]) || !is_array($contract)) { escomi_coverage_private_reject(); }
        $kind = $contract['reconcile_kind'] ?? null;
        if (!is_string($kind) || !isset($schemas[$kind]) || isset($seenKinds[$kind]) || $operationMatch[1] !== $schemas[$kind][0]) { escomi_coverage_private_reject(); }
        $seenKinds[$kind] = true;
        escomi_coverage_private_exact_keys($contract, array_merge(['reconcile_kind', 'payload_hash', 'post_id', 'status', 'primary_exists'], $schemas[$kind][1]));
        foreach ($contract as $key => $value) {
            if ($key === 'payload_hash') { if (!is_string($value) || !preg_match('/\A[0-9a-f]{64}\z/', $value)) { escomi_coverage_private_reject(); } }
            elseif ($key === 'status') { if (!in_array($value, ['publish', 'draft'], true)) { escomi_coverage_private_reject(); } }
            elseif (str_ends_with($key, '_exists')) { if (!is_bool($value)) { escomi_coverage_private_reject(); } }
            elseif ($key === 'failure_audit_post_id') { if ($value !== null && (!is_int($value) || $value <= 0)) { escomi_coverage_private_reject(); } }
            elseif (str_ends_with($key, '_id')) { if (!is_int($value) || $value <= 0) { escomi_coverage_private_reject(); } }
            elseif (str_ends_with($key, '_terms')) {
                if (!is_array($value) || !escomi_array_is_list_compat($value) || !$value || count(array_unique($value, SORT_REGULAR)) !== count($value)) { escomi_coverage_private_reject(); }
                foreach ($value as $term) { if (!is_int($term) || $term <= 0) { escomi_coverage_private_reject(); } }
            } elseif ($key === 'provenance_value') { if (!is_array($value) || $value !== []) { escomi_coverage_private_reject(); } }
            elseif (!is_string($value) || $value === '') { escomi_coverage_private_reject(); }
        }
        $result[$id] = $contract;
    }
    return $result;
}

function escomi_coverage_private_manifest_specs(): array
{
    return [
        'coverage-first-2026-08-25' => ['filename' => 'coverage-batch-manifest-2026-08-25.json', 'sha256' => '51b73e57e7f3a9c1863fb5d904d195e0903fe22c9f2b66d9616746db11c0875c'],
        'coverage-wave2-2026-08-28' => ['filename' => 'ESKOMI_COVERAGE_WAVE2_BATCH_MANIFEST_2026-08-28.json', 'sha256' => 'dc6e31917309b4d91a478cc1d4fa1d866b7ef8ca849440b3e88eb9ea86f3a4cd'],
    ];
}

function escomi_coverage_private_manifest(string $batchId, ?string $root = null): array
{
    $files = escomi_coverage_private_manifest_specs();
    if (!isset($files[$batchId])) { escomi_coverage_private_reject(); }
    ['filename' => $filename, 'sha256' => $digest] = $files[$batchId];
    $manifest = escomi_coverage_private_read_json($root ?? escomi_coverage_private_root(), $filename, $digest);
    if (($manifest['batch_id'] ?? null) !== $batchId || ($manifest['schema_version'] ?? null) !== 1) { escomi_coverage_private_reject(); }
    return $manifest;
}
