<?php
/**
 * Authenticated daily shop-data updates and their private audit log.
 */

$escomi_ai_update_security_file = __DIR__ . '/ai-update-security.php';
if ( ! function_exists( 'escomi_is_valid_daily_request_id' )
	&& is_readable( $escomi_ai_update_security_file )
) {
	require_once $escomi_ai_update_security_file;
}

$escomi_daily_meta_keys_constant = 'ES' . 'COMI_DAILY_UPDATE_META_KEYS';
if ( ! defined( $escomi_daily_meta_keys_constant ) ) {
	define(
		$escomi_daily_meta_keys_constant,
		array(
			'shop_today_analysis',
			'shop_availability',
			'shop_today_therapists',
		)
	);
}

const ESKOMI_DAILY_UPDATE_REQUEST_META_KEY = '_escomi_daily_update_request_ids';
const ESKOMI_DAILY_UPDATE_REQUEST_TTL      = 86400;
const ESKOMI_DAILY_UPDATE_REQUEST_MAX      = 100;

/**
 * 指定店舗の最新AI更新ログを1件取得。
 *
 * @param int $shop_post_id 店舗投稿ID。
 * @return WP_Post|null
 */
function escomi_get_latest_ai_log_for_shop( $shop_post_id ) {
	if ( ! $shop_post_id ) {
		return null;
	}

	$posts = get_posts(
		array(
			'post_type'      => 'ai_update_log',
			'posts_per_page' => 1,
			'post_status'    => 'publish',
			'meta_key'       => 'log_target_shop',
			'meta_value'     => (int) $shop_post_id,
			'orderby'        => 'date',
			'order'          => 'DESC',
		)
	);

	return ! empty( $posts ) ? $posts[0] : null;
}

add_action(
	'init',
	function () {
		register_post_type(
			'ai_update_log',
			array(
				'label'              => 'AI更新ログ',
				'public'             => false,
				'publicly_queryable' => false,
				'show_ui'            => true,
				'show_in_rest'       => false,
				'supports'           => array( 'title', 'editor', 'custom-fields' ),
				'menu_icon'          => 'dashicons-media-text',
			)
		);
	}
);

/**
 * 日次更新専用ユーザーと店舗編集権限の両方を確認する。
 *
 * @param WP_REST_Request $request REST request.
 * @return bool|WP_Error
 */
function escomi_can_update_daily_shop_data( $request ) {
	if ( ! current_user_can( 'escomi_update_daily_shop_data' ) ) {
		return new WP_Error( 'rest_forbidden', '更新権限がありません', array( 'status' => 403 ) );
	}

	$shop_id = absint( $request->get_param( 'shop_post_id' ) );
	if ( $shop_id <= 0 || 'shop' !== get_post_type( $shop_id ) ) {
		return new WP_Error( 'invalid_shop', '対象店舗を確認できません', array( 'status' => 400 ) );
	}

	if ( ! current_user_can( 'edit_post', $shop_id ) ) {
		return new WP_Error( 'rest_forbidden', '更新権限がありません', array( 'status' => 403 ) );
	}

	return true;
}

/**
 * PHP 7.xでもJSON配列とJSON objectを区別する。
 *
 * @param array $value Candidate list.
 * @return bool
 */
function escomi_daily_update_is_list( $value ) {
	if ( array() === $value ) {
		return true;
	}

	return array_keys( $value ) === range( 0, count( $value ) - 1 );
}

/**
 * UTF-8文字列の長さを返す。
 *
 * @param string $value Text.
 * @return int
 */
function escomi_daily_update_text_length( $value ) {
	if ( function_exists( 'mb_strlen' ) ) {
		return mb_strlen( $value, 'UTF-8' );
	}

	$match_count = preg_match_all( '/./us', $value, $matches );
	return false === $match_count ? strlen( $value ) : $match_count;
}

/**
 * 長さ超過や非文字列を切り捨てず拒否する。
 *
 * @param mixed  $value    Candidate text.
 * @param string $field    Field label.
 * @param int    $max      Maximum characters.
 * @param bool   $textarea Preserve newlines when true.
 * @return string|WP_Error
 */
function escomi_validate_daily_text( $value, $field, $max, $textarea = false ) {
	if ( ! is_string( $value ) ) {
		return new WP_Error( 'invalid_field', $field . 'は文字列で指定してください', array( 'status' => 400 ) );
	}

	if ( escomi_daily_update_text_length( $value ) > $max ) {
		return new WP_Error( 'field_too_long', $field . 'が上限を超えています', array( 'status' => 400 ) );
	}

	return $textarea ? sanitize_textarea_field( $value ) : sanitize_text_field( $value );
}

/**
 * セラピスト配列を厳格に検証してからsanitizeする。
 *
 * @param mixed $therapists Candidate therapist list.
 * @return array|WP_Error
 */
function escomi_validate_daily_therapists( $therapists ) {
	if ( ! is_array( $therapists ) || ! escomi_daily_update_is_list( $therapists ) ) {
		return new WP_Error( 'invalid_therapists', 'shop_today_therapistsは配列で指定してください', array( 'status' => 400 ) );
	}

	if ( count( $therapists ) > 100 ) {
		return new WP_Error( 'too_many_therapists', 'セラピスト件数が上限を超えています', array( 'status' => 400 ) );
	}

	$allowed_keys = array( 'name', 'time', 'status', 'tags' );
	$sanitized     = array();

	foreach ( $therapists as $index => $therapist ) {
		if ( ! is_array( $therapist ) || escomi_daily_update_is_list( $therapist ) ) {
			return new WP_Error( 'invalid_therapist', 'セラピスト情報が不正です', array( 'status' => 400, 'index' => $index ) );
		}

		$unknown_keys = array_diff( array_keys( $therapist ), $allowed_keys );
		if ( ! empty( $unknown_keys ) ) {
			return new WP_Error( 'unsupported_therapist_field', 'セラピスト情報に更新対象外の項目があります', array( 'status' => 400, 'index' => $index ) );
		}

		$item = array();
		foreach ( array( 'name' => 100, 'time' => 100, 'status' => 200 ) as $key => $limit ) {
			if ( ! array_key_exists( $key, $therapist ) ) {
				continue;
			}

			$value = escomi_validate_daily_text( $therapist[ $key ], $key, $limit );
			if ( is_wp_error( $value ) ) {
				return $value;
			}
			$item[ $key ] = $value;
		}

		if ( array_key_exists( 'tags', $therapist ) ) {
			$tags = $therapist['tags'];
			if ( ! is_array( $tags ) || ! escomi_daily_update_is_list( $tags ) || count( $tags ) > 10 ) {
				return new WP_Error( 'invalid_tags', 'tagsは10件以内の配列で指定してください', array( 'status' => 400, 'index' => $index ) );
			}

			$item['tags'] = array();
			foreach ( $tags as $tag ) {
				$clean_tag = escomi_validate_daily_text( $tag, 'tag', 50 );
				if ( is_wp_error( $clean_tag ) ) {
					return $clean_tag;
				}
				$item['tags'][] = $clean_tag;
			}
		}

		$sanitized[] = $item;
	}

	return $sanitized;
}

/**
 * 日次routeのpayloadをallowlistで検証する。
 *
 * @param WP_REST_Request $request REST request.
 * @return array|WP_Error
 */
function escomi_validate_daily_shop_update( $request ) {
	$request_id = strtolower( sanitize_text_field( (string) $request->get_param( 'request_id' ) ) );
	if ( ! function_exists( 'escomi_is_valid_daily_request_id' )
		|| ! escomi_is_valid_daily_request_id( $request_id )
	) {
		return new WP_Error( 'invalid_request_id', 'request_idが不正です', array( 'status' => 400 ) );
	}

	$meta = $request->get_param( 'meta' );
	if ( ! is_array( $meta ) ) {
		return new WP_Error( 'invalid_meta', 'metaが不正です', array( 'status' => 400 ) );
	}

	$allowed_meta_keys = constant( 'ES' . 'COMI_DAILY_UPDATE_META_KEYS' );
	$unknown           = array_diff( array_keys( $meta ), $allowed_meta_keys );
	if ( ! empty( $unknown ) ) {
		return new WP_Error( 'unsupported_field', '更新対象外の項目があります', array( 'status' => 400 ) );
	}

	$sanitized_meta = array();
	if ( array_key_exists( 'shop_today_analysis', $meta ) ) {
		$value = escomi_validate_daily_text( $meta['shop_today_analysis'], 'shop_today_analysis', 2000, true );
		if ( is_wp_error( $value ) ) {
			return $value;
		}
		$sanitized_meta['shop_today_analysis'] = $value;
	}

	if ( array_key_exists( 'shop_availability', $meta ) ) {
		$value = escomi_validate_daily_text( $meta['shop_availability'], 'shop_availability', 200 );
		if ( is_wp_error( $value ) ) {
			return $value;
		}
		$sanitized_meta['shop_availability'] = $value;
	}

	if ( array_key_exists( 'shop_today_therapists', $meta ) ) {
		$value = escomi_validate_daily_therapists( $meta['shop_today_therapists'] );
		if ( is_wp_error( $value ) ) {
			return $value;
		}
		$sanitized_meta['shop_today_therapists'] = $value;
	}

	return array(
		'request_id' => $request_id,
		'meta'       => $sanitized_meta,
	);
}

/**
 * 24時間以内のrequest_idだけを最大100件返す。
 *
 * @param int $shop_id Shop post ID.
 * @param int $now     Current Unix timestamp.
 * @return array
 */
function escomi_get_recent_daily_request_ids( $shop_id, $now ) {
	$stored = get_post_meta( $shop_id, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY, true );
	$stored = is_array( $stored ) ? $stored : array();
	$cutoff = $now - ESKOMI_DAILY_UPDATE_REQUEST_TTL;
	$recent = array();

	foreach ( $stored as $entry ) {
		if ( ! is_array( $entry ) || ! isset( $entry['id'], $entry['appliedAt'] ) ) {
			continue;
		}

		$applied_at = is_numeric( $entry['appliedAt'] ) ? (int) $entry['appliedAt'] : 0;
		if ( $applied_at < $cutoff || $applied_at > $now ) {
			continue;
		}

		$id = (string) $entry['id'];
		if ( ! escomi_is_valid_daily_request_id( $id ) ) {
			continue;
		}

		$recent[] = array(
			'id'        => $id,
			'appliedAt' => $applied_at,
		);
	}

	return array_slice( $recent, -ESKOMI_DAILY_UPDATE_REQUEST_MAX );
}

/**
 * 日次更新を適用する。
 *
 * @param WP_REST_Request $request REST request.
 * @return WP_REST_Response|WP_Error
 */
function handle_ai_shop_update_final( $request ) {
	$permission = escomi_can_update_daily_shop_data( $request );
	if ( is_wp_error( $permission ) ) {
		return $permission;
	}

	$validated = escomi_validate_daily_shop_update( $request );
	if ( is_wp_error( $validated ) ) {
		return $validated;
	}

	$shop_id    = absint( $request->get_param( 'shop_post_id' ) );
	$request_id = $validated['request_id'];
	$now        = time();
	$recent     = escomi_get_recent_daily_request_ids( $shop_id, $now );

	foreach ( $recent as $entry ) {
		if ( hash_equals( $entry['id'], $request_id ) ) {
			update_post_meta( $shop_id, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY, $recent );
			return new WP_REST_Response(
				array(
					'status'    => 'success',
					'shop_id'   => $shop_id,
					'duplicate' => true,
				),
				200
			);
		}
	}

	$changed_fields = array();
	foreach ( $validated['meta'] as $key => $value ) {
		$current_value = get_post_meta( $shop_id, $key, true );
		if ( $current_value === $value ) {
			continue;
		}

		$updated = update_post_meta( $shop_id, $key, $value );
		if ( false === $updated && get_post_meta( $shop_id, $key, true ) !== $value ) {
			return new WP_Error( 'update_failed', '店舗情報を更新できませんでした', array( 'status' => 500 ) );
		}
		$changed_fields[] = $key;
	}

	$recent[] = array(
		'id'        => $request_id,
		'appliedAt' => $now,
	);
	$recent   = array_slice( $recent, -ESKOMI_DAILY_UPDATE_REQUEST_MAX );
	update_post_meta( $shop_id, ESKOMI_DAILY_UPDATE_REQUEST_META_KEY, $recent );

	$log_id = null;
	if ( ! empty( $changed_fields ) ) {
		update_post_meta( $shop_id, 'shop_last_ai_check', current_time( 'mysql' ) );

		$summary = sanitize_textarea_field( (string) $request->get_param( 'summary' ) );
		$log_id  = wp_insert_post(
			array(
				'post_type'    => 'ai_update_log',
				'post_title'   => '【AI更新】' . get_the_title( $shop_id ),
				'post_content' => $summary,
				'post_status'  => 'publish',
			)
		);

		if ( ! is_wp_error( $log_id ) ) {
			update_post_meta( $log_id, 'log_target_shop', $shop_id );
			update_post_meta( $log_id, 'log_type', sanitize_key( (string) $request->get_param( 'log_type' ) ) ?: 'update' );
			update_post_meta( $log_id, 'log_ai_summary', $summary );
		}
	}

	return new WP_REST_Response(
		array(
			'status'         => 'success',
			'shop_id'        => $shop_id,
			'log_id'         => $log_id,
			'duplicate'      => false,
			'changed_fields' => $changed_fields,
		),
		empty( $changed_fields ) ? 200 : 201
	);
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'escomi/v1',
			'/update',
			array(
				'methods'             => array( 'POST' ),
				'callback'            => 'handle_ai_shop_update_final',
				'permission_callback' => 'escomi_can_update_daily_shop_data',
			)
		);
	},
	PHP_INT_MAX
);
