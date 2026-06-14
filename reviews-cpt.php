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
