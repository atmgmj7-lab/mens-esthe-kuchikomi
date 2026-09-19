<?php
// Included after the candidate pure loader and writer declarations; no WP bootstrap.
// No add_action shim: importing the writer registers nothing in this standalone process.
class WP_Error {
    public function __construct(public $code, public $message = '', public $data = []) {}
}
function is_wp_error($value) { return $value instanceof WP_Error; }
try {
    if (PHP_SAPI !== 'cli' || count($argv) !== 2) { throw new RuntimeException('arguments'); }
    $privateRoot = escomi_coverage_private_root($argv[1]);
    $contracts = escomi_coverage_private_contracts($privateRoot);
    foreach (array_keys(escomi_coverage_private_manifest_specs()) as $batch) {
        $manifest = escomi_coverage_private_manifest($batch, $privateRoot);
        if (is_wp_error(escomi_coverage_validate_manifest_contract($manifest))) {
            throw new RuntimeException('manifest_contract');
        }
    }
    echo "COVERAGE_PRIVATE_PREFLIGHT=PASS records=" . count($contracts) . " manifests=2\n";
} catch (Throwable $error) {
    // Do not reveal filesystem paths, private records or exception traces.
    echo "COVERAGE_PRIVATE_PREFLIGHT=FAIL\n";
    exit(1);
}
