<?php

declare(strict_types=1);

final class WP_Error {
    public string $code;
    public string $message;
    public array $data;
    public function __construct(string $code, string $message, array $data = array()) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }
}

final class WP_REST_Response {
    public array $data;
    public int $status;
    public function __construct(array $data, int $status = 200) {
        $this->data = $data;
        $this->status = $status;
    }
}

final class Coverage_Test_Request {
    public array $params;
    public function __construct(array $params) { $this->params = $params; }
    public function get_json_params(): array { return $this->params; }
    public function get_param(string $key) { return $this->params[$key] ?? null; }
}

final class Coverage_Test_Wpdb {
    public string $options = 'wp_options';
    public function prepare(string $query, ...$args): array { return array($query, $args); }
    public function query(array $prepared) {
        [$query, $args] = $prepared;
        $query = ltrim($query);
        if (str_starts_with($query, 'UPDATE ')) {
            [$replacement, $name, $expected] = $args;
            if (($GLOBALS['coverage_options'][$name] ?? null) !== $expected) return 0;
            $GLOBALS['coverage_options'][$name] = $replacement;
            return 1;
        }
        if (str_starts_with($query, 'DELETE ')) {
            [$name, $expected] = $args;
            if (($GLOBALS['coverage_options'][$name] ?? null) !== $expected) return 0;
            unset($GLOBALS['coverage_options'][$name]);
            return 1;
        }
        return false;
    }
}

$GLOBALS['wpdb'] = new Coverage_Test_Wpdb();
$GLOBALS['coverage_actions'] = array();
$GLOBALS['coverage_routes'] = array();
$GLOBALS['coverage_post_types'] = array();
$GLOBALS['coverage_options'] = array();
$GLOBALS['coverage_caps'] = array(
    'escomi_publish_coverage_batch' => true,
    'edit_posts' => true,
    'edit_post' => true,
    'create_posts' => true,
    'publish_posts' => true,
);
$GLOBALS['coverage_terms'] = array(
    13 => (object) array('term_id' => 13, 'slug' => 'shinosaka', 'taxonomy' => 'area'),
    17 => (object) array('term_id' => 17, 'slug' => 'sakai', 'taxonomy' => 'area'),
);
$GLOBALS['coverage_posts'] = array();
$GLOBALS['coverage_fields'] = array();
$GLOBALS['coverage_meta'] = array();
$GLOBALS['coverage_relations'] = array();
$GLOBALS['coverage_events'] = array();
$GLOBALS['coverage_field_keys'] = array(
    'official_url' => 'field_official_url',
    'shop_address' => 'field_shop_address',
    'basic_price' => 'field_basic_price',
    'shop_hours' => 'field_shop_hours',
    'shop_tel' => 'field_shop_tel',
    'shop_booking' => 'field_shop_booking',
);
$GLOBALS['coverage_fail_field'] = null;
$GLOBALS['coverage_fail_publish'] = false;
$GLOBALS['coverage_next_shop_id'] = 2000;
$GLOBALS['coverage_next_audit_id'] = 3000;

function add_action($hook, $callback) { $GLOBALS['coverage_actions'][$hook][] = $callback; }
function register_rest_route($namespace, $route, $args) { $GLOBALS['coverage_routes'][] = compact('namespace', 'route', 'args'); }
function register_post_type($name, $args) { $GLOBALS['coverage_post_types'][$name] = $args; }
function current_user_can($capability, ...$_args) { return $GLOBALS['coverage_caps'][$capability] ?? false; }
function get_term($id, $taxonomy) { return $GLOBALS['coverage_terms'][$id] ?? new WP_Error('missing', 'missing'); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function add_option($name, $value, $_deprecated = '', $autoload = 'yes') {
    if (array_key_exists($name, $GLOBALS['coverage_options'])) return false;
    if ($autoload !== 'no') throw new RuntimeException('Coverage options must be non-autoloaded');
    $GLOBALS['coverage_options'][$name] = $value;
    return true;
}
function get_option($name, $default = false) { return $GLOBALS['coverage_options'][$name] ?? $default; }
function update_option($name, $value, $autoload = null) {
    if ($autoload !== false) throw new RuntimeException('Ledger option must be non-autoloaded');
    $GLOBALS['coverage_options'][$name] = $value;
    return true;
}
function wp_cache_delete() { return true; }
function wp_generate_uuid4() { return '550e8400-e29b-41d4-a716-446655440000'; }
function sanitize_key($value) { return strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $value)); }
function metadata_exists($type, $post_id, $key) { return array_key_exists($key, $GLOBALS['coverage_meta'][$post_id] ?? array()); }
function get_post_meta($post_id, $key, $single = true) { return $GLOBALS['coverage_meta'][$post_id][$key] ?? ''; }
function update_post_meta($post_id, $key, $value) {
    $GLOBALS['coverage_meta'][$post_id][$key] = $value;
    return true;
}
function delete_post_meta($post_id, $key) { unset($GLOBALS['coverage_meta'][$post_id][$key]); return true; }
function get_field_object($name, $_post_id = false, $_format = false) {
    if (!isset($GLOBALS['coverage_field_keys'][$name])) return false;
    return array('key' => $GLOBALS['coverage_field_keys'][$name], 'name' => $name);
}
function get_field($name, $post_id, $_format = true) { $GLOBALS['coverage_events'][] = 'readback:field:' . $name; return $GLOBALS['coverage_fields'][$post_id][$name] ?? null; }
function update_field($key, $value, $post_id) {
    $name = array_search($key, $GLOBALS['coverage_field_keys'], true);
    if ($name === false || $GLOBALS['coverage_fail_field'] === $name) return false;
    $GLOBALS['coverage_fields'][$post_id][$name] = $value;
    $GLOBALS['coverage_meta'][$post_id][$name] = $value;
    $GLOBALS['coverage_events'][] = 'field:' . $name;
    return true;
}
function get_post_type($post_id) { return $GLOBALS['coverage_posts'][$post_id]['post_type'] ?? null; }
function get_post_type_object($post_type) { return (object) array('cap' => (object) array('create_posts' => 'create_posts', 'publish_posts' => 'publish_posts')); }
function get_post_status($post_id) { return $GLOBALS['coverage_posts'][$post_id]['post_status'] ?? false; }
function get_post($post_id) {
    if (!isset($GLOBALS['coverage_posts'][$post_id])) return null;
    $GLOBALS['coverage_events'][] = 'readback:post';
    return (object) array(
        'ID' => $post_id,
        'post_type' => $GLOBALS['coverage_posts'][$post_id]['post_type'],
        'post_status' => $GLOBALS['coverage_posts'][$post_id]['post_status'],
        'post_title' => $GLOBALS['coverage_posts'][$post_id]['post_title'],
        'post_name' => $GLOBALS['coverage_posts'][$post_id]['post_name'],
    );
}
function wp_insert_post($args, $wp_error = false) {
    if (($args['post_type'] ?? '') === 'coverage_batch_audit') {
        $id = $GLOBALS['coverage_next_audit_id']++;
        $GLOBALS['coverage_posts'][$id] = $args + array('post_name' => '', 'post_title' => '');
        $GLOBALS['coverage_events'][] = 'audit';
        return $id;
    }
    $id = $GLOBALS['coverage_next_shop_id']++;
    $GLOBALS['coverage_posts'][$id] = $args;
    $GLOBALS['coverage_events'][] = 'insert:' . ($args['post_status'] ?? '');
    return $id;
}
function wp_update_post($args, $wp_error = false) {
    $id = (int) ($args['ID'] ?? 0);
    if (!isset($GLOBALS['coverage_posts'][$id])) return new WP_Error('missing_post', 'missing');
    if (($args['post_status'] ?? '') === 'publish' && $GLOBALS['coverage_fail_publish']) {
        return new WP_Error('publish_failed', 'publish failed');
    }
    foreach ($args as $key => $value) {
        if ($key !== 'ID') $GLOBALS['coverage_posts'][$id][$key] = $value;
    }
    if (isset($args['post_status'])) $GLOBALS['coverage_events'][] = 'status:' . $args['post_status'];
    return $id;
}
function wp_get_object_terms($post_id, $taxonomy, $args = array()) { $GLOBALS['coverage_events'][] = 'readback:terms'; return array_values($GLOBALS['coverage_relations'][$post_id] ?? array()); }
function wp_set_object_terms($post_id, $terms, $taxonomy, $append = false) {
    $current = $append ? ($GLOBALS['coverage_relations'][$post_id] ?? array()) : array();
    $GLOBALS['coverage_relations'][$post_id] = array_values(array_unique(array_merge($current, array_map('intval', $terms))));
    sort($GLOBALS['coverage_relations'][$post_id]);
    $GLOBALS['coverage_events'][] = 'terms';
    return $GLOBALS['coverage_relations'][$post_id];
}
function wp_remove_object_terms($post_id, $terms, $taxonomy) {
    $remove = array_map('intval', (array) $terms);
    $GLOBALS['coverage_relations'][$post_id] = array_values(array_diff($GLOBALS['coverage_relations'][$post_id] ?? array(), $remove));
    return true;
}
function get_posts($args = array()) { return array_keys($GLOBALS['coverage_posts']); }

function coverage_fail(string $message): void { fwrite(STDERR, $message . "\n"); exit(1); }
function coverage_expect(bool $condition, string $message): void { if (!$condition) coverage_fail($message); }
function coverage_expect_error($value, string $code): void {
    coverage_expect($value instanceof WP_Error && $value->code === $code, "Expected WP_Error {$code}");
}

require_once dirname(__DIR__, 2) . '/coverage-batch-writer.php';

coverage_expect(defined('ESKOMI_COVERAGE_LOCK_TTL') && ESKOMI_COVERAGE_LOCK_TTL === 120, 'Lock TTL must be 120 seconds');
coverage_expect(defined('ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS') && ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS === 400, 'Ledger retention must be 400 days');
coverage_expect(ESKOMI_COVERAGE_CAPABILITY === 'escomi_publish_coverage_batch', 'Dedicated capability mismatch');
coverage_expect(escomi_coverage_writes_enabled() === false, 'Writes must default disabled');

foreach ($GLOBALS['coverage_actions']['rest_api_init'] ?? array() as $callback) { $callback(); }
coverage_expect(count($GLOBALS['coverage_routes']) === 1, 'One coverage route must be registered');
$route = $GLOBALS['coverage_routes'][0];
coverage_expect($route['namespace'] === 'escomi/v1' && $route['route'] === '/coverage-batch', 'Separate route mismatch');
coverage_expect($route['args']['methods'] === 'POST', 'Coverage route must be POST-only');

foreach ($GLOBALS['coverage_actions']['init'] ?? array() as $callback) { $callback(); }
$audit = $GLOBALS['coverage_post_types']['coverage_batch_audit'] ?? null;
coverage_expect(is_array($audit), 'Private audit CPT missing');
coverage_expect($audit['public'] === false && $audit['publicly_queryable'] === false, 'Audit CPT must be private');
coverage_expect($audit['show_in_rest'] === false && $audit['show_ui'] === false, 'Audit CPT must not expose REST/UI');

$bad = escomi_coverage_validate_request_params(array(
    'batch_id' => 'coverage-first-2026-08-25',
    'operation_id' => 'coverage-m0004-update',
    'attempt_id' => '550e8400-e29b-41d4-a716-446655440000',
    'payload_hash' => str_repeat('a', 64),
    'mode' => 'dry_run',
    'arbitrary_meta' => 'blocked',
));
coverage_expect_error($bad, 'unknown_parameter');

$manifest = escomi_coverage_load_manifest();
coverage_expect(!is_wp_error($manifest) && count($manifest['operations']) === 28, 'Checked-in manifest must load');
coverage_expect_error(escomi_coverage_load_manifest('/definitely/missing.json'), 'manifest_unavailable');
$tampered_manifest = $manifest;
$tampered_manifest['operations'][0]['payload']['arbitrary_meta'] = 'blocked';
$tampered_path = tempnam(sys_get_temp_dir(), 'coverage-manifest-');
file_put_contents($tampered_path, json_encode($tampered_manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
coverage_expect_error(escomi_coverage_load_manifest($tampered_path), 'manifest_invalid');
unlink($tampered_path);
$invalid_value_manifest = $manifest;
foreach ($invalid_value_manifest['operations'] as &$invalid_operation) {
    if ($invalid_operation['action'] === 'UPDATE_EXISTING' && $invalid_operation['payload']['fields']) {
        $invalid_operation['payload']['fields'][0]['field'] = 'basic_price';
        $invalid_operation['payload']['fields'][0]['proposed_value'] = '=CMD()';
        $invalid_operation['payload_hash'] = escomi_coverage_payload_hash($invalid_operation['payload']);
        break;
    }
}
unset($invalid_operation);
$invalid_value_path = tempnam(sys_get_temp_dir(), 'coverage-manifest-');
file_put_contents($invalid_value_path, json_encode($invalid_value_manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
coverage_expect_error(escomi_coverage_load_manifest($invalid_value_path), 'manifest_invalid');
unlink($invalid_value_path);

coverage_expect(escomi_coverage_validate_area_contract() === true, 'Exact area contract must pass');
$GLOBALS['coverage_terms'][17]->slug = 'sakaihigashi';
coverage_expect_error(escomi_coverage_validate_area_contract(), 'area_contract_mismatch');
$GLOBALS['coverage_terms'][17]->slug = 'sakai';
$GLOBALS['coverage_terms'][17]->taxonomy = 'category';
coverage_expect_error(escomi_coverage_validate_area_contract(), 'area_contract_mismatch');
$GLOBALS['coverage_terms'][17]->taxonomy = 'area';

$GLOBALS['coverage_caps']['escomi_publish_coverage_batch'] = false;
coverage_expect_error(escomi_coverage_permission(new Coverage_Test_Request(array())), 'rest_forbidden');
$GLOBALS['coverage_caps']['escomi_publish_coverage_batch'] = true;
$GLOBALS['coverage_caps']['edit_posts'] = false;
coverage_expect_error(escomi_coverage_permission(new Coverage_Test_Request(array())), 'rest_forbidden');
$GLOBALS['coverage_caps']['edit_posts'] = true;
coverage_expect(escomi_coverage_permission(new Coverage_Test_Request(array())) === true, 'Required capabilities should pass');

$lock_name = escomi_coverage_lock_option_name('batch-a', 'operation-a');
coverage_expect(str_starts_with($lock_name, '_escomi_coverage_lock_') && strlen($lock_name) === 86, 'Lock name contract mismatch');
$lock = escomi_coverage_acquire_lock('batch-a', 'operation-a');
coverage_expect(!is_wp_error($lock), 'First lock acquisition should pass');
coverage_expect_error(escomi_coverage_acquire_lock('batch-a', 'operation-a'), 'operation_locked');
coverage_expect(escomi_coverage_release_lock(array('name' => $lock['name'], 'value' => 'not-owner')) === false, 'Non-owner must not release lock');
coverage_expect(escomi_coverage_release_lock($lock) === true, 'Owner must release lock');
$stale_value = json_encode(array('created_at' => time() - 121, 'owner' => 'stale'));
$GLOBALS['coverage_options'][$lock_name] = $stale_value;
$recovered = escomi_coverage_acquire_lock('batch-a', 'operation-a');
coverage_expect(!is_wp_error($recovered) && $recovered['value'] !== $stale_value, 'Stale lock recovery should CAS replace');
coverage_expect(escomi_coverage_release_lock($recovered) === true, 'Recovered lock release failed');

$ledger_name = escomi_coverage_ledger_option_name('batch-a', 'operation-a');
$ledger = escomi_coverage_begin_ledger('batch-a', 'operation-a', str_repeat('b', 64), 'attempt-a');
coverage_expect($ledger['state'] === 'applying' && $ledger['retention_days'] === 400, 'Ledger lifecycle fields missing');
coverage_expect((json_decode($GLOBALS['coverage_options'][$ledger_name], true)['payload_hash'] ?? '') === str_repeat('b', 64), 'Ledger must be stored as non-autoloaded JSON');
$replay = escomi_coverage_begin_ledger('batch-a', 'operation-a', str_repeat('b', 64), 'attempt-b');
coverage_expect_error($replay, 'operation_in_progress');
$mismatch = escomi_coverage_begin_ledger('batch-a', 'operation-a', str_repeat('c', 64), 'attempt-c');
coverage_expect_error($mismatch, 'payload_mismatch');

$operation = null;
foreach ($manifest['operations'] as $item) {
    if ($item['operation_id'] === 'coverage-m0004-update') { $operation = $item; break; }
}
coverage_expect(is_array($operation), 'Expected manifest operation missing');
$request = new Coverage_Test_Request(array(
    'batch_id' => $manifest['batch_id'],
    'operation_id' => $operation['operation_id'],
    'attempt_id' => '550e8400-e29b-41d4-a716-446655440000',
    'payload_hash' => $operation['payload_hash'],
    'mode' => 'dry_run',
));
$response = escomi_coverage_handle_request($request);
coverage_expect($response instanceof WP_REST_Response && $response->status === 200, 'Dry-run must work while writes are disabled');
coverage_expect(($response->data['mode'] ?? '') === 'dry_run', 'Dry-run response mode missing');

$apply_params = $request->params;
$apply_params['mode'] = 'apply';
coverage_expect_error(escomi_coverage_handle_request(new Coverage_Test_Request($apply_params)), 'writes_disabled');

function coverage_reset_shop_runtime(): void {
    $GLOBALS['coverage_posts'] = array();
    $GLOBALS['coverage_fields'] = array();
    $GLOBALS['coverage_meta'] = array();
    $GLOBALS['coverage_relations'] = array();
    $GLOBALS['coverage_events'] = array();
    $GLOBALS['coverage_fail_field'] = null;
    $GLOBALS['coverage_fail_publish'] = false;
    $GLOBALS['coverage_next_shop_id'] = 2000;
}

function coverage_seed_shop(int $id, string $status = 'publish', string $title = 'Test Shop', string $slug = 'test-shop'): void {
    $GLOBALS['coverage_posts'][$id] = array(
        'post_type' => 'shop',
        'post_status' => $status,
        'post_title' => $title,
        'post_name' => $slug,
    );
}

function coverage_update_operation(): array {
    $operation = array(
        'operation_id' => 'coverage-mtest-update',
        'master_shop_id' => 'MTEST',
        'action' => 'UPDATE_EXISTING',
        'wp_id' => 42,
        'dry_run_status' => 'READY_UPDATE',
        'payload' => array(
            'action' => 'UPDATE_EXISTING',
            'wp_id' => 42,
            'fields' => array(
                array(
                    'field' => 'basic_price',
                    'current_hash' => escomi_coverage_current_hash('basic_price', true, 13000),
                    'proposed_value' => '10000',
                    'source' => 'https://example.test/price',
                    'observed_at' => '2026-08-23T00:00:00+00:00',
                ),
                array(
                    'field' => 'shop_hours',
                    'current_hash' => escomi_coverage_current_hash('shop_hours', true, '10:00'),
                    'proposed_value' => '11:00',
                    'source' => 'https://example.test/hours',
                    'observed_at' => '2026-08-23T00:00:00+00:00',
                ),
            ),
        ),
    );
    $operation['payload_hash'] = escomi_coverage_payload_hash($operation['payload']);
    return $operation;
}

coverage_reset_shop_runtime();
coverage_seed_shop(42);
$GLOBALS['coverage_fields'][42] = array('basic_price' => 14000, 'shop_hours' => '10:00');
$GLOBALS['coverage_meta'][42] = $GLOBALS['coverage_fields'][42];
coverage_expect_error(escomi_coverage_apply_update(coverage_update_operation()), 'field_conflict');
coverage_expect($GLOBALS['coverage_fields'][42]['basic_price'] === 14000, 'Conflict must not mutate any field');

coverage_reset_shop_runtime();
coverage_seed_shop(42);
$GLOBALS['coverage_fields'][42] = array('basic_price' => 13000, 'shop_hours' => '10:00');
$GLOBALS['coverage_meta'][42] = $GLOBALS['coverage_fields'][42];
$saved_key = $GLOBALS['coverage_field_keys']['basic_price'];
unset($GLOBALS['coverage_field_keys']['basic_price']);
coverage_expect_error(escomi_coverage_apply_update(coverage_update_operation()), 'acf_field_unavailable');
$GLOBALS['coverage_field_keys']['basic_price'] = $saved_key;
coverage_expect($GLOBALS['coverage_fields'][42]['basic_price'] === 13000, 'Missing ACF key must fail before writes');

coverage_reset_shop_runtime();
coverage_seed_shop(42);
$GLOBALS['coverage_fields'][42] = array('basic_price' => 13000, 'shop_hours' => '10:00');
$GLOBALS['coverage_meta'][42] = $GLOBALS['coverage_fields'][42];
$GLOBALS['coverage_fail_field'] = 'shop_hours';
coverage_expect_error(escomi_coverage_apply_update(coverage_update_operation()), 'field_write_failed');
coverage_expect($GLOBALS['coverage_fields'][42]['basic_price'] === 13000, 'Failed update must rollback earlier fields');

coverage_reset_shop_runtime();
coverage_seed_shop(42);
$GLOBALS['coverage_fields'][42] = array('basic_price' => 13000, 'shop_hours' => '10:00');
$GLOBALS['coverage_meta'][42] = $GLOBALS['coverage_fields'][42];
$update_result = escomi_coverage_apply_update(coverage_update_operation());
coverage_expect(!is_wp_error($update_result) && $GLOBALS['coverage_fields'][42]['basic_price'] === '10000', 'Update path did not write allowlisted field');
coverage_expect(
    array_column($GLOBALS['coverage_meta'][42]['shop_fact_provenance'] ?? array(), 'field') === array('price', 'hours'),
    'Supported first-party provenance was not stored'
);
coverage_expect(escomi_coverage_apply_rollback($update_result['rollback']) === true, 'Update rollback failed');
coverage_expect($GLOBALS['coverage_fields'][42]['basic_price'] === 13000 && $GLOBALS['coverage_fields'][42]['shop_hours'] === '10:00', 'Update rollback did not restore snapshot');
coverage_expect(!isset($GLOBALS['coverage_meta'][42]['shop_fact_provenance']), 'Update rollback did not restore provenance absence');

coverage_reset_shop_runtime();
coverage_seed_shop(50);
$GLOBALS['coverage_relations'][50] = array(17);
$relation_operation = array(
    'action' => 'ADD_AREA_RELATION',
    'wp_id' => 50,
    'payload' => array('area_terms_to_add' => array(13)),
);
$relation_result = escomi_coverage_apply_relation($relation_operation);
coverage_expect(!is_wp_error($relation_result) && $GLOBALS['coverage_relations'][50] === array(13, 17), 'Relation append failed');
$relation_again = escomi_coverage_apply_relation($relation_operation);
coverage_expect(!is_wp_error($relation_again) && $relation_again['changed'] === false, 'Duplicate relation must be NO_CHANGE');
coverage_expect(escomi_coverage_apply_rollback($relation_result['rollback']) === true, 'Relation rollback failed');
coverage_expect($GLOBALS['coverage_relations'][50] === array(17), 'Relation rollback removed wrong terms');

$create_operation = array(
    'operation_id' => 'coverage-mcreate-create',
    'master_shop_id' => 'MCREATE',
    'action' => 'CREATE_NEW',
    'payload_hash' => str_repeat('e', 64),
    'payload' => array(
        'action' => 'CREATE_NEW',
        'wp_id' => null,
        'title' => 'New Shop',
        'slug' => 'eskomi-mcreate',
        'area_terms' => array(13, 17),
        'fields' => array(
            array('field' => 'official_url', 'proposed_value' => 'https://new.example/', 'source' => 'https://new.example/', 'observed_at' => '2026-08-23'),
            array('field' => 'shop_tel', 'proposed_value' => '090-1111-2222', 'source' => 'https://new.example/', 'observed_at' => '2026-08-23'),
        ),
    ),
);

coverage_reset_shop_runtime();
coverage_seed_shop(99, 'draft', 'Other', 'other');
$GLOBALS['coverage_fields'][99] = array('official_url' => 'https://new.example/');
coverage_expect_error(escomi_coverage_check_create_collisions($create_operation), 'create_collision');

coverage_reset_shop_runtime();
$create_result = escomi_coverage_apply_create($create_operation, array());
coverage_expect(!is_wp_error($create_result), 'Draft-first create failed');
$created_id = $create_result['post_id'];
coverage_expect($GLOBALS['coverage_posts'][$created_id]['post_status'] === 'publish', 'Create did not publish after readback');
$insert_index = array_search('insert:draft', $GLOBALS['coverage_events'], true);
$readback_index = array_search('readback:post', $GLOBALS['coverage_events'], true);
$publish_index = array_search('status:publish', $GLOBALS['coverage_events'], true);
coverage_expect($insert_index !== false && $readback_index > $insert_index && $publish_index > $readback_index, 'Create lifecycle must be draft then readback then publish');
coverage_expect(escomi_coverage_apply_rollback($create_result['rollback']) === true, 'Create rollback failed');
coverage_expect($GLOBALS['coverage_posts'][$created_id]['post_status'] === 'draft', 'Create rollback must return post to draft');

coverage_reset_shop_runtime();
$GLOBALS['coverage_fail_publish'] = true;
$failed_create = escomi_coverage_apply_create($create_operation, array());
coverage_expect_error($failed_create, 'publish_failed');
coverage_expect(count($GLOBALS['coverage_posts']) === 1 && reset($GLOBALS['coverage_posts'])['post_status'] === 'draft', 'Publish failure must leave one draft');
$draft_id = array_key_first($GLOBALS['coverage_posts']);
$GLOBALS['coverage_fail_publish'] = false;
$retried_create = escomi_coverage_apply_create($create_operation, array('post_id' => $draft_id));
coverage_expect(!is_wp_error($retried_create) && $retried_create['post_id'] === $draft_id, 'Retry must reuse ledger-owned draft');
coverage_expect(count(array_filter($GLOBALS['coverage_events'], fn($event) => $event === 'insert:draft')) === 1, 'Retry created a second shop');

$GLOBALS['coverage_caps']['publish_posts'] = false;
coverage_expect_error(escomi_coverage_require_operation_capability($create_operation), 'rest_forbidden');
$GLOBALS['coverage_caps']['publish_posts'] = true;
coverage_expect(escomi_coverage_require_operation_capability($create_operation) === true, 'Create standard capabilities should pass');
$GLOBALS['coverage_caps']['edit_post'] = false;
coverage_expect_error(escomi_coverage_require_operation_capability(coverage_update_operation()), 'rest_forbidden');
$GLOBALS['coverage_caps']['edit_post'] = true;

$audit_id = escomi_coverage_append_audit(array(
    'batch_id' => 'batch-a',
    'operation_id' => 'operation-a',
    'attempt_id' => 'attempt-a',
    'state' => 'applied',
    'post_id' => 42,
    'payload_hash' => str_repeat('f', 64),
));
coverage_expect(is_int($audit_id) && $audit_id >= 3000, 'Append-only audit record failed');
coverage_expect($GLOBALS['coverage_posts'][$audit_id]['post_status'] === 'private', 'Audit record must be private');
coverage_expect(!str_contains($GLOBALS['coverage_posts'][$audit_id]['post_content'], 'lock'), 'Audit content exposed lock material');

coverage_reset_shop_runtime();
$GLOBALS['coverage_options'] = array();
coverage_seed_shop(42);
$GLOBALS['coverage_fields'][42] = array('basic_price' => 13000, 'shop_hours' => '10:00');
$GLOBALS['coverage_meta'][42] = $GLOBALS['coverage_fields'][42];
$execution_operation = coverage_update_operation();
$execution = escomi_coverage_execute_operation(
    $execution_operation,
    array(
        'batch_id' => 'coverage-test-batch',
        'operation_id' => $execution_operation['operation_id'],
        'attempt_id' => '550e8400-e29b-41d4-a716-446655440000',
        'payload_hash' => $execution_operation['payload_hash'],
        'mode' => 'apply',
    )
);
coverage_expect($execution instanceof WP_REST_Response && $execution->status === 201, 'Full update execution failed');
$execution_ledger_name = escomi_coverage_ledger_option_name('coverage-test-batch', $execution_operation['operation_id']);
$execution_ledger = json_decode($GLOBALS['coverage_options'][$execution_ledger_name] ?? '', true);
coverage_expect(($execution_ledger['state'] ?? '') === 'applied', 'Execution ledger did not reach applied');
coverage_expect(!array_key_exists(escomi_coverage_lock_option_name('coverage-test-batch', $execution_operation['operation_id']), $GLOBALS['coverage_options']), 'Execution lock was not released');
$event_count = count($GLOBALS['coverage_events']);
$replayed = escomi_coverage_execute_operation(
    $execution_operation,
    array(
        'batch_id' => 'coverage-test-batch',
        'operation_id' => $execution_operation['operation_id'],
        'attempt_id' => '650e8400-e29b-41d4-a716-446655440000',
        'payload_hash' => $execution_operation['payload_hash'],
        'mode' => 'apply',
    )
);
coverage_expect($replayed instanceof WP_REST_Response && ($replayed->data['duplicate'] ?? false) === true, 'Applied replay must be idempotent');
coverage_expect(count($GLOBALS['coverage_events']) === $event_count, 'Replay repeated a mutation or audit');

echo "Coverage batch writer boundary PASS\n";
