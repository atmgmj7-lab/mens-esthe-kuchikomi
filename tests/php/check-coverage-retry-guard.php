<?php
declare(strict_types=1);
namespace CoverageRetryGuardFixture;
// Execute only the real pure validator in a namespace with WP/ACF/ledger boundaries stubbed.
// No coverage apply/reconcile handler, database, HTTP, or mutation is invoked.
require_once dirname(__DIR__,2).'/coverage-batch-writer.php';
class WP_Error { public function __construct(public $code,public $message='',public $data=[]) {} }
function is_wp_error($value) { return $value instanceof WP_Error; }
function escomi_coverage_require_operation_capability($operation) { return true; }
function escomi_coverage_payload_hash($payload) { return hash('sha256',json_encode($payload)); }
function escomi_coverage_validate_area_contract() { return true; }
function escomi_coverage_validate_acf_contract() { return []; }
function escomi_coverage_optional_ledger($batch,$operation) { return $GLOBALS['fixture_ledger']; }
function escomi_coverage_fixed_hold_ids($batch) { return []; }
function escomi_coverage_recovery_operation_id($kind) { return null; }
function get_post(...$args) { throw new \RuntimeException('must not proceed to WordPress reads'); }
$reflection=new \ReflectionFunction('escomi_coverage_validate_runtime_operation');
$lines=file($reflection->getFileName());
$body=implode('',array_slice($lines,$reflection->getStartLine()-1,$reflection->getEndLine()-$reflection->getStartLine()+1));
eval('namespace CoverageRetryGuardFixture; '.$body);
$payload=['synthetic'=>true];$hash=escomi_coverage_payload_hash($payload);
$GLOBALS['fixture_ledger']=['state'=>'retry_ready','post_id'=>901,'payload_hash'=>$hash,'attempt_id'=>'old-attempt'];
$manifest=['batch_id'=>'synthetic-batch'];
$operation=['operation_id'=>'synthetic-create','action'=>'CREATE_NEW','payload'=>$payload,'payload_hash'=>$hash];
$params=['batch_id'=>'synthetic-batch','operation_id'=>'synthetic-create','payload_hash'=>$hash,'attempt_id'=>'new-attempt'];
$result=escomi_coverage_validate_runtime_operation($manifest,$operation,$params);
if (!is_wp_error($result) || $result->code!=='reconcile_contract_unavailable') { throw new \RuntimeException('missing private identity must reject before generic retry'); }
echo "PASS missing private identity rejects pure retry validation before downstream reads\n";
