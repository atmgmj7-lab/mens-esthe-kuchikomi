<?php

declare(strict_types=1);

const ESKOMI_COVERAGE_LOCK_TTL = 120;
const ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS = 400;
const ESKOMI_COVERAGE_CAPABILITY = 'escomi_execute_coverage_batch';
const ESKOMI_COVERAGE_LOCK_PREFIX = '_escomi_coverage_lock_';
const ESKOMI_COVERAGE_LEDGER_PREFIX = '_escomi_coverage_ledger_';
const ESKOMI_COVERAGE_AUDIT_POST_TYPE = 'coverage_batch_audit';

/**
 * Recursively sort object keys while preserving list order.
 *
 * @param mixed $value
 * @return mixed
 */
function escomi_coverage_canonicalize($value)
{
    if (!is_array($value)) {
        return $value;
    }

    if (array_is_list($value)) {
        return array_map('escomi_coverage_canonicalize', $value);
    }

    ksort($value, SORT_STRING);
    foreach ($value as $key => $nested) {
        $value[$key] = escomi_coverage_canonicalize($nested);
    }
    return $value;
}

/** @param mixed $value */
function escomi_coverage_canonical_json($value): string
{
    $json = json_encode(
        escomi_coverage_canonicalize($value),
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    );
    return (string) $json;
}

/** @param mixed $value */
function escomi_coverage_current_hash(string $field, bool $exists, $value): string
{
    return hash('sha256', escomi_coverage_canonical_json([
        'field' => $field,
        'exists' => $exists,
        'value' => $value,
    ]));
}

/** @param mixed $payload */
function escomi_coverage_payload_hash($payload): string
{
    return hash('sha256', escomi_coverage_canonical_json($payload));
}

function escomi_coverage_writes_enabled(): bool
{
    return defined('ESKOMI_COVERAGE_BATCH_WRITE_ENABLED')
        && ESKOMI_COVERAGE_BATCH_WRITE_ENABLED === true;
}

function escomi_coverage_register_audit_post_type(): void
{
    register_post_type(ESKOMI_COVERAGE_AUDIT_POST_TYPE, [
        'label' => 'Coverage Batch Audit',
        'public' => false,
        'publicly_queryable' => false,
        'show_ui' => false,
        'show_in_rest' => false,
        'exclude_from_search' => true,
        'supports' => ['title', 'editor'],
    ]);
}

function escomi_coverage_register_route(): void
{
    register_rest_route('escomi/v1', '/coverage-batch', [
        'methods' => 'POST',
        'callback' => 'escomi_coverage_handle_request',
        'permission_callback' => 'escomi_coverage_permission',
    ]);
}

function escomi_coverage_permission($request)
{
    if (!current_user_can(ESKOMI_COVERAGE_CAPABILITY) || !current_user_can('edit_posts')) {
        return new WP_Error(
            'rest_forbidden',
            'Coverage batch capability is required.',
            ['status' => 403]
        );
    }
    return true;
}

/** @param array<string,mixed> $params */
function escomi_coverage_validate_request_params(array $params)
{
    $allowed = ['batch_id', 'operation_id', 'attempt_id', 'payload_hash', 'mode'];
    $unknown = array_diff(array_keys($params), $allowed);
    if ($unknown) {
        return new WP_Error('unknown_parameter', 'Unknown request parameter.', ['status' => 400]);
    }
    foreach ($allowed as $name) {
        if (!array_key_exists($name, $params) || !is_string($params[$name])) {
            return new WP_Error('invalid_request', 'Required string parameter is missing.', ['status' => 400]);
        }
    }
    if (!preg_match('/\A[a-z0-9][a-z0-9-]{2,79}\z/', $params['batch_id'])) {
        return new WP_Error('invalid_request', 'Invalid batch identifier.', ['status' => 400]);
    }
    if (!preg_match('/\A[a-z0-9][a-z0-9-]{2,99}\z/', $params['operation_id'])) {
        return new WP_Error('invalid_request', 'Invalid operation identifier.', ['status' => 400]);
    }
    if (!preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i', $params['attempt_id'])) {
        return new WP_Error('invalid_request', 'Invalid attempt identifier.', ['status' => 400]);
    }
    if (!preg_match('/\A[0-9a-f]{64}\z/', $params['payload_hash'])) {
        return new WP_Error('invalid_request', 'Invalid payload hash.', ['status' => 400]);
    }
    if (!in_array($params['mode'], ['dry_run', 'apply'], true)) {
        return new WP_Error('invalid_request', 'Invalid request mode.', ['status' => 400]);
    }
    return $params;
}

function escomi_coverage_manifest_path(): string
{
    return __DIR__ . '/data/coverage-first/coverage-batch-manifest-2026-08-25.json';
}

function escomi_coverage_load_manifest(?string $path = null)
{
    $manifest_path = $path ?? escomi_coverage_manifest_path();
    if (!is_readable($manifest_path)) {
        return new WP_Error('manifest_unavailable', 'Coverage manifest is unavailable.', ['status' => 503]);
    }
    try {
        $manifest = json_decode((string) file_get_contents($manifest_path), true, 512, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) {
        return new WP_Error('manifest_invalid', 'Coverage manifest is invalid.', ['status' => 503]);
    }
    if (!is_array($manifest)
        || ($manifest['schema_version'] ?? null) !== 1
        || ($manifest['mode'] ?? null) !== 'DRY_RUN_ONLY'
        || !isset($manifest['batch_id'], $manifest['operations'])
        || !is_array($manifest['operations'])
    ) {
        return new WP_Error('manifest_invalid', 'Coverage manifest contract mismatch.', ['status' => 503]);
    }
    return $manifest;
}

function escomi_coverage_validate_area_contract()
{
    foreach ([13 => 'shinosaka', 17 => 'sakai'] as $term_id => $slug) {
        $term = get_term($term_id, 'area');
        if (is_wp_error($term)
            || !is_object($term)
            || (int) ($term->term_id ?? 0) !== $term_id
            || (string) ($term->slug ?? '') !== $slug
        ) {
            return new WP_Error(
                'area_contract_mismatch',
                'Area term contract mismatch.',
                ['status' => 409, 'term_id' => $term_id]
            );
        }
    }
    return true;
}

function escomi_coverage_option_suffix(string $batch_id, string $operation_id): string
{
    return hash('sha256', $batch_id . '|' . $operation_id);
}

function escomi_coverage_lock_option_name(string $batch_id, string $operation_id): string
{
    return ESKOMI_COVERAGE_LOCK_PREFIX . escomi_coverage_option_suffix($batch_id, $operation_id);
}

function escomi_coverage_ledger_option_name(string $batch_id, string $operation_id): string
{
    return ESKOMI_COVERAGE_LEDGER_PREFIX . escomi_coverage_option_suffix($batch_id, $operation_id);
}

function escomi_coverage_compare_swap_option(string $name, string $expected, string $replacement): bool
{
    global $wpdb;
    if (!isset($wpdb) || !isset($wpdb->options)) {
        return false;
    }
    $updated = $wpdb->query($wpdb->prepare(
        "UPDATE {$wpdb->options} SET option_value = %s WHERE option_name = %s AND option_value = %s",
        $replacement,
        $name,
        $expected
    ));
    wp_cache_delete($name, 'options');
    return $updated === 1;
}

function escomi_coverage_acquire_lock(string $batch_id, string $operation_id)
{
    $name = escomi_coverage_lock_option_name($batch_id, $operation_id);
    $value = escomi_coverage_canonical_json([
        'created_at' => time(),
        'owner' => wp_generate_uuid4(),
    ]);
    if (add_option($name, $value, '', 'no')) {
        return ['name' => $name, 'value' => $value];
    }
    $current = get_option($name, false);
    $decoded = is_string($current) ? json_decode($current, true) : null;
    $created_at = is_array($decoded) ? (int) ($decoded['created_at'] ?? 0) : 0;
    if ($created_at > time() - ESKOMI_COVERAGE_LOCK_TTL) {
        return new WP_Error('operation_locked', 'Coverage operation is locked.', ['status' => 409]);
    }
    if (!is_string($current) || !escomi_coverage_compare_swap_option($name, $current, $value)) {
        return new WP_Error('lock_unavailable', 'Coverage lock is unavailable.', ['status' => 503]);
    }
    return ['name' => $name, 'value' => $value];
}

/** @param array{name?:string,value?:string} $lock */
function escomi_coverage_release_lock(array $lock): bool
{
    global $wpdb;
    if (!isset($wpdb) || empty($lock['name']) || empty($lock['value'])) {
        return false;
    }
    $deleted = $wpdb->query($wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name = %s AND option_value = %s",
        $lock['name'],
        $lock['value']
    ));
    wp_cache_delete($lock['name'], 'options');
    return $deleted === 1;
}

function escomi_coverage_begin_ledger(
    string $batch_id,
    string $operation_id,
    string $payload_hash_value,
    string $attempt_id
) {
    $name = escomi_coverage_ledger_option_name($batch_id, $operation_id);
    $existing = get_option($name, false);
    if (is_array($existing)) {
        if (!hash_equals((string) ($existing['payload_hash'] ?? ''), $payload_hash_value)) {
            return new WP_Error('payload_mismatch', 'Ledger payload mismatch.', ['status' => 409]);
        }
        if (($existing['state'] ?? '') === 'applied') {
            return new WP_Error('operation_replay', 'Operation was already applied.', [
                'status' => 200,
                'post_id' => $existing['post_id'] ?? null,
            ]);
        }
        return new WP_Error('operation_in_progress', 'Operation is already in progress.', ['status' => 409]);
    }
    $ledger = [
        'schema_version' => 1,
        'batch_id' => $batch_id,
        'operation_id' => $operation_id,
        'payload_hash' => $payload_hash_value,
        'attempt_id' => $attempt_id,
        'state' => 'applying',
        'post_id' => null,
        'before_snapshot' => null,
        'after_hashes' => [],
        'area_terms_added' => [],
        'created_at' => gmdate('c'),
        'updated_at' => gmdate('c'),
        'retention_days' => ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS,
    ];
    if (!add_option($name, $ledger, '', 'no')) {
        return new WP_Error('ledger_unavailable', 'Coverage ledger is unavailable.', ['status' => 503]);
    }
    return $ledger;
}

function escomi_coverage_find_operation(array $manifest, string $operation_id)
{
    foreach ($manifest['operations'] as $operation) {
        if (($operation['operation_id'] ?? '') === $operation_id) {
            return $operation;
        }
    }
    return new WP_Error('operation_not_found', 'Coverage operation was not found.', ['status' => 404]);
}

function escomi_coverage_handle_request($request)
{
    $permission = escomi_coverage_permission($request);
    if (is_wp_error($permission)) {
        return $permission;
    }
    $raw = method_exists($request, 'get_json_params') ? $request->get_json_params() : [];
    $params = escomi_coverage_validate_request_params(is_array($raw) ? $raw : []);
    if (is_wp_error($params)) {
        return $params;
    }
    $manifest = escomi_coverage_load_manifest();
    if (is_wp_error($manifest)) {
        return $manifest;
    }
    if (!hash_equals((string) $manifest['batch_id'], $params['batch_id'])) {
        return new WP_Error('batch_not_found', 'Coverage batch was not found.', ['status' => 404]);
    }
    $operation = escomi_coverage_find_operation($manifest, $params['operation_id']);
    if (is_wp_error($operation)) {
        return $operation;
    }
    if (!hash_equals((string) ($operation['payload_hash'] ?? ''), $params['payload_hash'])) {
        return new WP_Error('payload_mismatch', 'Payload hash mismatch.', ['status' => 409]);
    }
    $area_contract = escomi_coverage_validate_area_contract();
    if (is_wp_error($area_contract)) {
        return $area_contract;
    }
    if ($params['mode'] === 'dry_run') {
        return new WP_REST_Response([
            'mode' => 'dry_run',
            'batch_id' => $params['batch_id'],
            'operation_id' => $params['operation_id'],
            'status' => $operation['dry_run_status'] ?? 'HOLD',
            'payload_hash' => $params['payload_hash'],
        ], 200);
    }
    if (!escomi_coverage_writes_enabled()) {
        return new WP_Error('writes_disabled', 'Coverage writes are disabled.', ['status' => 503]);
    }
    return new WP_Error('apply_not_available', 'Coverage apply is not available.', ['status' => 503]);
}

if (function_exists('add_action')) {
    add_action('init', 'escomi_coverage_register_audit_post_type');
    add_action('rest_api_init', 'escomi_coverage_register_route');
}
