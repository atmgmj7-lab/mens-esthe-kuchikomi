<?php

declare(strict_types=1);

const ESKOMI_COVERAGE_LOCK_TTL = 120;
const ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS = 400;
const ESKOMI_COVERAGE_CAPABILITY = 'escomi_publish_coverage_batch';
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
    $valid = is_array($manifest) ? escomi_coverage_validate_manifest_contract($manifest) : false;
    if (is_wp_error($valid) || $valid !== true) {
        return new WP_Error('manifest_invalid', 'Coverage manifest contract mismatch.', ['status' => 503]);
    }
    return $manifest;
}

function escomi_coverage_exact_keys(array $value, array $allowed): bool
{
    $actual = array_keys($value);
    sort($actual, SORT_STRING);
    sort($allowed, SORT_STRING);
    return $actual === $allowed;
}

function escomi_coverage_validate_field_value(string $field, $value): bool
{
    if ($field === 'basic_price') {
        return (is_int($value) || (is_string($value) && preg_match('/\A[0-9]+\z/', $value)))
            && (int) $value >= 1
            && (int) $value <= 1000000;
    }
    if (!is_string($value) || $value === '' || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        return false;
    }
    if ($field === 'official_url') {
        $parts = parse_url($value);
        return filter_var($value, FILTER_VALIDATE_URL) !== false
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && !empty($parts['host']);
    }
    if ($field === 'shop_tel') {
        return strlen($value) <= 50
            && preg_match('/\A[0-9+()\-\s]+\z/u', $value)
            && strlen(preg_replace('/\D+/', '', $value) ?? '') >= 6;
    }
    $limits = [
        'shop_address' => 1000,
        'shop_hours' => 500,
        'shop_booking' => 500,
    ];
    $length = function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
    return isset($limits[$field]) && $length <= $limits[$field];
}

function escomi_coverage_validate_manifest_contract(array $manifest)
{
    $top_keys = [
        'area_contract', 'batch_id', 'candidate_row_count', 'execution_entity_count',
        'mode', 'operations', 'pilot_operation_ids', 'schema_version',
        'snapshot_fetched_at', 'source_hashes',
    ];
    if (!escomi_coverage_exact_keys($manifest, $top_keys)
        || ($manifest['schema_version'] ?? null) !== 1
        || ($manifest['mode'] ?? null) !== 'DRY_RUN_ONLY'
        || ($manifest['candidate_row_count'] ?? null) !== 30
        || ($manifest['execution_entity_count'] ?? null) !== 28
        || ($manifest['area_contract'] ?? null) !== ['13' => 'shinosaka', '17' => 'sakai']
        || !is_array($manifest['operations'] ?? null)
        || !is_array($manifest['source_hashes'] ?? null)
        || count($manifest['operations']) !== 28
        || !is_array($manifest['pilot_operation_ids'] ?? null)
        || count($manifest['pilot_operation_ids']) !== 9
    ) {
        return new WP_Error('manifest_invalid', 'Manifest envelope mismatch.', ['status' => 503]);
    }
    foreach ($manifest['source_hashes'] as $source_name => $source_hash) {
        if (!is_string($source_name) || !preg_match('/\A[0-9a-f]{64}\z/', (string) $source_hash)) {
            return new WP_Error('manifest_invalid', 'Manifest source hash mismatch.', ['status' => 503]);
        }
    }
    $operation_keys = [
        'action', 'create_lifecycle', 'deferred_evidence', 'dry_run_status',
        'master_shop_id', 'operation_id', 'payload', 'payload_hash', 'wp_id',
    ];
    $payload_base_keys = ['action', 'area_terms', 'fields', 'master_shop_id', 'slug', 'title', 'wp_id'];
    $deferred_allowed = ['shop_station', 'shop_access', 'shop_booking_url', 'shop_line'];
    $ids = [];
    foreach ($manifest['operations'] as $operation) {
        if (!is_array($operation) || !escomi_coverage_exact_keys($operation, $operation_keys)) {
            return new WP_Error('manifest_invalid', 'Manifest operation key mismatch.', ['status' => 503]);
        }
        $action = (string) ($operation['action'] ?? '');
        $ready = [
            'UPDATE_EXISTING' => 'READY_UPDATE',
            'CREATE_NEW' => 'READY_CREATE',
            'ADD_AREA_RELATION' => 'READY_RELATION',
        ];
        if (!isset($ready[$action])
            || ($operation['dry_run_status'] ?? '') !== $ready[$action]
            || !preg_match('/\Acoverage-m[0-9]+-(update|create|relation)\z/', (string) ($operation['operation_id'] ?? ''))
            || in_array($operation['operation_id'], $ids, true)
            || !preg_match('/\AM[0-9]{4}\z/', (string) ($operation['master_shop_id'] ?? ''))
            || !is_array($operation['payload'] ?? null)
            || !is_array($operation['deferred_evidence'] ?? null)
        ) {
            return new WP_Error('manifest_invalid', 'Manifest operation contract mismatch.', ['status' => 503]);
        }
        $ids[] = $operation['operation_id'];
        $payload_keys = $payload_base_keys;
        if ($action === 'ADD_AREA_RELATION') {
            $payload_keys[] = 'area_terms_to_add';
        }
        $payload = $operation['payload'];
        if (!escomi_coverage_exact_keys($payload, $payload_keys)
            || ($payload['action'] ?? '') !== $action
            || ($payload['master_shop_id'] ?? '') !== $operation['master_shop_id']
            || ($payload['wp_id'] ?? null) !== ($operation['wp_id'] ?? null)
            || !is_array($payload['area_terms'] ?? null)
            || !$payload['area_terms']
            || array_diff($payload['area_terms'], [13, 17])
            || !is_array($payload['fields'] ?? null)
            || !hash_equals((string) ($operation['payload_hash'] ?? ''), escomi_coverage_payload_hash($payload))
        ) {
            return new WP_Error('manifest_invalid', 'Manifest payload contract mismatch.', ['status' => 503]);
        }
        if ($action === 'CREATE_NEW') {
            if ($operation['wp_id'] !== null
                || $operation['create_lifecycle'] !== 'draft_then_readback_then_publish'
                || $payload['title'] === ''
                || $payload['slug'] === ''
            ) {
                return new WP_Error('manifest_invalid', 'Create contract mismatch.', ['status' => 503]);
            }
        } elseif (!is_int($operation['wp_id']) || $operation['wp_id'] < 1 || $operation['create_lifecycle'] !== null) {
            return new WP_Error('manifest_invalid', 'Existing shop contract mismatch.', ['status' => 503]);
        }
        if ($action === 'ADD_AREA_RELATION') {
            if ($payload['fields'] !== []
                || !is_array($payload['area_terms_to_add'])
                || array_diff($payload['area_terms_to_add'], [13, 17])
            ) {
                return new WP_Error('manifest_invalid', 'Relation contract mismatch.', ['status' => 503]);
            }
        }
        $seen_fields = [];
        foreach ($payload['fields'] as $field) {
            $keys = ['field', 'observed_at', 'proposed_value', 'source'];
            if ($action === 'UPDATE_EXISTING') {
                $keys[] = 'current_hash';
            }
            if (!is_array($field)
                || !escomi_coverage_exact_keys($field, $keys)
                || !in_array($field['field'] ?? '', escomi_coverage_allowed_fields(), true)
                || in_array($field['field'], $seen_fields, true)
                || ($field['proposed_value'] ?? '') === ''
                || !escomi_coverage_validate_field_value((string) $field['field'], $field['proposed_value'])
                || !str_starts_with((string) ($field['source'] ?? ''), 'https://')
                || ($field['observed_at'] ?? '') === ''
                || ($action === 'UPDATE_EXISTING' && !preg_match('/\A[0-9a-f]{64}\z/', (string) ($field['current_hash'] ?? '')))
            ) {
                return new WP_Error('manifest_invalid', 'Manifest field contract mismatch.', ['status' => 503]);
            }
            $seen_fields[] = $field['field'];
        }
        foreach ($operation['deferred_evidence'] as $field) {
            if (!is_array($field)
                || !escomi_coverage_exact_keys($field, ['field', 'observed_at', 'proposed_value', 'source'])
                || !in_array($field['field'] ?? '', $deferred_allowed, true)
                || (($field['proposed_value'] ?? '') !== '' && !str_starts_with((string) ($field['source'] ?? ''), 'https://'))
            ) {
                return new WP_Error('manifest_invalid', 'Deferred evidence contract mismatch.', ['status' => 503]);
            }
        }
    }
    foreach ($manifest['pilot_operation_ids'] as $pilot_id) {
        if (!in_array($pilot_id, $ids, true)) {
            return new WP_Error('manifest_invalid', 'Pilot operation is outside manifest.', ['status' => 503]);
        }
    }
    return true;
}

function escomi_coverage_validate_area_contract()
{
    foreach ([13 => 'shinosaka', 17 => 'sakai'] as $term_id => $slug) {
        $term = get_term($term_id, 'area');
        if (is_wp_error($term)
            || !is_object($term)
            || (int) ($term->term_id ?? 0) !== $term_id
            || (string) ($term->slug ?? '') !== $slug
            || (string) ($term->taxonomy ?? '') !== 'area'
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
    string $attempt_id,
    bool $allow_resume = false
) {
    $name = escomi_coverage_ledger_option_name($batch_id, $operation_id);
    $stored = get_option($name, false);
    $existing = is_string($stored) ? json_decode($stored, true) : null;
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
        if ($allow_resume && ($existing['state'] ?? '') === 'applying') {
            $existing['resumed'] = true;
            return $existing;
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
        'option_name' => $name,
    ];
    if (!add_option($name, escomi_coverage_canonical_json($ledger), '', 'no')) {
        return new WP_Error('ledger_unavailable', 'Coverage ledger is unavailable.', ['status' => 503]);
    }
    return $ledger;
}

function escomi_coverage_transition_ledger(array $expected, array $changes)
{
    $name = (string) ($expected['option_name'] ?? '');
    if ($name === ''
        || $name !== escomi_coverage_ledger_option_name(
            (string) ($expected['batch_id'] ?? ''),
            (string) ($expected['operation_id'] ?? '')
        )
    ) {
        return new WP_Error('ledger_invalid', 'Coverage ledger identity is invalid.', ['status' => 503]);
    }
    $next = array_replace($expected, $changes, ['updated_at' => gmdate('c')]);
    $current_json = escomi_coverage_canonical_json($expected);
    $next_json = escomi_coverage_canonical_json($next);
    if (!escomi_coverage_compare_swap_option($name, $current_json, $next_json)) {
        return new WP_Error('ledger_conflict', 'Coverage ledger changed concurrently.', ['status' => 409]);
    }
    return $next;
}

function escomi_coverage_current_ledger(string $batch_id, string $operation_id)
{
    $stored = get_option(escomi_coverage_ledger_option_name($batch_id, $operation_id), false);
    $ledger = is_string($stored) ? json_decode($stored, true) : null;
    return is_array($ledger)
        ? $ledger
        : new WP_Error('ledger_unavailable', 'Coverage ledger is unavailable.', ['status' => 503]);
}

function escomi_coverage_allowed_fields(): array
{
    return [
        'official_url',
        'shop_address',
        'basic_price',
        'shop_hours',
        'shop_tel',
        'shop_booking',
    ];
}

function escomi_coverage_values_equivalent(string $field, $left, $right): bool
{
    if ($field === 'basic_price') {
        return (string) ($left ?? '') === (string) ($right ?? '');
    }
    if ($field === 'official_url') {
        return rtrim(strtolower(trim((string) $left)), '/')
            === rtrim(strtolower(trim((string) $right)), '/');
    }
    if ($field === 'shop_tel') {
        return preg_replace('/\D+/', '', (string) $left)
            === preg_replace('/\D+/', '', (string) $right);
    }
    if ($field === 'shop_address') {
        $normalize = static function ($value): string {
            $text = str_replace("\xc2\xa0", ' ', (string) $value);
            return preg_replace('/\s+/u', ' ', trim($text)) ?? '';
        };
        return $normalize($left) === $normalize($right);
    }
    return $left === $right;
}

function escomi_coverage_resolve_acf_field_key(string $field)
{
    if (!in_array($field, escomi_coverage_allowed_fields(), true)
        || !function_exists('get_field_object')
    ) {
        return new WP_Error('acf_field_unavailable', 'Approved ACF field is unavailable.', ['status' => 503]);
    }
    $object = get_field_object($field, false, false);
    $key = is_array($object) ? (string) ($object['key'] ?? '') : '';
    $name = is_array($object) ? (string) ($object['name'] ?? '') : '';
    if ($name !== $field || !preg_match('/\Afield_[A-Za-z0-9_-]+\z/', $key)) {
        return new WP_Error('acf_field_unavailable', 'Approved ACF field key is unavailable.', ['status' => 503]);
    }
    return $key;
}

function escomi_coverage_capture_field(int $post_id, string $field): array
{
    return [
        'field' => $field,
        'exists' => metadata_exists('post', $post_id, $field),
        'value' => get_field($field, $post_id, false),
    ];
}

function escomi_coverage_write_acf_value(int $post_id, string $field, string $field_key, $value): bool
{
    $written = update_field($field_key, $value, $post_id);
    return $written !== false
        || escomi_coverage_values_equivalent($field, get_field($field, $post_id, false), $value);
}

function escomi_coverage_restore_field_snapshots(int $post_id, array $snapshots): bool
{
    $ok = true;
    foreach (array_reverse($snapshots) as $snapshot) {
        $field = (string) $snapshot['field'];
        if (!empty($snapshot['exists'])) {
            $key = escomi_coverage_resolve_acf_field_key($field);
            if (is_wp_error($key)
                || !escomi_coverage_write_acf_value($post_id, $field, $key, $snapshot['value'])
            ) {
                $ok = false;
            }
        } else {
            delete_post_meta($post_id, $field);
        }
    }
    return $ok;
}

function escomi_coverage_capture_provenance(int $post_id): array
{
    return [
        'exists' => metadata_exists('post', $post_id, 'shop_fact_provenance'),
        'value' => get_post_meta($post_id, 'shop_fact_provenance', true),
    ];
}

function escomi_coverage_provenance_field(string $field): ?string
{
    return [
        'official_url' => 'official',
        'basic_price' => 'price',
        'shop_hours' => 'hours',
        'shop_booking' => 'booking',
    ][$field] ?? null;
}

function escomi_coverage_write_provenance(int $post_id, array $field_items): array
{
    $snapshot = escomi_coverage_capture_provenance($post_id);
    $current = is_array($snapshot['value']) ? $snapshot['value'] : [];
    $replace = [];
    foreach ($field_items as $item) {
        $category = escomi_coverage_provenance_field((string) ($item['field'] ?? ''));
        if ($category !== null) {
            $replace[$category] = $item;
        }
    }
    if (!$replace) {
        return ['snapshot' => $snapshot, 'value' => $current, 'changed' => false];
    }
    $next = [];
    foreach ($current as $record) {
        if (is_array($record) && !isset($replace[(string) ($record['field'] ?? '')])) {
            $next[] = $record;
        }
    }
    foreach ($replace as $category => $item) {
        $observed = substr((string) ($item['observed_at'] ?? ''), 0, 10);
        $next[] = [
            'field' => $category,
            'sourceUrl' => (string) ($item['source'] ?? ''),
            'sourceType' => 'official-site',
            'observedAt' => $observed,
            'reviewedAt' => gmdate('Y-m-d'),
            'reviewStatus' => 'reviewed',
            'publishedValueHash' => escomi_coverage_payload_hash($item['proposed_value'] ?? null),
        ];
    }
    update_post_meta($post_id, 'shop_fact_provenance', $next);
    if (get_post_meta($post_id, 'shop_fact_provenance', true) !== $next) {
        return ['error' => new WP_Error('provenance_write_failed', 'Provenance could not be stored.', ['status' => 500])];
    }
    return ['snapshot' => $snapshot, 'value' => $next, 'changed' => true];
}

function escomi_coverage_restore_provenance(int $post_id, array $snapshot): bool
{
    if (!empty($snapshot['exists'])) {
        update_post_meta($post_id, 'shop_fact_provenance', $snapshot['value']);
        return get_post_meta($post_id, 'shop_fact_provenance', true) === $snapshot['value'];
    }
    delete_post_meta($post_id, 'shop_fact_provenance');
    return !metadata_exists('post', $post_id, 'shop_fact_provenance');
}

function escomi_coverage_apply_update(array $operation)
{
    $post_id = (int) ($operation['wp_id'] ?? $operation['payload']['wp_id'] ?? 0);
    if ($post_id < 1 || get_post_type($post_id) !== 'shop') {
        return new WP_Error('shop_not_found', 'Target shop was not found.', ['status' => 404]);
    }
    $fields = $operation['payload']['fields'] ?? null;
    if (!is_array($fields)) {
        return new WP_Error('manifest_invalid', 'Update fields are invalid.', ['status' => 503]);
    }
    $planned = [];
    $snapshots = [];
    foreach ($fields as $item) {
        $field = is_array($item) ? (string) ($item['field'] ?? '') : '';
        if (!in_array($field, escomi_coverage_allowed_fields(), true)
            || !isset($item['current_hash'], $item['proposed_value'])
        ) {
            return new WP_Error('manifest_invalid', 'Update field contract mismatch.', ['status' => 503]);
        }
        $key = escomi_coverage_resolve_acf_field_key($field);
        if (is_wp_error($key)) {
            return $key;
        }
        $snapshot = escomi_coverage_capture_field($post_id, $field);
        $actual_hash = escomi_coverage_current_hash($field, $snapshot['exists'], $snapshot['value']);
        if (!hash_equals((string) $item['current_hash'], $actual_hash)) {
            return new WP_Error('field_conflict', 'A target field changed after dry-run.', [
                'status' => 409,
                'field' => $field,
                'current_hash' => $actual_hash,
            ]);
        }
        if (escomi_coverage_values_equivalent($field, $snapshot['value'], $item['proposed_value'])) {
            continue;
        }
        $snapshots[] = $snapshot;
        $planned[] = ['field' => $field, 'key' => $key, 'value' => $item['proposed_value']];
    }
    foreach ($planned as $item) {
        if (!escomi_coverage_write_acf_value($post_id, $item['field'], $item['key'], $item['value'])) {
            escomi_coverage_restore_field_snapshots($post_id, $snapshots);
            return new WP_Error('field_write_failed', 'An approved field could not be written.', [
                'status' => 500,
                'field' => $item['field'],
            ]);
        }
    }
    $provenance_items = array_values(array_filter(
        $fields,
        static fn($item): bool => in_array(
            (string) ($item['field'] ?? ''),
            array_column($planned, 'field'),
            true
        )
    ));
    $provenance = escomi_coverage_write_provenance($post_id, $provenance_items);
    if (isset($provenance['error'])) {
        escomi_coverage_restore_field_snapshots($post_id, $snapshots);
        return $provenance['error'];
    }
    $after_hashes = [];
    foreach ($snapshots as $snapshot) {
        $current = escomi_coverage_capture_field($post_id, $snapshot['field']);
        $after_hashes[$snapshot['field']] = escomi_coverage_current_hash(
            $snapshot['field'],
            $current['exists'],
            $current['value']
        );
    }
    return [
        'post_id' => $post_id,
        'changed' => !empty($planned),
        'changed_fields' => array_column($planned, 'field'),
        'rollback' => [
            'action' => 'UPDATE_EXISTING',
            'post_id' => $post_id,
            'before_fields' => $snapshots,
            'after_hashes' => $after_hashes,
            'before_provenance' => $provenance['snapshot'],
            'after_provenance_hash' => escomi_coverage_payload_hash($provenance['value']),
        ],
    ];
}

function escomi_coverage_relation_hash(array $terms): string
{
    $terms = array_values(array_unique(array_map('intval', $terms)));
    sort($terms, SORT_NUMERIC);
    return escomi_coverage_payload_hash($terms);
}

function escomi_coverage_current_area_terms(int $post_id): array
{
    $terms = wp_get_object_terms($post_id, 'area', ['fields' => 'ids']);
    if (is_wp_error($terms) || !is_array($terms)) {
        return [];
    }
    $terms = array_values(array_unique(array_map('intval', $terms)));
    sort($terms, SORT_NUMERIC);
    return $terms;
}

function escomi_coverage_apply_relation(array $operation)
{
    $post_id = (int) ($operation['wp_id'] ?? $operation['payload']['wp_id'] ?? 0);
    if ($post_id < 1 || get_post_type($post_id) !== 'shop') {
        return new WP_Error('shop_not_found', 'Target shop was not found.', ['status' => 404]);
    }
    $requested = $operation['payload']['area_terms_to_add'] ?? null;
    if (!is_array($requested)
        || array_diff($requested, [13, 17])
        || count($requested) !== count(array_unique($requested))
    ) {
        return new WP_Error('manifest_invalid', 'Area relation contract mismatch.', ['status' => 503]);
    }
    $before = escomi_coverage_current_area_terms($post_id);
    $to_add = array_values(array_diff(array_map('intval', $requested), $before));
    if (!$to_add) {
        return ['post_id' => $post_id, 'changed' => false, 'rollback' => null];
    }
    $written = wp_set_object_terms($post_id, $to_add, 'area', true);
    if (is_wp_error($written)) {
        return new WP_Error('relation_write_failed', 'Area relation could not be added.', ['status' => 500]);
    }
    $after = escomi_coverage_current_area_terms($post_id);
    if (array_diff($to_add, $after)) {
        return new WP_Error('relation_readback_failed', 'Area relation readback failed.', ['status' => 500]);
    }
    return [
        'post_id' => $post_id,
        'changed' => true,
        'area_terms_added' => $to_add,
        'rollback' => [
            'action' => 'ADD_AREA_RELATION',
            'post_id' => $post_id,
            'before_terms' => $before,
            'area_terms_added' => $to_add,
            'after_hash' => escomi_coverage_relation_hash($after),
        ],
    ];
}

function escomi_coverage_normalize_identity(string $kind, $value): string
{
    $value = trim(str_replace("\xc2\xa0", ' ', (string) $value));
    if ($kind === 'official_url') {
        return rtrim(strtolower($value), '/');
    }
    if ($kind === 'shop_tel') {
        return preg_replace('/\D+/', '', $value) ?? '';
    }
    return strtolower(preg_replace('/\s+/u', ' ', $value) ?? '');
}

function escomi_coverage_check_create_collisions(array $operation)
{
    $payload = $operation['payload'] ?? [];
    $wanted = [
        'canonical_name' => escomi_coverage_normalize_identity('canonical_name', $payload['title'] ?? ''),
        'slug' => escomi_coverage_normalize_identity('slug', $payload['slug'] ?? ''),
    ];
    foreach ($payload['fields'] ?? [] as $item) {
        $field = (string) ($item['field'] ?? '');
        if (in_array($field, ['official_url', 'shop_tel', 'shop_address'], true)) {
            $wanted[$field] = escomi_coverage_normalize_identity($field, $item['proposed_value'] ?? '');
        }
    }
    $collisions = [];
    $ids = get_posts([
        'post_type' => 'shop',
        'post_status' => ['publish', 'draft', 'pending', 'private', 'future', 'trash'],
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true,
    ]);
    foreach (is_array($ids) ? $ids : [] as $post_id) {
        if (get_post_type($post_id) !== 'shop') {
            continue;
        }
        $post = get_post($post_id);
        if (!$post) {
            continue;
        }
        if ($wanted['canonical_name'] !== ''
            && escomi_coverage_normalize_identity('canonical_name', $post->post_title) === $wanted['canonical_name']
        ) {
            $collisions[] = 'canonical_name';
        }
        if ($wanted['slug'] !== ''
            && escomi_coverage_normalize_identity('slug', $post->post_name) === $wanted['slug']
        ) {
            $collisions[] = 'slug';
        }
        foreach (['official_url', 'shop_tel', 'shop_address'] as $field) {
            if (!empty($wanted[$field])
                && escomi_coverage_normalize_identity($field, get_field($field, $post_id, false)) === $wanted[$field]
            ) {
                $collisions[] = $field;
            }
        }
    }
    if ($collisions) {
        return new WP_Error('create_collision', 'Create identity collision detected.', [
            'status' => 409,
            'fields' => array_values(array_unique($collisions)),
        ]);
    }
    return true;
}

function escomi_coverage_force_draft(int $post_id): bool
{
    $updated = wp_update_post(['ID' => $post_id, 'post_status' => 'draft'], true);
    return !is_wp_error($updated) && get_post_status($post_id) === 'draft';
}

function escomi_coverage_apply_create(array $operation, array $ledger)
{
    $payload = $operation['payload'] ?? [];
    if (($payload['action'] ?? '') !== 'CREATE_NEW'
        || empty($payload['title'])
        || empty($payload['slug'])
        || !is_array($payload['area_terms'] ?? null)
        || array_diff($payload['area_terms'], [13, 17])
    ) {
        return new WP_Error('manifest_invalid', 'Create payload contract mismatch.', ['status' => 503]);
    }
    $field_keys = [];
    foreach ($payload['fields'] ?? [] as $item) {
        $field = (string) ($item['field'] ?? '');
        $key = escomi_coverage_resolve_acf_field_key($field);
        if (is_wp_error($key) || !array_key_exists('proposed_value', $item)) {
            return is_wp_error($key) ? $key : new WP_Error('manifest_invalid', 'Create field contract mismatch.', ['status' => 503]);
        }
        $field_keys[$field] = $key;
    }
    $post_id = (int) ($ledger['post_id'] ?? 0);
    if ($post_id > 0) {
        if (get_post_type($post_id) !== 'shop' || get_post_status($post_id) !== 'draft') {
            return new WP_Error('create_resume_mismatch', 'Ledger draft cannot be resumed.', ['status' => 409]);
        }
    } else {
        $collision = escomi_coverage_check_create_collisions($operation);
        if (is_wp_error($collision)) {
            return $collision;
        }
        $post_id = wp_insert_post([
            'post_type' => 'shop',
            'post_status' => 'draft',
            'post_title' => (string) $payload['title'],
            'post_name' => (string) $payload['slug'],
        ], true);
        if (is_wp_error($post_id) || (int) $post_id < 1) {
            return new WP_Error('create_failed', 'Draft shop could not be created.', ['status' => 500]);
        }
        $post_id = (int) $post_id;
        if (!empty($ledger['option_name'])) {
            $checkpoint = escomi_coverage_transition_ledger($ledger, [
                'post_id' => $post_id,
                'state' => 'applying',
                'create_stage' => 'draft_created',
            ]);
            if (is_wp_error($checkpoint)) {
                escomi_coverage_force_draft($post_id);
                return $checkpoint;
            }
            $ledger = $checkpoint;
        }
    }
    foreach ($payload['fields'] ?? [] as $item) {
        $field = (string) $item['field'];
        if (!escomi_coverage_write_acf_value($post_id, $field, $field_keys[$field], $item['proposed_value'])) {
            escomi_coverage_force_draft($post_id);
            return new WP_Error('field_write_failed', 'Create field write failed.', ['status' => 500, 'post_id' => $post_id]);
        }
    }
    $terms = array_values(array_unique(array_map('intval', $payload['area_terms'])));
    $written_terms = wp_set_object_terms($post_id, $terms, 'area', false);
    if (is_wp_error($written_terms)) {
        escomi_coverage_force_draft($post_id);
        return new WP_Error('relation_write_failed', 'Create area relation failed.', ['status' => 500, 'post_id' => $post_id]);
    }
    $provenance = escomi_coverage_write_provenance($post_id, $payload['fields'] ?? []);
    if (isset($provenance['error'])) {
        escomi_coverage_force_draft($post_id);
        return $provenance['error'];
    }
    $post = get_post($post_id);
    $readback_terms = escomi_coverage_current_area_terms($post_id);
    $readback_ok = $post
        && $post->post_status === 'draft'
        && $post->post_title === (string) $payload['title']
        && $post->post_name === (string) $payload['slug']
        && $readback_terms === $terms;
    foreach ($payload['fields'] ?? [] as $item) {
        $readback_ok = $readback_ok && escomi_coverage_values_equivalent(
            (string) $item['field'],
            get_field((string) $item['field'], $post_id, false),
            $item['proposed_value']
        );
    }
    if (!$readback_ok) {
        escomi_coverage_force_draft($post_id);
        return new WP_Error('create_readback_failed', 'Draft create readback failed.', ['status' => 500, 'post_id' => $post_id]);
    }
    $published = wp_update_post(['ID' => $post_id, 'post_status' => 'publish'], true);
    if (is_wp_error($published) || get_post_status($post_id) !== 'publish') {
        escomi_coverage_force_draft($post_id);
        return new WP_Error('publish_failed', 'Draft could not be published.', ['status' => 500, 'post_id' => $post_id]);
    }
    return [
        'post_id' => $post_id,
        'changed' => true,
        'rollback' => [
            'action' => 'CREATE_NEW',
            'post_id' => $post_id,
            'after_status' => 'publish',
        ],
    ];
}

function escomi_coverage_apply_rollback(array $rollback)
{
    $action = (string) ($rollback['action'] ?? '');
    $post_id = (int) ($rollback['post_id'] ?? 0);
    if ($post_id < 1 || get_post_type($post_id) !== 'shop') {
        return new WP_Error('rollback_target_missing', 'Rollback target is unavailable.', ['status' => 409]);
    }
    if ($action === 'UPDATE_EXISTING') {
        foreach ($rollback['after_hashes'] ?? [] as $field => $expected_hash) {
            $current = escomi_coverage_capture_field($post_id, (string) $field);
            if (!hash_equals((string) $expected_hash, escomi_coverage_current_hash((string) $field, $current['exists'], $current['value']))) {
                return new WP_Error('rollback_conflict', 'A field changed after apply.', ['status' => 409, 'field' => $field]);
            }
        }
        $current_provenance = get_post_meta($post_id, 'shop_fact_provenance', true);
        if (!hash_equals(
            (string) ($rollback['after_provenance_hash'] ?? ''),
            escomi_coverage_payload_hash(is_array($current_provenance) ? $current_provenance : [])
        )) {
            return new WP_Error('rollback_conflict', 'Provenance changed after apply.', ['status' => 409]);
        }
        $fields_restored = escomi_coverage_restore_field_snapshots($post_id, $rollback['before_fields'] ?? []);
        $provenance_restored = escomi_coverage_restore_provenance($post_id, $rollback['before_provenance'] ?? []);
        return $fields_restored && $provenance_restored
            ? true
            : new WP_Error('rollback_failed', 'Field rollback failed.', ['status' => 500]);
    }
    if ($action === 'ADD_AREA_RELATION') {
        $current = escomi_coverage_current_area_terms($post_id);
        if (!hash_equals((string) ($rollback['after_hash'] ?? ''), escomi_coverage_relation_hash($current))) {
            return new WP_Error('rollback_conflict', 'Area relations changed after apply.', ['status' => 409]);
        }
        $removed = wp_remove_object_terms($post_id, $rollback['area_terms_added'] ?? [], 'area');
        if (is_wp_error($removed) || $removed === false) {
            return new WP_Error('rollback_failed', 'Area relation rollback failed.', ['status' => 500]);
        }
        return escomi_coverage_current_area_terms($post_id) === ($rollback['before_terms'] ?? [])
            ? true
            : new WP_Error('rollback_failed', 'Area relation rollback readback failed.', ['status' => 500]);
    }
    if ($action === 'CREATE_NEW') {
        if (get_post_status($post_id) !== ($rollback['after_status'] ?? '')) {
            return new WP_Error('rollback_conflict', 'Created post status changed after apply.', ['status' => 409]);
        }
        return escomi_coverage_force_draft($post_id)
            ? true
            : new WP_Error('rollback_failed', 'Created post could not return to draft.', ['status' => 500]);
    }
    return new WP_Error('rollback_invalid', 'Rollback action is invalid.', ['status' => 400]);
}

function escomi_coverage_require_operation_capability(array $operation)
{
    if (!current_user_can(ESKOMI_COVERAGE_CAPABILITY) || !current_user_can('edit_posts')) {
        return new WP_Error('rest_forbidden', 'Coverage batch capability is required.', ['status' => 403]);
    }
    if (($operation['action'] ?? '') === 'CREATE_NEW') {
        $post_type = get_post_type_object('shop');
        $create_cap = is_object($post_type) && isset($post_type->cap->create_posts)
            ? (string) $post_type->cap->create_posts
            : 'edit_posts';
        $publish_cap = is_object($post_type) && isset($post_type->cap->publish_posts)
            ? (string) $post_type->cap->publish_posts
            : 'publish_posts';
        if (!current_user_can($create_cap) || !current_user_can($publish_cap)) {
            return new WP_Error('rest_forbidden', 'Shop create and publish capabilities are required.', ['status' => 403]);
        }
    } else {
        $post_id = (int) ($operation['wp_id'] ?? 0);
        if ($post_id < 1 || !current_user_can('edit_post', $post_id)) {
            return new WP_Error('rest_forbidden', 'Target shop edit capability is required.', ['status' => 403]);
        }
    }
    return true;
}

function escomi_coverage_append_audit(array $event)
{
    $allowed = [
        'batch_id',
        'operation_id',
        'attempt_id',
        'state',
        'post_id',
        'payload_hash',
        'changed_fields',
        'area_terms_added',
        'duplicate',
        'error_code',
    ];
    $safe = [];
    foreach ($allowed as $key) {
        if (array_key_exists($key, $event)) {
            $safe[$key] = $event[$key];
        }
    }
    $audit_id = wp_insert_post([
        'post_type' => ESKOMI_COVERAGE_AUDIT_POST_TYPE,
        'post_status' => 'private',
        'post_title' => sprintf(
            'Coverage %s %s',
            (string) ($safe['operation_id'] ?? 'unknown'),
            (string) ($safe['state'] ?? 'unknown')
        ),
        'post_content' => escomi_coverage_canonical_json($safe),
    ], true);
    if (is_wp_error($audit_id) || (int) $audit_id < 1) {
        return new WP_Error('audit_failed', 'Coverage audit could not be appended.', ['status' => 500]);
    }
    return (int) $audit_id;
}

function escomi_coverage_execute_operation(array $operation, array $params)
{
    $capability = escomi_coverage_require_operation_capability($operation);
    if (is_wp_error($capability)) {
        return $capability;
    }
    $ready_statuses = [
        'UPDATE_EXISTING' => 'READY_UPDATE',
        'CREATE_NEW' => 'READY_CREATE',
        'ADD_AREA_RELATION' => 'READY_RELATION',
    ];
    $action = (string) ($operation['action'] ?? '');
    if (!isset($ready_statuses[$action])
        || ($operation['dry_run_status'] ?? '') !== $ready_statuses[$action]
    ) {
        return new WP_Error('operation_not_ready', 'Coverage operation is not ready.', ['status' => 409]);
    }
    if (!hash_equals(
        (string) ($operation['payload_hash'] ?? ''),
        escomi_coverage_payload_hash($operation['payload'] ?? null)
    )) {
        return new WP_Error('manifest_hash_mismatch', 'Manifest payload hash mismatch.', ['status' => 503]);
    }
    $area = escomi_coverage_validate_area_contract();
    if (is_wp_error($area)) {
        return $area;
    }
    $batch_id = (string) ($params['batch_id'] ?? '');
    $operation_id = (string) ($params['operation_id'] ?? '');
    $lock = escomi_coverage_acquire_lock($batch_id, $operation_id);
    if (is_wp_error($lock)) {
        return $lock;
    }
    $result = null;
    try {
        $ledger = escomi_coverage_begin_ledger(
            $batch_id,
            $operation_id,
            (string) $operation['payload_hash'],
            (string) ($params['attempt_id'] ?? ''),
            true
        );
        if (is_wp_error($ledger)) {
            if ($ledger->code === 'operation_replay') {
                $result = new WP_REST_Response([
                    'status' => 'applied',
                    'duplicate' => true,
                    'post_id' => $ledger->data['post_id'] ?? null,
                    'operation_id' => $operation_id,
                    'payload_hash' => $operation['payload_hash'],
                ], 200);
            } else {
                $result = $ledger;
            }
        } else {
            if ($action === 'UPDATE_EXISTING') {
                $applied = escomi_coverage_apply_update($operation);
            } elseif ($action === 'ADD_AREA_RELATION') {
                $applied = escomi_coverage_apply_relation($operation);
            } else {
                $applied = escomi_coverage_apply_create($operation, $ledger);
            }
            if (is_wp_error($applied)) {
                $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                if (!is_wp_error($current_ledger)) {
                    escomi_coverage_transition_ledger($current_ledger, [
                        'state' => 'applying',
                        'post_id' => $applied->data['post_id'] ?? ($current_ledger['post_id'] ?? null),
                        'last_error_code' => $applied->code,
                    ]);
                }
                $result = $applied;
            } else {
                $audit_id = escomi_coverage_append_audit([
                    'batch_id' => $batch_id,
                    'operation_id' => $operation_id,
                    'attempt_id' => (string) ($params['attempt_id'] ?? ''),
                    'state' => 'applied',
                    'post_id' => $applied['post_id'] ?? null,
                    'payload_hash' => $operation['payload_hash'],
                    'changed_fields' => $applied['changed_fields'] ?? [],
                    'area_terms_added' => $applied['area_terms_added'] ?? [],
                    'duplicate' => false,
                ]);
                if (is_wp_error($audit_id)) {
                    $rollback = !empty($applied['rollback'])
                        ? escomi_coverage_apply_rollback($applied['rollback'])
                        : true;
                    $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                    if (!is_wp_error($current_ledger)) {
                        escomi_coverage_transition_ledger($current_ledger, [
                            'state' => $rollback === true ? 'rolled_back' : 'manual_review_required',
                            'last_error_code' => $audit_id->code,
                        ]);
                    }
                    $result = $audit_id;
                } else {
                    $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                    if (is_wp_error($current_ledger)) {
                        $result = $current_ledger;
                    } else {
                        $completed = escomi_coverage_transition_ledger($current_ledger, [
                            'state' => 'applied',
                            'post_id' => $applied['post_id'] ?? null,
                            'rollback' => $applied['rollback'] ?? null,
                            'audit_id' => $audit_id,
                            'last_error_code' => null,
                        ]);
                        $result = is_wp_error($completed)
                            ? $completed
                            : new WP_REST_Response([
                                'status' => 'applied',
                                'duplicate' => false,
                                'post_id' => $applied['post_id'] ?? null,
                                'operation_id' => $operation_id,
                                'payload_hash' => $operation['payload_hash'],
                            ], !empty($applied['changed']) ? 201 : 200);
                    }
                }
            }
        }
    } finally {
        $released = escomi_coverage_release_lock($lock);
    }
    if (!$released && !is_wp_error($result)) {
        return new WP_Error('lock_release_failed', 'Operation completed but lock release failed.', [
            'status' => 503,
            'retry_after' => ESKOMI_COVERAGE_LOCK_TTL,
        ]);
    }
    return $result;
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
    return escomi_coverage_execute_operation($operation, $params);
}

if (function_exists('add_action')) {
    add_action('init', 'escomi_coverage_register_audit_post_type');
    add_action('rest_api_init', 'escomi_coverage_register_route');
}
