<?php
declare(strict_types=1);

final class WP_Error {
	public string $code;
	public string $message;
	public array $data;

	public function __construct( string $code, string $message, array $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
}

final class WP_REST_Response {
	public array $data;
	public int $status;

	public function __construct( array $data, int $status = 200 ) {
		$this->data   = $data;
		$this->status = $status;
	}
}

final class Eskomi_Test_Request {
	private array $params;

	public function __construct( array $params ) {
		$this->params = $params;
	}

	public function get_param( string $key ) {
		return $this->params[ $key ] ?? null;
	}
}

final class Eskomi_Test_Wpdb {
	public string $options = 'wp_options';

	public function prepare( string $query, ...$args ): array {
		return array( 'query' => $query, 'args' => $args );
	}

	public function query( array $prepared ) {
		$query = ltrim( $prepared['query'] );
		$args  = $prepared['args'];

		if ( str_starts_with( $query, 'UPDATE ' ) ) {
			list( $replacement, $name, $expected ) = $args;
			if ( ! array_key_exists( $name, $GLOBALS['eskomi_test_options'] )
				|| $GLOBALS['eskomi_test_options'][ $name ] !== $expected
			) {
				return 0;
			}
			$GLOBALS['eskomi_test_options'][ $name ] = $replacement;
			return 1;
		}

		if ( str_starts_with( $query, 'DELETE ' ) ) {
			if ( $GLOBALS['eskomi_test_fail_lock_release'] ) {
				return false;
			}
			list( $name, $expected ) = $args;
			if ( ! array_key_exists( $name, $GLOBALS['eskomi_test_options'] )
				|| $GLOBALS['eskomi_test_options'][ $name ] !== $expected
			) {
				return 0;
			}
			unset( $GLOBALS['eskomi_test_options'][ $name ] );
			return 1;
		}

		return false;
	}
}

$GLOBALS['wpdb'] = new Eskomi_Test_Wpdb();

function eskomi_test_reset_runtime(): void {
	$GLOBALS['eskomi_test_meta']              = array();
	$GLOBALS['eskomi_test_meta_updates']      = array();
	$GLOBALS['eskomi_test_options']           = array();
	$GLOBALS['eskomi_test_log_count']         = 0;
	$GLOBALS['eskomi_test_deleted_posts']     = array();
	$GLOBALS['eskomi_test_operational_events'] = array();
	$GLOBALS['eskomi_test_can_update']        = true;
	$GLOBALS['eskomi_test_fail_meta_key']     = null;
	$GLOBALS['eskomi_test_fail_meta_remaining'] = 0;
	$GLOBALS['eskomi_test_fail_meta_on_call'] = array();
	$GLOBALS['eskomi_test_meta_call_counts']  = array();
	$GLOBALS['eskomi_test_fail_insert']       = false;
	$GLOBALS['eskomi_test_fail_delete_post']  = false;
	$GLOBALS['eskomi_test_fail_lock_release'] = false;
	$GLOBALS['eskomi_test_uuid_counter']      = 0;
}

eskomi_test_reset_runtime();

function add_action() {}
function register_post_type() {}
function register_rest_route() {}
function do_action( $hook, ...$args ) {
	if ( 'eskomi_daily_update_operational_log' === $hook ) {
		$GLOBALS['eskomi_test_operational_events'][] = $args;
	}
}
function apply_filters( $hook, $value ) {
	return 'eskomi_daily_update_write_error_log' === $hook ? false : $value;
}
function get_posts() { return array(); }
function absint( $value ) { return abs( (int) $value ); }
function get_post_type( $post_id ) { return 42 === (int) $post_id ? 'shop' : 'post'; }
function current_user_can( $capability ) {
	return $GLOBALS['eskomi_test_can_update']
		&& in_array( $capability, array( 'escomi_update_daily_shop_data', 'edit_post' ), true );
}
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $value ) ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function get_the_title() { return 'テスト店舗'; }
function current_time() { return '2026-07-18 12:00:00'; }
function wp_generate_uuid4() {
	++$GLOBALS['eskomi_test_uuid_counter'];
	return sprintf( '00000000-0000-4000-8000-%012d', $GLOBALS['eskomi_test_uuid_counter'] );
}
function wp_insert_post() {
	if ( $GLOBALS['eskomi_test_fail_insert'] ) {
		return new WP_Error( 'insert_failed', 'insert failed' );
	}
	++$GLOBALS['eskomi_test_log_count'];
	return 1000 + $GLOBALS['eskomi_test_log_count'];
}
function wp_delete_post( $post_id ) {
	if ( $GLOBALS['eskomi_test_fail_delete_post'] ) {
		return false;
	}
	$GLOBALS['eskomi_test_deleted_posts'][] = (int) $post_id;
	unset( $GLOBALS['eskomi_test_meta'][ $post_id ] );
	return true;
}
function get_post_meta( $post_id, $key ) {
	return $GLOBALS['eskomi_test_meta'][ $post_id ][ $key ] ?? '';
}
function metadata_exists( $meta_type, $post_id, $key ) {
	return array_key_exists( $key, $GLOBALS['eskomi_test_meta'][ $post_id ] ?? array() );
}
function update_post_meta( $post_id, $key, $value ) {
	$GLOBALS['eskomi_test_meta_call_counts'][ $key ] =
		( $GLOBALS['eskomi_test_meta_call_counts'][ $key ] ?? 0 ) + 1;
	$call_number = $GLOBALS['eskomi_test_meta_call_counts'][ $key ];
	if ( in_array( $call_number, $GLOBALS['eskomi_test_fail_meta_on_call'][ $key ] ?? array(), true ) ) {
		return false;
	}

	if ( $GLOBALS['eskomi_test_fail_meta_key'] === $key
		&& $GLOBALS['eskomi_test_fail_meta_remaining'] > 0
	) {
		--$GLOBALS['eskomi_test_fail_meta_remaining'];
		return false;
	}

	$current = $GLOBALS['eskomi_test_meta'][ $post_id ][ $key ] ?? null;
	$GLOBALS['eskomi_test_meta'][ $post_id ][ $key ] = $value;
	$GLOBALS['eskomi_test_meta_updates'][ $post_id ][ $key ] =
		( $GLOBALS['eskomi_test_meta_updates'][ $post_id ][ $key ] ?? 0 ) + 1;
	return $current === $value ? false : true;
}
function delete_post_meta( $post_id, $key ) {
	if ( ! metadata_exists( 'post', $post_id, $key ) ) {
		return false;
	}
	unset( $GLOBALS['eskomi_test_meta'][ $post_id ][ $key ] );
	return true;
}
function add_option( $name, $value ) {
	if ( array_key_exists( $name, $GLOBALS['eskomi_test_options'] ) ) {
		return false;
	}
	$GLOBALS['eskomi_test_options'][ $name ] = $value;
	return true;
}
function get_option( $name, $default = false ) {
	return $GLOBALS['eskomi_test_options'][ $name ] ?? $default;
}
function wp_cache_delete() { return true; }

function eskomi_test_fail( string $message ): void {
	fwrite( STDERR, $message . "\n" );
	exit( 1 );
}

function eskomi_test_expect_error( $value, string $expected_code ): void {
	if ( ! $value instanceof WP_Error || $value->code !== $expected_code ) {
		eskomi_test_fail( 'Expected WP_Error code: ' . $expected_code );
	}
}

function eskomi_test_request( string $request_id, array $meta ): Eskomi_Test_Request {
	return new Eskomi_Test_Request(
		array(
			'shop_post_id' => 42,
			'request_id'   => $request_id,
			'meta'         => $meta,
			'summary'      => '監査用要約',
			'log_type'     => 'update',
		)
	);
}

function eskomi_test_uuid( int $value ): string {
	return sprintf( '%08x-0000-4000-8000-%012x', $value, $value );
}

require_once dirname( __DIR__, 2 ) . '/ai-update-security.php';
require_once dirname( __DIR__, 2 ) . '/ai-update-log.php';

foreach ( array( 'escomi_acquire_daily_shop_lock', 'escomi_release_daily_shop_lock' ) as $required_function ) {
	if ( ! function_exists( $required_function ) ) {
		eskomi_test_fail( 'Missing production lock function: ' . $required_function );
	}
}

$valid_request_ids = array(
	'550e8400-e29b-41d4-a716-446655440000',
	'B4C094AE-A4A5-4F07-8F7D-0A3C5C18E634',
);

$invalid_request_ids = array(
	str_repeat( '-', 36 ),
	'550e8400-e29b-11d4-a716-446655440000',
	'550e8400-e29b-41d4-7716-446655440000',
	'550e8400-e29b-41d4-a716-44665544000',
	'550e8400e29b41d4a716446655440000',
	'{550e8400-e29b-41d4-a716-446655440000}',
	'',
	null,
);

foreach ( $valid_request_ids as $request_id ) {
	if ( ! escomi_is_valid_daily_request_id( $request_id ) ) {
		eskomi_test_fail( 'Valid UUIDv4 was rejected.' );
	}
}
foreach ( $invalid_request_ids as $request_id ) {
	if ( escomi_is_valid_daily_request_id( $request_id ) ) {
		eskomi_test_fail( 'Invalid request_id was accepted.' );
	}
}

$GLOBALS['eskomi_test_can_update'] = false;
eskomi_test_expect_error(
	escomi_can_update_daily_shop_data( new Eskomi_Test_Request( array( 'shop_post_id' => 999 ) ) ),
	'rest_forbidden'
);
$GLOBALS['eskomi_test_can_update'] = true;

$boundary_therapist = array(
	'name'   => str_repeat( 'n', 100 ),
	'time'   => str_repeat( 't', 100 ),
	'status' => str_repeat( 's', 200 ),
	'tags'   => array_fill( 0, 10, str_repeat( 'g', 50 ) ),
);
$boundary_payload = eskomi_test_request(
	$valid_request_ids[0],
	array(
		'shop_today_analysis'   => str_repeat( 'a', 2000 ),
		'shop_availability'     => str_repeat( 'v', 200 ),
		'shop_today_therapists' => array_fill( 0, 100, $boundary_therapist ),
	)
);
$validated = escomi_validate_daily_shop_update( $boundary_payload );
if ( is_wp_error( $validated ) || 3 !== count( $validated['meta'] ) ) {
	eskomi_test_fail( 'Exact payload boundaries were rejected.' );
}

$over_limit_cases = array(
	array( 'shop_today_analysis' => str_repeat( 'a', 2001 ) ),
	array( 'shop_availability' => str_repeat( 'v', 201 ) ),
	array( 'shop_today_therapists' => array( array( 'name' => str_repeat( 'n', 101 ) ) ) ),
	array( 'shop_today_therapists' => array( array( 'time' => str_repeat( 't', 101 ) ) ) ),
	array( 'shop_today_therapists' => array( array( 'status' => str_repeat( 's', 201 ) ) ) ),
	array( 'shop_today_therapists' => array( array( 'tags' => array( str_repeat( 'g', 51 ) ) ) ) ),
	array( 'shop_today_therapists' => array( array( 'tags' => array_fill( 0, 11, 'g' ) ) ) ),
	array( 'shop_today_therapists' => array_fill( 0, 101, array( 'name' => 'n' ) ) ),
);
foreach ( $over_limit_cases as $index => $meta ) {
	if ( ! is_wp_error( escomi_validate_daily_shop_update( eskomi_test_request( $valid_request_ids[0], $meta ) ) ) ) {
		eskomi_test_fail( 'Over-limit fixture was accepted: ' . $index );
	}
}

eskomi_test_expect_error(
	escomi_validate_daily_shop_update(
		eskomi_test_request( $valid_request_ids[0], array( 'official_url' => 'https://example.test/' ) )
	),
	'unsupported_field'
);
eskomi_test_expect_error(
	escomi_validate_daily_shop_update(
		eskomi_test_request(
			$valid_request_ids[0],
			array( 'shop_today_therapists' => array( array( 'name' => 'n', 'profile' => array() ) ) )
		)
	),
	'unsupported_therapist_field'
);

$now = time();
$GLOBALS['eskomi_test_meta'][42][ ESKOMI_DAILY_UPDATE_REQUEST_META_KEY ] = array(
	array( 'id' => eskomi_test_uuid( 1 ), 'appliedAt' => $now - ESKOMI_DAILY_UPDATE_REQUEST_TTL - 1 ),
	array( 'id' => eskomi_test_uuid( 2 ), 'appliedAt' => $now - ESKOMI_DAILY_UPDATE_REQUEST_TTL ),
	array( 'id' => eskomi_test_uuid( 3 ), 'appliedAt' => $now ),
);
$recent = escomi_get_recent_daily_request_ids( 42, $now );
if ( 2 !== count( $recent ) || eskomi_test_uuid( 2 ) !== $recent[0]['id'] ) {
	eskomi_test_fail( '24-hour request history expiry is incorrect.' );
}

$history = array();
for ( $index = 1; $index <= 105; ++$index ) {
	$history[] = array( 'id' => eskomi_test_uuid( 100 + $index ), 'appliedAt' => $now );
}
$GLOBALS['eskomi_test_meta'][42][ ESKOMI_DAILY_UPDATE_REQUEST_META_KEY ] = $history;
$recent = escomi_get_recent_daily_request_ids( 42, $now );
if ( 100 !== count( $recent ) || eskomi_test_uuid( 106 ) !== $recent[0]['id'] ) {
	eskomi_test_fail( 'Request history was not capped at the latest 100 entries.' );
}

eskomi_test_reset_runtime();
$lock_name = escomi_daily_shop_lock_option_name( 42 );
$GLOBALS['eskomi_test_options'][ $lock_name ] = ( time() - ESKOMI_DAILY_UPDATE_LOCK_TTL - 1 ) . '|stale';
$stale_lock = escomi_acquire_daily_shop_lock( 42 );
if ( is_wp_error( $stale_lock ) ) {
	eskomi_test_fail( 'Stale lock was not recovered.' );
}
escomi_release_daily_shop_lock( $stale_lock );
if ( array_key_exists( $lock_name, $GLOBALS['eskomi_test_options'] ) ) {
	eskomi_test_fail( 'Owned lock was not released.' );
}

foreach ( array( eskomi_test_uuid( 300 ), eskomi_test_uuid( 301 ) ) as $locked_request_id ) {
	$GLOBALS['eskomi_test_options'][ $lock_name ] = time() . '|external';
	$locked_response = handle_ai_shop_update_final(
		eskomi_test_request( $locked_request_id, array( 'shop_today_analysis' => 'blocked' ) )
	);
	eskomi_test_expect_error( $locked_response, 'update_locked' );
	if ( 409 !== ( $locked_response->data['status'] ?? null ) ) {
		eskomi_test_fail( 'Lock contention must be retryable HTTP 409.' );
	}
	unset( $GLOBALS['eskomi_test_options'][ $lock_name ] );
}
if ( metadata_exists( 'post', 42, 'shop_today_analysis' ) ) {
	eskomi_test_fail( 'Locked request modified shop data.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_meta'][42]['shop_today_analysis'] = 'old analysis';
$GLOBALS['eskomi_test_meta'][42]['shop_availability']   = 'old availability';
$GLOBALS['eskomi_test_fail_meta_key']                   = 'shop_availability';
$GLOBALS['eskomi_test_fail_meta_remaining']             = 1;
$partial_failure = handle_ai_shop_update_final(
	eskomi_test_request(
		eskomi_test_uuid( 400 ),
		array( 'shop_today_analysis' => 'new analysis', 'shop_availability' => 'new availability' )
	)
);
eskomi_test_expect_error( $partial_failure, 'update_failed' );
if ( 'old analysis' !== get_post_meta( 42, 'shop_today_analysis', true )
	|| 'old availability' !== get_post_meta( 42, 'shop_availability', true )
	|| metadata_exists( 'post', 42, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY )
) {
	eskomi_test_fail( 'Partial field failure was not fully rolled back.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_meta'][42]['shop_today_analysis'] = 'old';
$GLOBALS['eskomi_test_fail_meta_key']                   = ESKOMI_DAILY_UPDATE_REQUEST_META_KEY;
$GLOBALS['eskomi_test_fail_meta_remaining']             = 1;
$history_failure = handle_ai_shop_update_final(
	eskomi_test_request( eskomi_test_uuid( 401 ), array( 'shop_today_analysis' => 'new' ) )
);
eskomi_test_expect_error( $history_failure, 'request_history_failed' );
if ( 'old' !== get_post_meta( 42, 'shop_today_analysis', true )
	|| metadata_exists( 'post', 42, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY )
	|| metadata_exists( 'post', 42, 'shop_last_ai_check' )
) {
	eskomi_test_fail( 'History storage failure was not rolled back.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_meta'][42]['shop_today_analysis'] = 'old';
$GLOBALS['eskomi_test_fail_insert']                     = true;
$audit_failure = handle_ai_shop_update_final(
	eskomi_test_request( eskomi_test_uuid( 402 ), array( 'shop_today_analysis' => 'new' ) )
);
eskomi_test_expect_error( $audit_failure, 'audit_log_failed' );
if ( 'old' !== get_post_meta( 42, 'shop_today_analysis', true )
	|| metadata_exists( 'post', 42, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY )
	|| metadata_exists( 'post', 42, 'shop_last_ai_check' )
) {
	eskomi_test_fail( 'Audit insert failure was not rolled back.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_meta'][42]['shop_today_analysis'] = 'old analysis';
$GLOBALS['eskomi_test_meta'][42]['shop_availability']   = 'old availability';
$GLOBALS['eskomi_test_fail_meta_on_call'] = array(
	'shop_today_therapists' => array( 1 ),
	'shop_availability'     => array( 2 ),
);
$rollback_failure = handle_ai_shop_update_final(
	eskomi_test_request(
		eskomi_test_uuid( 403 ),
		array(
			'shop_today_analysis'   => 'new analysis',
			'shop_availability'     => 'new availability',
			'shop_today_therapists' => array( array( 'name' => 'n' ) ),
		)
	)
);
eskomi_test_expect_error( $rollback_failure, 'rollback_failed' );
if ( 'old analysis' !== get_post_meta( 42, 'shop_today_analysis', true ) ) {
	eskomi_test_fail( 'Rollback stopped before restoring snapshots after the failed key.' );
}
if ( str_contains( $rollback_failure->message . serialize( $rollback_failure->data ), 'shop_availability' ) ) {
	eskomi_test_fail( 'Rollback failure key leaked into the external response.' );
}
if ( empty( $GLOBALS['eskomi_test_operational_events'] ) ) {
	eskomi_test_fail( 'Rollback failure was not recorded internally.' );
}
$rollback_event = $GLOBALS['eskomi_test_operational_events'][ count( $GLOBALS['eskomi_test_operational_events'] ) - 1 ];
if ( 'rollback_failed' !== $rollback_event[0]
	|| ! in_array( 'shop_availability', $rollback_event[1], true )
) {
	eskomi_test_fail( 'Rollback failure did not record the failed key internally.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_meta'][42]['shop_today_analysis'] = 'old';
$GLOBALS['eskomi_test_fail_meta_on_call']['log_target_shop'] = array( 1 );
$GLOBALS['eskomi_test_fail_delete_post'] = true;
$audit_cleanup_failure = handle_ai_shop_update_final(
	eskomi_test_request( eskomi_test_uuid( 404 ), array( 'shop_today_analysis' => 'new' ) )
);
eskomi_test_expect_error( $audit_cleanup_failure, 'audit_cleanup_failed' );
if ( 'old' !== get_post_meta( 42, 'shop_today_analysis', true ) ) {
	eskomi_test_fail( 'Audit cleanup failure did not roll back shop data.' );
}
if ( empty( $GLOBALS['eskomi_test_operational_events'] ) ) {
	eskomi_test_fail( 'Audit cleanup failure was not recorded internally.' );
}
$audit_event = $GLOBALS['eskomi_test_operational_events'][ count( $GLOBALS['eskomi_test_operational_events'] ) - 1 ];
if ( 'audit_cleanup_failed' !== $audit_event[0] ) {
	eskomi_test_fail( 'Audit cleanup failure recorded the wrong operational event.' );
}

eskomi_test_reset_runtime();
$GLOBALS['eskomi_test_fail_lock_release'] = true;
$lock_release_failure = handle_ai_shop_update_final(
	eskomi_test_request( eskomi_test_uuid( 405 ), array( 'shop_today_analysis' => 'committed' ) )
);
eskomi_test_expect_error( $lock_release_failure, 'lock_release_failed' );
if ( 'committed' !== get_post_meta( 42, 'shop_today_analysis', true )
	|| ! metadata_exists( 'post', 42, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY )
) {
	eskomi_test_fail( 'Committed update was lost when lock release failed.' );
}
if ( str_contains( $lock_release_failure->message . serialize( $lock_release_failure->data ), '|' ) ) {
	eskomi_test_fail( 'Lock token leaked into the external response.' );
}
if ( empty( $GLOBALS['eskomi_test_operational_events'] ) ) {
	eskomi_test_fail( 'Lock release failure was not recorded internally.' );
}
$lock_event = $GLOBALS['eskomi_test_operational_events'][ count( $GLOBALS['eskomi_test_operational_events'] ) - 1 ];
if ( 'lock_release_failed' !== $lock_event[0] || ! empty( $lock_event[1] ) ) {
	eskomi_test_fail( 'Lock release operational event must not contain token details.' );
}

eskomi_test_reset_runtime();
$request_a = eskomi_test_request(
	'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	array( 'shop_today_analysis' => 'first' )
);
$request_b = eskomi_test_request(
	'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
	array( 'shop_today_analysis' => 'second' )
);
$retry_a = eskomi_test_request(
	'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
	array( 'shop_today_analysis' => 'stale retry' )
);
$first_response  = handle_ai_shop_update_final( $request_a );
$second_response = handle_ai_shop_update_final( $request_b );
$retry_response  = handle_ai_shop_update_final( $retry_a );
if ( 201 !== $first_response->status || 201 !== $second_response->status ) {
	eskomi_test_fail( 'Changed payload did not return 201.' );
}
if ( 200 !== $retry_response->status || true !== $retry_response->data['duplicate'] ) {
	eskomi_test_fail( 'Out-of-order retry was not detected as duplicate.' );
}
if ( 'second' !== get_post_meta( 42, 'shop_today_analysis', true ) ) {
	eskomi_test_fail( 'Duplicate retry overwrote the current value.' );
}

$request_c = eskomi_test_request(
	'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
	array( 'shop_today_analysis' => 'second' )
);
$log_count_before_noop = $GLOBALS['eskomi_test_log_count'];
$noop_response         = handle_ai_shop_update_final( $request_c );
if ( 200 !== $noop_response->status || $log_count_before_noop !== $GLOBALS['eskomi_test_log_count'] ) {
	eskomi_test_fail( 'No-op request created an update log.' );
}

fwrite( STDOUT, "AI update route security: PASS\n" );
