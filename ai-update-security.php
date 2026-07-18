<?php
/**
 * Stateless security helpers for the daily shop update route.
 */

if ( ! function_exists( 'escomi_is_valid_daily_request_id' ) ) {
	/**
	 * Accept only canonical UUIDv4 request identifiers.
	 *
	 * This function deliberately does not read WordPress state so callers and
	 * focused tests can validate identifiers without bootstrapping WordPress.
	 *
	 * @param mixed $request_id Candidate request identifier.
	 * @return bool
	 */
	function escomi_is_valid_daily_request_id( $request_id ) {
		return is_string( $request_id )
			&& 1 === preg_match(
				'/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
				$request_id
			);
	}
}
