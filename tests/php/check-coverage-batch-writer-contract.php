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
    'escomi_execute_coverage_batch' => true,
    'edit_posts' => true,
    'publish_posts' => true,
);
$GLOBALS['coverage_terms'] = array(
    13 => (object) array('term_id' => 13, 'slug' => 'shinosaka'),
    17 => (object) array('term_id' => 17, 'slug' => 'sakai'),
);

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

function coverage_fail(string $message): void { fwrite(STDERR, $message . "\n"); exit(1); }
function coverage_expect(bool $condition, string $message): void { if (!$condition) coverage_fail($message); }
function coverage_expect_error($value, string $code): void {
    coverage_expect($value instanceof WP_Error && $value->code === $code, "Expected WP_Error {$code}");
}

require_once dirname(__DIR__, 2) . '/coverage-batch-writer.php';

coverage_expect(defined('ESKOMI_COVERAGE_LOCK_TTL') && ESKOMI_COVERAGE_LOCK_TTL === 120, 'Lock TTL must be 120 seconds');
coverage_expect(defined('ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS') && ESKOMI_COVERAGE_LEDGER_RETENTION_DAYS === 400, 'Ledger retention must be 400 days');
coverage_expect(ESKOMI_COVERAGE_CAPABILITY === 'escomi_execute_coverage_batch', 'Dedicated capability mismatch');
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

coverage_expect(escomi_coverage_validate_area_contract() === true, 'Exact area contract must pass');
$GLOBALS['coverage_terms'][17]->slug = 'sakaihigashi';
coverage_expect_error(escomi_coverage_validate_area_contract(), 'area_contract_mismatch');
$GLOBALS['coverage_terms'][17]->slug = 'sakai';

$GLOBALS['coverage_caps']['escomi_execute_coverage_batch'] = false;
coverage_expect_error(escomi_coverage_permission(new Coverage_Test_Request(array())), 'rest_forbidden');
$GLOBALS['coverage_caps']['escomi_execute_coverage_batch'] = true;
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
coverage_expect(($GLOBALS['coverage_options'][$ledger_name]['payload_hash'] ?? '') === str_repeat('b', 64), 'Ledger must be stored');
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

echo "Coverage batch writer boundary PASS\n";
