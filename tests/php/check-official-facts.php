<?php
/** Contract fixture: no WordPress connection or credentials. */
define('ABSPATH', __DIR__);
class WP_Error { public $code; public $data; function __construct($code,$message='',$data=[]){$this->code=$code;$this->data=$data;} }
class WP_REST_Response { public $data; public $status; function __construct($data,$status=200){$this->data=$data;$this->status=$status;} function header($k,$v){} function get_data(){return $this->data;} function get_status(){return $this->status;} }
class FixtureRequest { private $data; function __construct($data){$this->data=$data;} function get_json_params(){return $this->data;} function get_param($key){return $this->data[$key]??null;} function get_method(){return 'POST';} function get_body(){return json_encode($this->data);} }
function add_action(...$args){}
function add_filter(...$args){}
function do_action(...$args){if($GLOBALS['hook_throw']??false)throw new RuntimeException('fixture-hook');}
function maybe_serialize($v){return is_array($v)?serialize($v):$v;}
function maybe_unserialize($v){return is_string($v)&&str_starts_with($v,'a:')?unserialize($v):$v;}
function register_rest_route(...$args){}
function is_wp_error($v){return $v instanceof WP_Error;}
function current_user_can($cap,...$args){return $GLOBALS['caps'][$cap]??false;}
function get_current_user_id(){return 9;}
function wp_get_current_user(){return (object)['caps'=>['manage_shop_public_meta'=>$GLOBALS['direct_cap']??true]];}
function escomi_shop_public_meta_auth($allowed,$key,$id){return current_user_can('edit_post',$id)&&current_user_can('manage_shop_public_meta');}
function escomi_sanitize_shop_fact_provenance($x){return $x;}
function get_post($id){return $GLOBALS['post'];}
function get_post_meta($id,$key,$single=false){$v=$GLOBALS['meta'][$key]??null;return $single?($v??''):($v===null?[]:[$v]);}
function update_post_meta($id,$key,$value){if($key===($GLOBALS['fail_key']??''))return false;$GLOBALS['meta'][$key]=($key===($GLOBALS['corrupt_key']??''))?'corrupt-readback':$value;$GLOBALS['writes'][]=$key;return true;}
function wp_cache_delete(...$args){}
function clean_post_cache(...$args){}
function wp_get_object_terms(...$args){return [13];}
function wp_json_encode($v,...$args){return json_encode($v);}
function wp_salt($scheme='auth'){return 'fixture-only-signing-key';}
function wp_unslash($v){return $v;}
function wp_slash($v){return $v;}
function sanitize_text_field($v){return trim(strip_tags($v));}
function sanitize_textarea_field($v){return trim(strip_tags($v));}
function wp_http_validate_url($v){return filter_var($v,FILTER_VALIDATE_URL);}
function current_time($format,$gmt=false){return $format==='Y-m-d'?($gmt?($GLOBALS['utc_date']??'2026-09-13'):($GLOBALS['site_date']??'2026-09-13')):'2026-09-13 00:00:00';}
class FixtureDB {
 public $posts='wp_posts'; public $postmeta='wp_postmeta'; public $term_relationships='wp_term_relationships'; public $term_taxonomy='wp_term_taxonomy'; public $prefix='wp_'; public $last_error=''; public $saved;
 function prepare($q,...$args){return $q;}
 function get_col($q){return str_contains($q,'ENGINE')?['InnoDB','InnoDB','InnoDB','InnoDB']:[13];}
 function get_var($q){return 1;}
 function get_row($q){return $GLOBALS['post'];}
 function get_results($q){$r=[];foreach($GLOBALS['meta'] as $k=>$v){$r[]=(object)['meta_key'=>$k,'meta_value'=>maybe_serialize($v)];}return $r;}
 function update($table,$record,$where){return update_post_meta($where['post_id'],$where['meta_key'],maybe_unserialize($record['meta_value']));}
 function insert($table,$record){return update_post_meta($record['post_id'],$record['meta_key'],maybe_unserialize($record['meta_value']));}
 function delete($table,$where){if($where['meta_key']===($GLOBALS['fail_key']??''))return false;unset($GLOBALS['meta'][$where['meta_key']]);return 1;}
 function query($q){$GLOBALS['queries'][]=$q;if(($GLOBALS['fail_isolation']??false)&&$q==='SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')return false;if($q==='START TRANSACTION')$this->saved=$GLOBALS['meta'];if($q==='ROLLBACK')$GLOBALS['meta']=$this->saved;return 1;}
 function suppress_errors($v=true){return false;}
}
require __DIR__.'/../../official-facts-rest.php';
$GLOBALS['wpdb']=new FixtureDB();
$passed=0;
function check($test,$label){global $passed;if(!$test){fwrite(STDERR,"FAIL: $label\n");exit(1);} $passed++;}
function reset_fixture(){ $GLOBALS['queries']=[];$GLOBALS['corrupt_key']='';$GLOBALS['fail_isolation']=false;$GLOBALS['hook_throw']=false;$GLOBALS['direct_cap']=true;$GLOBALS['caps']=['edit_post'=>true,'manage_shop_public_meta'=>true];$GLOBALS['post']=(object)['ID'=>1,'post_type'=>'shop','post_name'=>'shop-one','post_status'=>'publish'];$GLOBALS['meta']=['shop_hours'=>'10:00～22:00','shop_tel'=>'080-1234-5678','shop_fact_provenance'=>[]];$GLOBALS['writes']=[];$GLOBALS['fail_key']=''; }
function payload(){ $expected=escomi_official_facts_snapshot(1);$canonical=json_encode('11:00~23:00',JSON_UNESCAPED_UNICODE);return ['batch_id'=>'11111111-1111-4111-8111-111111111111','wp_id'=>1,'slug'=>'shop-one','expected'=>$expected,'updates'=>['shop_hours'=>'11:00～23:00'],'provenance'=>[['field'=>'hours','sourceUrl'=>'https://official.example/access','sourceType'=>'official-site','observedAt'=>'2026-09-13','reviewedAt'=>'2026-09-13','reviewStatus'=>'reviewed','publishedValueHash'=>hash('sha256',$canonical)]],'canonical'=>['hours'=>$canonical],'audit'=>['shop_hours'=>['source_url'=>'https://official.example/access','checked_at'=>'2026-09-13']]]; }
reset_fixture(); $p=payload();
$GLOBALS['direct_cap']=false;check(is_wp_error(escomi_official_facts_permission(new FixtureRequest($p))),'inherited administrator capability rejected');$GLOBALS['direct_cap']=true;
check(!is_wp_error(escomi_official_facts_validate($p)),'valid payload');
foreach(['title','slug','status','area','taxonomy','post_status','archive','delete','rank','unknown'] as $key){$q=$p;$q['updates'][$key]='x';check(is_wp_error(escomi_official_facts_validate($q)),'reject '.$key);}
foreach([null,'','unknown','null'] as $value){$q=$p;$q['updates']['shop_hours']=$value;check(is_wp_error(escomi_official_facts_validate($q)),'no wipe');}
$q=$p;unset($q['audit']['shop_hours']['checked_at']);check(is_wp_error(escomi_official_facts_validate($q)),'date required');
$q=$p;$q['audit']['shop_hours']['source_url']='';check(is_wp_error(escomi_official_facts_validate($q)),'source required');
$q=$p;$q['audit']['shop_hours']['checked_at']='2099-01-01';check(is_wp_error(escomi_official_facts_validate($q)),'future date rejected');
$q=$p;$q['provenance'][0]['publishedValueHash']=str_repeat('0',64);check(is_wp_error(escomi_official_facts_validate($q)),'canonical hash mismatch');
$GLOBALS['caps']['manage_shop_public_meta']=false;check(is_wp_error(escomi_official_facts_permission(new FixtureRequest($p))),'capability denied');
reset_fixture();$p=payload();$q=$p;$q['slug']='wrong';check(is_wp_error(escomi_official_facts_apply(new FixtureRequest($q))),'slug mismatch');check(count($GLOBALS['writes'])===0,'identity writes zero');
reset_fixture();$p=payload();$GLOBALS['meta']['shop_tel']='080-0000-0000';check(is_wp_error(escomi_official_facts_apply(new FixtureRequest($p))),'unchanged contributor conflict');check(count($GLOBALS['writes'])===0,'conflict writes zero');
reset_fixture();$q=payload();$q['canonical']['hours']='"invented"';$q['provenance'][0]['publishedValueHash']=hash('sha256',$q['canonical']['hours']);check(is_wp_error(escomi_official_facts_apply(new FixtureRequest($q))),'proper SHA cannot authenticate wrong canonical');check(count($GLOBALS['writes'])===0,'wrong projection writes zero');
reset_fixture();$p=payload();$result=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($result),'apply');check($GLOBALS['meta']['shop_hours']==='11:00～23:00','fact readback');check($GLOBALS['meta']['shop_fact_provenance']===$p['provenance'],'provenance readback');
$before=count($GLOBALS['writes']);$second=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($second)&&count($GLOBALS['writes'])===$before,'second run noop');
reset_fixture();$p=payload();$GLOBALS['fail_key']='shop_fact_provenance';$result=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($result),'partial failure not success');check($GLOBALS['meta']['shop_hours']==='10:00～22:00'&&$GLOBALS['meta']['shop_fact_provenance']===[],'transaction rolls back facts and provenance');
reset_fixture();$p=payload();$applied=escomi_official_facts_apply(new FixtureRequest($p));
check(isset($applied->data['receipt']),'signed rollback receipt issued');
$rollback=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$applied->data['receipt']];
$bad=$rollback;$bad['receipt']['payload']['before']['fields']['shop_hours']['value']='tamper';
check(is_wp_error(escomi_official_facts_rollback(new FixtureRequest($bad))),'receipt tamper rejected');
$GLOBALS['meta']['shop_tel']='080-5555-0000';check(is_wp_error(escomi_official_facts_rollback(new FixtureRequest($rollback))),'stale rollback rejected');$GLOBALS['meta']['shop_tel']='080-1234-5678';
$back=escomi_official_facts_rollback(new FixtureRequest($rollback));check(!is_wp_error($back)&&$back->data['state']==='ROLLED_BACK','rollback applied');check(escomi_official_facts_snapshot(1)===$p['expected'],'exact original snapshot restored');
$back=escomi_official_facts_rollback(new FixtureRequest($rollback));check(!is_wp_error($back)&&$back->data['state']==='NOOP','repeated rollback no-op');
reset_fixture();$p=payload();$p['updates']['shop_holiday']='火曜日';$p['audit']['shop_holiday']=$p['audit']['shop_hours'];$applied=escomi_official_facts_apply(new FixtureRequest($p));$rollback=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$applied->data['receipt']];
$GLOBALS['fail_key']='shop_fact_provenance';$back=escomi_official_facts_rollback(new FixtureRequest($rollback));check(is_wp_error($back),'rollback failure reported');check($GLOBALS['meta']['shop_hours']==='11:00～23:00'&&$GLOBALS['meta']['shop_holiday']==='火曜日','rollback failure atomic');$GLOBALS['fail_key']='';
$back=escomi_official_facts_rollback(new FixtureRequest($rollback));check(!is_wp_error($back)&&!array_key_exists('shop_holiday',$GLOBALS['meta']),'rollback restores absence');
reset_fixture();$q=payload();$q['canonical']['hours']='"invented"';$q['provenance'][0]['publishedValueHash']=hash('sha256',$q['canonical']['hours']);$GLOBALS['meta']['shop_hours']='11:00～23:00';$GLOBALS['meta']['shop_fact_provenance']=$q['provenance'];check(is_wp_error(escomi_official_facts_apply(new FixtureRequest($q))),'projection validated before noop');
reset_fixture();$p=payload();$GLOBALS['hook_throw']=true;$result=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($result)&&isset($result->data['receipt'])&&$result->data['cache_published']===false,'postcommit hook failure retains receipt');
$GLOBALS['hook_throw']=false;$rollback=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$result->data['receipt']];$GLOBALS['direct_cap']=false;check(is_wp_error(escomi_official_facts_rollback(new FixtureRequest($rollback))),'rollback dedicatedcap required');
reset_fixture();$p=payload();$GLOBALS['fail_isolation']=true;$result=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($result)&&!in_array('START TRANSACTION',$GLOBALS['queries'],true),'failed isolation cannot start apply transaction');
reset_fixture();$p=payload();$result=escomi_official_facts_apply(new FixtureRequest($p));$rollback=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$result->data['receipt']];$GLOBALS['queries']=[];$GLOBALS['fail_isolation']=true;$result=escomi_official_facts_rollback(new FixtureRequest($rollback));check(is_wp_error($result)&&!in_array('START TRANSACTION',$GLOBALS['queries'],true),'failed isolation cannot start rollback transaction');
$GLOBALS['utc_date']='2026-09-12';$GLOBALS['site_date']='2026-09-13';
check(escomi_official_facts_date('2026-09-13'),'site calendar today accepted across UTC midnight boundary');
check(!escomi_official_facts_date('2026-09-14'),'site calendar tomorrow remains rejected');
reset_fixture();$p=payload();check(!is_wp_error(escomi_official_facts_validate($p)),'JST evidence payload validates before UTC midnight');
unset($GLOBALS['utc_date'],$GLOBALS['site_date']);
echo "PASS official facts contracts: $passed\n";
