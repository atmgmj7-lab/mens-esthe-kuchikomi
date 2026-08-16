<?php
/**
 * Execute the production review hooks and queue function against a safe local
 * fixture. Each scenario runs in its own PHP process so request-local static
 * state matches WordPress request boundaries.
 */

define( 'ABSPATH', __DIR__ );

$GLOBALS['escomi_cache_actions']      = array();
$GLOBALS['escomi_cache_sent_reasons'] = array();
$GLOBALS['escomi_cache_set_throttle'] = 0;
$GLOBALS['escomi_cache_post_types']   = array();
$GLOBALS['escomi_cache_post_status']  = array();
$GLOBALS['escomi_cache_post_meta']    = array();

final class WP_Post {
	public int $ID;
	public string $post_type;
	public string $post_status;

	public function __construct( int $id, string $post_type, string $post_status ) {
		$this->ID          = $id;
		$this->post_type   = $post_type;
		$this->post_status = $post_status;
	}
}

function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	unset( $priority, $accepted_args );
	$GLOBALS['escomi_cache_actions'][ $hook ][] = $callback;
}

function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
	add_action( $hook, $callback, $priority, $accepted_args );
}

function get_post_type( $post_id ) {
	return $GLOBALS['escomi_cache_post_types'][ (int) $post_id ] ?? false;
}

function get_post_status( $post_id ) {
	return $GLOBALS['escomi_cache_post_status'][ (int) $post_id ] ?? false;
}

function get_post_meta( $post_id, $meta_key, $single = false ) {
	$value = $GLOBALS['escomi_cache_post_meta'][ (int) $post_id ][ $meta_key ] ?? '';
	if ( $single ) {
		return is_array( $value ) ? ( $value[0] ?? '' ) : $value;
	}
	if ( is_array( $value ) ) {
		return $value;
	}
	return '' === $value ? array() : array( $value );
}

function escomi_headless_revalidate_is_throttled() {
	return true;
}

function escomi_headless_revalidate_set_throttle() {
	$GLOBALS['escomi_cache_set_throttle']++;
}

function escomi_headless_send_revalidate( $reason ) {
	$GLOBALS['escomi_cache_sent_reasons'][] = (string) $reason;
}

function escomi_headless_revalidate_skip_post( $post_id ) {
	return (int) $post_id <= 0;
}

function escomi_headless_revalidate_is_relevant_post_type( $post_type ) {
	return in_array( $post_type, array( 'shop', 'post', 'page', 'reviews' ), true );
}

function escomi_cache_extract_function( string $source, string $function_name ): string {
	$tokens = token_get_all( $source );
	$count  = count( $tokens );
	for ( $index = 0; $index < $count; $index++ ) {
		$token = $tokens[ $index ];
		if ( ! is_array( $token ) || T_FUNCTION !== $token[0] ) {
			continue;
		}

		$name_index = $index + 1;
		while ( $name_index < $count ) {
			$name_token = $tokens[ $name_index ];
			if ( is_array( $name_token ) && T_WHITESPACE === $name_token[0] ) {
				$name_index++;
				continue;
			}
			break;
		}
		if ( $name_index >= $count || ! is_array( $tokens[ $name_index ] ) || T_STRING !== $tokens[ $name_index ][0] || $function_name !== $tokens[ $name_index ][1] ) {
			continue;
		}

		$code          = '';
		$brace_depth   = 0;
		$started_body  = false;
		for ( $cursor = $index; $cursor < $count; $cursor++ ) {
			$current = $tokens[ $cursor ];
			$text    = is_array( $current ) ? $current[1] : $current;
			$code   .= $text;
			if ( '{' === $text ) {
				$started_body = true;
				$brace_depth++;
			} elseif ( '}' === $text && $started_body ) {
				$brace_depth--;
				if ( 0 === $brace_depth ) {
					return $code;
				}
			}
		}
	}

	throw new RuntimeException( 'Production function not found: ' . $function_name );
}

function escomi_cache_fail( string $message ): void {
	fwrite( STDERR, $message . "\n" );
	exit( 1 );
}

function escomi_cache_run_shutdown(): void {
	foreach ( $GLOBALS['escomi_cache_actions']['shutdown'] ?? array() as $callback ) {
		$callback();
	}
}

function escomi_cache_call_hook( string $hook, ...$args ): void {
	$callbacks = $GLOBALS['escomi_cache_actions'][ $hook ] ?? array();
	if ( array() === $callbacks ) {
		escomi_cache_fail( 'Required production hook is missing: ' . $hook );
	}
	foreach ( $callbacks as $callback ) {
		$callback( ...$args );
	}
}

function escomi_cache_set_post( int $post_id, string $post_type, string $post_status, string $approval_status = '' ): void {
	$GLOBALS['escomi_cache_post_types'][ $post_id ]  = $post_type;
	$GLOBALS['escomi_cache_post_status'][ $post_id ] = $post_status;
	$GLOBALS['escomi_cache_post_meta'][ $post_id ]   = array( 'approval_status' => $approval_status );
}

$functions_source = file_get_contents( dirname( __DIR__, 2 ) . '/functions.php' );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_queue_revalidate' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_save_post' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_trashed_post' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_untrashed_post' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_before_delete_post' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_deleted_post' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_area_taxonomy_change' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_area_relationship_added' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_area_relationship_deleted' ) );
eval( escomi_cache_extract_function( $functions_source, 'escomi_headless_on_primary_area_meta_change' ) );
require_once dirname( __DIR__, 2 ) . '/reviews-cpt.php';
add_action( 'added_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4 );
add_action( 'updated_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4 );
add_action( 'deleted_post_meta', 'escomi_headless_on_primary_area_meta_change', 20, 4 );

$scenario = $argv[1] ?? '';
switch ( $scenario ) {
	case 'new_publish':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		$GLOBALS['escomi_cache_actions']['transition_post_status'][0]( 'publish', 'pending', new WP_Post( 42, 'reviews', 'publish' ) );
		break;
	case 'new_publish_pending':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		$GLOBALS['escomi_cache_actions']['transition_post_status'][0]( 'publish', 'pending', new WP_Post( 42, 'reviews', 'publish' ) );
		break;
	case 'approval':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		escomi_cache_call_hook( 'update_post_metadata', null, 42, 'approval_status', 'approved', '' );
		break;
	case 'nonapproval':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		escomi_cache_call_hook( 'update_post_metadata', null, 42, 'approval_status', 'pending', '' );
		break;
	case 'pending_to_rejected':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		escomi_cache_call_hook( 'update_post_metadata', null, 42, 'approval_status', 'rejected', '' );
		break;
	case 'added_approval_meta':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		escomi_cache_call_hook( 'added_post_meta', 10, 42, 'approval_status', 'approved' );
		break;
	case 'added_pending_meta':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		escomi_cache_call_hook( 'added_post_meta', 10, 42, 'approval_status', 'pending' );
		break;
	case 'deleted_approval_meta':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		escomi_cache_call_hook( 'delete_post_metadata', null, 42, 'approval_status', '', false );
		break;
	case 'deleted_pending_meta':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		escomi_cache_call_hook( 'delete_post_metadata', null, 42, 'approval_status', '', false );
		break;
	case 'rating_update':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		$GLOBALS['escomi_cache_actions']['updated_post_meta'][0]( 11, 42, 'rating_total', 5 );
		break;
	case 'rating_pending':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'pending' );
		$GLOBALS['escomi_cache_actions']['updated_post_meta'][0]( 11, 42, 'rating_total', 5 );
		break;
	case 'body_update':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		escomi_headless_on_save_post( 42, new WP_Post( 42, 'reviews', 'publish' ), true );
		break;
	case 'pending_submission':
		escomi_cache_set_post( 42, 'reviews', 'pending', 'pending' );
		escomi_headless_on_save_post( 42, new WP_Post( 42, 'reviews', 'pending' ), false );
		break;
	case 'nonpublic':
		escomi_cache_set_post( 42, 'reviews', 'draft', 'approved' );
		$GLOBALS['escomi_cache_actions']['transition_post_status'][0]( 'draft', 'publish', new WP_Post( 42, 'reviews', 'draft' ) );
		break;
	case 'trash':
		escomi_cache_set_post( 42, 'reviews', 'trash', 'approved' );
		$GLOBALS['escomi_cache_actions']['transition_post_status'][0]( 'trash', 'publish', new WP_Post( 42, 'reviews', 'trash' ) );
		escomi_headless_on_trashed_post( 42 );
		break;
	case 'restore':
		escomi_cache_set_post( 42, 'reviews', 'draft', 'approved' );
		escomi_headless_on_untrashed_post( 42 );
		break;
	case 'delete':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		escomi_headless_on_before_delete_post( 42, new WP_Post( 42, 'reviews', 'publish' ) );
		escomi_headless_on_deleted_post( 42, new WP_Post( 42, 'reviews', 'publish' ) );
		break;
	case 'delete_pending':
		escomi_cache_set_post( 42, 'reviews', 'pending', 'pending' );
		escomi_headless_on_before_delete_post( 42, new WP_Post( 42, 'reviews', 'pending' ) );
		escomi_headless_on_deleted_post( 42, new WP_Post( 42, 'reviews', 'pending' ) );
		break;
	case 'multi_hook_publish':
		escomi_cache_set_post( 42, 'reviews', 'publish', 'approved' );
		$GLOBALS['escomi_cache_actions']['transition_post_status'][0]( 'publish', 'pending', new WP_Post( 42, 'reviews', 'publish' ) );
		escomi_cache_call_hook( 'update_post_metadata', null, 42, 'approval_status', 'approved', '' );
		break;
	case 'shop_change_after_throttle':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_headless_on_save_post( 84, new WP_Post( 84, 'shop', 'publish' ), true );
		break;
	case 'area_change_after_throttle':
		escomi_headless_on_area_taxonomy_change( 9, 10 );
		break;
	case 'area_relation_add':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_headless_on_area_relationship_added( 84, 10, 'area' );
		break;
	case 'area_relation_remove':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_headless_on_area_relationship_deleted( 84, array( 10 ), 'area' );
		break;
	case 'area_relation_replace':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_headless_on_area_relationship_deleted( 84, array( 10 ), 'area' );
		escomi_headless_on_area_relationship_added( 84, 11, 'area' );
		break;
	case 'area_relation_unrelated':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_headless_on_area_relationship_added( 84, 10, 'shop_category' );
		break;
	case 'primary_area_meta_added':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_cache_call_hook( 'added_post_meta', 12, 84, 'shop_primary_area_term_id', 13 );
		break;
	case 'primary_area_meta_updated':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_cache_call_hook( 'updated_post_meta', 12, 84, 'shop_primary_area_term_id', 13 );
		break;
	case 'primary_area_meta_deleted':
		escomi_cache_set_post( 84, 'shop', 'publish' );
		escomi_cache_call_hook( 'deleted_post_meta', array( 12 ), 84, 'shop_primary_area_term_id', 13 );
		break;
	default:
		escomi_cache_fail( 'Unknown fixture scenario.' );
}

escomi_cache_run_shutdown();
$expected_send_count = in_array(
	$scenario,
	array( 'new_publish_pending', 'pending_to_rejected', 'added_pending_meta', 'deleted_pending_meta', 'rating_pending', 'pending_submission', 'restore', 'delete_pending', 'area_relation_unrelated' ),
	true
) ? 0 : 1;
if ( $expected_send_count !== count( $GLOBALS['escomi_cache_sent_reasons'] ) ) {
	escomi_cache_fail( 'Unexpected revalidation count for scenario: ' . $scenario );
}
if ( 0 !== $GLOBALS['escomi_cache_set_throttle'] ) {
	escomi_cache_fail( 'Public-data invalidation must not create a lossy cross-request throttle: ' . $scenario );
}

fwrite( STDOUT, 'Review cache invalidation fixture: PASS ' . $scenario . "\n" );
