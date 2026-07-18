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

$GLOBALS['escomi_test_meta']         = array();
$GLOBALS['escomi_test_meta_updates'] = array();
$GLOBALS['escomi_test_log_count']    = 0;
$GLOBALS['escomi_test_can_update']   = true;

function add_action() {}
function register_post_type() {}
function register_rest_route() {}
function get_posts() { return array(); }
function absint( $value ) { return abs( (int) $value ); }
function get_post_type( $post_id ) { return 42 === (int) $post_id ? 'shop' : 'post'; }
function current_user_can( $capability ) {
	return $GLOBALS['escomi_test_can_update']
		&& in_array( $capability, array( 'escomi_update_daily_shop_data', 'edit_post' ), true );
}
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_textarea_field( $value ) { return trim( strip_tags( (string) $value ) ); }
function sanitize_key( $value ) { return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $value ) ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function get_the_title() { return 'テスト店舗'; }
function current_time() { return '2026-07-18 12:00:00'; }
function wp_insert_post() {
	++$GLOBALS['escomi_test_log_count'];
	return 1000 + $GLOBALS['escomi_test_log_count'];
}
function get_post_meta( $post_id, $key ) {
	return $GLOBALS['escomi_test_meta'][ $post_id ][ $key ] ?? '';
}
function update_post_meta( $post_id, $key, $value ) {
	$current = $GLOBALS['escomi_test_meta'][ $post_id ][ $key ] ?? null;
	$GLOBALS['escomi_test_meta'][ $post_id ][ $key ] = $value;
	$GLOBALS['escomi_test_meta_updates'][ $post_id ][ $key ] =
		( $GLOBALS['escomi_test_meta_updates'][ $post_id ][ $key ] ?? 0 ) + 1;
	return $current === $value ? false : true;
}

function escomi_test_fail( string $message ): void {
	fwrite( STDERR, $message . "\n" );
	exit( 1 );
}

function escomi_test_expect_error( $value, string $expected_code ): void {
	if ( ! $value instanceof WP_Error || $value->code !== $expected_code ) {
		escomi_test_fail( 'Expected WP_Error code: ' . $expected_code );
	}
}

require_once dirname( __DIR__, 2 ) . '/ai-update-security.php';
require_once dirname( __DIR__, 2 ) . '/ai-update-log.php';

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
		escomi_test_fail( 'Valid UUIDv4 was rejected.' );
	}
}

foreach ( $invalid_request_ids as $request_id ) {
	if ( escomi_is_valid_daily_request_id( $request_id ) ) {
		escomi_test_fail( 'Invalid request_id was accepted.' );
	}
}

$GLOBALS['escomi_test_can_update'] = false;
escomi_test_expect_error(
	escomi_can_update_daily_shop_data(
		new Eskomi_Test_Request( array( 'shop_post_id' => 999 ) )
	),
	'rest_forbidden'
);
$GLOBALS['escomi_test_can_update'] = true;

$valid_payload = new Eskomi_Test_Request(
	array(
		'shop_post_id' => 42,
		'request_id'   => $valid_request_ids[0],
		'meta'         => array(
			'shop_today_analysis' => '本日の案内',
			'shop_availability'   => '空きあり',
			'shop_today_therapists' => array(
				array(
					'name'   => '担当者A',
					'time'   => '12:00-18:00',
					'status' => '受付中',
					'tags'   => array( '新人', '予約可' ),
				),
			),
		),
	)
);

$validated = escomi_validate_daily_shop_update( $valid_payload );
if ( is_wp_error( $validated ) || 3 !== count( $validated['meta'] ) ) {
	escomi_test_fail( 'Valid allowlisted payload was rejected.' );
}

escomi_test_expect_error(
	escomi_validate_daily_shop_update(
		new Eskomi_Test_Request(
			array(
				'request_id' => $valid_request_ids[0],
				'meta'       => array( 'official_url' => 'https://example.test/' ),
			)
		)
	),
	'unsupported_field'
);

escomi_test_expect_error(
	escomi_validate_daily_shop_update(
		new Eskomi_Test_Request(
			array(
				'request_id' => $valid_request_ids[0],
				'meta'       => array( 'shop_today_analysis' => str_repeat( 'a', 2001 ) ),
			)
		)
	),
	'field_too_long'
);

escomi_test_expect_error(
	escomi_validate_daily_shop_update(
		new Eskomi_Test_Request(
			array(
				'request_id' => $valid_request_ids[0],
				'meta'       => array(
					'shop_today_therapists' => array(
						array( 'name' => '担当者A', 'profile' => array( 'hidden' => true ) ),
					),
				),
			)
		)
	),
	'unsupported_therapist_field'
);

escomi_test_expect_error(
	escomi_validate_daily_shop_update(
		new Eskomi_Test_Request(
			array(
				'request_id' => $valid_request_ids[0],
				'meta'       => array(
					'shop_today_therapists' => array_fill( 0, 101, array( 'name' => '担当者' ) ),
				),
			)
		)
	),
	'too_many_therapists'
);

$request_a = new Eskomi_Test_Request(
	array(
		'shop_post_id' => 42,
		'request_id'   => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		'meta'         => array( 'shop_today_analysis' => 'first' ),
	)
);
$request_b = new Eskomi_Test_Request(
	array(
		'shop_post_id' => 42,
		'request_id'   => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
		'meta'         => array( 'shop_today_analysis' => 'second' ),
	)
);
$retry_a = new Eskomi_Test_Request(
	array(
		'shop_post_id' => 42,
		'request_id'   => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
		'meta'         => array( 'shop_today_analysis' => 'stale retry' ),
	)
);

$first_response  = handle_ai_shop_update_final( $request_a );
$second_response = handle_ai_shop_update_final( $request_b );
$retry_response  = handle_ai_shop_update_final( $retry_a );

if ( 201 !== $first_response->status || 201 !== $second_response->status ) {
	escomi_test_fail( 'Changed payload did not return 201.' );
}
if ( 200 !== $retry_response->status || true !== $retry_response->data['duplicate'] ) {
	escomi_test_fail( 'Out-of-order retry was not detected as duplicate.' );
}
if ( 'second' !== get_post_meta( 42, 'shop_today_analysis', true ) ) {
	escomi_test_fail( 'Duplicate retry overwrote the current value.' );
}
if ( 2 !== $GLOBALS['escomi_test_meta_updates'][42]['shop_today_analysis'] ) {
	escomi_test_fail( 'Duplicate retry performed an extra field update.' );
}

$request_c = new Eskomi_Test_Request(
	array(
		'shop_post_id' => 42,
		'request_id'   => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
		'meta'         => array( 'shop_today_analysis' => 'second' ),
	)
);
$log_count_before_noop = $GLOBALS['escomi_test_log_count'];
$noop_response         = handle_ai_shop_update_final( $request_c );
if ( 200 !== $noop_response->status || $log_count_before_noop !== $GLOBALS['escomi_test_log_count'] ) {
	escomi_test_fail( 'No-op request created an update log.' );
}

fwrite( STDOUT, "AI update route security: PASS\n" );
