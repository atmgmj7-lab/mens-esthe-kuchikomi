<?php
/**
 * Public, field-level shop verification metadata.
 *
 * Values are supplied by an authorized management workflow. This file never
 * infers provenance or ranking snapshots from the current public shop values.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

function escomi_shop_public_meta_date( $value ) {
    $value = is_string( $value ) ? trim( $value ) : '';
    if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $value, $matches ) ) {
        return '';
    }
    return checkdate( (int) $matches[2], (int) $matches[3], (int) $matches[1] ) ? $value : '';
}

function escomi_shop_public_meta_url( $value ) {
    $url = esc_url_raw( is_string( $value ) ? trim( $value ) : '', array( 'http', 'https' ) );
    return $url && wp_http_validate_url( $url ) ? $url : '';
}

function escomi_sanitize_shop_public_value_digest( $value ) {
    $value = is_string( $value ) ? strtolower( trim( $value ) ) : '';
    return preg_match( '/^[a-f0-9]{64}$/', $value ) ? $value : '';
}

function escomi_sanitize_shop_fact_provenance( $items ) {
    $items = is_array( $items ) ? $items : array();
    $allowed_fields = array( 'price', 'hours', 'access', 'booking', 'official', 'image' );
    $allowed_sources = array( 'official-site', 'shop-provided', 'admin-verified' );
    $allowed_statuses = array( 'reviewed', 'pending', 'rejected' );
    $latest = array();

    foreach ( $items as $item ) {
        if ( ! is_array( $item ) ) {
            continue;
        }
        $field = isset( $item['field'] ) ? sanitize_key( $item['field'] ) : '';
        $source_url = escomi_shop_public_meta_url( $item['sourceUrl'] ?? '' );
        $source_type = isset( $item['sourceType'] ) ? sanitize_key( $item['sourceType'] ) : '';
        $observed_at = escomi_shop_public_meta_date( $item['observedAt'] ?? '' );
        $reviewed_at = escomi_shop_public_meta_date( $item['reviewedAt'] ?? '' );
        $review_status = isset( $item['reviewStatus'] ) ? sanitize_key( $item['reviewStatus'] ) : '';
        $published_value = escomi_sanitize_shop_public_value_digest( $item['publishedValueHash'] ?? '' );

        if (
            ! in_array( $field, $allowed_fields, true ) ||
            ! $source_url ||
            ! in_array( $source_type, $allowed_sources, true ) ||
            ! $observed_at ||
            ! $reviewed_at ||
            ! in_array( $review_status, $allowed_statuses, true ) ||
            ! $published_value
        ) {
            continue;
        }

        $record = array(
            'field'              => $field,
            'sourceUrl'          => $source_url,
            'sourceType'         => $source_type,
            'observedAt'         => $observed_at,
            'reviewedAt'         => $reviewed_at,
            'reviewStatus'       => $review_status,
            'publishedValueHash' => $published_value,
        );
        if ( ! isset( $latest[ $field ] ) || strcmp( $reviewed_at, $latest[ $field ]['reviewedAt'] ) > 0 ) {
            $latest[ $field ] = $record;
        }
    }

    return array_values( $latest );
}

function escomi_sanitize_shop_area_ranking_snapshot( $items ) {
    $items = is_array( $items ) ? $items : array();
    $normalized = array();
    foreach ( $items as $item ) {
        if ( ! is_array( $item ) ) {
            continue;
        }
        $area_slug = isset( $item['areaSlug'] ) ? sanitize_title( $item['areaSlug'] ) : '';
        $rank = filter_var( $item['rank'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
        $total = filter_var( $item['totalEligibleShops'] ?? null, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
        $basis = isset( $item['basis'] ) ? sanitize_text_field( $item['basis'] ) : '';
        $observed_at = escomi_shop_public_meta_date( $item['observedAt'] ?? '' );
        $is_pr = $item['isPr'] ?? null;
        if ( ! $area_slug || false === $rank || false === $total || $rank > $total || ! $basis || ! $observed_at || ! is_bool( $is_pr ) ) {
            continue;
        }
        $normalized[] = array(
            'areaSlug'          => $area_slug,
            'rank'              => $rank,
            'totalEligibleShops'=> $total,
            'basis'             => $basis,
            'observedAt'        => $observed_at,
            'isPr'              => $is_pr,
        );
    }
    usort( $normalized, function ( $first, $second ) {
        return strcmp( $second['observedAt'], $first['observedAt'] );
    } );
    return $normalized;
}

function escomi_shop_public_meta_auth( $allowed, $meta_key, $post_id ) {
    unset( $allowed, $meta_key );
    return current_user_can( 'edit_post', (int) $post_id ) && current_user_can( 'manage_shop_public_meta' );
}

/** Normalize a single explicit area term ID without inferring from other fields. */
function escomi_sanitize_shop_primary_area_term_id( $value ) {
    if ( ! is_int( $value ) && ! ( is_string( $value ) && preg_match( '/^[1-9]\d*$/', $value ) ) ) {
        return 0;
    }
    $term_id = filter_var( $value, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
    return false === $term_id ? 0 : (int) $term_id;
}

/** Return the explicit primary area only when it belongs to the shop's area relations. */
function escomi_validate_shop_primary_area_term_id( $shop_id, $value ) {
    $shop_id = filter_var( $shop_id, FILTER_VALIDATE_INT, array( 'options' => array( 'min_range' => 1 ) ) );
    $term_id = escomi_sanitize_shop_primary_area_term_id( $value );
    if ( false === $shop_id || ! $term_id ) {
        return 0;
    }

    $term = get_term( $term_id, 'area' );
    if ( ! $term || is_wp_error( $term ) || ! isset( $term->taxonomy ) || 'area' !== $term->taxonomy ) {
        return 0;
    }

    $relations = get_the_terms( (int) $shop_id, 'area' );
    if ( ! is_array( $relations ) || is_wp_error( $relations ) ) {
        return 0;
    }

    foreach ( $relations as $relation ) {
        if (
            isset( $relation->term_id, $relation->taxonomy )
            && 'area' === $relation->taxonomy
            && $term_id === (int) $relation->term_id
        ) {
            return $term_id;
        }
    }
    return 0;
}

function escomi_register_shop_public_meta() {
    $common = array(
        'single'        => true,
        'type'          => 'array',
        'default'       => array(),
        'auth_callback' => 'escomi_shop_public_meta_auth',
    );
    register_post_meta( 'shop', 'shop_fact_provenance', array_merge( $common, array(
        'sanitize_callback' => 'escomi_sanitize_shop_fact_provenance',
        'show_in_rest'      => array(
            'schema' => array(
                'type'  => 'array',
                'items' => array( 'type' => 'object' ),
            ),
        ),
    ) ) );
    register_post_meta( 'shop', 'shop_area_ranking_snapshot', array_merge( $common, array(
        'sanitize_callback' => 'escomi_sanitize_shop_area_ranking_snapshot',
        'show_in_rest'      => array(
            'schema' => array(
                'type'  => 'array',
                'items' => array( 'type' => 'object' ),
            ),
        ),
    ) ) );
    register_post_meta( 'shop', 'shop_primary_area_term_id', array(
        'single'            => true,
        'type'              => 'integer',
        'default'           => 0,
        'sanitize_callback' => 'escomi_sanitize_shop_primary_area_term_id',
        'auth_callback'     => 'escomi_shop_public_meta_auth',
        'show_in_rest'      => false,
    ) );
}
add_action( 'init', 'escomi_register_shop_public_meta' );

/** Keep the existing ShopView ACF envelope while exposing only sanitized read values. */
function escomi_prepare_shop_public_meta( $response, $post ) {
    if ( ! $response instanceof WP_REST_Response || ! $post instanceof WP_Post ) {
        return $response;
    }
    $data = $response->get_data();
    $acf = isset( $data['acf'] ) && is_array( $data['acf'] ) ? $data['acf'] : array();
    $acf['shop_fact_provenance'] = escomi_sanitize_shop_fact_provenance(
        get_post_meta( $post->ID, 'shop_fact_provenance', true )
    );
    $acf['shop_area_ranking_snapshot'] = escomi_sanitize_shop_area_ranking_snapshot(
        get_post_meta( $post->ID, 'shop_area_ranking_snapshot', true )
    );
    $primary_area_term_id = escomi_validate_shop_primary_area_term_id(
        $post->ID,
        get_post_meta( $post->ID, 'shop_primary_area_term_id', true )
    );
    $acf['shop_primary_area_term_id'] = $primary_area_term_id ?: null;
    $data['acf'] = $acf;
    $response->set_data( $data );
    return $response;
}
add_filter( 'rest_prepare_shop', 'escomi_prepare_shop_public_meta', 10, 2 );
