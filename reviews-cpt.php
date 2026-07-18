<?php
/**
 * User-submitted shop reviews (moderated, pending by default).
 *
 * Deploy: require from swell_child/functions.php
 * REST: POST /wp-json/wp/v2/reviews (Application Password, status pending)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function escomi_register_reviews_cpt() {
	register_post_type(
		'reviews',
		array(
			'labels'              => array(
				'name'          => '口コミ',
				'singular_name' => '口コミ',
				'add_new_item'  => '口コミを追加',
				'edit_item'     => '口コミを編集',
			),
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_rest'        => true,
			'rest_base'           => 'reviews',
			'has_archive'         => false,
			'supports'            => array( 'title', 'editor', 'custom-fields' ),
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
			'menu_icon'           => 'dashicons-testimonial',
		)
	);
}
add_action( 'init', 'escomi_register_reviews_cpt' );

function escomi_register_review_meta_fields() {
	$fields = array(
		'review_shop_id'       => 'integer',
		'review_shop_slug'     => 'string',
		'reviewer_name'        => 'string',
		'used_period'          => 'string',
		'rating_total'         => 'integer',
		'rating_price'         => 'integer',
		'rating_service'       => 'integer',
		'rating_cleanliness'   => 'integer',
		'revisit_intent'       => 'string',
		'approval_status'      => 'string',
		'moderation_note'      => 'string',
		'approved_at'          => 'string',
	);

	foreach ( $fields as $key => $type ) {
		register_post_meta(
			'reviews',
			$key,
			array(
				'single'            => true,
				'type'              => $type,
				'show_in_rest'      => true,
				'auth_callback'     => function () {
					return current_user_can( 'edit_posts' );
				},
				'sanitize_callback' => 'sanitize_text_field',
			)
		);
	}
}
add_action( 'init', 'escomi_register_review_meta_fields' );

/** New REST submissions are always pending until admin publishes. */
add_filter(
	'rest_pre_insert_reviews',
	function ( $prepared_post ) {
		if ( empty( $prepared_post->ID ) ) {
			$prepared_post->post_status = 'pending';
		}
		return $prepared_post;
	}
);

/** Default approval_status meta on insert. */
add_action(
	'rest_insert_reviews',
	function ( $post, $request, $creating ) {
		if ( ! $creating ) {
			return;
		}
		update_post_meta( $post->ID, 'approval_status', 'pending' );
	},
	10,
	3
);

/** Invalidate the public review cache whenever moderation visibility changes. */
add_action(
	'transition_post_status',
	function ( $new_status, $old_status, $post ) {
		if ( ! ( $post instanceof WP_Post ) || 'reviews' !== $post->post_type || $new_status === $old_status ) {
			return;
		}
		if ( function_exists( 'escomi_headless_queue_revalidate' ) ) {
			escomi_headless_queue_revalidate( 'review_status:' . (int) $post->ID );
		}
	},
	20,
	3
);

function escomi_review_approval_meta_revalidate( $meta_id, $post_id, $meta_key ) {
	unset( $meta_id );
	if ( 'approval_status' !== $meta_key || 'reviews' !== get_post_type( $post_id ) ) {
		return;
	}
	if ( function_exists( 'escomi_headless_queue_revalidate' ) ) {
		escomi_headless_queue_revalidate( 'review_approval:' . (int) $post_id );
	}
}
add_action( 'added_post_meta', 'escomi_review_approval_meta_revalidate', 20, 3 );
add_action( 'updated_post_meta', 'escomi_review_approval_meta_revalidate', 20, 3 );
add_action( 'deleted_post_meta', 'escomi_review_approval_meta_revalidate', 20, 3 );
