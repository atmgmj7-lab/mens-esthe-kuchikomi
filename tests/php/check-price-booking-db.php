<?php
/** Isolated MariaDB, existing dedicated writer, real transactions/readback/rollback. */
class WP_REST_Request {function __construct($method,$route){}function set_param($key,$value){}}
function rest_do_request($request){return new class {function get_status(){return 200;}function get_data(){return ['acf'=>['price_90'=>null]];}};}
require __DIR__.'/check-official-facts-db.php';
function reset_foundation_db(){global $wpdb;reset_db();foreach(['price_60'=>'9000','price_90'=>'14000','shop_line'=>'https://line.me/R/ti/p/shop','shop_booking'=>'電話 / LINE'] as $k=>$v)$wpdb->insert('wp_postmeta',['post_id'=>1,'meta_key'=>$k,'meta_value'=>$v]);}
function foundation_db_payload($field){
 $p=db_payload();$value=$field==='price_90'?'15000':'https://booking.example/reserve?shop=one&course=90';$cat=$field==='price_90'?'price':'booking';
 $canonical=$cat==='price'?'[{"durationMinutes":90,"priceYen":15000}]':'[{"kind":"line","href":"https://line.me/R/ti/p/shop"},{"kind":"reservation","href":"https://booking.example/reserve?shop=one&course=90"},{"kind":"tel","href":"tel:08012345678"}]';
 $p['updates']=[$field=>$value];$p['canonical']=[$cat=>$canonical];$p['provenance'][0]['field']=$cat;$p['provenance'][0]['publishedValueHash']=hash('sha256',$canonical);
 $today=gmdate('Y-m-d');$a=['source_url'=>'https://official.example/access','checked_at'=>$today,'source_host'=>'official.example','normalized_value'=>$value,'observed_at'=>$today,'reviewed_at'=>$today];
 if($cat==='price'){$a['duration_minutes']=90;$a['price_type']='EXACT_STANDARD';}else{$a['booking_purpose']='reservation';$a['linked_from_url']=$a['source_url'];}
 $p['audit']=[$field=>$a];return $p;
}
foreach(['price_90','shop_booking_url'] as $field){
 reset_foundation_db();$p=foundation_db_payload($field);$r=escomi_official_facts_apply(new DBRequest($p));check_db(!is_wp_error($r)&&$r->data['state']==='APPLIED',$field.' SQL apply');
 $actual=escomi_official_facts_snapshot(1);check_db($actual['fields'][$field]['value']===$p['updates'][$field],$field.' SQL exact readback');
 foreach(['price_60','shop_line','shop_tel','shop_booking'] as $other)check_db($actual['fields'][$other]===$p['expected']['fields'][$other],$field.' SQL preserves '.$other);
 $back=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$r->data['receipt']];$r=escomi_official_facts_rollback(new DBRequest($back));check_db(!is_wp_error($r)&&escomi_official_facts_snapshot(1)===$p['expected'],$field.' SQL receipt rollback exact absence/value');
 reset_foundation_db();$p=foundation_db_payload($field);$observer->query("UPDATE wp_postmeta SET meta_value='changed' WHERE meta_key='shop_tel'");$r=escomi_official_facts_apply(new DBRequest($p));check_db(is_wp_error($r)&&$r->code==='snapshot_conflict',$field.' SQL stale contributor refuses write');
 reset_foundation_db();$p=foundation_db_payload($field);$before=escomi_official_facts_snapshot(1);
 $wpdb->after_mutation=function($sql)use($field,$wpdb){if(str_contains($sql,$field)){$wpdb->after_mutation=null;$wpdb->query($wpdb->prepare("UPDATE wp_postmeta SET meta_value='corrupt' WHERE post_id=1 AND meta_key=%s",$field));}};
 $r=escomi_official_facts_apply(new DBRequest($p));$wpdb->after_mutation=null;check_db(is_wp_error($r)&&escomi_official_facts_snapshot(1)===$before,$field.' SQL successful write corrupted before readback rolls back exactly');
}
echo "PASS extended InnoDB foundation: $passed assertions; WordPress API boundary shims\n";
