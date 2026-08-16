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

if ( ! function_exists( 'escomi_public_review_area_slug' ) ) {
	function escomi_public_review_area_slug( $value ) {
		if ( ! is_string( $value ) || '' === $value || strlen( $value ) > 200 ) {
			return null;
		}
		return preg_match( '/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $value ) ? $value : null;
	}
}

if ( ! function_exists( 'escomi_public_review_primary_area' ) ) {
	function escomi_public_review_primary_area( $shop_id, $areas ) {
		$stored_values = get_post_meta( (int) $shop_id, 'shop_primary_area_term_id', false );
		if ( ! is_array( $stored_values ) || 1 !== count( $stored_values ) ) {
			return null;
		}

		$primary_area_id = escomi_public_review_positive_integer( $stored_values[0], null );
		if ( null === $primary_area_id ) {
			return null;
		}

		foreach ( $areas as $area ) {
			if ( isset( $area['id'] ) && $primary_area_id === (int) $area['id'] ) {
				return $area;
			}
		}
		return null;
	}
}

if ( ! function_exists( 'escomi_global_public_reviews_posts_clauses' ) ) {
	function escomi_global_public_reviews_posts_clauses( $clauses, $query ) {
		if ( ! $query->get( 'escomi_global_public_reviews' ) ) {
			return $clauses;
		}

		global $wpdb;
		$clauses['join'] .= $wpdb->prepare(
			" INNER JOIN {$wpdb->postmeta} AS escomi_review_approval
				ON escomi_review_approval.post_id = {$wpdb->posts}.ID
				AND escomi_review_approval.meta_key = %s
				AND escomi_review_approval.meta_value = %s
			INNER JOIN {$wpdb->postmeta} AS escomi_review_shop_relation
				ON escomi_review_shop_relation.post_id = {$wpdb->posts}.ID
				AND escomi_review_shop_relation.meta_key = %s
			LEFT JOIN {$wpdb->postmeta} AS escomi_review_approval_duplicate
				ON escomi_review_approval_duplicate.post_id = escomi_review_approval.post_id
				AND escomi_review_approval_duplicate.meta_key = %s
				AND escomi_review_approval_duplicate.meta_id <> escomi_review_approval.meta_id
			LEFT JOIN {$wpdb->postmeta} AS escomi_review_shop_relation_duplicate
				ON escomi_review_shop_relation_duplicate.post_id = escomi_review_shop_relation.post_id
				AND escomi_review_shop_relation_duplicate.meta_key = %s
				AND escomi_review_shop_relation_duplicate.meta_id <> escomi_review_shop_relation.meta_id
			INNER JOIN {$wpdb->posts} AS escomi_review_shop
				ON escomi_review_shop.ID = CAST(escomi_review_shop_relation.meta_value AS UNSIGNED)
				AND escomi_review_shop.post_type = %s
				AND escomi_review_shop.post_status = %s",
			'approval_status',
			'approved',
			'review_shop_id',
			'approval_status',
			'review_shop_id',
			'shop',
			'publish'
		);
		$clauses['where'] .= " AND escomi_review_shop_relation.meta_value REGEXP '^[1-9][0-9]*$'
			AND escomi_review_approval_duplicate.meta_id IS NULL
			AND escomi_review_shop_relation_duplicate.meta_id IS NULL";

		$primary_area_term_id = (int) $query->get( 'escomi_primary_area_term_id' );
		if ( $primary_area_term_id > 0 ) {
			$clauses['join'] .= $wpdb->prepare(
				" INNER JOIN {$wpdb->postmeta} AS escomi_review_shop_primary_area
					ON escomi_review_shop_primary_area.post_id = escomi_review_shop.ID
					AND escomi_review_shop_primary_area.meta_key = %s
					AND BINARY escomi_review_shop_primary_area.meta_value = BINARY %s
				LEFT JOIN {$wpdb->postmeta} AS escomi_review_shop_primary_duplicate
					ON escomi_review_shop_primary_duplicate.post_id = escomi_review_shop_primary_area.post_id
					AND escomi_review_shop_primary_duplicate.meta_key = %s
					AND escomi_review_shop_primary_duplicate.meta_id <> escomi_review_shop_primary_area.meta_id
				INNER JOIN {$wpdb->term_relationships} AS escomi_review_shop_primary_relation
					ON escomi_review_shop_primary_relation.object_id = escomi_review_shop.ID
				INNER JOIN {$wpdb->term_taxonomy} AS escomi_review_shop_primary_taxonomy
					ON escomi_review_shop_primary_taxonomy.term_taxonomy_id = escomi_review_shop_primary_relation.term_taxonomy_id
					AND escomi_review_shop_primary_taxonomy.taxonomy = %s
					AND escomi_review_shop_primary_taxonomy.term_id = %d",
				'shop_primary_area_term_id',
				(string) $primary_area_term_id,
				'shop_primary_area_term_id',
				'area',
				$primary_area_term_id
			);
			$clauses['where'] .= " AND escomi_review_shop_primary_area.meta_value REGEXP '^[1-9][0-9]*$'
				AND escomi_review_shop_primary_duplicate.meta_id IS NULL";
		}
		$clauses['groupby'] = "{$wpdb->posts}.ID";
		return $clauses;
	}
}

if ( ! function_exists( 'escomi_global_public_reviews_query' ) ) {
	function escomi_global_public_reviews_query( $page, $per_page, $primary_area_term_id = null ) {
		add_filter( 'posts_clauses', 'escomi_global_public_reviews_posts_clauses', 10, 2 );
		try {
			$query = new WP_Query(
				array(
					'post_type'                       => 'reviews',
					'post_status'                     => 'publish',
					'posts_per_page'                  => $per_page,
					'paged'                           => $page,
					'orderby'                         => array(
						'date' => 'DESC',
						'ID'   => 'DESC',
					),
					'ignore_sticky_posts'             => true,
					'update_post_meta_cache'          => true,
					'update_post_term_cache'          => false,
					'escomi_global_public_reviews'    => true,
					'escomi_primary_area_term_id'     => null === $primary_area_term_id ? 0 : (int) $primary_area_term_id,
				)
			);
			global $wpdb;
			if ( ! empty( $wpdb->last_error ) ) {
				return new WP_Error( 'review_query_failed', '口コミ情報を取得できません。', array( 'status' => 503 ) );
			}
			return $query;
		} finally {
			remove_filter( 'posts_clauses', 'escomi_global_public_reviews_posts_clauses', 10 );
		}
	}
}

if ( ! function_exists( 'escomi_global_public_review_area_item' ) ) {
	function escomi_global_public_review_area_item( $term ) {
		return array(
			'id'   => (int) $term->term_id,
			'slug' => (string) $term->slug,
			'name' => trim( wp_strip_all_tags( (string) $term->name, true ) ),
		);
	}
}

if ( ! function_exists( 'escomi_global_public_reviews_query_page' ) ) {
	function escomi_global_public_reviews_query_page( $page, $per_page, $primary_area_term_id = null ) {
		$query = escomi_global_public_reviews_query( $page, $per_page, $primary_area_term_id );
		if ( is_wp_error( $query ) ) {
			return $query;
		}

		$reviews = is_array( $query->posts ) ? $query->posts : array();
		$total   = (int) $query->found_posts;

		if ( empty( $reviews ) ) {
			return array(
				'items'      => array(),
				'total'      => $total,
				'totalPages' => $total > 0 ? (int) ceil( $total / $per_page ) : 0,
				'page'       => $page,
			);
		}

		$review_shop_ids = array();
		foreach ( $reviews as $review ) {
			$shop_id = escomi_public_review_positive_integer( get_post_meta( $review->ID, 'review_shop_id', true ), null );
			if ( null === $shop_id ) {
				return new WP_Error( 'invalid_review_relation', '口コミの店舗情報を取得できません。', array( 'status' => 503 ) );
			}
			$review_shop_ids[ (int) $review->ID ] = $shop_id;
		}

		$shop_ids = array_values( array_unique( array_values( $review_shop_ids ) ) );
		$shops    = get_posts(
			array(
				'post_type'      => 'shop',
				'post_status'    => 'publish',
				'post__in'       => $shop_ids,
				'posts_per_page' => count( $shop_ids ),
				'orderby'        => 'post__in',
				'no_found_rows'  => true,
				'update_post_meta_cache' => true,
				'update_post_term_cache' => false,
			)
		);
		$shops_by_id = array();
		foreach ( $shops as $shop ) {
			$shops_by_id[ (int) $shop->ID ] = $shop;
		}
		if ( count( $shops_by_id ) !== count( $shop_ids ) ) {
			return new WP_Error( 'invalid_review_relation', '口コミの店舗情報を取得できません。', array( 'status' => 503 ) );
		}

		$terms = wp_get_object_terms( $shop_ids, 'area', array( 'fields' => 'all_with_object_id' ) );
		if ( is_wp_error( $terms ) ) {
			return new WP_Error( 'invalid_review_relation', '口コミの地域情報を取得できません。', array( 'status' => 503 ) );
		}
		$areas_by_shop_id = array_fill_keys( $shop_ids, array() );
		foreach ( $terms as $term ) {
			$object_id = (int) $term->object_id;
			if ( isset( $areas_by_shop_id[ $object_id ] ) ) {
				$areas_by_shop_id[ $object_id ][] = escomi_global_public_review_area_item( $term );
			}
		}
		foreach ( $areas_by_shop_id as &$areas ) {
			usort( $areas, fn( $left, $right ) => $left['id'] <=> $right['id'] );
		}
		unset( $areas );

		$primary_areas_by_shop_id = array();
		if ( null !== $primary_area_term_id ) {
			foreach ( $areas_by_shop_id as $shop_id => $areas ) {
				$primary_areas_by_shop_id[ $shop_id ] = escomi_public_review_primary_area( $shop_id, $areas );
			}
		}

		$items = array();
		foreach ( $reviews as $review ) {
			$shop_id = $review_shop_ids[ (int) $review->ID ];
			$shop    = $shops_by_id[ $shop_id ];
			$shop_item = array(
				'id'   => (int) $shop->ID,
				'slug' => (string) $shop->post_name,
				'name' => trim( wp_strip_all_tags( (string) $shop->post_title, true ) ),
			);
			if ( null !== $primary_area_term_id ) {
				$shop_item['primaryArea'] = $primary_areas_by_shop_id[ $shop_id ];
			}
			$items[] = array_merge(
				escomi_public_review_item( $review ),
				array(
					'shop'  => $shop_item,
					'areas' => $areas_by_shop_id[ $shop_id ],
				)
			);
		}

		return array(
			'items'      => $items,
			'total'      => $total,
			'totalPages' => $total > 0 ? (int) ceil( $total / $per_page ) : 0,
			'page'       => $page,
		);
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

if ( ! function_exists( 'escomi_get_global_public_reviews' ) ) {
	function escomi_get_global_public_reviews( $request ) {
		$query_params   = $request->get_query_params();
		$allowed_params = array( 'page', 'per_page', 'primary_area_slug' );
		foreach ( array_keys( $query_params ) as $param ) {
			if ( ! in_array( $param, $allowed_params, true ) ) {
				return escomi_public_review_request_error( '未対応のパラメーターです。' );
			}
		}

		$page     = escomi_public_review_positive_integer( $query_params['page'] ?? null, 1 );
		$per_page = escomi_public_review_positive_integer( $query_params['per_page'] ?? null, 20, 20 );
		if ( null === $page || null === $per_page || $page > 1000 || $page - 1 > intdiv( PHP_INT_MAX, $per_page ) ) {
			return escomi_public_review_request_error( 'pageとper_pageには有効な整数を指定してください。' );
		}

		$primary_area_term_id = null;
		if ( array_key_exists( 'primary_area_slug', $query_params ) ) {
			$primary_area_slug = escomi_public_review_area_slug( $query_params['primary_area_slug'] );
			if ( null === $primary_area_slug ) {
				return escomi_public_review_request_error( 'primary_area_slugには有効な地域slugを指定してください。' );
			}
			$primary_area = get_term_by( 'slug', $primary_area_slug, 'area' );
			if ( ! $primary_area || is_wp_error( $primary_area ) || ! isset( $primary_area->term_id, $primary_area->taxonomy ) || 'area' !== $primary_area->taxonomy ) {
				return new WP_Error( 'area_not_found', '地域が見つかりません。', array( 'status' => 404 ) );
			}
			$primary_area_term_id = (int) $primary_area->term_id;
		}

		$result = escomi_global_public_reviews_query_page( $page, $per_page, $primary_area_term_id );
		return is_wp_error( $result ) ? $result : rest_ensure_response( $result );
	}
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'escomi/v1',
			'/reviews',
			array(
				'methods'             => array( 'GET' ),
				'callback'            => 'escomi_get_global_public_reviews',
				'permission_callback' => function () {
					return true;
				},
			)
		);
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
