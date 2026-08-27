<?php

declare(strict_types=1);

const ESKOMI_COVERAGE_LOCK_TTL = 120;
const ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS = 400;
const ESKOMI_COVERAGE_CAPABILITY = 'escomi_publish_coverage_batch';
const ESKOMI_COVERAGE_LOCK_PREFIX = '_escomi_coverage_lock_';
const ESKOMI_COVERAGE_LEDGER_PREFIX = '_escomi_coverage_ledger_';
const ESKOMI_COVERAGE_AUDIT_POST_TYPE = 'coverage_batch_audit';
const ESKOMI_COVERAGE_MANIFEST_SHA256 = '51b73e57e7f3a9c1863fb5d904d195e0903fe22c9f2b66d9616746db11c0875c';
const ESKOMI_COVERAGE_FIXED_HOLD_IDS = ['M0217', 'M0293', 'M0408', 'M0661'];

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
function escomi_coverage_canonical_field_value(string $field, bool $exists, $value)
{
    if (!$exists) {
        return $value === null
            ? null
            : new WP_Error('field_value_invalid', 'Missing field value must be null.', ['status' => 409]);
    }
    if ($field !== 'basic_price') {
        return is_string($value)
            ? $value
            : new WP_Error('field_value_invalid', 'Text field value must be a string.', ['status' => 409]);
    }
    if (is_int($value)) {
        $normalized = $value;
    } elseif (is_string($value) && preg_match('/\A[1-9][0-9]*\z/', $value)) {
        $normalized = (int) $value;
    } else {
        return new WP_Error('field_value_invalid', 'Basic price is not a canonical positive integer.', ['status' => 409]);
    }
    return $normalized >= 1 && $normalized <= 1000000
        ? $normalized
        : new WP_Error('field_value_invalid', 'Basic price is outside the allowed range.', ['status' => 409]);
}

/** @param mixed $value */
function escomi_coverage_current_canonical_json(string $field, bool $exists, $value)
{
    $canonical_value = escomi_coverage_canonical_field_value($field, $exists, $value);
    if (is_wp_error($canonical_value)) {
        return $canonical_value;
    }
    return escomi_coverage_canonical_json([
        'field' => $field,
        'exists' => $exists,
        'value' => $canonical_value,
    ]);
}

/** @param mixed $value */
function escomi_coverage_current_hash(string $field, bool $exists, $value)
{
    $canonical = escomi_coverage_current_canonical_json($field, $exists, $value);
    return is_wp_error($canonical) ? $canonical : hash('sha256', $canonical);
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
    if (!in_array($params['mode'], ['dry_run', 'apply', 'reconcile'], true)) {
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
    $manifest_bytes = (string) file_get_contents($manifest_path);
    if (!hash_equals(ESKOMI_COVERAGE_MANIFEST_SHA256, hash('sha256', $manifest_bytes))) {
        return new WP_Error('manifest_digest_mismatch', 'Coverage manifest digest mismatch.', ['status' => 503]);
    }
    try {
        $manifest = json_decode($manifest_bytes, true, 512, JSON_THROW_ON_ERROR);
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
        return (is_int($value) || (is_string($value) && preg_match('/\A[1-9][0-9]*\z/', $value)))
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
        'area_contract', 'batch_id', 'candidate_row_count', 'candidate_rows', 'execution_entity_count',
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
        || !is_array($manifest['candidate_rows'] ?? null)
        || !is_array($manifest['source_hashes'] ?? null)
        || count($manifest['operations']) !== 28
        || count($manifest['candidate_rows']) !== 30
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
        $allowed_statuses = [
            'UPDATE_EXISTING' => ['READY_UPDATE'],
            'CREATE_NEW' => ['READY_CREATE', 'HOLD'],
            'ADD_AREA_RELATION' => ['READY_RELATION'],
        ];
        if (!isset($allowed_statuses[$action])
            || !in_array($operation['dry_run_status'] ?? '', $allowed_statuses[$action], true)
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
        } elseif ($action === 'CREATE_NEW') {
            $payload_keys[] = 'physical_location_evidence';
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
                || !is_array($payload['physical_location_evidence'] ?? null)
            ) {
                return new WP_Error('manifest_invalid', 'Create contract mismatch.', ['status' => 503]);
            }
            $has_location = false;
            foreach ($payload['physical_location_evidence'] as $evidence) {
                if (!is_array($evidence)
                    || !escomi_coverage_exact_keys($evidence, [
                        'access', 'address', 'final_area_class', 'observed_at',
                        'source', 'station', 'target_area',
                    ])
                    || !in_array($evidence['target_area'] ?? '', ['新大阪', '堺東'], true)
                    || !in_array($evidence['final_area_class'] ?? '', ['CORE_LOCATION', 'BROAD_NEARBY'], true)
                    || !str_starts_with((string) ($evidence['source'] ?? ''), 'https://')
                    || ($evidence['observed_at'] ?? '') === ''
                ) {
                    return new WP_Error('manifest_invalid', 'Physical location evidence mismatch.', ['status' => 503]);
                }
                $has_location = $has_location || trim(
                    (string) ($evidence['address'] ?? '')
                    . (string) ($evidence['station'] ?? '')
                    . (string) ($evidence['access'] ?? '')
                ) !== '';
            }
            if (($operation['dry_run_status'] === 'READY_CREATE') !== $has_location) {
                return new WP_Error('manifest_invalid', 'Create readiness does not match location evidence.', ['status' => 503]);
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
    $candidate_keys = [
        'action', 'area_term_id', 'basic_verified', 'canonical_name',
        'final_area_class', 'mapping_status', 'master_shop_id', 'operation_id',
        'target_area', 'wp_id', 'wp_slug',
    ];
    foreach ($manifest['candidate_rows'] as $candidate) {
        if (!is_array($candidate)
            || !escomi_coverage_exact_keys($candidate, $candidate_keys)
            || ($candidate['basic_verified'] ?? null) !== true
            || !in_array($candidate['target_area'] ?? '', ['新大阪', '堺東'], true)
            || !in_array($candidate['area_term_id'] ?? null, [13, 17], true)
            || !in_array($candidate['operation_id'] ?? '', $ids, true)
        ) {
            return new WP_Error('manifest_invalid', 'Candidate projection mismatch.', ['status' => 503]);
        }
    }
    return true;
}

function escomi_coverage_validate_area_contract()
{
    $contract = [
        2 => ['slug' => 'osaka', 'parent' => 0],
        13 => ['slug' => 'shinosaka', 'parent' => 2],
        17 => ['slug' => 'sakai', 'parent' => 2],
    ];
    foreach ($contract as $term_id => $expected) {
        $term = get_term($term_id, 'area');
        if (is_wp_error($term)
            || !is_object($term)
            || (int) ($term->term_id ?? 0) !== $term_id
            || (string) ($term->slug ?? '') !== $expected['slug']
            || (string) ($term->taxonomy ?? '') !== 'area'
            || (int) ($term->parent ?? 0) !== $expected['parent']
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

function escomi_coverage_allowed_derived_area_terms(array $required)
{
    $required = array_values(array_unique(array_map('intval', $required)));
    sort($required, SORT_NUMERIC);
    if (!$required || array_diff($required, [13, 17])) {
        return new WP_Error('manifest_invalid', 'Required area relation contract mismatch.', ['status' => 503]);
    }
    $area_contract = escomi_coverage_validate_area_contract();
    if (is_wp_error($area_contract)) {
        return $area_contract;
    }
    $allowed = [];
    foreach ($required as $term_id) {
        $ancestors = get_ancestors($term_id, 'area', 'taxonomy');
        if (!is_array($ancestors)) {
            return new WP_Error('area_contract_mismatch', 'Area ancestors are unavailable.', [
                'status' => 409,
                'term_id' => $term_id,
            ]);
        }
        foreach ($ancestors as $ancestor_id) {
            $ancestor_id = (int) $ancestor_id;
            if ($ancestor_id !== 2) {
                return new WP_Error('area_contract_mismatch', 'Area ancestor is outside the approved contract.', [
                    'status' => 409,
                    'term_id' => $term_id,
                    'ancestor_id' => $ancestor_id,
                ]);
            }
            $allowed[] = $ancestor_id;
        }
    }
    $allowed = array_values(array_unique($allowed));
    sort($allowed, SORT_NUMERIC);
    return $allowed;
}

function escomi_coverage_validate_area_relation_contract(array $required, array $actual)
{
    $required = array_values(array_unique(array_map('intval', $required)));
    $actual = array_values(array_unique(array_map('intval', $actual)));
    sort($required, SORT_NUMERIC);
    sort($actual, SORT_NUMERIC);
    $allowed_derived = escomi_coverage_allowed_derived_area_terms($required);
    if (is_wp_error($allowed_derived)) {
        return $allowed_derived;
    }
    $missing = array_values(array_diff($required, $actual));
    if ($missing) {
        return new WP_Error('missing_area_relation', 'Required area relation is missing.', [
            'status' => 409,
            'missing' => $missing,
        ]);
    }
    $unexpected = array_values(array_diff($actual, array_merge($required, $allowed_derived)));
    if ($unexpected) {
        return new WP_Error('unexpected_area_relation', 'Unexpected area relation was added.', [
            'status' => 409,
            'unexpected' => $unexpected,
        ]);
    }
    return [
        'required' => $required,
        'allowed_derived' => $allowed_derived,
        'actual' => $actual,
        'unexpected' => [],
    ];
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
        if ($allow_resume
            && ($existing['state'] ?? '') === 'retry_ready'
        ) {
            if (hash_equals((string) ($existing['attempt_id'] ?? ''), $attempt_id)) {
                return new WP_Error('attempt_reuse', 'Retry requires a new attempt identifier.', ['status' => 409]);
            }
            return escomi_coverage_transition_ledger($existing, [
                'state' => 'applying',
                'previous_attempt_id' => $existing['attempt_id'] ?? null,
                'attempt_id' => $attempt_id,
                'resumed' => true,
            ]);
        }
        if (($existing['state'] ?? '') === 'manual_review_required') {
            return new WP_Error('reconcile_required', 'Manual-review ledger requires reconciliation.', ['status' => 409]);
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

function escomi_coverage_transition_ledger_verified(array $expected, array $changes)
{
    $transitioned = escomi_coverage_transition_ledger($expected, $changes);
    if (!is_wp_error($transitioned)) {
        return $transitioned;
    }
    $current = escomi_coverage_current_ledger(
        (string) ($expected['batch_id'] ?? ''),
        (string) ($expected['operation_id'] ?? '')
    );
    if (is_wp_error($current)
        || !hash_equals(
            escomi_coverage_canonical_json($expected),
            escomi_coverage_canonical_json($current)
        )
    ) {
        return $transitioned;
    }
    return escomi_coverage_transition_ledger($current, $changes);
}

function escomi_coverage_force_terminal_ledger(
    string $batch_id,
    string $operation_id,
    string $attempt_id,
    string $payload_hash_value,
    array $changes
) {
    $current = escomi_coverage_current_ledger($batch_id, $operation_id);
    if (is_wp_error($current)
        || ($current['state'] ?? '') !== 'applying'
        || !hash_equals((string) ($current['attempt_id'] ?? ''), $attempt_id)
        || !hash_equals((string) ($current['payload_hash'] ?? ''), $payload_hash_value)
    ) {
        return new WP_Error('ledger_recovery_failed', 'Ledger is not eligible for terminal recovery.', ['status' => 503]);
    }
    $transitioned = escomi_coverage_transition_ledger_verified($current, $changes);
    if (!is_wp_error($transitioned)) {
        return $transitioned;
    }
    $current = escomi_coverage_current_ledger($batch_id, $operation_id);
    if (is_wp_error($current)
        || ($current['state'] ?? '') !== 'applying'
        || !hash_equals((string) ($current['attempt_id'] ?? ''), $attempt_id)
        || !hash_equals((string) ($current['payload_hash'] ?? ''), $payload_hash_value)
    ) {
        return new WP_Error('ledger_recovery_failed', 'Ledger changed before terminal recovery.', ['status' => 503]);
    }
    $next = array_replace($current, $changes, ['updated_at' => gmdate('c')]);
    $name = (string) ($current['option_name'] ?? '');
    if ($name === '' || $name !== escomi_coverage_ledger_option_name($batch_id, $operation_id)) {
        return new WP_Error('ledger_recovery_failed', 'Ledger identity is invalid during terminal recovery.', ['status' => 503]);
    }
    update_option($name, escomi_coverage_canonical_json($next), false);
    $readback = escomi_coverage_current_ledger($batch_id, $operation_id);
    return !is_wp_error($readback)
        && hash_equals(escomi_coverage_canonical_json($next), escomi_coverage_canonical_json($readback))
            ? $readback
            : new WP_Error('ledger_recovery_failed', 'Terminal ledger recovery did not persist.', ['status' => 503]);
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
    return array_keys(escomi_coverage_acf_contract());
}

function escomi_coverage_acf_contract(): array
{
    return [
        'official_url' => ['key' => 'field_6963dc02cb703', 'name' => 'official_url', 'type' => 'url'],
        'shop_address' => ['key' => 'field_6961cd30524ab', 'name' => 'shop_address', 'type' => 'text'],
        'basic_price' => ['key' => 'field_69620c6d5f836', 'name' => 'basic_price', 'type' => 'number'],
        'shop_hours' => ['key' => 'field_6961cd1b524aa', 'name' => 'shop_hours', 'type' => 'text'],
        'shop_tel' => ['key' => 'field_6961ccb0524a5', 'name' => 'shop_tel', 'type' => 'text'],
        'shop_booking' => ['key' => 'field_696452111cbb2', 'name' => 'shop_booking', 'type' => 'text'],
    ];
}

function escomi_coverage_validate_acf_contract(?array $field_names = null)
{
    $contract = escomi_coverage_acf_contract();
    $names = $field_names ?? array_keys($contract);
    if (!function_exists('get_field_object')) {
        return new WP_Error('acf_field_unavailable', 'ACF field definitions are unavailable.', ['status' => 503]);
    }
    $validated = [];
    foreach ($names as $field) {
        if (!is_string($field) || !isset($contract[$field])) {
            return new WP_Error('acf_field_unavailable', 'Approved ACF field is unavailable.', ['status' => 503]);
        }
        $expected = $contract[$field];
        $object = get_field_object($expected['key'], false, false);
        if (!is_array($object)) {
            return new WP_Error('acf_field_unavailable', 'Approved ACF field definition is unavailable.', [
                'status' => 503,
                'field' => $field,
            ]);
        }
        if (($object['key'] ?? null) !== $expected['key']
            || ($object['name'] ?? null) !== $expected['name']
            || ($object['type'] ?? null) !== $expected['type']
        ) {
            return new WP_Error('acf_field_contract_mismatch', 'Approved ACF field definition does not match.', [
                'status' => 409,
                'field' => $field,
            ]);
        }
        $validated[$field] = $expected;
    }
    return $validated;
}

function escomi_coverage_values_equivalent(string $field, $left, $right): bool
{
    $left_value = escomi_coverage_canonical_field_value($field, true, $left);
    $right_value = escomi_coverage_canonical_field_value($field, true, $right);
    if (is_wp_error($left_value) || is_wp_error($right_value)) {
        return false;
    }
    if ($field === 'basic_price') {
        return $left_value === $right_value;
    }
    if ($field === 'official_url') {
        return rtrim(strtolower(trim($left_value)), '/')
            === rtrim(strtolower(trim($right_value)), '/');
    }
    if ($field === 'shop_tel') {
        return preg_replace('/\D+/', '', $left_value)
            === preg_replace('/\D+/', '', $right_value);
    }
    if ($field === 'shop_address') {
        $normalize = static function ($value): string {
            $text = str_replace("\xc2\xa0", ' ', (string) $value);
            return preg_replace('/\s+/u', ' ', trim($text)) ?? '';
        };
        return $normalize($left_value) === $normalize($right_value);
    }
    return $left_value === $right_value;
}

function escomi_coverage_resolve_acf_field_key(string $field)
{
    $validated = escomi_coverage_validate_acf_contract([$field]);
    return is_wp_error($validated) ? $validated : $validated[$field]['key'];
}

function escomi_coverage_capture_field(int $post_id, string $field): array
{
    return [
        'field' => $field,
        'exists' => metadata_exists('post', $post_id, $field),
        'value' => get_field($field, $post_id, false),
        'reference_exists' => metadata_exists('post', $post_id, '_' . $field),
        'reference' => get_post_meta($post_id, '_' . $field, true),
    ];
}

function escomi_coverage_capture_allowlisted_fields(int $post_id): array
{
    $fields = [];
    foreach (escomi_coverage_allowed_fields() as $field) {
        $fields[$field] = escomi_coverage_capture_field($post_id, $field);
    }
    ksort($fields, SORT_STRING);
    return $fields;
}

function escomi_coverage_failure_scope($result): string
{
    if (!is_wp_error($result)) {
        return 'SAME_CONTRACT_READY';
    }
    $data = $result->get_error_data();
    return is_array($data) && ($data['failure_scope'] ?? '') === 'CANDIDATE_HOLD'
        ? 'CANDIDATE_HOLD'
        : 'SYSTEMIC_BLOCKING';
}

function escomi_coverage_provenance_source_error(string $code, string $message, array $data = []): WP_Error
{
    return new WP_Error($code, $message, array_merge([
        'status' => 409,
        'failure_scope' => 'CANDIDATE_HOLD',
    ], $data));
}

function escomi_coverage_candidate_hold_from_error(
    $error,
    string $action,
    $ledger,
    array $field_contracts
): array {
    return [
        'status' => 'HOLD',
        'classification' => 'CANDIDATE_HOLD',
        'hold_reason' => is_wp_error($error) ? (string) $error->get_error_code() : 'candidate_hold',
        'action' => $action,
        'duplicate' => false,
        'ledger' => $ledger,
        'field_contracts' => $field_contracts,
    ];
}

function escomi_coverage_is_candidate_preflight_error($error): bool
{
    return is_wp_error($error) && in_array((string) $error->get_error_code(), [
        'shop_not_found',
        'shop_identity_mismatch',
        'field_conflict',
        'field_value_invalid',
        'create_collision',
    ], true);
}

function escomi_coverage_canonical_source_host(string $url): string
{
    $parts = function_exists('wp_parse_url') ? wp_parse_url($url) : parse_url($url);
    $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
    return str_starts_with($host, 'www.') ? substr($host, 4) : $host;
}

function escomi_coverage_absolute_redirect_url(string $base, string $location): string
{
    $location = trim($location);
    if ($location === '') {
        return '';
    }
    $parts = function_exists('wp_parse_url') ? wp_parse_url($location) : parse_url($location);
    if (is_array($parts) && !empty($parts['scheme'])) {
        return $location;
    }
    $base_parts = function_exists('wp_parse_url') ? wp_parse_url($base) : parse_url($base);
    if (!is_array($base_parts) || empty($base_parts['scheme']) || empty($base_parts['host'])) {
        return '';
    }
    $origin = strtolower((string) $base_parts['scheme']) . '://' . (string) $base_parts['host'];
    if (!empty($base_parts['port'])) {
        $origin .= ':' . (int) $base_parts['port'];
    }
    if (str_starts_with($location, '//')) {
        return strtolower((string) $base_parts['scheme']) . ':' . $location;
    }
    if (str_starts_with($location, '/')) {
        return $origin . $location;
    }
    $path = (string) ($base_parts['path'] ?? '/');
    $directory = preg_replace('#/[^/]*$#', '/', $path);
    return $origin . ($directory ?: '/') . $location;
}

function escomi_coverage_resolve_provenance_source(string $source)
{
    if (!function_exists('escomi_shop_public_meta_url')
        || !function_exists('escomi_sanitize_shop_fact_provenance')
        || !function_exists('wp_safe_remote_head')
    ) {
        return new WP_Error('provenance_contract_unavailable', 'Production provenance sanitizer is unavailable.', [
            'status' => 503,
            'failure_scope' => 'SYSTEMIC_BLOCKING',
        ]);
    }
    $accepted = (string) escomi_shop_public_meta_url($source);
    if ($accepted === '') {
        return escomi_coverage_provenance_source_error(
            'provenance_source_rejected',
            'Provenance source was rejected by WordPress URL safety.'
        );
    }
    $original_host = escomi_coverage_canonical_source_host($accepted);
    $current = $accepted;
    for ($redirects = 0; $redirects <= 5; $redirects++) {
        $response = wp_safe_remote_head($current, [
            'timeout' => 15,
            'redirection' => 0,
            'reject_unsafe_urls' => true,
            'sslverify' => true,
        ]);
        if (is_wp_error($response)) {
            return escomi_coverage_provenance_source_error(
                'provenance_source_rejected',
                'Provenance source safe request failed.',
                ['cause' => $response->get_error_code()]
            );
        }
        $status = (int) wp_remote_retrieve_response_code($response);
        if ($status === 405 && function_exists('wp_safe_remote_get')) {
            $response = wp_safe_remote_get($current, [
                'timeout' => 15,
                'redirection' => 0,
                'reject_unsafe_urls' => true,
                'sslverify' => true,
                'limit_response_size' => 1,
                'headers' => ['Range' => 'bytes=0-0'],
            ]);
            if (is_wp_error($response)) {
                return escomi_coverage_provenance_source_error(
                    'provenance_source_rejected',
                    'Provenance source bounded safe GET failed.',
                    ['cause' => $response->get_error_code()]
                );
            }
            $status = (int) wp_remote_retrieve_response_code($response);
        }
        if ($status >= 300 && $status < 400) {
            if ($redirects === 5) {
                return escomi_coverage_provenance_source_error(
                    'provenance_source_rejected',
                    'Provenance source exceeded the redirect limit.'
                );
            }
            $next = escomi_coverage_absolute_redirect_url(
                $current,
                (string) wp_remote_retrieve_header($response, 'location')
            );
            $next = $next === '' ? '' : (string) escomi_shop_public_meta_url($next);
            if ($next === ''
                || !hash_equals($original_host, escomi_coverage_canonical_source_host($next))
            ) {
                return escomi_coverage_provenance_source_error(
                    'provenance_source_rejected',
                    'Provenance redirect violated the public host contract.'
                );
            }
            $current = $next;
            continue;
        }
        if ($status < 200 || $status >= 300) {
            return escomi_coverage_provenance_source_error(
                'provenance_source_rejected',
                'Provenance source did not return a safely reachable response.',
                ['http_status' => $status]
            );
        }
        return $current;
    }
    return escomi_coverage_provenance_source_error(
        'provenance_source_rejected',
        'Provenance source could not be resolved safely.'
    );
}

function escomi_coverage_prepare_provenance(array $current, array $field_items)
{
    $replace = [];
    $resolved = [];
    foreach ($field_items as $item) {
        $category = escomi_coverage_provenance_field((string) ($item['field'] ?? ''));
        if ($category === null) {
            continue;
        }
        $source = (string) ($item['source'] ?? '');
        if (!array_key_exists($source, $resolved)) {
            $resolved[$source] = escomi_coverage_resolve_provenance_source($source);
        }
        if (is_wp_error($resolved[$source])) {
            return $resolved[$source];
        }
        $replace[$category] = array_merge($item, ['resolved_source' => $resolved[$source]]);
    }
    $next = [];
    foreach ($current as $record) {
        if (is_array($record) && !isset($replace[(string) ($record['field'] ?? '')])) {
            $next[] = $record;
        }
    }
    foreach ($replace as $category => $item) {
        $next[] = [
            'field' => $category,
            'sourceUrl' => (string) $item['resolved_source'],
            'sourceType' => 'official-site',
            'observedAt' => substr((string) ($item['observed_at'] ?? ''), 0, 10),
            'reviewedAt' => gmdate('Y-m-d'),
            'reviewStatus' => 'reviewed',
            'publishedValueHash' => escomi_coverage_payload_hash($item['proposed_value'] ?? null),
        ];
    }
    $sanitized = escomi_sanitize_shop_fact_provenance($next);
    if (!is_array($sanitized)
        || escomi_coverage_canonical_json($sanitized) !== escomi_coverage_canonical_json($next)
    ) {
        return escomi_coverage_provenance_source_error(
            'provenance_source_rejected',
            'Production provenance sanitizer rejected or transformed a source record.'
        );
    }
    return [
        'status' => 'PROVENANCE_READY',
        'current_hash' => escomi_coverage_payload_hash($current),
        'records' => $sanitized,
        'resolved_sources' => $resolved,
    ];
}

function escomi_coverage_field_snapshots_equal(array $expected, array $actual): bool
{
    if (array_keys($expected) !== array_keys($actual)) {
        return false;
    }
    foreach ($expected as $field => $before) {
        $after = $actual[$field] ?? null;
        $exists = (bool) ($before['exists'] ?? false);
        if (!is_array($before)
            || !is_array($after)
            || $exists !== (bool) ($after['exists'] ?? false)
            || (bool) ($before['reference_exists'] ?? false) !== (bool) ($after['reference_exists'] ?? false)
            || (string) ($before['reference'] ?? '') !== (string) ($after['reference'] ?? '')
            || ($exists
                ? !escomi_coverage_values_equivalent(
                    (string) $field,
                    $before['value'] ?? null,
                    $after['value'] ?? null
                )
                : ($before['value'] ?? null) !== ($after['value'] ?? null))
        ) {
            return false;
        }
    }
    return true;
}

function escomi_coverage_write_acf_value(int $post_id, string $field, string $field_key, $value): bool
{
    update_field($field_key, $value, $post_id);
    return metadata_exists('post', $post_id, $field)
        && metadata_exists('post', $post_id, '_' . $field)
        && hash_equals($field_key, (string) get_post_meta($post_id, '_' . $field, true))
        && escomi_coverage_values_equivalent($field, get_field($field, $post_id, false), $value);
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
                continue;
            }
            if (!empty($snapshot['reference_exists'])) {
                update_post_meta($post_id, '_' . $field, $snapshot['reference']);
                if ((string) get_post_meta($post_id, '_' . $field, true) !== (string) $snapshot['reference']) {
                    $ok = false;
                }
            } else {
                delete_post_meta($post_id, '_' . $field);
                if (metadata_exists('post', $post_id, '_' . $field)) {
                    $ok = false;
                }
            }
        } else {
            delete_post_meta($post_id, $field);
            delete_post_meta($post_id, '_' . $field);
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

function escomi_coverage_write_provenance(
    int $post_id,
    array $field_items,
    ?array $prepared_plan = null
): array
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
    $plan = $prepared_plan ?? escomi_coverage_prepare_provenance($current, $field_items);
    if (is_wp_error($plan)) {
        $data = $plan->get_error_data();
        $data = is_array($data) ? $data : [];
        $data['post_id'] = $post_id;
        $plan->add_data($data);
        return ['error' => $plan];
    }
    if (($plan['status'] ?? '') !== 'PROVENANCE_READY'
        || !is_array($plan['records'] ?? null)
        || !is_string($plan['current_hash'] ?? null)
        || !hash_equals($plan['current_hash'], escomi_coverage_payload_hash($current))
    ) {
        return ['error' => new WP_Error(
            'provenance_plan_conflict',
            'Prepared provenance state changed before apply.',
            ['status' => 409, 'post_id' => $post_id]
        )];
    }
    $next = $plan['records'];
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

function escomi_coverage_expected_provenance(array $field_items): array
{
    $expected = [];
    foreach ($field_items as $item) {
        $category = escomi_coverage_provenance_field((string) ($item['field'] ?? ''));
        if ($category === null) {
            continue;
        }
        $expected[$category] = [
            'field' => $category,
            'sourceUrl' => (string) ($item['source'] ?? ''),
            'sourceType' => 'official-site',
            'observedAt' => substr((string) ($item['observed_at'] ?? ''), 0, 10),
            'reviewStatus' => 'reviewed',
            'publishedValueHash' => escomi_coverage_payload_hash($item['proposed_value'] ?? null),
        ];
    }
    ksort($expected, SORT_STRING);
    return $expected;
}

function escomi_coverage_validate_provenance_state(
    array $snapshot,
    array $field_items,
    ?array $prepared_plan = null
): bool
{
    $expected = [];
    if (is_array($prepared_plan['records'] ?? null)) {
        foreach ($prepared_plan['records'] as $record) {
            if (!is_array($record) || !is_string($record['field'] ?? null)) {
                return false;
            }
            $expected[(string) $record['field']] = [
                'field' => (string) $record['field'],
                'sourceUrl' => (string) ($record['sourceUrl'] ?? ''),
                'sourceType' => (string) ($record['sourceType'] ?? ''),
                'observedAt' => (string) ($record['observedAt'] ?? ''),
                'reviewStatus' => (string) ($record['reviewStatus'] ?? ''),
                'publishedValueHash' => (string) ($record['publishedValueHash'] ?? ''),
            ];
        }
        ksort($expected, SORT_STRING);
    } else {
        $expected = escomi_coverage_expected_provenance($field_items);
    }
    if (!$expected) {
        return !($snapshot['exists'] ?? false);
    }
    if ((bool) ($snapshot['exists'] ?? false) !== (bool) $expected
        || !is_array($snapshot['value'] ?? null)
        || count($snapshot['value']) !== count($expected)
    ) {
        return false;
    }
    $actual = [];
    foreach ($snapshot['value'] as $record) {
        if (!is_array($record)
            || !is_string($record['field'] ?? null)
            || !preg_match('/\A\d{4}-\d{2}-\d{2}\z/', (string) ($record['reviewedAt'] ?? ''))
        ) {
            return false;
        }
        $category = (string) $record['field'];
        if (isset($actual[$category])) {
            return false;
        }
        $actual[$category] = [
            'field' => $category,
            'sourceUrl' => (string) ($record['sourceUrl'] ?? ''),
            'sourceType' => (string) ($record['sourceType'] ?? ''),
            'observedAt' => (string) ($record['observedAt'] ?? ''),
            'reviewStatus' => (string) ($record['reviewStatus'] ?? ''),
            'publishedValueHash' => (string) ($record['publishedValueHash'] ?? ''),
        ];
    }
    ksort($actual, SORT_STRING);
    return $actual === $expected;
}

function escomi_coverage_capture_create_state(int $post_id)
{
    $post = get_post($post_id);
    $area_terms = escomi_coverage_current_area_terms($post_id);
    if (!$post || is_wp_error($area_terms)) {
        return is_wp_error($area_terms)
            ? $area_terms
            : new WP_Error('shop_not_found', 'Created shop could not be read.', ['status' => 404]);
    }
    return [
        'post' => [
            'id' => (int) $post_id,
            'type' => (string) get_post_type($post_id),
            'status' => (string) $post->post_status,
            'title' => (string) $post->post_title,
            'slug' => (string) $post->post_name,
        ],
        'fields' => escomi_coverage_capture_allowlisted_fields($post_id),
        'provenance' => escomi_coverage_capture_provenance($post_id),
        'primary' => [
            'exists' => metadata_exists('post', $post_id, 'shop_primary_area_term_id'),
            'value' => get_post_meta($post_id, 'shop_primary_area_term_id', true),
        ],
        'area_terms' => $area_terms,
    ];
}

function escomi_coverage_validate_create_current_state(
    array $operation,
    int $post_id,
    ?array $prepared_plan = null
)
{
    $state = escomi_coverage_capture_create_state($post_id);
    if (is_wp_error($state)) {
        return $state;
    }
    $payload = $operation['payload'] ?? [];
    $post = $state['post'];
    if ($post['type'] !== 'shop'
        || $post['status'] !== 'publish'
        || $post['title'] !== (string) ($payload['title'] ?? '')
        || $post['slug'] !== (string) ($payload['slug'] ?? '')
        || ($state['primary']['exists'] ?? false)
    ) {
        return new WP_Error('create_post_publish_readback_failed', 'Published shop identity or Primary Area changed.', [
            'status' => 409,
            'post_id' => $post_id,
        ]);
    }
    $proposed = [];
    foreach ($payload['fields'] ?? [] as $item) {
        $proposed[(string) ($item['field'] ?? '')] = $item;
    }
    $acf_contract = escomi_coverage_acf_contract();
    foreach ($state['fields'] as $field => $snapshot) {
        if (!isset($proposed[$field])) {
            if (($snapshot['exists'] ?? false) || ($snapshot['reference_exists'] ?? false)) {
                return new WP_Error('create_post_publish_readback_failed', 'An unplanned ACF field changed during publish.', [
                    'status' => 409,
                    'post_id' => $post_id,
                    'field' => $field,
                ]);
            }
            continue;
        }
        if (!($snapshot['exists'] ?? false)
            || !($snapshot['reference_exists'] ?? false)
            || !hash_equals((string) $acf_contract[$field]['key'], (string) ($snapshot['reference'] ?? ''))
            || !escomi_coverage_values_equivalent(
                $field,
                $snapshot['value'] ?? null,
                $proposed[$field]['proposed_value'] ?? null
            )
        ) {
            return new WP_Error('create_post_publish_readback_failed', 'An allowlisted ACF field changed during publish.', [
                'status' => 409,
                'post_id' => $post_id,
                'field' => $field,
            ]);
        }
    }
    if (!escomi_coverage_validate_provenance_state(
        $state['provenance'],
        $payload['fields'] ?? [],
        $prepared_plan
    )) {
        return new WP_Error('create_post_publish_readback_failed', 'Provenance changed during publish.', [
            'status' => 409,
            'post_id' => $post_id,
        ]);
    }
    $relations = escomi_coverage_validate_area_relation_contract(
        is_array($payload['area_terms'] ?? null) ? $payload['area_terms'] : [],
        $state['area_terms']
    );
    if (is_wp_error($relations)) {
        return $relations;
    }
    return [
        'state' => $state,
        'relation_contract' => $relations,
        'state_hash' => escomi_coverage_payload_hash($state),
    ];
}

function escomi_coverage_validate_create_post_publish_state(
    array $operation,
    int $post_id,
    array $draft_state,
    ?array $prepared_plan = null
) {
    $validated = escomi_coverage_validate_create_current_state(
        $operation,
        $post_id,
        $prepared_plan
    );
    if (is_wp_error($validated)) {
        return $validated;
    }
    $published = $validated['state'];
    if (!escomi_coverage_field_snapshots_equal($draft_state['fields'] ?? [], $published['fields'] ?? [])
        || escomi_coverage_canonical_json($draft_state['provenance'] ?? null)
            !== escomi_coverage_canonical_json($published['provenance'] ?? null)
        || escomi_coverage_canonical_json($draft_state['primary'] ?? null)
            !== escomi_coverage_canonical_json($published['primary'] ?? null)
    ) {
        return new WP_Error('create_post_publish_readback_failed', 'Published shop state changed after draft readback.', [
            'status' => 409,
            'post_id' => $post_id,
        ]);
    }
    return $validated;
}

function escomi_coverage_apply_update(array $operation, ?array $validation = null)
{
    $post_id = (int) ($operation['wp_id'] ?? $operation['payload']['wp_id'] ?? 0);
    if ($post_id < 1 || get_post_type($post_id) !== 'shop') {
        return new WP_Error('shop_not_found', 'Target shop was not found.', ['status' => 404]);
    }
    $fields = $operation['payload']['fields'] ?? null;
    if (!is_array($fields)) {
        return new WP_Error('manifest_invalid', 'Update fields are invalid.', ['status' => 503]);
    }
    $planned = is_array($validation['planned_fields'] ?? null) ? $validation['planned_fields'] : [];
    $snapshots = is_array($validation['field_snapshots'] ?? null) ? $validation['field_snapshots'] : [];
    if ($validation === null) {
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
        if (is_wp_error($actual_hash)) {
            return $actual_hash;
        }
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
    }
    foreach ($planned as $item) {
        if (!escomi_coverage_write_acf_value($post_id, $item['field'], $item['key'], $item['value'])) {
            escomi_coverage_restore_field_snapshots($post_id, $snapshots);
            return new WP_Error('field_write_failed', 'An approved field could not be written.', [
                'status' => 500,
                'field' => $item['field'],
            ]);
        }
        $readback = escomi_coverage_capture_field($post_id, $item['field']);
        if (!$readback['exists']
            || !escomi_coverage_values_equivalent($item['field'], $readback['value'], $item['value'])
        ) {
            escomi_coverage_restore_field_snapshots($post_id, $snapshots);
            return new WP_Error('field_readback_failed', 'An approved field did not match after write.', [
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
    $provenance = escomi_coverage_write_provenance(
        $post_id,
        $provenance_items,
        is_array($validation['provenance_plan'] ?? null) ? $validation['provenance_plan'] : null
    );
    if (isset($provenance['error'])) {
        escomi_coverage_restore_field_snapshots($post_id, $snapshots);
        return $provenance['error'];
    }
    $after_hashes = [];
    foreach ($snapshots as $snapshot) {
        $current = escomi_coverage_capture_field($post_id, $snapshot['field']);
        $after_hash = escomi_coverage_current_hash(
            $snapshot['field'],
            $current['exists'],
            $current['value']
        );
        if (is_wp_error($after_hash)) {
            escomi_coverage_restore_field_snapshots($post_id, $snapshots);
            escomi_coverage_restore_provenance($post_id, $provenance['snapshot']);
            return $after_hash;
        }
        $after_hashes[$snapshot['field']] = $after_hash;
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

function escomi_coverage_current_area_terms(int $post_id)
{
    $terms = wp_get_object_terms($post_id, 'area', ['fields' => 'ids']);
    if (is_wp_error($terms) || !is_array($terms)) {
        return new WP_Error('relation_read_failed', 'Area relations could not be read.', ['status' => 500]);
    }
    $terms = array_values(array_unique(array_map('intval', $terms)));
    sort($terms, SORT_NUMERIC);
    return $terms;
}

function escomi_coverage_restore_area_terms(int $post_id, array $before): bool
{
    $restored = wp_set_object_terms($post_id, $before, 'area', false);
    if (is_wp_error($restored)) {
        return false;
    }
    $readback = escomi_coverage_current_area_terms($post_id);
    return !is_wp_error($readback) && $readback === $before;
}

function escomi_coverage_apply_relation(array $operation, ?array $validation = null)
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
    $before = is_array($validation['area_before'] ?? null)
        ? $validation['area_before']
        : escomi_coverage_current_area_terms($post_id);
    if (is_wp_error($before)) {
        return $before;
    }
    $to_add = is_array($validation['area_terms_to_add'] ?? null)
        ? $validation['area_terms_to_add']
        : array_values(array_diff(array_map('intval', $requested), $before));
    if (!$to_add) {
        return ['post_id' => $post_id, 'changed' => false, 'rollback' => null];
    }
    $written = wp_set_object_terms($post_id, $to_add, 'area', true);
    if (is_wp_error($written)) {
        return new WP_Error('relation_write_failed', 'Area relation could not be added.', ['status' => 500]);
    }
    $after = escomi_coverage_current_area_terms($post_id);
    if (is_wp_error($after)) {
        return escomi_coverage_restore_area_terms($post_id, $before)
            ? $after
            : new WP_Error('relation_rollback_failed', 'Area relation read failed and restore was unsuccessful.', ['status' => 500]);
    }
    $expected_after = array_values(array_unique(array_merge($before, array_map('intval', $to_add))));
    sort($expected_after, SORT_NUMERIC);
    if ($after !== $expected_after) {
        if (!escomi_coverage_restore_area_terms($post_id, $before)) {
            return new WP_Error('relation_rollback_failed', 'Area relation readback failed and restore was unsuccessful.', ['status' => 500]);
        }
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
    if (get_post_status($post_id) === 'draft') {
        return true;
    }
    $updated = wp_update_post(['ID' => $post_id, 'post_status' => 'draft'], true);
    return !is_wp_error($updated) && get_post_status($post_id) === 'draft';
}

function escomi_coverage_create_state_hash(int $post_id, array $field_names)
{
    $state = escomi_coverage_capture_create_state($post_id);
    return is_wp_error($state) ? $state : escomi_coverage_payload_hash($state);
}

function escomi_coverage_apply_create(array $operation, array $ledger, ?array $validation = null)
{
    $payload = $operation['payload'] ?? [];
    if (($payload['action'] ?? '') !== 'CREATE_NEW'
        || empty($payload['title'])
        || empty($payload['slug'])
        || !is_array($payload['area_terms'] ?? null)
        || array_diff($payload['area_terms'], [13, 17])
        || !is_array($payload['physical_location_evidence'] ?? null)
        || !$payload['physical_location_evidence']
    ) {
        return new WP_Error('manifest_invalid', 'Create payload contract mismatch.', ['status' => 503]);
    }
    $field_keys = is_array($validation['field_keys'] ?? null) ? $validation['field_keys'] : [];
    foreach ($payload['fields'] ?? [] as $item) {
        $field = (string) ($item['field'] ?? '');
        $key = $field_keys[$field] ?? escomi_coverage_resolve_acf_field_key($field);
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
    $prepared_provenance = is_array($validation['provenance_plan'] ?? null)
        ? $validation['provenance_plan']
        : null;
    $provenance = escomi_coverage_write_provenance(
        $post_id,
        $payload['fields'] ?? [],
        $prepared_provenance
    );
    if (isset($provenance['error'])) {
        escomi_coverage_force_draft($post_id);
        return $provenance['error'];
    }
    $draft_state = escomi_coverage_capture_create_state($post_id);
    $post = is_wp_error($draft_state) ? null : $draft_state['post'];
    $readback_terms = is_wp_error($draft_state) ? $draft_state : $draft_state['area_terms'];
    $readback_ok = !is_wp_error($draft_state)
        && $post['type'] === 'shop'
        && $post['status'] === 'draft'
        && $post['title'] === (string) $payload['title']
        && $post['slug'] === (string) $payload['slug']
        && !($draft_state['primary']['exists'] ?? false)
        && $readback_terms === $terms
        && escomi_coverage_validate_provenance_state(
            $draft_state['provenance'] ?? [],
            $payload['fields'] ?? [],
            $prepared_provenance
        );
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
    $post_publish = escomi_coverage_validate_create_post_publish_state(
        $operation,
        $post_id,
        $draft_state,
        $prepared_provenance
    );
    if (is_wp_error($post_publish)) {
        if (!escomi_coverage_force_draft($post_id)) {
            return new WP_Error('create_recovery_failed', 'Published shop failed validation and could not be returned to draft.', [
                'status' => 500,
                'post_id' => $post_id,
                'cause' => $post_publish->get_error_code(),
            ]);
        }
        return $post_publish;
    }
    $field_names = array_values(array_map(
        static fn($item): string => (string) $item['field'],
        $payload['fields'] ?? []
    ));
    $after_hash = (string) $post_publish['state_hash'];
    return [
        'post_id' => $post_id,
        'changed' => true,
        'relation_contract' => $post_publish['relation_contract'],
        'rollback' => [
            'action' => 'CREATE_NEW',
            'post_id' => $post_id,
            'after_status' => 'publish',
            'slug' => (string) $payload['slug'],
            'field_names' => $field_names,
            'after_hash' => $after_hash,
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
            $current_hash = escomi_coverage_current_hash(
                (string) $field,
                $current['exists'],
                $current['value']
            );
            if (is_wp_error($current_hash) || !hash_equals((string) $expected_hash, $current_hash)) {
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
        if (is_wp_error($current)) {
            return $current;
        }
        if (!hash_equals((string) ($rollback['after_hash'] ?? ''), escomi_coverage_relation_hash($current))) {
            return new WP_Error('rollback_conflict', 'Area relations changed after apply.', ['status' => 409]);
        }
        $removed = wp_remove_object_terms($post_id, $rollback['area_terms_added'] ?? [], 'area');
        if (is_wp_error($removed) || $removed === false) {
            return new WP_Error('rollback_failed', 'Area relation rollback failed.', ['status' => 500]);
        }
        $readback = escomi_coverage_current_area_terms($post_id);
        if (is_wp_error($readback)) {
            return $readback;
        }
        return $readback === ($rollback['before_terms'] ?? [])
            ? true
            : new WP_Error('rollback_failed', 'Area relation rollback readback failed.', ['status' => 500]);
    }
    if ($action === 'CREATE_NEW') {
        $post = get_post($post_id);
        $current_state_hash = escomi_coverage_create_state_hash($post_id, $rollback['field_names'] ?? []);
        if (!$post
            || is_wp_error($current_state_hash)
            || get_post_status($post_id) !== ($rollback['after_status'] ?? '')
            || (string) $post->post_name !== (string) ($rollback['slug'] ?? '')
            || !hash_equals(
                (string) ($rollback['after_hash'] ?? ''),
                $current_state_hash
            )
        ) {
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

function escomi_coverage_optional_ledger(string $batch_id, string $operation_id)
{
    $stored = get_option(escomi_coverage_ledger_option_name($batch_id, $operation_id), false);
    if ($stored === false) {
        return null;
    }
    $ledger = is_string($stored) ? json_decode($stored, true) : null;
    return is_array($ledger)
        ? $ledger
        : new WP_Error('ledger_unavailable', 'Coverage ledger is unavailable.', ['status' => 503]);
}

function escomi_coverage_validate_existing_identity(array $operation)
{
    $post_id = (int) ($operation['wp_id'] ?? $operation['payload']['wp_id'] ?? 0);
    $post = $post_id > 0 ? get_post($post_id) : null;
    if (!$post || get_post_type($post_id) !== 'shop') {
        return new WP_Error('shop_not_found', 'Target shop was not found.', ['status' => 404]);
    }
    if ((string) $post->post_name !== (string) ($operation['payload']['slug'] ?? '')
        || get_post_status($post_id) !== 'publish'
    ) {
        return new WP_Error('shop_identity_mismatch', 'Target shop identity changed after mapping.', ['status' => 409]);
    }
    return ['post_id' => $post_id, 'post' => $post];
}

function escomi_coverage_validate_update_runtime(array $operation, array $field_contracts)
{
    $identity = escomi_coverage_validate_existing_identity($operation);
    if (is_wp_error($identity)) {
        return $identity;
    }
    $planned = [];
    $snapshots = [];
    $field_keys = [];
    foreach ($operation['payload']['fields'] ?? [] as $item) {
        $field = is_array($item) ? (string) ($item['field'] ?? '') : '';
        if (!isset($field_contracts[$field], $item['current_hash'])
            || !array_key_exists('proposed_value', $item)
        ) {
            return new WP_Error('manifest_invalid', 'Update field contract mismatch.', ['status' => 503]);
        }
        $snapshot = escomi_coverage_capture_field($identity['post_id'], $field);
        $actual_hash = escomi_coverage_current_hash($field, $snapshot['exists'], $snapshot['value']);
        if (is_wp_error($actual_hash)) {
            return $actual_hash;
        }
        if (!hash_equals((string) $item['current_hash'], $actual_hash)) {
            return new WP_Error('field_conflict', 'A target field changed after dry-run.', [
                'status' => 409,
                'field' => $field,
                'current_hash' => $actual_hash,
            ]);
        }
        $field_keys[$field] = $field_contracts[$field]['key'];
        if (!escomi_coverage_values_equivalent($field, $snapshot['value'], $item['proposed_value'])) {
            $snapshots[] = $snapshot;
            $planned[] = [
                'field' => $field,
                'key' => $field_contracts[$field]['key'],
                'value' => $item['proposed_value'],
            ];
        }
    }
    return [
        'post_id' => $identity['post_id'],
        'status' => $planned ? 'READY_UPDATE' : 'NO_CHANGE',
        'field_keys' => $field_keys,
        'field_snapshots' => $snapshots,
        'planned_fields' => $planned,
    ];
}

function escomi_coverage_validate_runtime_operation(array $manifest, array $operation, array $params)
{
    $capability = escomi_coverage_require_operation_capability($operation);
    if (is_wp_error($capability)) {
        return $capability;
    }
    if (!hash_equals((string) ($manifest['batch_id'] ?? ''), (string) ($params['batch_id'] ?? ''))
        || !hash_equals((string) ($operation['operation_id'] ?? ''), (string) ($params['operation_id'] ?? ''))
    ) {
        return new WP_Error('operation_not_found', 'Coverage operation was not found.', ['status' => 404]);
    }
    if (!hash_equals((string) ($operation['payload_hash'] ?? ''), (string) ($params['payload_hash'] ?? ''))
        || !hash_equals(
            (string) ($operation['payload_hash'] ?? ''),
            escomi_coverage_payload_hash($operation['payload'] ?? null)
        )
    ) {
        return new WP_Error('payload_mismatch', 'Payload hash mismatch.', ['status' => 409]);
    }
    $area = escomi_coverage_validate_area_contract();
    if (is_wp_error($area)) {
        return $area;
    }
    $field_contracts = escomi_coverage_validate_acf_contract();
    if (is_wp_error($field_contracts)) {
        return $field_contracts;
    }
    $ledger = escomi_coverage_optional_ledger((string) $params['batch_id'], (string) $params['operation_id']);
    if (is_wp_error($ledger)) {
        return $ledger;
    }
    if (is_array($ledger)) {
        if (!hash_equals((string) ($ledger['payload_hash'] ?? ''), (string) $operation['payload_hash'])) {
            return new WP_Error('payload_mismatch', 'Ledger payload mismatch.', ['status' => 409]);
        }
        $ledger_state = (string) ($ledger['state'] ?? '');
        if ($ledger_state === 'applied') {
            return [
                'status' => 'NO_CHANGE',
                'classification' => 'SAME_CONTRACT_READY',
                'action' => $operation['action'],
                'post_id' => $ledger['post_id'] ?? $operation['wp_id'] ?? null,
                'duplicate' => true,
                'ledger' => $ledger,
                'field_contracts' => $field_contracts,
            ];
        }
        if ($ledger_state === 'manual_review_required') {
            return new WP_Error('reconcile_required', 'Manual-review ledger requires reconciliation.', ['status' => 409]);
        }
        if ($ledger_state === 'candidate_hold_provenance') {
            return [
                'status' => 'HOLD',
                'classification' => 'CANDIDATE_HOLD',
                'hold_reason' => (string) ($ledger['hold_reason'] ?? 'provenance_source_rejected'),
                'action' => (string) ($operation['action'] ?? ''),
                'post_id' => $ledger['post_id'] ?? null,
                'duplicate' => true,
                'ledger' => $ledger,
                'field_contracts' => $field_contracts,
            ];
        }
        if ($ledger_state === 'retry_ready') {
            if (hash_equals((string) ($ledger['attempt_id'] ?? ''), (string) ($params['attempt_id'] ?? ''))) {
                return new WP_Error('attempt_reuse', 'Retry requires a new attempt identifier.', ['status' => 409]);
            }
        } else {
            return new WP_Error('operation_in_progress', 'Operation is already in progress.', ['status' => 409]);
        }
    }
    $action = (string) ($operation['action'] ?? '');
    if (in_array((string) ($operation['master_shop_id'] ?? ''), ESKOMI_COVERAGE_FIXED_HOLD_IDS, true)
        || ($operation['dry_run_status'] ?? '') === 'HOLD'
    ) {
        return [
            'status' => 'HOLD',
            'classification' => 'CANDIDATE_HOLD',
            'hold_reason' => 'fixed_hold',
            'action' => $action,
            'duplicate' => false,
            'ledger' => $ledger,
            'field_contracts' => $field_contracts,
        ];
    }
    if ($action === 'UPDATE_EXISTING') {
        $validation = escomi_coverage_validate_update_runtime($operation, $field_contracts);
    } elseif ($action === 'ADD_AREA_RELATION') {
        $identity = escomi_coverage_validate_existing_identity($operation);
        if (is_wp_error($identity)) {
            return escomi_coverage_is_candidate_preflight_error($identity)
                ? escomi_coverage_candidate_hold_from_error($identity, $action, $ledger, $field_contracts)
                : $identity;
        }
        $requested = $operation['payload']['area_terms_to_add'] ?? null;
        if (!is_array($requested) || array_diff($requested, [13, 17])) {
            return new WP_Error('manifest_invalid', 'Area relation contract mismatch.', ['status' => 503]);
        }
        $before = escomi_coverage_current_area_terms($identity['post_id']);
        if (is_wp_error($before)) {
            return $before;
        }
        $to_add = array_values(array_diff(array_map('intval', $requested), $before));
        $validation = [
            'post_id' => $identity['post_id'],
            'status' => $to_add ? 'READY_RELATION' : 'NO_CHANGE',
            'area_before' => $before,
            'area_terms_to_add' => $to_add,
        ];
    } elseif ($action === 'CREATE_NEW') {
        $resume_provenance_plan = null;
        $resume_post_id = is_array($ledger) && ($ledger['state'] ?? '') === 'retry_ready'
            ? (int) ($ledger['post_id'] ?? 0)
            : 0;
        if ($resume_post_id > 0) {
            if (($operation['operation_id'] ?? '') === 'coverage-m0240-create') {
                $m0240_contract = escomi_coverage_reconcile_contracts()['coverage-m0240-create'] ?? null;
                $m0240_state = is_array($m0240_contract)
                    ? escomi_coverage_validate_m0240_failed_draft($operation, $m0240_contract)
                    : new WP_Error('reconcile_contract_unavailable', 'M0240 retry contract is unavailable.', ['status' => 503]);
                if (is_wp_error($m0240_state)) {
                    return $m0240_state;
                }
                if (($m0240_state['target_state'] ?? '') === 'candidate_hold_provenance') {
                    $source_error = escomi_coverage_provenance_source_error(
                        (string) ($m0240_state['hold_reason'] ?? 'provenance_source_rejected'),
                        'M0240 provenance source is no longer ready for resume.',
                        ['post_id' => $resume_post_id]
                    );
                    return escomi_coverage_candidate_hold_from_error(
                        $source_error,
                        $action,
                        $ledger,
                        $field_contracts
                    );
                }
                if (!hash_equals(
                    (string) ($ledger['reconciled_state_hash'] ?? ''),
                    (string) ($m0240_state['state_hash'] ?? '')
                )) {
                    return new WP_Error(
                        'reconcile_state_mismatch',
                        'M0240 draft changed after reconciliation.',
                        ['status' => 409, 'post_id' => $resume_post_id]
                    );
                }
                $resume_provenance_plan = is_array($m0240_state['provenance_plan'] ?? null)
                    ? $m0240_state['provenance_plan']
                    : null;
            }
            $resume_post = get_post($resume_post_id);
            if (!$resume_post
                || get_post_type($resume_post_id) !== 'shop'
                || get_post_status($resume_post_id) !== 'draft'
                || (string) $resume_post->post_title !== (string) ($operation['payload']['title'] ?? '')
                || (string) $resume_post->post_name !== (string) ($operation['payload']['slug'] ?? '')
            ) {
                return new WP_Error(
                    'create_resume_mismatch',
                    'Ledger-owned draft identity changed before resume.',
                    ['status' => 409, 'post_id' => $resume_post_id]
                );
            }
        } else {
            $collision = escomi_coverage_check_create_collisions($operation);
            if (is_wp_error($collision)) {
                return escomi_coverage_is_candidate_preflight_error($collision)
                    ? escomi_coverage_candidate_hold_from_error($collision, $action, $ledger, $field_contracts)
                    : $collision;
            }
        }
        $field_keys = [];
        foreach ($operation['payload']['fields'] ?? [] as $item) {
            $field = (string) ($item['field'] ?? '');
            if (!isset($field_contracts[$field])) {
                return new WP_Error('manifest_invalid', 'Create field contract mismatch.', ['status' => 503]);
            }
            $field_keys[$field] = $field_contracts[$field]['key'];
        }
        $validation = [
            'post_id' => $resume_post_id ?: null,
            'status' => 'READY_CREATE',
            'field_keys' => $field_keys,
            'prevalidated_provenance_plan' => $resume_provenance_plan,
        ];
    } else {
        return new WP_Error('operation_not_ready', 'Coverage operation is not ready.', ['status' => 409]);
    }
    if (is_wp_error($validation)) {
        return escomi_coverage_is_candidate_preflight_error($validation)
            ? escomi_coverage_candidate_hold_from_error($validation, $action, $ledger, $field_contracts)
            : $validation;
    }
    $provenance_items = [];
    if ($action === 'UPDATE_EXISTING') {
        $planned_fields = array_fill_keys(array_map(
            static fn($item): string => (string) ($item['field'] ?? ''),
            $validation['planned_fields'] ?? []
        ), true);
        $provenance_items = array_values(array_filter(
            $operation['payload']['fields'] ?? [],
            static fn($item): bool => isset($planned_fields[(string) ($item['field'] ?? '')])
        ));
    } elseif ($action === 'CREATE_NEW') {
        $provenance_items = is_array($operation['payload']['fields'] ?? null)
            ? $operation['payload']['fields']
            : [];
    }
    if ($provenance_items) {
        $provenance_post_id = (int) ($validation['post_id'] ?? ($ledger['post_id'] ?? 0));
        $snapshot = $provenance_post_id > 0
            ? escomi_coverage_capture_provenance($provenance_post_id)
            : ['exists' => false, 'value' => []];
        $plan = is_array($validation['prevalidated_provenance_plan'] ?? null)
            ? $validation['prevalidated_provenance_plan']
            : escomi_coverage_prepare_provenance(
                is_array($snapshot['value'] ?? null) ? $snapshot['value'] : [],
                $provenance_items
            );
        if (is_wp_error($plan)) {
            return escomi_coverage_failure_scope($plan) === 'CANDIDATE_HOLD'
                ? escomi_coverage_candidate_hold_from_error($plan, $action, $ledger, $field_contracts)
                : $plan;
        }
        $validation['provenance_plan'] = $plan;
        $validation['provenance_status'] = $plan['status'];
    } else {
        $validation['provenance_plan'] = [
            'status' => 'PROVENANCE_READY',
            'records' => [],
            'resolved_sources' => [],
        ];
        $validation['provenance_status'] = 'PROVENANCE_READY';
    }
    return array_merge($validation, [
        'classification' => 'SAME_CONTRACT_READY',
        'action' => $action,
        'duplicate' => false,
        'ledger' => $ledger,
        'field_contracts' => $field_contracts,
    ]);
}

function escomi_coverage_reconcile_contracts(): array
{
    return [
        'coverage-m0004-update' => [
            'reconcile_kind' => 'retry_ready',
            'payload_hash' => 'df96873e26c250068e250efa2200ce83c13047c4f881fbf23c4a630dbe6fdaf7',
            'failure_audit_id' => 5066,
            'post_id' => 770,
            'status' => 'publish',
            'area_terms' => [2, 5, 13, 51],
            'primary_exists' => false,
            'provenance_exists' => false,
        ],
        'coverage-m0145-create' => [
            'reconcile_kind' => 'applied_create_relation',
            'payload_hash' => 'a10b11b53c194019eaa90edb690710acb7526808daa588fcca43643f301cbdec',
            'applied_audit_id' => 5071,
            'post_id' => 5070,
            'status' => 'publish',
            'required_area_terms' => [13, 17],
            'allowed_derived_area_terms' => [2],
            'primary_exists' => false,
        ],
        'coverage-m0240-create' => [
            'reconcile_kind' => 'failed_create_provenance',
            'payload_hash' => '97f46e383c7e25673bfbee20c6f4e32c9e352fac765638e3b4cc2192c8b03903',
            'failure_audit_id' => 5087,
            'failure_audit_post_id' => null,
            'post_id' => 5086,
            'status' => 'draft',
            'title' => '神々のエステ',
            'slug' => 'eskomi-m0240',
            'area_terms' => [13],
            'primary_exists' => false,
            'provenance_exists' => true,
            'provenance_value' => [],
            'failure_code' => 'provenance_write_failed',
        ],
    ];
}

function escomi_coverage_validate_m0240_failed_draft(array $operation, array $contract)
{
    if (!hash_equals((string) ($contract['payload_hash'] ?? ''), (string) ($operation['payload_hash'] ?? ''))
        || (string) ($operation['operation_id'] ?? '') !== 'coverage-m0240-create'
        || (string) ($operation['action'] ?? '') !== 'CREATE_NEW'
    ) {
        return new WP_Error('payload_mismatch', 'M0240 reconcile operation contract mismatch.', ['status' => 409]);
    }
    $post_id = (int) ($contract['post_id'] ?? 0);
    $post = get_post($post_id);
    $area_terms = escomi_coverage_current_area_terms($post_id);
    $provenance = escomi_coverage_capture_provenance($post_id);
    if (!$post
        || get_post_type($post_id) !== 'shop'
        || get_post_status($post_id) !== (string) $contract['status']
        || (string) $post->post_title !== (string) $contract['title']
        || (string) $post->post_name !== (string) $contract['slug']
        || is_wp_error($area_terms)
        || $area_terms !== $contract['area_terms']
        || metadata_exists('post', $post_id, 'shop_primary_area_term_id') !== (bool) $contract['primary_exists']
        || (bool) ($provenance['exists'] ?? false) !== (bool) $contract['provenance_exists']
        || escomi_coverage_canonical_json($provenance['value'] ?? null)
            !== escomi_coverage_canonical_json($contract['provenance_value'])
    ) {
        return new WP_Error('reconcile_state_mismatch', 'M0240 draft state does not match the recorded failure baseline.', ['status' => 409]);
    }
    $field_contracts = escomi_coverage_validate_acf_contract();
    if (is_wp_error($field_contracts)) {
        return $field_contracts;
    }
    $expected_fields = [];
    foreach ($operation['payload']['fields'] ?? [] as $item) {
        $field = (string) ($item['field'] ?? '');
        if (!isset($field_contracts[$field])) {
            return new WP_Error('manifest_invalid', 'M0240 field contract mismatch.', ['status' => 503]);
        }
        $snapshot = escomi_coverage_capture_field($post_id, $field);
        if (!($snapshot['exists'] ?? false)
            || !($snapshot['reference_exists'] ?? false)
            || !hash_equals((string) $field_contracts[$field]['key'], (string) ($snapshot['reference'] ?? ''))
            || !escomi_coverage_values_equivalent($field, $snapshot['value'] ?? null, $item['proposed_value'] ?? null)
        ) {
            return new WP_Error('reconcile_state_mismatch', 'M0240 draft ACF state changed.', ['status' => 409, 'field' => $field]);
        }
        $expected_fields[$field] = $snapshot;
    }
    foreach (escomi_coverage_capture_allowlisted_fields($post_id) as $field => $snapshot) {
        if (!isset($expected_fields[$field])
            && (($snapshot['exists'] ?? false) || ($snapshot['reference_exists'] ?? false))
        ) {
            return new WP_Error('reconcile_state_mismatch', 'M0240 draft contains an unplanned ACF value.', ['status' => 409, 'field' => $field]);
        }
    }
    $plan = escomi_coverage_prepare_provenance(
        is_array($provenance['value'] ?? null) ? $provenance['value'] : [],
        $operation['payload']['fields'] ?? []
    );
    if (is_wp_error($plan) && escomi_coverage_failure_scope($plan) !== 'CANDIDATE_HOLD') {
        return $plan;
    }
    $target = is_wp_error($plan) ? 'candidate_hold_provenance' : 'retry_ready';
    $hold_reason = is_wp_error($plan) ? (string) $plan->get_error_code() : null;
    return [
        'post_id' => $post_id,
        'target_state' => $target,
        'hold_reason' => $hold_reason,
        'provenance_plan' => is_wp_error($plan) ? null : $plan,
        'state_hash' => escomi_coverage_payload_hash([
            'post_id' => $post_id,
            'status' => (string) $contract['status'],
            'title' => (string) $contract['title'],
            'slug' => (string) $contract['slug'],
            'area_terms' => $area_terms,
            'primary_exists' => (bool) $contract['primary_exists'],
            'provenance' => $provenance,
            'fields' => $expected_fields,
            'target_state' => $target,
            'hold_reason' => $hold_reason,
            'prepared_records' => is_wp_error($plan) ? null : $plan['records'],
        ]),
    ];
}

function escomi_coverage_validate_m0240_failure_audit(
    array $operation,
    array $ledger,
    array $contract
): bool {
    $audit = get_post((int) $contract['failure_audit_id']);
    $body = $audit ? json_decode((string) $audit->post_content, true) : null;
    return $audit
        && $audit->post_type === ESKOMI_COVERAGE_AUDIT_POST_TYPE
        && $audit->post_status === 'private'
        && is_array($body)
        && ($body['batch_id'] ?? '') === ($ledger['batch_id'] ?? '')
        && ($body['state'] ?? '') === 'manual_review_required'
        && ($body['operation_id'] ?? '') === ($operation['operation_id'] ?? '')
        && ($body['payload_hash'] ?? '') === ($operation['payload_hash'] ?? '')
        && ($body['attempt_id'] ?? '') === ($ledger['original_attempt_id'] ?? $ledger['attempt_id'] ?? '')
        && array_key_exists('post_id', $body)
        && $body['post_id'] === ($contract['failure_audit_post_id'] ?? null)
        && ($body['error_code'] ?? '') === ($contract['failure_code'] ?? '');
}

function escomi_coverage_find_m0240_reconcile_audit(array $operation, array $ledger): ?int
{
    foreach ((array) get_posts([
        'post_type' => ESKOMI_COVERAGE_AUDIT_POST_TYPE,
        'post_status' => 'private',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true,
    ]) as $audit_id) {
        $audit = get_post((int) $audit_id);
        $body = $audit ? json_decode((string) $audit->post_content, true) : null;
        if ($audit
            && $audit->post_type === ESKOMI_COVERAGE_AUDIT_POST_TYPE
            && $audit->post_status === 'private'
            && is_array($body)
            && ($body['batch_id'] ?? '') === ($ledger['batch_id'] ?? '')
            && ($body['state'] ?? '') === ($ledger['reconcile_target_state'] ?? '')
            && ($body['operation_id'] ?? '') === ($operation['operation_id'] ?? '')
            && ($body['payload_hash'] ?? '') === ($operation['payload_hash'] ?? '')
            && ($body['attempt_id'] ?? '') === ($ledger['reconcile_attempt_id'] ?? '')
            && ($body['reconciled_state_hash'] ?? '') === ($ledger['reconciled_state_hash'] ?? '')
            && (int) ($body['previous_audit_id'] ?? 0) === (int) ($ledger['failure_audit_id'] ?? 0)
            && (int) ($body['post_id'] ?? 0) === (int) ($ledger['post_id'] ?? 0)
            && ($body['original_attempt_id'] ?? '') === ($ledger['original_attempt_id'] ?? '')
        ) {
            return (int) $audit_id;
        }
    }
    return null;
}

function escomi_coverage_reconcile_m0240_locked(
    array $manifest,
    array $operation,
    array $params,
    array $contract
) {
    $batch_id = (string) $params['batch_id'];
    $operation_id = (string) $operation['operation_id'];
    $ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
    if (is_wp_error($ledger)
        || (int) ($ledger['schema_version'] ?? 0) !== 1
        || ($ledger['batch_id'] ?? '') !== $batch_id
        || ($ledger['operation_id'] ?? '') !== $operation_id
        || !hash_equals((string) ($ledger['payload_hash'] ?? ''), (string) $operation['payload_hash'])
        || (int) ($ledger['post_id'] ?? 0) !== (int) $contract['post_id']
        || (int) ($ledger['audit_id'] ?? 0) !== (int) $contract['failure_audit_id']
        || ($ledger['option_name'] ?? '') !== escomi_coverage_ledger_option_name($batch_id, $operation_id)
    ) {
        return is_wp_error($ledger)
            ? $ledger
            : new WP_Error('reconcile_state_mismatch', 'M0240 ledger identity does not match.', ['status' => 409]);
    }
    $state = (string) ($ledger['state'] ?? '');
    if ($state === 'retry_ready') {
        return new WP_REST_Response([
            'status' => 'retry_ready',
            'classification' => 'SAME_CONTRACT_READY',
            'duplicate' => true,
            'operation_id' => $operation_id,
            'post_id' => (int) $contract['post_id'],
            'reconcile_audit_id' => $ledger['reconcile_audit_id'] ?? null,
        ], 200);
    }
    if ($state === 'candidate_hold_provenance'
        && ($ledger['reconcile_attempt_id'] ?? '') === (string) $params['attempt_id']
    ) {
        return new WP_REST_Response([
            'status' => 'candidate_hold_provenance',
            'classification' => 'CANDIDATE_HOLD',
            'duplicate' => true,
            'operation_id' => $operation_id,
            'post_id' => (int) $contract['post_id'],
            'reconcile_audit_id' => $ledger['reconcile_audit_id'] ?? null,
        ], 200);
    }
    if (!in_array($state, ['manual_review_required', 'candidate_hold_provenance', 'reconciling_m0240'], true)) {
        return new WP_Error('reconcile_state_mismatch', 'M0240 ledger is not eligible for reconciliation.', ['status' => 409]);
    }
    if (!escomi_coverage_validate_m0240_failure_audit($operation, $ledger, $contract)) {
        return new WP_Error('reconcile_audit_mismatch', 'M0240 original failure audit does not match.', ['status' => 409]);
    }
    if ($state !== 'reconciling_m0240') {
        $validated = escomi_coverage_validate_m0240_failed_draft($operation, $contract);
        if (is_wp_error($validated)) {
            return $validated;
        }
        $reserved = escomi_coverage_transition_ledger($ledger, [
            'state' => 'reconciling_m0240',
            'failure_audit_id' => (int) $contract['failure_audit_id'],
            'original_attempt_id' => (string) ($ledger['original_attempt_id'] ?? $ledger['attempt_id'] ?? ''),
            'reconcile_attempt_id' => (string) $params['attempt_id'],
            'reconcile_target_state' => (string) $validated['target_state'],
            'reconciled_state_hash' => (string) $validated['state_hash'],
            'hold_reason' => $validated['hold_reason'],
        ]);
        if (is_wp_error($reserved)) {
            return $reserved;
        }
        $ledger = $reserved;
    } elseif (($ledger['reconcile_attempt_id'] ?? '') !== (string) $params['attempt_id']) {
        return new WP_Error('reconcile_state_mismatch', 'M0240 reconcile attempt changed while reserved.', ['status' => 409]);
    } else {
        $validated = escomi_coverage_validate_m0240_failed_draft($operation, $contract);
        if (is_wp_error($validated)
            || !hash_equals((string) ($ledger['reconciled_state_hash'] ?? ''), (string) ($validated['state_hash'] ?? ''))
            || ($ledger['reconcile_target_state'] ?? '') !== ($validated['target_state'] ?? '')
        ) {
            return is_wp_error($validated)
                ? $validated
                : new WP_Error('reconcile_state_mismatch', 'M0240 draft changed while reconciliation was reserved.', ['status' => 409]);
        }
    }
    $audit_id = escomi_coverage_find_m0240_reconcile_audit($operation, $ledger);
    if ($audit_id === null) {
        $audit_id = escomi_coverage_append_audit([
            'batch_id' => $manifest['batch_id'],
            'operation_id' => $operation_id,
            'attempt_id' => (string) $ledger['reconcile_attempt_id'],
            'state' => (string) $ledger['reconcile_target_state'],
            'classification' => ($ledger['reconcile_target_state'] ?? '') === 'retry_ready'
                ? 'SAME_CONTRACT_READY'
                : 'CANDIDATE_HOLD',
            'post_id' => (int) $contract['post_id'],
            'payload_hash' => $operation['payload_hash'],
            'previous_audit_id' => (int) $contract['failure_audit_id'],
            'reconciled_state_hash' => (string) $ledger['reconciled_state_hash'],
            'original_attempt_id' => (string) $ledger['original_attempt_id'],
            'hold_reason' => $ledger['hold_reason'] ?? null,
        ]);
    }
    if (is_wp_error($audit_id)) {
        return $audit_id;
    }
    $target = (string) $ledger['reconcile_target_state'];
    $transitioned = escomi_coverage_transition_ledger($ledger, [
        'state' => $target,
        'reconcile_audit_id' => $audit_id,
        'reconciled_at' => gmdate('c'),
    ]);
    return is_wp_error($transitioned)
        ? $transitioned
        : new WP_REST_Response([
            'status' => $target,
            'classification' => $target === 'retry_ready' ? 'SAME_CONTRACT_READY' : 'CANDIDATE_HOLD',
            'duplicate' => false,
            'operation_id' => $operation_id,
            'post_id' => (int) $contract['post_id'],
            'reconcile_audit_id' => $audit_id,
        ], 200);
}

function escomi_coverage_validate_reconcile_state(array $operation, array $contract)
{
    if (!hash_equals((string) $contract['payload_hash'], (string) ($operation['payload_hash'] ?? ''))
        || (int) ($operation['wp_id'] ?? 0) !== (int) $contract['post_id']
    ) {
        return new WP_Error('payload_mismatch', 'Reconcile operation contract mismatch.', ['status' => 409]);
    }
    $identity = escomi_coverage_validate_existing_identity($operation);
    $area_terms = escomi_coverage_current_area_terms((int) $contract['post_id']);
    if (is_wp_error($area_terms)) {
        return $area_terms;
    }
    if (is_wp_error($identity)
        || get_post_status((int) $contract['post_id']) !== $contract['status']
        || $area_terms !== $contract['area_terms']
        || metadata_exists('post', (int) $contract['post_id'], 'shop_primary_area_term_id') !== $contract['primary_exists']
        || metadata_exists('post', (int) $contract['post_id'], 'shop_fact_provenance') !== $contract['provenance_exists']
    ) {
        return new WP_Error('reconcile_state_mismatch', 'Reconcile shop state does not match the recorded baseline.', ['status' => 409]);
    }
    $field_contracts = escomi_coverage_validate_acf_contract();
    if (is_wp_error($field_contracts)) {
        return $field_contracts;
    }
    $validated = escomi_coverage_validate_update_runtime($operation, $field_contracts);
    if (is_wp_error($validated)) {
        $details = escomi_coverage_error_details($validated);
        return in_array($details['code'], ['field_conflict', 'field_value_invalid'], true)
            ? new WP_Error('reconcile_state_mismatch', 'Reconcile field state does not match the recorded baseline.', ['status' => 409])
            : $validated;
    }
    $hashes = [];
    foreach ($operation['payload']['fields'] ?? [] as $item) {
        $field = (string) $item['field'];
        $snapshot = escomi_coverage_capture_field((int) $contract['post_id'], $field);
        $hash = escomi_coverage_current_hash($field, $snapshot['exists'], $snapshot['value']);
        if (is_wp_error($hash)) {
            return $hash;
        }
        $hashes[$field] = $hash;
    }
    return [
        'post_id' => (int) $contract['post_id'],
        'state_hash' => escomi_coverage_payload_hash([
            'post_id' => (int) $contract['post_id'],
            'slug' => (string) ($operation['payload']['slug'] ?? ''),
            'status' => (string) $contract['status'],
            'area_terms' => $contract['area_terms'],
            'primary_exists' => $contract['primary_exists'],
            'provenance_exists' => $contract['provenance_exists'],
            'field_hashes' => $hashes,
        ]),
    ];
}

function escomi_coverage_find_reconcile_audit(array $operation, array $ledger): ?int
{
    $ids = get_posts([
        'post_type' => ESKOMI_COVERAGE_AUDIT_POST_TYPE,
        'post_status' => 'private',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true,
    ]);
    foreach (is_array($ids) ? $ids : [] as $audit_id) {
        $audit = get_post((int) $audit_id);
        $body = $audit ? json_decode((string) $audit->post_content, true) : null;
        if ($audit
            && $audit->post_type === ESKOMI_COVERAGE_AUDIT_POST_TYPE
            && $audit->post_status === 'private'
            && is_array($body)
            && ($body['state'] ?? '') === 'retry_ready'
            && ($body['operation_id'] ?? '') === ($operation['operation_id'] ?? '')
            && ($body['payload_hash'] ?? '') === ($operation['payload_hash'] ?? '')
            && ($body['attempt_id'] ?? '') === ($ledger['reconcile_attempt_id'] ?? '')
            && ($body['reconciled_state_hash'] ?? '') === ($ledger['reconciled_state_hash'] ?? '')
            && (int) ($body['previous_audit_id'] ?? 0) === (int) ($ledger['previous_audit_id'] ?? 0)
        ) {
            return (int) $audit_id;
        }
    }
    return null;
}

function escomi_coverage_find_applied_relation_reconcile_audit(array $operation, array $ledger): ?int
{
    $required = array_values(array_unique(array_map(
        'intval',
        is_array($operation['payload']['area_terms'] ?? null) ? $operation['payload']['area_terms'] : []
    )));
    sort($required, SORT_NUMERIC);
    $allowed_derived = escomi_coverage_allowed_derived_area_terms($required);
    if (is_wp_error($allowed_derived)) {
        return null;
    }
    $actual = array_values(array_unique(array_merge($required, $allowed_derived)));
    sort($actual, SORT_NUMERIC);
    $ids = get_posts([
        'post_type' => ESKOMI_COVERAGE_AUDIT_POST_TYPE,
        'post_status' => 'private',
        'posts_per_page' => -1,
        'fields' => 'ids',
        'no_found_rows' => true,
    ]);
    foreach (is_array($ids) ? $ids : [] as $audit_id) {
        $audit = get_post((int) $audit_id);
        $body = $audit ? json_decode((string) $audit->post_content, true) : null;
        if ($audit
            && $audit->post_type === ESKOMI_COVERAGE_AUDIT_POST_TYPE
            && $audit->post_status === 'private'
            && is_array($body)
            && ($body['state'] ?? '') === 'applied_reconciled'
            && ($body['batch_id'] ?? '') === ($ledger['batch_id'] ?? '')
            && ($body['operation_id'] ?? '') === ($operation['operation_id'] ?? '')
            && ($body['payload_hash'] ?? '') === ($operation['payload_hash'] ?? '')
            && ($body['attempt_id'] ?? '') === ($ledger['relation_reconcile_attempt_id'] ?? '')
            && ($body['reconciled_state_hash'] ?? '') === ($ledger['reconciled_state_hash'] ?? '')
            && (int) ($body['previous_audit_id'] ?? 0) === (int) ($ledger['previous_audit_id'] ?? 0)
            && (int) ($body['post_id'] ?? 0) === (int) ($ledger['post_id'] ?? 0)
            && ($body['original_attempt_id'] ?? '') === ($ledger['original_attempt_id'] ?? '')
            && ($body['required_area_terms'] ?? null) === $required
            && ($body['allowed_derived_area_terms'] ?? null) === $allowed_derived
            && ($body['actual_area_terms'] ?? null) === $actual
        ) {
            return (int) $audit_id;
        }
    }
    return null;
}

function escomi_coverage_validate_applied_create_reconcile_state(array $operation, array $contract)
{
    if (!hash_equals((string) ($contract['payload_hash'] ?? ''), (string) ($operation['payload_hash'] ?? ''))
        || (string) ($operation['action'] ?? '') !== 'CREATE_NEW'
        || (int) ($contract['post_id'] ?? 0) < 1
    ) {
        return new WP_Error('payload_mismatch', 'Applied create reconcile contract mismatch.', ['status' => 409]);
    }
    $validated = escomi_coverage_validate_create_current_state($operation, (int) $contract['post_id']);
    if (is_wp_error($validated)) {
        return new WP_Error('reconcile_state_mismatch', 'Applied create state does not match.', [
            'status' => 409,
            'cause' => $validated->get_error_code(),
        ]);
    }
    $relations = $validated['relation_contract'];
    $expected_actual = array_values(array_unique(array_merge(
        $contract['required_area_terms'] ?? [],
        $contract['allowed_derived_area_terms'] ?? []
    )));
    sort($expected_actual, SORT_NUMERIC);
    if (($validated['state']['post']['status'] ?? '') !== ($contract['status'] ?? '')
        || ($relations['required'] ?? null) !== ($contract['required_area_terms'] ?? null)
        || ($relations['allowed_derived'] ?? null) !== ($contract['allowed_derived_area_terms'] ?? null)
        || ($relations['actual'] ?? null) !== $expected_actual
        || (bool) ($validated['state']['primary']['exists'] ?? false) !== (bool) ($contract['primary_exists'] ?? false)
    ) {
        return new WP_Error('reconcile_state_mismatch', 'Applied create relation state does not match.', ['status' => 409]);
    }
    return [
        'post_id' => (int) $contract['post_id'],
        'state_hash' => (string) $validated['state_hash'],
        'relation_contract' => $relations,
    ];
}

function escomi_coverage_reconcile_applied_create_locked(
    array $manifest,
    array $operation,
    array $params,
    array $contract
) {
    $batch_id = (string) $params['batch_id'];
    $operation_id = (string) $params['operation_id'];
    $ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
    if (is_wp_error($ledger)) {
        return $ledger;
    }
    if (!hash_equals((string) ($ledger['payload_hash'] ?? ''), (string) $operation['payload_hash'])) {
        return new WP_Error('payload_mismatch', 'Applied reconcile ledger payload mismatch.', ['status' => 409]);
    }
    if (($ledger['batch_id'] ?? '') !== $batch_id
        || ($ledger['operation_id'] ?? '') !== $operation_id
        || (int) ($ledger['post_id'] ?? 0) !== (int) $contract['post_id']
        || ($ledger['option_name'] ?? '') !== escomi_coverage_ledger_option_name($batch_id, $operation_id)
        || (int) ($ledger['schema_version'] ?? 0) !== 1
    ) {
        return new WP_Error('reconcile_state_mismatch', 'Applied reconcile ledger identity does not match.', ['status' => 409]);
    }
    if ((($ledger['state'] ?? '') === 'reconciling_applied' || !empty($ledger['relation_reconcile_audit_id']))
        && (($ledger['original_attempt_id'] ?? '') !== ($ledger['attempt_id'] ?? '')
            || empty($ledger['relation_reconcile_attempt_id']))
    ) {
        return new WP_Error('reconcile_state_mismatch', 'Applied reconcile ledger lineage does not match.', ['status' => 409]);
    }
    if (($ledger['state'] ?? '') === 'applied'
        && (int) ($ledger['audit_id'] ?? 0) === (int) $contract['applied_audit_id']
        && !empty($ledger['relation_reconcile_audit_id'])
    ) {
        $state = escomi_coverage_validate_applied_create_reconcile_state($operation, $contract);
        if (is_wp_error($state)
            || !hash_equals(
                (string) ($ledger['reconciled_state_hash'] ?? ''),
                (string) ($state['state_hash'] ?? '')
            )
        ) {
            return is_wp_error($state)
                ? $state
                : new WP_Error('reconcile_state_mismatch', 'Applied reconciled state changed.', ['status' => 409]);
        }
        $audit = get_post((int) $ledger['relation_reconcile_audit_id']);
        $body = $audit ? json_decode((string) $audit->post_content, true) : null;
        if (!$audit
            || $audit->post_type !== ESKOMI_COVERAGE_AUDIT_POST_TYPE
            || $audit->post_status !== 'private'
            || !is_array($body)
            || ($body['state'] ?? '') !== 'applied_reconciled'
            || ($body['batch_id'] ?? '') !== $manifest['batch_id']
            || ($body['operation_id'] ?? '') !== $operation_id
            || ($body['payload_hash'] ?? '') !== $operation['payload_hash']
            || ($body['attempt_id'] ?? '') !== ($ledger['relation_reconcile_attempt_id'] ?? '')
            || ($body['original_attempt_id'] ?? '') !== ($ledger['original_attempt_id'] ?? '')
            || ($body['reconciled_state_hash'] ?? '') !== ($ledger['reconciled_state_hash'] ?? '')
            || (int) ($body['previous_audit_id'] ?? 0) !== (int) $contract['applied_audit_id']
            || (int) ($body['post_id'] ?? 0) !== (int) $contract['post_id']
            || ($body['required_area_terms'] ?? null) !== ($state['relation_contract']['required'] ?? null)
            || ($body['allowed_derived_area_terms'] ?? null) !== ($state['relation_contract']['allowed_derived'] ?? null)
            || ($body['actual_area_terms'] ?? null) !== ($state['relation_contract']['actual'] ?? null)
        ) {
            return new WP_Error('reconcile_audit_mismatch', 'Applied reconcile audit does not match.', ['status' => 409]);
        }
        return new WP_REST_Response([
            'status' => 'applied_reconciled',
            'duplicate' => true,
            'operation_id' => $operation_id,
            'reconcile_audit_id' => (int) $ledger['relation_reconcile_audit_id'],
        ], 200);
    }
    if (($ledger['state'] ?? '') === 'applied'
        && (int) ($ledger['audit_id'] ?? 0) === (int) $contract['applied_audit_id']
    ) {
        $audit = get_post((int) $contract['applied_audit_id']);
        $body = $audit ? json_decode((string) $audit->post_content, true) : null;
        if (!$audit
            || $audit->post_type !== ESKOMI_COVERAGE_AUDIT_POST_TYPE
            || $audit->post_status !== 'private'
            || !is_array($body)
            || ($body['state'] ?? '') !== 'applied'
            || ($body['batch_id'] ?? '') !== $manifest['batch_id']
            || ($body['operation_id'] ?? '') !== $operation_id
            || ($body['payload_hash'] ?? '') !== $operation['payload_hash']
            || ($body['attempt_id'] ?? '') !== ($ledger['attempt_id'] ?? '')
            || (int) ($body['post_id'] ?? 0) !== (int) $contract['post_id']
        ) {
            return new WP_Error('reconcile_audit_mismatch', 'Original applied audit does not match.', ['status' => 409]);
        }
        $state = escomi_coverage_validate_applied_create_reconcile_state($operation, $contract);
        if (is_wp_error($state)) {
            return $state;
        }
        $ledger = escomi_coverage_transition_ledger($ledger, [
            'state' => 'reconciling_applied',
            'previous_audit_id' => (int) $contract['applied_audit_id'],
            'reconciled_state_hash' => $state['state_hash'],
            'relation_reconcile_attempt_id' => (string) $params['attempt_id'],
            'original_attempt_id' => (string) ($ledger['attempt_id'] ?? ''),
        ]);
        if (is_wp_error($ledger)) {
            return $ledger;
        }
    } elseif (($ledger['state'] ?? '') === 'reconciling_applied'
        && ($ledger['relation_reconcile_attempt_id'] ?? '') === (string) $params['attempt_id']
        && (int) ($ledger['previous_audit_id'] ?? 0) === (int) $contract['applied_audit_id']
    ) {
        $state = escomi_coverage_validate_applied_create_reconcile_state($operation, $contract);
        if (is_wp_error($state)
            || !hash_equals((string) ($ledger['reconciled_state_hash'] ?? ''), (string) ($state['state_hash'] ?? ''))
        ) {
            return is_wp_error($state)
                ? $state
                : new WP_Error('reconcile_state_mismatch', 'Applied state changed while reserved.', ['status' => 409]);
        }
    } else {
        return new WP_Error('reconcile_state_mismatch', 'Applied ledger is not eligible for reconciliation.', ['status' => 409]);
    }
    $reconcile_audit_id = escomi_coverage_find_applied_relation_reconcile_audit($operation, $ledger);
    if ($reconcile_audit_id === null) {
        $state = escomi_coverage_validate_applied_create_reconcile_state($operation, $contract);
        if (is_wp_error($state)) {
            return $state;
        }
        $relations = $state['relation_contract'];
        $reconcile_audit_id = escomi_coverage_append_audit([
            'batch_id' => $manifest['batch_id'],
            'operation_id' => $operation_id,
            'attempt_id' => (string) $ledger['relation_reconcile_attempt_id'],
            'state' => 'applied_reconciled',
            'post_id' => (int) $contract['post_id'],
            'payload_hash' => $operation['payload_hash'],
            'previous_audit_id' => (int) $contract['applied_audit_id'],
            'reconciled_state_hash' => (string) $ledger['reconciled_state_hash'],
            'original_attempt_id' => (string) ($ledger['original_attempt_id'] ?? ''),
            'required_area_terms' => $relations['required'],
            'allowed_derived_area_terms' => $relations['allowed_derived'],
            'actual_area_terms' => $relations['actual'],
        ]);
    }
    if (is_wp_error($reconcile_audit_id)) {
        return $reconcile_audit_id;
    }
    $completed = escomi_coverage_transition_ledger($ledger, [
        'state' => 'applied',
        'relation_reconcile_audit_id' => $reconcile_audit_id,
        'relation_reconciled_at' => gmdate('c'),
    ]);
    return is_wp_error($completed)
        ? $completed
        : new WP_REST_Response([
            'status' => 'applied_reconciled',
            'duplicate' => false,
            'operation_id' => $operation_id,
            'reconcile_audit_id' => $reconcile_audit_id,
        ], 200);
}

function escomi_coverage_reconcile_operation(array $manifest, array $operation, array $params)
{
    $capability = escomi_coverage_require_operation_capability($operation);
    if (is_wp_error($capability)) {
        return $capability;
    }
    $contracts = escomi_coverage_reconcile_contracts();
    $contract = $contracts[$operation['operation_id'] ?? ''] ?? null;
    if (!is_array($contract)
        || ($params['mode'] ?? '') !== 'reconcile'
        || !hash_equals((string) ($manifest['batch_id'] ?? ''), (string) ($params['batch_id'] ?? ''))
        || !hash_equals((string) ($operation['payload_hash'] ?? ''), (string) ($params['payload_hash'] ?? ''))
    ) {
        return new WP_Error('payload_mismatch', 'Reconcile request contract mismatch.', ['status' => 409]);
    }
    $area = escomi_coverage_validate_area_contract();
    if (is_wp_error($area)) {
        return $area;
    }
    $lock = escomi_coverage_acquire_lock((string) $params['batch_id'], (string) $params['operation_id']);
    if (is_wp_error($lock)) {
        return $lock;
    }
    if (($contract['reconcile_kind'] ?? '') === 'applied_create_relation') {
        $applied_result = null;
        try {
            $applied_result = escomi_coverage_reconcile_applied_create_locked(
                $manifest,
                $operation,
                $params,
                $contract
            );
        } finally {
            $applied_released = escomi_coverage_release_lock($lock);
        }
        if (!$applied_released && !is_wp_error($applied_result)) {
            return new WP_Error('lock_release_failed', 'Reconcile completed but lock release failed.', ['status' => 503]);
        }
        return $applied_result;
    }
    if (($contract['reconcile_kind'] ?? '') === 'failed_create_provenance') {
        $m0240_result = null;
        try {
            $m0240_result = escomi_coverage_reconcile_m0240_locked(
                $manifest,
                $operation,
                $params,
                $contract
            );
        } finally {
            $m0240_released = escomi_coverage_release_lock($lock);
        }
        if (!$m0240_released && !is_wp_error($m0240_result)) {
            return new WP_Error('lock_release_failed', 'M0240 reconcile completed but lock release failed.', ['status' => 503]);
        }
        return $m0240_result;
    }
    $result = null;
    try {
        $ledger = escomi_coverage_current_ledger((string) $params['batch_id'], (string) $params['operation_id']);
        if (is_wp_error($ledger)) {
            $result = $ledger;
        } elseif (!hash_equals((string) ($ledger['payload_hash'] ?? ''), (string) $operation['payload_hash'])) {
            $result = new WP_Error('payload_mismatch', 'Reconcile ledger payload mismatch.', ['status' => 409]);
        } elseif (($ledger['state'] ?? '') === 'retry_ready'
            && (int) ($ledger['previous_audit_id'] ?? 0) === (int) $contract['failure_audit_id']
        ) {
            $result = new WP_REST_Response([
                'status' => 'retry_ready',
                'duplicate' => true,
                'operation_id' => $operation['operation_id'],
                'reconcile_audit_id' => $ledger['reconcile_audit_id'] ?? null,
            ], 200);
        } elseif (($ledger['state'] ?? '') === 'manual_review_required'
            && (int) ($ledger['audit_id'] ?? 0) === (int) $contract['failure_audit_id']
        ) {
            $audit = get_post((int) $contract['failure_audit_id']);
            $audit_body = $audit ? json_decode((string) $audit->post_content, true) : null;
            $audit_ok = $audit
                && $audit->post_type === ESKOMI_COVERAGE_AUDIT_POST_TYPE
                && $audit->post_status === 'private'
                && is_array($audit_body)
                && ($audit_body['state'] ?? '') === 'manual_review_required'
                && ($audit_body['operation_id'] ?? '') === $operation['operation_id']
                && ($audit_body['payload_hash'] ?? '') === $operation['payload_hash']
                && ($audit_body['attempt_id'] ?? '') === ($ledger['attempt_id'] ?? '')
                && ($audit_body['post_id'] ?? null) === null;
            if (!$audit_ok) {
                $result = new WP_Error('reconcile_audit_mismatch', 'Original failure audit does not match.', ['status' => 409]);
            } else {
                $state = escomi_coverage_validate_reconcile_state($operation, $contract);
                if (is_wp_error($state)) {
                    $result = $state;
                } else {
                    $reserved = escomi_coverage_transition_ledger($ledger, [
                        'state' => 'reconciling',
                        'previous_audit_id' => (int) $contract['failure_audit_id'],
                        'reconciled_state_hash' => $state['state_hash'],
                        'reconcile_attempt_id' => (string) $params['attempt_id'],
                        'original_attempt_id' => (string) ($ledger['attempt_id'] ?? ''),
                    ]);
                    $ledger = $reserved;
                    $result = is_wp_error($reserved) ? $reserved : null;
                }
            }
        } elseif (($ledger['state'] ?? '') === 'reconciling'
            && ($ledger['reconcile_attempt_id'] ?? '') === (string) $params['attempt_id']
            && (int) ($ledger['previous_audit_id'] ?? 0) === (int) $contract['failure_audit_id']
        ) {
            $state = escomi_coverage_validate_reconcile_state($operation, $contract);
            if (is_wp_error($state)
                || !hash_equals((string) ($ledger['reconciled_state_hash'] ?? ''), (string) ($state['state_hash'] ?? ''))
            ) {
                $result = is_wp_error($state)
                    ? $state
                    : new WP_Error('reconcile_state_mismatch', 'Reconcile state changed while reserved.', ['status' => 409]);
            }
        } else {
            $result = new WP_Error('reconcile_state_mismatch', 'Ledger is not eligible for reconciliation.', ['status' => 409]);
        }
        if ($result === null && ($ledger['state'] ?? '') === 'reconciling') {
            $reconcile_audit_id = escomi_coverage_find_reconcile_audit($operation, $ledger);
            if ($reconcile_audit_id === null) {
                $reconcile_audit_id = escomi_coverage_append_audit([
                    'batch_id' => $manifest['batch_id'],
                    'operation_id' => $operation['operation_id'],
                    'attempt_id' => (string) $ledger['reconcile_attempt_id'],
                    'state' => 'retry_ready',
                    'post_id' => (int) $contract['post_id'],
                    'payload_hash' => $operation['payload_hash'],
                    'previous_audit_id' => (int) $contract['failure_audit_id'],
                    'reconciled_state_hash' => (string) $ledger['reconciled_state_hash'],
                    'original_attempt_id' => (string) ($ledger['original_attempt_id'] ?? ''),
                ]);
            }
            if (is_wp_error($reconcile_audit_id)) {
                $result = $reconcile_audit_id;
            } else {
                $transitioned = escomi_coverage_transition_ledger($ledger, [
                    'state' => 'retry_ready',
                    'reconcile_audit_id' => $reconcile_audit_id,
                    'reconciled_at' => gmdate('c'),
                ]);
                $result = is_wp_error($transitioned)
                    ? $transitioned
                    : new WP_REST_Response([
                        'status' => 'retry_ready',
                        'duplicate' => false,
                        'operation_id' => $operation['operation_id'],
                        'reconcile_audit_id' => $reconcile_audit_id,
                    ], 200);
            }
        }
    } finally {
        $released = escomi_coverage_release_lock($lock);
    }
    if (!$released && !is_wp_error($result)) {
        return new WP_Error('lock_release_failed', 'Reconcile completed but lock release failed.', ['status' => 503]);
    }
    return $result;
}

function escomi_coverage_error_details($error): array
{
    if (!is_wp_error($error)) {
        return ['code' => '', 'message' => '', 'data' => []];
    }
    $data = $error->get_error_data();
    return [
        'code' => (string) $error->get_error_code(),
        'message' => (string) $error->get_error_message(),
        'data' => is_array($data) ? $data : [],
    ];
}

function escomi_coverage_append_audit(array $event)
{
    $allowed = [
        'batch_id',
        'operation_id',
        'attempt_id',
        'state',
        'classification',
        'hold_reason',
        'post_id',
        'payload_hash',
        'changed_fields',
        'area_terms_added',
        'duplicate',
        'error_code',
        'previous_audit_id',
        'reconciled_state_hash',
        'original_attempt_id',
        'required_area_terms',
        'allowed_derived_area_terms',
        'actual_area_terms',
        'before_hashes',
        'after_hashes',
        'sources',
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

function escomi_coverage_audit_evidence(array $operation, array $applied): array
{
    $rollback = is_array($applied['rollback'] ?? null) ? $applied['rollback'] : [];
    $before_hashes = [];
    $after_hashes = [];
    if (($rollback['action'] ?? '') === 'UPDATE_EXISTING') {
        foreach ($rollback['before_fields'] ?? [] as $snapshot) {
            $field = (string) ($snapshot['field'] ?? '');
            $before_hashes[$field] = escomi_coverage_current_hash(
                $field,
                (bool) ($snapshot['exists'] ?? false),
                $snapshot['value'] ?? null
            );
        }
        $after_hashes = $rollback['after_hashes'] ?? [];
    } elseif (($rollback['action'] ?? '') === 'ADD_AREA_RELATION') {
        $before_hashes['area_relation'] = escomi_coverage_relation_hash($rollback['before_terms'] ?? []);
        $after_hashes['area_relation'] = (string) ($rollback['after_hash'] ?? '');
    } elseif (($rollback['action'] ?? '') === 'CREATE_NEW') {
        $after_hashes['create_state'] = (string) ($rollback['after_hash'] ?? '');
        $relation_contract = is_array($applied['relation_contract'] ?? null)
            ? $applied['relation_contract']
            : [];
        $after_hashes['area_relation'] = escomi_coverage_relation_hash(
            is_array($relation_contract['actual'] ?? null) ? $relation_contract['actual'] : []
        );
    }
    $sources = [];
    foreach ($operation['payload']['fields'] ?? [] as $field) {
        $sources[] = [
            'field' => (string) ($field['field'] ?? ''),
            'source' => (string) ($field['source'] ?? ''),
            'observed_at' => (string) ($field['observed_at'] ?? ''),
        ];
    }
    foreach ($operation['payload']['physical_location_evidence'] ?? [] as $evidence) {
        $sources[] = [
            'field' => 'physical_location',
            'source' => (string) ($evidence['source'] ?? ''),
            'observed_at' => (string) ($evidence['observed_at'] ?? ''),
        ];
    }
    $evidence = [
        'before_hashes' => $before_hashes,
        'after_hashes' => $after_hashes,
        'sources' => $sources,
    ];
    if (($rollback['action'] ?? '') === 'CREATE_NEW' && !empty($relation_contract)) {
        $evidence['required_area_terms'] = $relation_contract['required'] ?? [];
        $evidence['allowed_derived_area_terms'] = $relation_contract['allowed_derived'] ?? [];
        $evidence['actual_area_terms'] = $relation_contract['actual'] ?? [];
    }
    return $evidence;
}

function escomi_coverage_execute_operation(array $operation, array $params, ?array $manifest = null)
{
    $manifest = $manifest ?? ['batch_id' => (string) ($params['batch_id'] ?? '')];
    $batch_id = (string) ($params['batch_id'] ?? '');
    $operation_id = (string) ($params['operation_id'] ?? '');
    $lock = escomi_coverage_acquire_lock($batch_id, $operation_id);
    if (is_wp_error($lock)) {
        return $lock;
    }
    $result = null;
    try {
        $validation = escomi_coverage_validate_runtime_operation($manifest, $operation, $params);
        if (is_wp_error($validation)) {
            $result = $validation;
        } elseif (!empty($validation['duplicate'])) {
            $result = new WP_REST_Response([
                    'status' => 'applied',
                    'duplicate' => true,
                    'post_id' => $validation['post_id'] ?? null,
                    'operation_id' => $operation_id,
                    'payload_hash' => $operation['payload_hash'],
                ], 200);
        } elseif (($validation['status'] ?? '') === 'HOLD') {
            $result = new WP_Error('operation_not_ready', 'Coverage operation is not ready.', ['status' => 409]);
        } else {
            $ledger = escomi_coverage_begin_ledger(
                $batch_id,
                $operation_id,
                (string) $operation['payload_hash'],
                (string) ($params['attempt_id'] ?? ''),
                true
            );
            if (is_wp_error($ledger)) {
                $result = $ledger;
            } else {
                $action = (string) ($operation['action'] ?? '');
                if ($action === 'UPDATE_EXISTING') {
                    $applied = escomi_coverage_apply_update($operation, $validation);
                } elseif ($action === 'ADD_AREA_RELATION') {
                    $applied = escomi_coverage_apply_relation($operation, $validation);
                } else {
                    $applied = escomi_coverage_apply_create($operation, $ledger, $validation);
                }
                if (is_wp_error($applied)) {
                    $applied_error = escomi_coverage_error_details($applied);
                    $failure_audit = escomi_coverage_append_audit([
                        'batch_id' => $batch_id,
                        'operation_id' => $operation_id,
                        'attempt_id' => (string) ($params['attempt_id'] ?? ''),
                        'state' => 'manual_review_required',
                        'post_id' => $applied_error['data']['post_id'] ?? ($ledger['post_id'] ?? null),
                        'payload_hash' => $operation['payload_hash'],
                        'error_code' => $applied_error['code'],
                    ]);
                    $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                    if (!is_wp_error($current_ledger)) {
                        $failed = escomi_coverage_transition_ledger_verified($current_ledger, [
                            'state' => 'manual_review_required',
                            'post_id' => $applied_error['data']['post_id'] ?? ($current_ledger['post_id'] ?? null),
                            'last_error_code' => $applied_error['code'],
                            'audit_id' => is_wp_error($failure_audit) ? null : $failure_audit,
                        ]);
                    } else {
                        $failed = $current_ledger;
                    }
                    $result = is_wp_error($failed)
                        ? $failed
                        : (is_wp_error($failure_audit) ? $failure_audit : $applied);
                } else {
                    $audit_event = array_merge([
                        'batch_id' => $batch_id,
                        'operation_id' => $operation_id,
                        'attempt_id' => (string) ($params['attempt_id'] ?? ''),
                        'state' => 'applied',
                        'post_id' => $applied['post_id'] ?? null,
                        'payload_hash' => $operation['payload_hash'],
                        'changed_fields' => $applied['changed_fields'] ?? [],
                        'area_terms_added' => $applied['area_terms_added'] ?? [],
                        'duplicate' => false,
                        'previous_audit_id' => $ledger['reconcile_audit_id'] ?? null,
                    ], escomi_coverage_audit_evidence($operation, $applied));
                    $audit_id = escomi_coverage_append_audit($audit_event);
                    if (is_wp_error($audit_id)) {
                        $audit_error = escomi_coverage_error_details($audit_id);
                        $rollback = !empty($applied['rollback'])
                            ? escomi_coverage_apply_rollback($applied['rollback'])
                            : true;
                        $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                        if (!is_wp_error($current_ledger)) {
                            $failed = escomi_coverage_transition_ledger_verified($current_ledger, [
                                'state' => $rollback === true ? 'rolled_back' : 'manual_review_required',
                                'last_error_code' => $audit_error['code'],
                            ]);
                        } else {
                            $failed = $current_ledger;
                        }
                        $result = is_wp_error($failed) ? $failed : $audit_id;
                    } else {
                        $current_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                        if (is_wp_error($current_ledger)) {
                            $result = $current_ledger;
                        } else {
                            $completed = escomi_coverage_transition_ledger_verified($current_ledger, [
                                'state' => 'applied',
                                'post_id' => $applied['post_id'] ?? null,
                                'rollback' => $applied['rollback'] ?? null,
                                'audit_id' => $audit_id,
                                'last_error_code' => null,
                            ]);
                            if (is_wp_error($completed)) {
                                $rollback = !empty($applied['rollback'])
                                    ? escomi_coverage_apply_rollback($applied['rollback'])
                                    : true;
                                $recovery_state = $rollback === true ? 'rolled_back' : 'manual_review_required';
                                $recovery_audit = escomi_coverage_append_audit([
                                    'batch_id' => $batch_id,
                                    'operation_id' => $operation_id,
                                    'attempt_id' => (string) ($params['attempt_id'] ?? ''),
                                    'state' => $recovery_state,
                                    'post_id' => $applied['post_id'] ?? null,
                                    'payload_hash' => $operation['payload_hash'],
                                    'error_code' => 'ledger_conflict',
                                    'previous_audit_id' => $audit_id,
                                ]);
                                $recovery_ledger = escomi_coverage_current_ledger($batch_id, $operation_id);
                                if (!is_wp_error($recovery_ledger)) {
                                    $recovered = escomi_coverage_force_terminal_ledger(
                                        $batch_id,
                                        $operation_id,
                                        (string) ($params['attempt_id'] ?? ''),
                                        (string) $operation['payload_hash'],
                                        [
                                        'state' => $recovery_state,
                                        'last_error_code' => 'ledger_conflict',
                                        'applied_audit_id' => $audit_id,
                                        'audit_id' => is_wp_error($recovery_audit) ? $audit_id : $recovery_audit,
                                        ]
                                    );
                                    if (is_wp_error($recovered)) {
                                        $result = $recovered;
                                    }
                                }
                                if ($result === null) {
                                    $result = $completed;
                                }
                            } else {
                                $result = new WP_REST_Response([
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
    if ($params['mode'] === 'reconcile') {
        return escomi_coverage_reconcile_operation($manifest, $operation, $params);
    }
    if ($params['mode'] === 'dry_run') {
        $validation = escomi_coverage_validate_runtime_operation($manifest, $operation, $params);
        if (is_wp_error($validation)) {
            return $validation;
        }
        return new WP_REST_Response([
            'mode' => 'dry_run',
            'batch_id' => $params['batch_id'],
            'operation_id' => $params['operation_id'],
            'status' => $validation['status'] ?? 'HOLD',
            'classification' => $validation['classification'] ?? 'SYSTEMIC_BLOCKING',
            'hold_reason' => $validation['hold_reason'] ?? null,
            'validation' => 'PASS',
            'duplicate' => $validation['duplicate'] ?? false,
            'post_id' => $validation['post_id'] ?? null,
            'payload_hash' => $params['payload_hash'],
            'post_publish_validation' => ($operation['action'] ?? '') === 'CREATE_NEW'
                ? 'NOT_EXECUTED_DRY_RUN'
                : 'NOT_APPLICABLE',
        ], 200);
    }
    if (!escomi_coverage_writes_enabled()) {
        return new WP_Error('writes_disabled', 'Coverage writes are disabled.', ['status' => 503]);
    }
    return escomi_coverage_execute_operation($operation, $params, $manifest);
}

if (function_exists('add_action')) {
    add_action('init', 'escomi_coverage_register_audit_post_type');
    add_action('rest_api_init', 'escomi_coverage_register_route');
}
