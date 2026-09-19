<?php
/** Narrow read-only projection; ACF definitions remain managed in the WP database. */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Preserve the observed decimal-string storage contract; suppress malformed legacy values. */
function escomi_public_shop_price_90( $value ) {
    if ( ! is_string( $value ) && ! is_int( $value ) ) { return null; }
    $value = (string) $value;
    return preg_match( '/^[1-9][0-9]{0,6}$/D', $value ) ? $value : null;
}

function escomi_public_shop_booking_url( $value ) {
    if ( ! is_string( $value ) || strlen( $value ) > 2048 || preg_match( '/[\x00-\x20\x7f]/', $value ) ) { return null; }
    $parts = parse_url( $value );
    if ( ! is_array( $parts ) || ! isset( $parts['scheme'], $parts['host'] ) ||
        ! in_array( strtolower( $parts['scheme'] ), array( 'http', 'https' ), true ) ||
        isset( $parts['user'] ) || isset( $parts['pass'] ) ||
        false === filter_var( $value, FILTER_VALIDATE_URL ) ) { return null; }
    return $value;
}

/** Same response hook as shop-public-meta.php; never expose the entire private price group. */
function escomi_prepare_shop_price_booking_public( $response, $post ) {
    if ( ! $response instanceof WP_REST_Response || ! $post instanceof WP_Post ) { return $response; }
    $data = $response->get_data();
    $acf = isset( $data['acf'] ) && is_array( $data['acf'] ) ? $data['acf'] : array();
    $acf['price_90'] = escomi_public_shop_price_90( get_post_meta( $post->ID, 'price_90', true ) );
    $acf['shop_booking_url'] = escomi_public_shop_booking_url( get_post_meta( $post->ID, 'shop_booking_url', true ) );
    $data['acf'] = $acf;
    $response->set_data( $data );
    return $response;
}
add_filter( 'rest_prepare_shop', 'escomi_prepare_shop_price_booking_public', 20, 2 );

/** Extend ACF's registered schema after its request-specific registration (priority 10).
 * Keep its getter/updater and every existing property; never register another writer.
 */
function escomi_shop_price_booking_rest_schema( $response, $handler, $request ) {
    global $wp_rest_additional_fields;
    if ( ! preg_match( '~^/wp/v2/shop(?:/[0-9]+)?/?$~D', $request->get_route() ) ||
        ! isset( $wp_rest_additional_fields['shop']['acf']['schema'] ) ) { return $response; }
    $registration = $wp_rest_additional_fields['shop']['acf'];
    foreach ( array( 'price_90' => '90分料金（円）', 'shop_booking_url' => 'Web予約URL' ) as $field => $description ) {
        $registration['schema']['properties'][ $field ] = array(
            'description' => $description,
            'type' => array( 'string', 'null' ),
            'readonly' => true,
            'context' => array( 'view', 'embed', 'edit' ),
        );
    }
    register_rest_field( 'shop', 'acf', $registration );
    return $response;
}
add_filter( 'rest_pre_dispatch', 'escomi_shop_price_booking_rest_schema', 20, 3 );

/** Native ACF REST updates must not bypass the reviewed dedicated writer contract.
 * Admin GUI field edits are unaffected; only these two HTTP API fields are reserved.
 */
function escomi_shop_price_booking_native_write_guard( $response, $handler, $request ) {
    if ( ! preg_match( '~^/wp/v2/shop(?:/[0-9]+)?/?$~D', $request->get_route() ) ||
        ! in_array( $request->get_method(), array( 'POST', 'PUT', 'PATCH' ), true ) ) { return $response; }
    $acf = $request->get_param( 'acf' );
    if ( ! is_array( $acf ) ) { return $response; }
    $reserved = array( 'price_90', 'shop_booking_url', 'field_696fcb4e89be6', 'field_escomi_shop_booking_url_v1' );
    $key_map = isset( $acf['_acf_field_key_map'] ) && is_array( $acf['_acf_field_key_map'] ) ? $acf['_acf_field_key_map'] : array();
    foreach ( $acf as $key => $value ) {
        // ACF supports both field keys and a caller-provided name-to-key mapping.
        $mapped = isset( $key_map[ $key ] ) ? $key_map[ $key ] : $key;
        if ( in_array( $key, $reserved, true ) || in_array( $mapped, $reserved, true ) ) {
            return new WP_Error( 'dedicated_official_facts_writer_required', 'Use the dedicated official facts writer for this field.', array( 'status' => 403 ) );
        }
    }
    return $response;
}
add_filter( 'rest_pre_dispatch', 'escomi_shop_price_booking_native_write_guard', 30, 3 );
