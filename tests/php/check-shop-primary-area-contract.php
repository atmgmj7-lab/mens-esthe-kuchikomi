<?php
declare(strict_types=1);

define( 'ABSPATH', __DIR__ );

final class WP_Post {
	public int $ID;

	public function __construct( int $id ) {
		$this->ID = $id;
	}
}

final class WP_Term {
	public int $term_id;
	public string $taxonomy;
	public string $slug;
	public string $name;
	public int $parent;

	public function __construct( int $id, string $taxonomy, string $slug, string $name, int $parent = 0 ) {
		$this->term_id = $id;
		$this->taxonomy = $taxonomy;
		$this->slug = $slug;
		$this->name = $name;
		$this->parent = $parent;
	}
}

final class WP_Error {}

final class WP_REST_Response {
	private array $data;

	public function __construct( array $data ) {
		$this->data = $data;
	}

	public function get_data(): array {
		return $this->data;
	}

	public function set_data( array $data ): void {
		$this->data = $data;
	}
}

$GLOBALS['escomi_primary_registered_meta'] = array();
$GLOBALS['escomi_primary_filters'] = array();
$GLOBALS['escomi_primary_meta'] = array();
$GLOBALS['escomi_primary_terms'] = array(
	1 => new WP_Term( 1, 'area', 'osaka', '大阪' ),
	2 => new WP_Term( 2, 'area', 'umeda', '梅田', 1 ),
	3 => new WP_Term( 3, 'area', 'nihonbashi', '大阪日本橋', 1 ),
	8 => new WP_Term( 8, 'shop_category', 'relaxation', 'リラクゼーション' ),
	9 => new WP_Term( 9, 'area', 'sakai', '堺東' ),
);
$GLOBALS['escomi_primary_relations'] = array(
	101 => array( 1, 2 ),
	102 => array( 3 ),
);

function escomi_primary_expect( bool $condition, string $message ): void {
	if ( ! $condition ) {
		fwrite( STDERR, "Shop primary area contract failed: {$message}\n" );
		exit( 1 );
	}
}

function add_action( $hook, $callback ) {
	if ( 'init' === $hook ) {
		$callback();
	}
}
function add_filter( $hook, $callback ) {
	$GLOBALS['escomi_primary_filters'][ $hook ] = $callback;
}
function register_post_meta( $post_type, $key, $args ) {
	$GLOBALS['escomi_primary_registered_meta'][ $post_type ][ $key ] = $args;
}
function current_user_can() {
	return true;
}
function sanitize_key( $value ) {
	return strtolower( preg_replace( '/[^a-z0-9_\-]/', '', (string) $value ) );
}
function sanitize_title( $value ) {
	return sanitize_key( $value );
}
function sanitize_text_field( $value ) {
	return trim( (string) $value );
}
function esc_url_raw( $value ) {
	return (string) $value;
}
function wp_http_validate_url( $value ) {
	return filter_var( $value, FILTER_VALIDATE_URL ) ? $value : false;
}
function is_wp_error( $value ) {
	return $value instanceof WP_Error;
}
function get_post_meta( $post_id, $key, $single = false ) {
	unset( $single );
	return $GLOBALS['escomi_primary_meta'][ (int) $post_id ][ $key ] ?? '';
}
function get_term( $term_id, $taxonomy = '' ) {
	$term = $GLOBALS['escomi_primary_terms'][ (int) $term_id ] ?? null;
	if ( ! $term || ( $taxonomy && $term->taxonomy !== $taxonomy ) ) {
		return null;
	}
	return $term;
}
function get_the_terms( $post_id, $taxonomy ) {
	$ids = $GLOBALS['escomi_primary_relations'][ (int) $post_id ] ?? array();
	return array_values( array_filter( array_map(
		fn( $id ) => get_term( $id ),
		$ids
	), fn( $term ) => $term && $term->taxonomy === $taxonomy ) );
}

require_once dirname( __DIR__, 2 ) . '/shop-public-meta.php';

escomi_primary_expect(
	function_exists( 'escomi_validate_shop_primary_area_term_id' ),
	'validator must exist'
);
escomi_primary_expect(
	function_exists( 'escomi_sanitize_shop_primary_area_term_id' ),
	'sanitizer must exist'
);

$registered = $GLOBALS['escomi_primary_registered_meta']['shop']['shop_primary_area_term_id'] ?? null;
escomi_primary_expect( is_array( $registered ), 'single shop meta must be registered' );
escomi_primary_expect( true === ( $registered['single'] ?? false ), 'meta must be single-value' );
escomi_primary_expect( 'integer' === ( $registered['type'] ?? null ), 'meta must use integer type' );
escomi_primary_expect( empty( $registered['show_in_rest'] ), 'meta must not add an anonymous REST writer' );

escomi_primary_expect( 2 === escomi_sanitize_shop_primary_area_term_id( '2' ), 'canonical digit string must normalize to integer' );
foreach ( array( '', 0, -2, '2.0', '+2', array( 2 ) ) as $invalid ) {
	escomi_primary_expect( 0 === escomi_sanitize_shop_primary_area_term_id( $invalid ), 'invalid storage value must normalize to 0' );
}

escomi_primary_expect( 2 === escomi_validate_shop_primary_area_term_id( 101, '2' ), 'explicit related area must be valid' );
escomi_primary_expect( 0 === escomi_validate_shop_primary_area_term_id( 101, 3 ), 'related area from another shop must be invalid' );
escomi_primary_expect( 0 === escomi_validate_shop_primary_area_term_id( 101, 8 ), 'non-area taxonomy must be invalid' );
escomi_primary_expect( 0 === escomi_validate_shop_primary_area_term_id( 101, 9 ), 'unrelated area must be invalid' );
escomi_primary_expect( 0 === escomi_validate_shop_primary_area_term_id( 0, 2 ), 'invalid shop ID must fail closed' );

$GLOBALS['escomi_primary_relations'][101] = array( 2, 1 );
escomi_primary_expect( 2 === escomi_validate_shop_primary_area_term_id( 101, 2 ), 'relation order must not affect explicit primary' );

$GLOBALS['escomi_primary_meta'][101]['shop_primary_area_term_id'] = '2';
$prepared = escomi_prepare_shop_public_meta( new WP_REST_Response( array( 'acf' => array() ) ), new WP_Post( 101 ) );
escomi_primary_expect( 2 === $prepared->get_data()['acf']['shop_primary_area_term_id'], 'validated explicit primary must be public' );

$GLOBALS['escomi_primary_meta'][101]['shop_primary_area_term_id'] = '9';
$invalid_prepared = escomi_prepare_shop_public_meta( new WP_REST_Response( array( 'acf' => array() ) ), new WP_Post( 101 ) );
escomi_primary_expect( null === $invalid_prepared->get_data()['acf']['shop_primary_area_term_id'], 'invalid stored primary must be public as null' );

$GLOBALS['escomi_primary_meta'][101]['shop_primary_area_term_id'] = '';
$empty_prepared = escomi_prepare_shop_public_meta( new WP_REST_Response( array( 'acf' => array() ) ), new WP_Post( 101 ) );
escomi_primary_expect( null === $empty_prepared->get_data()['acf']['shop_primary_area_term_id'], 'missing primary must be public as null' );

echo "Shop primary area PHP contract: PASS\n";
