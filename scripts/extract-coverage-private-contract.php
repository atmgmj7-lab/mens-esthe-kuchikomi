<?php
declare(strict_types=1);
// Local migration only. Parse the literal return array; never load/execute the live module.
if (PHP_SAPI !== 'cli' || count($argv) !== 3) { fwrite(STDERR,"Usage: php extract-coverage-private-contract.php LIVE_SNAPSHOT NEW_PRIVATE_JSON\n"); exit(2); }
try {
    $source = file_get_contents($argv[1]);
    if (!is_string($source) || !preg_match('/function escomi_coverage_reconcile_contracts\(\): array\s*\{(.*?)\n\}/s', $source, $match)) { throw new RuntimeException(); }
    $body = $match[1];
    foreach (token_get_all("<?php " . $body) as $token) {
        if (is_array($token)) {
            if (in_array($token[0], [T_OPEN_TAG,T_WHITESPACE,T_RETURN,T_CONSTANT_ENCAPSED_STRING,T_LNUMBER,T_DOUBLE_ARROW],true)) { continue; }
            if ($token[0]===T_STRING && in_array(strtolower($token[1]),['true','false','null'],true)) { continue; }
            throw new RuntimeException();
        }
        if (!in_array($token,['[',']',',',';'],true)) { throw new RuntimeException(); }
    }
    $map = eval($body); // Whitelisted literal array syntax only, no calls, variables or includes.
    if (!is_array($map) || count($map)!==3) { throw new RuntimeException(); }
    $records=[];
    foreach ($map as $identity=>$contract) { $records[]=['operation_id'=>$identity,'contract'=>$contract]; }
    $directory=dirname($argv[2]);
    if (is_link($directory) || (fileperms($directory)&07777)!==0700) { throw new RuntimeException(); }
    $previous=umask(0077);
    try { $handle=fopen($argv[2],'xb'); } finally { umask($previous); }
    if (!$handle) { throw new RuntimeException(); }
    $bytes=json_encode(['version'=>1,'recoveryContracts'=>$records],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
    try { if (fwrite($handle,$bytes)!==strlen($bytes)) { throw new RuntimeException(); } } finally { fclose($handle); }
    echo "PRIVATE_EXTRACTION=PASS records=3\n";
} catch (Throwable $error) { fwrite(STDERR,"PRIVATE_EXTRACTION=FAIL\n"); exit(1); }
