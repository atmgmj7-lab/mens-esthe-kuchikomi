<?php
/**
 * Public, read-only access to approved reviews for a published shop.
 *
 * WordPress remains the public source of truth. This endpoint intentionally
 * exposes only review copy, submission time, and validated rating values.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'escomi_public_review_rating' ) ) {
	function escomi_public_review_rating( $value ) {
		if ( is_int( $value ) ) {
			$rating = $value;
		} elseif ( is_string( $value ) && preg_match( '/^[1-5]$/', $value ) ) {
			$rating = (int) $value;
		} else {
			return null;
		}

		return $rating >= 1 && $rating <= 5 ? $rating : null;
	}
}

if ( ! function_exists( 'escomi_public_review_date' ) ) {
	function escomi_public_review_date( $value ) {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return null;
		}

		$value = trim( $value );
		$date  = null;
		foreach ( array( '!Y-m-d\TH:i:sP', '!Y-m-d H:i:s' ) as $format ) {
			$candidate = DateTimeImmutable::createFromFormat( $format, $value, new DateTimeZone( 'UTC' ) );
			$errors    = DateTimeImmutable::getLastErrors();
			if ( false !== $candidate && ( false === $errors || ( 0 === $errors['warning_count'] && 0 === $errors['error_count'] ) ) ) {
				$date = $candidate;
				break;
			}
		}

		if ( ! ( $date instanceof DateTimeImmutable ) ) {
			return null;
		}

		return $date->setTimezone( new DateTimeZone( 'UTC' ) )->format( DATE_ATOM );
	}
}

if ( ! function_exists( 'escomi_public_review_item' ) ) {
	function escomi_public_review_item( $review ) {
		$body = wp_check_invalid_utf8( wp_strip_all_tags( (string) $review->post_content, true ) );

		return array(
			'id'                => (int) $review->ID,
			'body'              => trim( $body ),
			'submittedAt'       => escomi_public_review_date( get_post_time( DATE_ATOM, true, $review ) ),
			'ratingTotal'       => escomi_public_review_rating( get_post_meta( $review->ID, 'rating_total', true ) ),
			'ratingPrice'       => escomi_public_review_rating( get_post_meta( $review->ID, 'rating_price', true ) ),
			'ratingService'     => escomi_public_review_rating( get_post_meta( $review->ID, 'rating_service', true ) ),
			'ratingCleanliness' => escomi_public_review_rating( get_post_meta( $review->ID, 'rating_cleanliness', true ) ),
		);
	}
}

if ( ! function_exists( 'escomi_public_review_metric' ) ) {
	function escomi_public_review_metric( $items, $rating_key ) {
		$ratings = array();
		foreach ( $items as $item ) {
			if ( isset( $item[ $rating_key ] ) && is_int( $item[ $rating_key ] ) ) {
				$ratings[] = $item[ $rating_key ];
			}
		}

		$count = count( $ratings );
		return array(
			'average'       => $count > 0 ? round( array_sum( $ratings ) / $count, 1 ) : null,
			'responseCount' => $count,
		);
	}
}

if ( ! function_exists( 'escomi_public_review_date_range' ) ) {
	function escomi_public_review_date_range( $items ) {
		$dates = array_values(
			array_filter(
				array_column( $items, 'submittedAt' ),
				function ( $value ) {
					return is_string( $value ) && '' !== $value;
				}
			)
		);

		if ( empty( $dates ) ) {
			return null;
		}

		sort( $dates, SORT_STRING );
		return array(
			'oldestSubmittedAt' => $dates[0],
			'latestSubmittedAt' => $dates[ count( $dates ) - 1 ],
		);
	}
}

if ( ! function_exists( 'escomi_public_reviews_query_args' ) ) {
	function escomi_public_reviews_query_args( $shop_id ) {
		return array(
			'post_type'              => 'reviews',
			'post_status'            => 'publish',
			'posts_per_page'         => -1,
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'no_found_rows'          => true,
			'update_post_meta_cache' => true,
			'update_post_term_cache' => false,
			'meta_query'             => array(
				'relation' => 'AND',
				array(
					'key'     => 'approval_status',
					'value'   => 'approved',
					'compare' => '=',
				),
				array(
					'key'     => 'review_shop_id',
					'value'   => (int) $shop_id,
					'compare' => '=',
					'type'    => 'NUMERIC',
				),
			),
		);
	}
}

if ( ! function_exists( 'escomi_public_reviews_query_page' ) ) {
	function escomi_public_reviews_query_page( $shop_id, $page, $per_page ) {
		$reviews = get_posts( escomi_public_reviews_query_args( $shop_id ) );
		$items   = array_map( 'escomi_public_review_item', $reviews );
		$total   = count( $items );

		return array(
			'items'      => array_values( array_slice( $items, ( $page - 1 ) * $per_page, $per_page ) ),
			'total'      => $total,
			'totalPages' => $total > 0 ? (int) ceil( $total / $per_page ) : 0,
			'page'       => $page,
			'metrics'    => array(
				'total'       => escomi_public_review_metric( $items, 'ratingTotal' ),
				'price'       => escomi_public_review_metric( $items, 'ratingPrice' ),
				'service'     => escomi_public_review_metric( $items, 'ratingService' ),
				'cleanliness' => escomi_public_review_metric( $items, 'ratingCleanliness' ),
			),
			'dateRange'  => escomi_public_review_date_range( $items ),
		);
	}
}

if ( ! function_exists( 'escomi_public_review_positive_integer' ) ) {
	function escomi_public_review_positive_integer( $value, $default, $maximum = null ) {
		if ( null === $value || '' === $value ) {
			$value = $default;
		}

		if ( is_int( $value ) ) {
			$number = $value;
		} elseif ( is_string( $value ) && preg_match( '/^[1-9][0-9]*$/', $value ) ) {
			$maximum_integer = (string) PHP_INT_MAX;
			if ( strlen( $value ) > strlen( $maximum_integer )
				|| ( strlen( $value ) === strlen( $maximum_integer ) && strcmp( $value, $maximum_integer ) > 0 )
			) {
				return null;
			}
			$number = (int) $value;
		} else {
			return null;
		}

		if ( $number < 1 || ( null !== $maximum && $number > $maximum ) ) {
			return null;
		}

		return $number;
	}
}

if ( ! function_exists( 'escomi_public_review_request_error' ) ) {
	function escomi_public_review_request_error( $message ) {
		return new WP_Error( 'invalid_review_request', $message, array( 'status' => 400 ) );
	}
}

if ( ! function_exists( 'escomi_get_public_shop_reviews' ) ) {
	function escomi_get_public_shop_reviews( $request ) {
		$url_params     = $request->get_url_params();
		$query_params   = $request->get_query_params();
		$allowed_params = array( 'page', 'per_page' );
		foreach ( array_keys( $query_params ) as $param ) {
			if ( ! in_array( $param, $allowed_params, true ) ) {
				return escomi_public_review_request_error( '未対応のパラメーターです。' );
			}
		}

		$shop_id  = escomi_public_review_positive_integer( $url_params['shop_id'] ?? null, null );
		$page     = escomi_public_review_positive_integer( $query_params['page'] ?? null, 1 );
		$per_page = escomi_public_review_positive_integer( $query_params['per_page'] ?? null, 20, 20 );

		if ( null === $shop_id || null === $page || null === $per_page ) {
			return escomi_public_review_request_error( 'pageとper_pageには有効な整数を指定してください。' );
		}
		if ( $page - 1 > intdiv( PHP_INT_MAX, $per_page ) ) {
			return escomi_public_review_request_error( 'pageが有効範囲を超えています。' );
		}

		$shop = get_post( $shop_id );
		if ( ! ( $shop instanceof WP_Post ) || 'shop' !== $shop->post_type || 'publish' !== $shop->post_status ) {
			return new WP_Error( 'shop_not_found', '店舗が見つかりません。', array( 'status' => 404 ) );
		}

		return rest_ensure_response( escomi_public_reviews_query_page( $shop_id, $page, $per_page ) );
	}
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'escomi/v1',
			'/shops/(?P<shop_id>[1-9][0-9]*)/reviews',
			array(
				'methods'             => array( 'GET' ),
				'callback'            => 'escomi_get_public_shop_reviews',
				'permission_callback' => function () {
					return true;
				},
			)
		);
	}
);
