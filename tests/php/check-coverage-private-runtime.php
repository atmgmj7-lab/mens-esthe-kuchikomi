<?php
declare(strict_types=1);
require dirname(__DIR__, 2) . '/coverage-private-runtime.php';
$root = realpath(sys_get_temp_dir()) . '/coverage-private-test-' . bin2hex(random_bytes(6));
mkdir($root, 0700);
function check(bool $condition): void { if (!$condition) throw new RuntimeException('Check failed'); }
function expect_fail(callable $fn): void { try { $fn(); } catch (RuntimeException $e) { return; } throw new RuntimeException('Expected rejection'); }
function fixture(string $root, string $bytes): string { $p=$root.'/fixture.json'; file_put_contents($p,$bytes); chmod($p,0600); clearstatcache(); return $p; }
try {
 expect_fail(fn()=>escomi_coverage_private_contracts($root));
 $bytes='{"batch_id":"synthetic","schema_version":1,"items":[]}';
 $p=fixture($root,$bytes);
 check(escomi_coverage_private_read_json($root,'fixture.json',hash('sha256',$bytes))['batch_id']==='synthetic');
 expect_fail(fn()=>escomi_coverage_private_read_json($root,'missing.json'));
 expect_fail(fn()=>escomi_coverage_private_read_json($root,'../fixture.json'));
 expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json',str_repeat('0',64)));
 chmod($p,0644); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json'));
 fixture($root,'{"x":1,"x":2}'); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json'));
 fixture($root,'{"x":{"a":1,"\u0061":2}}'); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json'));
 fixture($root,'{'); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json'));
 fixture($root,str_repeat(' ',1048577)); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json'));
 unlink($p); symlink('/etc/passwd',$p); expect_fail(fn()=>escomi_coverage_private_read_json($root,'fixture.json')); unlink($p);
 expect_fail(fn()=>escomi_coverage_private_manifest('unknown',$root));
 file_put_contents($root.'/recovery-contracts.json','{"version":1,"recoveryContracts":[]}'); chmod($root.'/recovery-contracts.json',0600);
 expect_fail(fn()=>escomi_coverage_private_contracts($root));
 $base=['payload_hash'=>str_repeat('a',64),'post_id'=>101,'status'=>'publish','primary_exists'=>false];
 $contracts=[
  'coverage-m9001-update'=>$base+['reconcile_kind'=>'retry_ready','failure_audit_id'=>201,'area_terms'=>[1],'provenance_exists'=>false],
  'coverage-m9002-create'=>$base+['reconcile_kind'=>'applied_create_relation','applied_audit_id'=>202,'required_area_terms'=>[1],'allowed_derived_area_terms'=>[2]],
  'coverage-m9003-create'=>array_replace($base,['status'=>'draft'])+['reconcile_kind'=>'failed_create_provenance','failure_audit_id'=>203,'failure_audit_post_id'=>null,'title'=>'Synthetic fixture','slug'=>'synthetic-fixture','area_terms'=>[1],'provenance_exists'=>true,'provenance_value'=>[],'failure_code'=>'synthetic_failure'],
 ];
 $records=[]; foreach($contracts as $id=>$contract) $records[]=['operation_id'=>$id,'contract'=>$contract];
 $valid=['version'=>1,'recoveryContracts'=>$records];
 $save=function(array $data) use($root):void {file_put_contents($root.'/recovery-contracts.json',json_encode($data,JSON_THROW_ON_ERROR));chmod($root.'/recovery-contracts.json',0600);clearstatcache();};
 $save($valid); check(escomi_coverage_private_contracts($root)===$contracts);
 foreach(['missing','extra','duplicate','wrong_integer','wrong_bool','terms_empty','terms_duplicate','hash','kind','version','unknown','duplicate_kind','record_object','missing_contract','negative_id','status','title_type'] as $case) {
  $bad=$valid;
  switch($case) {
   case 'missing':unset($bad['recoveryContracts'][0]['contract']['post_id']);break;
   case 'extra':$bad['recoveryContracts'][0]['contract']['extra']=1;break;
   case 'duplicate':$bad['recoveryContracts'][2]=$bad['recoveryContracts'][0];break;
   case 'wrong_integer':$bad['recoveryContracts'][0]['contract']['post_id']='101';break;
   case 'wrong_bool':$bad['recoveryContracts'][0]['contract']['primary_exists']=0;break;
   case 'terms_empty':$bad['recoveryContracts'][0]['contract']['area_terms']=[];break;
   case 'terms_duplicate':$bad['recoveryContracts'][0]['contract']['area_terms']=[1,1];break;
   case 'hash':$bad['recoveryContracts'][0]['contract']['payload_hash']='bad';break;
   case 'kind':$bad['recoveryContracts'][0]['contract']['reconcile_kind']='unknown';break;
   case 'version':$bad['version']='1';break;
   case 'duplicate_kind':$bad['recoveryContracts'][2]['contract']=$bad['recoveryContracts'][1]['contract'];break;
   case 'record_object':$bad['recoveryContracts']=['key'=>$bad['recoveryContracts'][0]];break;
   case 'missing_contract':unset($bad['recoveryContracts'][0]['contract']);break;
   case 'negative_id':$bad['recoveryContracts'][0]['contract']['post_id']=-1;break;
   case 'status':$bad['recoveryContracts'][0]['contract']['status']=true;break;
   case 'title_type':$bad['recoveryContracts'][2]['contract']['title']=123;break;
   case 'unknown':$bad['recoveryContracts'][0]['operation_id']='unknown';break;
  }
  $save($bad);expect_fail(fn()=>escomi_coverage_private_contracts($root));
 }
 $save($valid);chmod($root.'/recovery-contracts.json',0400);chmod($root,0500);clearstatcache();check(escomi_coverage_private_contracts($root)===$contracts);chmod($root,0700);chmod($root.'/recovery-contracts.json',0600);
 $link=$root.'-link';mkdir($root.'/nested',0700);symlink($root,$link);try {expect_fail(fn()=>escomi_coverage_private_contracts($link));expect_fail(fn()=>escomi_coverage_private_read_json($link.'/nested','fixture.json'));} finally {unlink($link);rmdir($root.'/nested');}
 chmod($root,0755);expect_fail(fn()=>escomi_coverage_private_contracts($root));chmod($root,0700);
 check(escomi_coverage_private_root('/synthetic/public_html/')==='/synthetic/private/escomi-coverage');
 echo "PASS private runtime secure read and contract mutation tests\n";
} finally { foreach(glob($root.'/*') as $p) unlink($p); rmdir($root); }
