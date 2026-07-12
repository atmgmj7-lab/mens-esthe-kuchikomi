<?php
header( 'Content-Type: application/json; charset=utf-8' );

$result = array(
    'ok' => false,
    'opcache_reset_available' => function_exists( 'opcache_reset' ),
);

if ( function_exists( 'opcache_reset' ) ) {
    $result['ok'] = opcache_reset();
}

$result['self_deleted'] = @unlink( __FILE__ );

echo json_encode( $result );
