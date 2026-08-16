<?php
declare(strict_types=1);

define( 'ABSPATH', __DIR__ );

final class WP_Post {
	public int $ID;
	public string $post_type;
	public string $post_status;
	public string $post_content;
	public string $post_date_gmt;
	public string $post_name;
	public string $post_title;

	public function __construct( int $id, string $type, string $status, string $body, string $date, string $slug = '', string $title = '' ) {
		$this->ID            = $id;
		$this->post_type     = $type;
		$this->post_status   = $status;
		$this->post_content  = $body;
		$this->post_date_gmt = $date;
		$this->post_name     = $slug;
		$this->post_title    = $title;
	}
}

final class WP_Term {
	public int $term_id;
	public string $slug;
	public string $name;
	public int $object_id;

	public function __construct( int $term_id, string $slug, string $name, int $object_id ) {
		$this->term_id   = $term_id;
		$this->slug      = $slug;
		$this->name      = $name;
		$this->object_id = $object_id;
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

final class Eskomi_Public_Review_Test_Wpdb {
	public string $posts = 'wp_posts';
	public string $postmeta = 'wp_postmeta';
	public string $last_error = '';

	public function prepare( string $query, ...$values ): string {
		foreach ( $values as $value ) {
			$query = preg_replace( '/%s/', "'" . addslashes( (string) $value ) . "'", $query, 1 );
		}
		return $query;
	}
}

final class Eskomi_Public_Review_Test_Request {
	private array $url_params;
	private array $query_params;

	public function __construct( array $url_params, array $query_params = array() ) {
		$this->url_params   = $url_params;
		$this->query_params = $query_params;
	}

	public function get_param( string $key ) {
		$params = $this->get_params();
		return $params[ $key ] ?? null;
	}

	public function get_params(): array {
		return array_merge( $this->url_params, $this->query_params );
	}

	public function get_url_params(): array {
		return $this->url_params;
	}

	public function get_query_params(): array {
		return $this->query_params;
	}
}

$GLOBALS['escomi_public_review_routes'] = array();
$GLOBALS['escomi_public_review_posts']  = array();
$GLOBALS['escomi_public_review_meta']   = array();
$GLOBALS['escomi_public_shops']         = array(
	42 => new WP_Post( 42, 'shop', 'publish', '', '2026-01-01 00:00:00', 'shop-forty-two', '公開店舗42' ),
	43 => new WP_Post( 43, 'shop', 'draft', '', '2026-01-01 00:00:00', 'private-shop', '非公開店舗' ),
	44 => new WP_Post( 44, 'post', 'publish', '', '2026-01-01 00:00:00' ),
	45 => new WP_Post( 45, 'shop', 'publish', '', '2026-01-01 00:00:00', 'shop-forty-five', '公開店舗45' ),
);
$GLOBALS['escomi_public_shop_terms'] = array(
	42 => array(
		new WP_Term( 10, 'osaka', '大阪', 42 ),
		new WP_Term( 11, 'umeda', '梅田', 42 ),
	),
	45 => array(
		new WP_Term( 12, 'nihonbashi', '大阪日本橋', 45 ),
	),
);
$GLOBALS['escomi_global_review_query_count'] = 0;
$GLOBALS['escomi_global_shop_query_count']   = 0;
$GLOBALS['escomi_global_area_query_count']   = 0;
$GLOBALS['escomi_filter_callbacks']          = array();
$GLOBALS['escomi_public_review_meta_counts'] = array();
$GLOBALS['escomi_global_query_args']         = array();
$GLOBALS['escomi_global_query_clauses']      = array();
$GLOBALS['wpdb']                             = new Eskomi_Public_Review_Test_Wpdb();

function add_action( $hook, $callback ) {
	if ( 'rest_api_init' === $hook ) {
		$callback();
	}
}
function register_rest_route( $namespace, $route, $args ) {
	$GLOBALS['escomi_public_review_routes'][] = compact( 'namespace', 'route', 'args' );
}
function add_filter( $hook, $callback ) {
	$GLOBALS['escomi_filter_callbacks'][ $hook ] = $callback;
}
function remove_filter( $hook, $callback ) {
	if ( ( $GLOBALS['escomi_filter_callbacks'][ $hook ] ?? null ) === $callback ) {
		unset( $GLOBALS['escomi_filter_callbacks'][ $hook ] );
	}
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
	if ( 'shop' === $args['post_type'] ) {
		$GLOBALS['escomi_global_shop_query_count']++;
		$shop_ids = array_map( 'intval', $args['post__in'] ?? array() );
		return array_values(
			array_filter(
				$GLOBALS['escomi_public_shops'],
				fn( $shop ) => in_array( $shop->ID, $shop_ids, true ) && 'shop' === $shop->post_type && 'publish' === $shop->post_status
			)
		);
	}
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
function wp_get_object_terms( $shop_ids, $taxonomy, $args ) {
	$GLOBALS['escomi_global_area_query_count']++;
	if ( 'area' !== $taxonomy || 'all_with_object_id' !== ( $args['fields'] ?? '' ) ) {
		return new WP_Error( 'invalid_term_query', 'Invalid term query.' );
	}
	$terms = array();
	foreach ( $shop_ids as $shop_id ) {
		$terms = array_merge( $terms, $GLOBALS['escomi_public_shop_terms'][ (int) $shop_id ] ?? array() );
	}
	return $terms;
}

final class WP_Query {
	public array $posts;
	public int $found_posts;
	private array $args;

	public function __construct( array $args ) {
		$GLOBALS['escomi_global_review_query_count']++;
		$this->args = $args;
		$GLOBALS['escomi_global_query_args'] = $args;
		$clauses = array( 'join' => '', 'where' => '', 'groupby' => '' );
		if ( isset( $GLOBALS['escomi_filter_callbacks']['posts_clauses'] ) ) {
			$clauses = $GLOBALS['escomi_filter_callbacks']['posts_clauses']( $clauses, $this );
		}
		$GLOBALS['escomi_global_query_clauses'] = $clauses;
		$filters_approved = str_contains( $clauses['join'], 'escomi_review_approval' )
			&& str_contains( $clauses['join'], "'approval_status'" )
			&& str_contains( $clauses['join'], "'approved'" );
		$filters_public_shop = str_contains( $clauses['join'], 'escomi_review_shop_relation' )
			&& str_contains( $clauses['join'], 'escomi_review_shop.ID' )
			&& str_contains( $clauses['join'], "'shop'" )
			&& str_contains( $clauses['join'], "'publish'" );
		$rejects_duplicate_approval = str_contains( $clauses['join'], 'escomi_review_approval_duplicate' )
			&& str_contains( $clauses['where'], 'escomi_review_approval_duplicate.meta_id IS NULL' );
		$rejects_duplicate_relation = str_contains( $clauses['join'], 'escomi_review_shop_relation_duplicate' )
			&& str_contains( $clauses['where'], 'escomi_review_shop_relation_duplicate.meta_id IS NULL' );
		$items = array_values(
			array_filter(
				$GLOBALS['escomi_public_review_posts'],
				function ( $review ) use ( $args, $filters_approved, $filters_public_shop, $rejects_duplicate_approval, $rejects_duplicate_relation ) {
					$shop_id = (int) get_post_meta( $review->ID, 'review_shop_id', true );
					$shop    = $GLOBALS['escomi_public_shops'][ $shop_id ] ?? null;
					$approval_count = $GLOBALS['escomi_public_review_meta_counts'][ $review->ID ]['approval_status'] ?? 0;
					$relation_count = $GLOBALS['escomi_public_review_meta_counts'][ $review->ID ]['review_shop_id'] ?? 0;
					return $review->post_type === $args['post_type']
						&& $review->post_status === $args['post_status']
						&& ( ! $filters_approved || 'approved' === get_post_meta( $review->ID, 'approval_status', true ) )
						&& ( ! $filters_public_shop || ( $shop instanceof WP_Post && 'shop' === $shop->post_type && 'publish' === $shop->post_status ) )
						&& ( ! $rejects_duplicate_approval || 1 === $approval_count )
						&& ( ! $rejects_duplicate_relation || 1 === $relation_count );
				}
			)
		);
		if ( array( 'date' => 'DESC', 'ID' => 'DESC' ) === ( $args['orderby'] ?? null ) ) {
			usort( $items, fn( $left, $right ) => $right->post_date_gmt <=> $left->post_date_gmt ?: $right->ID <=> $left->ID );
		} else {
			usort( $items, fn( $left, $right ) => $left->ID <=> $right->ID );
		}
		$this->found_posts = count( $items );
		$offset            = ( (int) $args['paged'] - 1 ) * (int) $args['posts_per_page'];
		$this->posts       = array_slice( $items, $offset, (int) $args['posts_per_page'] );
	}

	public function get( string $key ) {
		return $this->args[ $key ] ?? null;
	}
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
	$GLOBALS['escomi_public_review_meta_counts'][ $id ] = array(
		'approval_status' => 1,
		'review_shop_id'  => 1,
	);
}

function escomi_public_review_test_duplicate_meta( int $id, string $key ): void {
	$GLOBALS['escomi_public_review_meta_counts'][ $id ][ $key ]++;
}

require_once dirname( __DIR__, 2 ) . '/reviews-public-rest.php';

escomi_public_review_test_expect(
	null === escomi_public_review_date( '2026-02-30 03:00:00' ),
	'Impossible calendar dates must not be normalized into public data.'
);

$shop_routes = array_values(
	array_filter(
		$GLOBALS['escomi_public_review_routes'],
		fn( $candidate ) => str_starts_with( $candidate['route'], '/shops/' )
	)
);
escomi_public_review_test_expect( 1 === count( $shop_routes ), 'Public shop review route was not registered.' );
$route = $shop_routes[0];
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
		array( 'page' => 0 ),
		array( 'page' => '1.5' ),
		array( 'per_page' => 0 ),
		array( 'per_page' => 21 ),
		array( 'page' => str_repeat( '9', 100 ) ),
		array( 'unknown' => 'value' ),
	) as $invalid_params
) {
	$response = $callback( new Eskomi_Public_Review_Test_Request( array( 'shop_id' => 42 ), $invalid_params ) );
	escomi_public_review_test_expect( $response instanceof WP_Error && 400 === $response->data['status'], 'Invalid or unknown parameter must be 400.' );
}

$response = $callback(
	new Eskomi_Public_Review_Test_Request(
		array( 'shop_id' => 42 ),
		array( 'page' => 2, 'per_page' => 2 )
	)
);
escomi_public_review_test_expect( $response instanceof WP_REST_Response, 'Valid request must return a REST response.' );
escomi_public_review_test_expect( 103 === $response->data['items'][0]['id'], 'Second page item is incorrect.' );

$path_override = $callback(
	new Eskomi_Public_Review_Test_Request(
		array( 'shop_id' => 42 ),
		array( 'shop_id' => 99 )
	)
);
escomi_public_review_test_expect(
	$path_override instanceof WP_Error && 400 === $path_override->data['status'],
	'Query shop_id must be rejected and must never override the path shop_id.'
);

escomi_public_review_test_record(
	107,
	43,
	'publish',
	'approved',
	'2026-07-22 03:00:00',
	array( 'rating_total' => 1 )
);
escomi_public_review_test_record(
	108,
	45,
	'publish',
	'approved',
	'2026-07-18 03:00:00',
	array( 'rating_total' => 5 )
);
escomi_public_review_test_record(
	109,
	42,
	'publish',
	'approved',
	'2026-07-18 03:00:00',
	array( 'rating_total' => 4 )
);
escomi_public_review_test_record(
	110,
	42,
	'publish',
	'approved',
	'2026-07-23 03:00:00',
	array( 'rating_total' => 5 )
);
escomi_public_review_test_duplicate_meta( 110, 'approval_status' );
escomi_public_review_test_record(
	111,
	42,
	'publish',
	'approved',
	'2026-07-24 03:00:00',
	array( 'rating_total' => 5 )
);
escomi_public_review_test_duplicate_meta( 111, 'review_shop_id' );

escomi_public_review_test_expect( 2 === count( $GLOBALS['escomi_public_review_routes'] ), 'Global public review route was not registered.' );
$global_routes = array_values(
	array_filter(
		$GLOBALS['escomi_public_review_routes'],
		fn( $candidate ) => '/reviews' === $candidate['route']
	)
);
escomi_public_review_test_expect( 1 === count( $global_routes ), 'Exactly one global review route must be registered.' );
$global_route = $global_routes[0];
escomi_public_review_test_expect( array( 'GET' ) === $global_route['args']['methods'], 'Global review REST must be GET-only.' );
escomi_public_review_test_expect( true === $global_route['args']['permission_callback'](), 'Global review REST must be public read-only.' );

$global_callback = $global_route['args']['callback'];
$global_response = $global_callback( new Eskomi_Public_Review_Test_Request( array(), array( 'page' => 1, 'per_page' => 2 ) ) );
escomi_public_review_test_expect( $global_response instanceof WP_REST_Response, 'Valid global request must return a REST response.' );
escomi_public_review_test_expect( 5 === $global_response->data['total'], 'Only approved reviews attached to public shops must be counted globally.' );
escomi_public_review_test_expect( 3 === $global_response->data['totalPages'], 'Global totalPages must use the bounded page size.' );
escomi_public_review_test_expect( array( 109, 108 ) === array_column( $global_response->data['items'], 'id' ), 'Global reviews must use date DESC and ID DESC stable order.' );
escomi_public_review_test_expect( 2 === $GLOBALS['escomi_global_query_args']['posts_per_page'], 'Global review query must use the requested bounded page size.' );
escomi_public_review_test_expect( 1 === $GLOBALS['escomi_global_query_args']['paged'], 'Global review query must use the requested page.' );
escomi_public_review_test_expect( array( 'date' => 'DESC', 'ID' => 'DESC' ) === $GLOBALS['escomi_global_query_args']['orderby'], 'Global query must apply stable date and ID order.' );
escomi_public_review_test_expect( str_contains( $GLOBALS['escomi_global_query_clauses']['join'], 'escomi_review_approval_duplicate' ), 'Duplicate approval meta must be excluded by the production query filter.' );
escomi_public_review_test_expect( str_contains( $GLOBALS['escomi_global_query_clauses']['join'], 'escomi_review_shop_relation_duplicate' ), 'Duplicate shop relation meta must be excluded by the production query filter.' );
escomi_public_review_test_expect( 42 === $global_response->data['items'][0]['shop']['id'], 'Global review must preserve the canonical shop ID.' );
escomi_public_review_test_expect( 'shop-forty-two' === $global_response->data['items'][0]['shop']['slug'], 'Global review must expose the canonical shop slug.' );
escomi_public_review_test_expect( '公開店舗42' === $global_response->data['items'][0]['shop']['name'], 'Global review must expose the public shop name.' );
escomi_public_review_test_expect(
	array( 'osaka', 'umeda' ) === array_column( $global_response->data['items'][0]['areas'], 'slug' ),
	'All canonical area relations must be returned without inventing a primary area.'
);
escomi_public_review_test_expect( 1 === $GLOBALS['escomi_global_review_query_count'], 'Global feed must use one bounded review query.' );
escomi_public_review_test_expect( 1 === $GLOBALS['escomi_global_shop_query_count'], 'Page shops must be resolved in one bulk query.' );
escomi_public_review_test_expect( 1 === $GLOBALS['escomi_global_area_query_count'], 'Page areas must be resolved in one bulk query.' );
$global_serialized = json_encode( $global_response->data, JSON_UNESCAPED_UNICODE );
foreach ( array( 'private@example.test', '192.0.2.1', '非公開氏名', '管理用メモ', 'approval_status', 'review_shop_id', '非公開店舗' ) as $private_value ) {
	escomi_public_review_test_expect( ! str_contains( $global_serialized, $private_value ), 'Private global review data leaked: ' . $private_value );
}
foreach ( array( array( 'per_page' => 21 ), array( 'page' => 0 ), array( 'page' => 1001 ), array( 'shop' => 42 ) ) as $invalid_params ) {
	$response = $global_callback( new Eskomi_Public_Review_Test_Request( array(), $invalid_params ) );
	escomi_public_review_test_expect( $response instanceof WP_Error && 400 === $response->data['status'], 'Invalid global pagination or filter must be rejected.' );
}
$GLOBALS['wpdb']->last_error = 'fixture database failure';
$failed_query_response = $global_callback( new Eskomi_Public_Review_Test_Request( array() ) );
escomi_public_review_test_expect(
	$failed_query_response instanceof WP_Error && 503 === $failed_query_response->data['status'],
	'WordPress query failure must fail closed instead of becoming an available empty feed.'
);
$GLOBALS['wpdb']->last_error = '';

fwrite( STDOUT, "Public approved review PHP fixture: PASS\n" );
