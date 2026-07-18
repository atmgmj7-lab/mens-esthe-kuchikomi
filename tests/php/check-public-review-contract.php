<?php
declare(strict_types=1);

define( 'ABSPATH', __DIR__ );

final class WP_Post {
	public int $ID;
	public string $post_type;
	public string $post_status;
	public string $post_content;
	public string $post_date_gmt;

	public function __construct( int $id, string $type, string $status, string $body, string $date ) {
		$this->ID            = $id;
		$this->post_type     = $type;
		$this->post_status   = $status;
		$this->post_content  = $body;
		$this->post_date_gmt = $date;
	}
}

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

final class Eskomi_Public_Review_Test_Request {
	private array $params;

	public function __construct( array $params ) {
		$this->params = $params;
	}

	public function get_param( string $key ) {
		return $this->params[ $key ] ?? null;
	}

	public function get_params(): array {
		return $this->params;
	}
}

$GLOBALS['escomi_public_review_routes'] = array();
$GLOBALS['escomi_public_review_posts']  = array();
$GLOBALS['escomi_public_review_meta']   = array();
$GLOBALS['escomi_public_shops']         = array(
	42 => new WP_Post( 42, 'shop', 'publish', '', '2026-01-01 00:00:00' ),
	43 => new WP_Post( 43, 'shop', 'draft', '', '2026-01-01 00:00:00' ),
	44 => new WP_Post( 44, 'post', 'publish', '', '2026-01-01 00:00:00' ),
);

function add_action( $hook, $callback ) {
	if ( 'rest_api_init' === $hook ) {
		$callback();
	}
}
function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['escomi_public_review_routes'][] = compact( 'namespace', 'route', 'args' );
}
function rest_ensure_response( $data ) {
	return new WP_REST_Response( $data );
}
function get_post( $post_id ) {
	return $GLOBALS['escomi_public_shops'][ (int) $post_id ] ?? null;
}
function get_post_meta( $post_id, $key ) {
	return $GLOBALS['escomi_public_review_meta'][ (int) $post_id ][ $key ] ?? '';
}
function wp_strip_all_tags( $value ) {
	return trim( strip_tags( (string) $value ) );
}
function wp_check_invalid_utf8( $value ) {
	return (string) $value;
}
function get_post_time( $format, $gmt, $post ) {
	unset( $format, $gmt );
	return $post->post_date_gmt;
}
function absint( $value ) {
	return abs( (int) $value );
}
function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}
function get_posts( $args ) {
	$items = array_filter(
		$GLOBALS['escomi_public_review_posts'],
		function ( $post ) use ( $args ) {
			if ( $post->post_type !== $args['post_type'] || $post->post_status !== $args['post_status'] ) {
				return false;
			}
			foreach ( $args['meta_query'] as $clause ) {
				if ( ! is_array( $clause ) || empty( $clause['key'] ) ) {
					continue;
				}
				$value = get_post_meta( $post->ID, $clause['key'], true );
				if ( (string) $value !== (string) $clause['value'] ) {
					return false;
				}
			}
			return true;
		}
	);
	usort(
		$items,
		fn( $left, $right ) => strcmp( $right->post_date_gmt, $left->post_date_gmt )
	);
	return array_values( $items );
}

function escomi_public_review_test_fail( string $message ): void {
	fwrite( STDERR, $message . "\n" );
	exit( 1 );
}

function escomi_public_review_test_expect( bool $condition, string $message ): void {
	if ( ! $condition ) {
		escomi_public_review_test_fail( $message );
	}
}

function escomi_public_review_test_record(
	int $id,
	int $shop_id,
	string $post_status,
	string $approval_status,
	string $date,
	array $ratings,
	string $body = '<b>承認済み本文</b>'
): void {
	$GLOBALS['escomi_public_review_posts'][] = new WP_Post( $id, 'reviews', $post_status, $body, $date );
	$GLOBALS['escomi_public_review_meta'][ $id ] = array_merge(
		array(
			'review_shop_id'  => $shop_id,
			'approval_status' => $approval_status,
			'reviewer_name'   => '非公開氏名',
			'reviewer_email'  => 'private@example.test',
			'reviewer_ip'     => '192.0.2.1',
			'moderation_note' => '管理用メモ',
		),
		$ratings
	);
}

require_once dirname( __DIR__, 2 ) . '/reviews-public-rest.php';

escomi_public_review_test_expect(
	null === escomi_public_review_date( '2026-02-30 03:00:00' ),
	'Impossible calendar dates must not be normalized into public data.'
);

escomi_public_review_test_expect( 1 === count( $GLOBALS['escomi_public_review_routes'] ), 'Public review route was not registered.' );
$route = $GLOBALS['escomi_public_review_routes'][0];
escomi_public_review_test_expect( 'escomi/v1' === $route['namespace'], 'Wrong review REST namespace.' );
escomi_public_review_test_expect( array( 'GET' ) === $route['args']['methods'], 'Review REST must be GET-only.' );
escomi_public_review_test_expect( true === $route['args']['permission_callback'](), 'Review REST must be public read-only.' );

escomi_public_review_test_record(
	101,
	42,
	'publish',
	'approved',
	'2026-07-18 03:00:00',
	array( 'rating_total' => 5, 'rating_price' => 4, 'rating_service' => 5, 'rating_cleanliness' => 3 )
);
escomi_public_review_test_record(
	102,
	42,
	'publish',
	'approved',
	'2026-07-17 03:00:00',
	array( 'rating_total' => 4, 'rating_price' => 0, 'rating_service' => 6, 'rating_cleanliness' => '5' )
);
escomi_public_review_test_record(
	103,
	42,
	'publish',
	'approved',
	'2026-07-16 03:00:00',
	array( 'rating_total' => 3, 'rating_price' => 5, 'rating_service' => 'bad', 'rating_cleanliness' => 4 )
);
escomi_public_review_test_record(
	104,
	42,
	'publish',
	'pending',
	'2026-07-19 03:00:00',
	array( 'rating_total' => 1 )
);
escomi_public_review_test_record(
	105,
	99,
	'publish',
	'approved',
	'2026-07-20 03:00:00',
	array( 'rating_total' => 1 )
);
escomi_public_review_test_record(
	106,
	42,
	'draft',
	'approved',
	'2026-07-21 03:00:00',
	array( 'rating_total' => 1 )
);

$page = escomi_public_reviews_query_page( 42, 1, 2 );
escomi_public_review_test_expect( 3 === $page['total'], 'Only approved reviews for the requested shop must be counted.' );
escomi_public_review_test_expect( 2 === $page['totalPages'], 'Pagination total is incorrect.' );
escomi_public_review_test_expect( array( 101, 102 ) === array_column( $page['items'], 'id' ), 'Reviews must be newest first.' );
escomi_public_review_test_expect( '承認済み本文' === $page['items'][0]['body'], 'Review body must be plain text.' );
escomi_public_review_test_expect( null === $page['items'][1]['ratingPrice'], 'Rating 0 must become null.' );
escomi_public_review_test_expect( null === $page['items'][1]['ratingService'], 'Rating 6 must become null.' );
escomi_public_review_test_expect( 5 === $page['items'][1]['ratingCleanliness'], 'Integer-shaped valid rating must remain valid.' );
escomi_public_review_test_expect( 4.0 === $page['metrics']['total']['average'], 'Total rating average must use all approved valid responses.' );
escomi_public_review_test_expect( 3 === $page['metrics']['total']['responseCount'], 'Total response count is incorrect.' );
escomi_public_review_test_expect( 4.5 === $page['metrics']['price']['average'], 'Price average must ignore invalid ratings.' );
escomi_public_review_test_expect( 2 === $page['metrics']['price']['responseCount'], 'Price response count must ignore invalid ratings.' );
escomi_public_review_test_expect( '2026-07-16T03:00:00+00:00' === $page['dateRange']['oldestSubmittedAt'], 'Oldest date is incorrect.' );
escomi_public_review_test_expect( '2026-07-18T03:00:00+00:00' === $page['dateRange']['latestSubmittedAt'], 'Latest date is incorrect.' );
$serialized = json_encode( $page, JSON_UNESCAPED_UNICODE );
foreach ( array( 'private@example.test', '192.0.2.1', '非公開氏名', '管理用メモ', 'approval_status', 'review_shop_id' ) as $private_value ) {
	escomi_public_review_test_expect( ! str_contains( $serialized, $private_value ), 'Private review data leaked: ' . $private_value );
}

$empty = escomi_public_reviews_query_page( 999, 1, 20 );
escomi_public_review_test_expect( 0 === $empty['total'], 'Empty result total must be zero.' );
escomi_public_review_test_expect( 0 === $empty['totalPages'], 'Empty result totalPages must be zero.' );
escomi_public_review_test_expect( null === $empty['metrics']['total']['average'], 'Empty average must be null.' );
escomi_public_review_test_expect( 0 === $empty['metrics']['total']['responseCount'], 'Empty response count must be zero.' );
escomi_public_review_test_expect( null === $empty['dateRange'], 'Empty date range must be null.' );

$callback = $route['args']['callback'];
foreach ( array( 999, 43, 44 ) as $invalid_shop_id ) {
	$response = $callback( new Eskomi_Public_Review_Test_Request( array( 'shop_id' => $invalid_shop_id ) ) );
	escomi_public_review_test_expect( $response instanceof WP_Error && 404 === $response->data['status'], 'Invalid or unpublished shop must be 404.' );
}
foreach (
	array(
		array( 'shop_id' => 42, 'page' => 0 ),
		array( 'shop_id' => 42, 'page' => '1.5' ),
		array( 'shop_id' => 42, 'per_page' => 0 ),
		array( 'shop_id' => 42, 'per_page' => 21 ),
		array( 'shop_id' => 42, 'page' => str_repeat( '9', 100 ) ),
		array( 'shop_id' => 42, 'unknown' => 'value' ),
	) as $invalid_params
) {
	$response = $callback( new Eskomi_Public_Review_Test_Request( $invalid_params ) );
	escomi_public_review_test_expect( $response instanceof WP_Error && 400 === $response->data['status'], 'Invalid or unknown parameter must be 400.' );
}

$response = $callback( new Eskomi_Public_Review_Test_Request( array( 'shop_id' => 42, 'page' => 2, 'per_page' => 2 ) ) );
escomi_public_review_test_expect( $response instanceof WP_REST_Response, 'Valid request must return a REST response.' );
escomi_public_review_test_expect( 103 === $response->data['items'][0]['id'], 'Second page item is incorrect.' );

fwrite( STDOUT, "Public approved review PHP fixture: PASS\n" );
