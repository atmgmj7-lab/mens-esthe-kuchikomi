<?php
header('Content-Type: text/plain; charset=UTF-8');
if (function_exists('opcache_reset')) {
    $result = opcache_reset();
    echo $result ? 'OPcache reset: OK' : 'OPcache reset: FAILED';
} else {
    echo 'OPcache not enabled';
}
echo "\nPHP " . phpversion();
