<?php
/** Execute the real dedicated transaction/validator with in-memory WP/DB boundary shims. */
class WP_REST_Request { function __construct($method,$route){} function set_param($key,$value){} }
function rest_do_request($request) { return new WP_REST_Response(['acf'=>array_fill_keys($GLOBALS['visible_price_keys']??['price_90'],null)],200); }
require __DIR__.'/check-official-facts.php';
function foundation_payload($field, $value) {
    $p=payload(); $category=$field==='price_90'?'price':'booking';
    $p['updates']=[$field=>$value];
    $canonical=$category==='price'?'[{"durationMinutes":90,"priceYen":15000}]':'[{"kind":"line","href":"https://line.me/R/ti/p/shop"},{"kind":"reservation","href":"https://booking.example/reserve?shop=one&course=90"},{"kind":"tel","href":"tel:08012345678"}]';
    $p['canonical']=[$category=>$canonical];
    $p['provenance']=[['field'=>$category,'sourceUrl'=>'https://official.example/menu','sourceType'=>'official-site','observedAt'=>'2026-09-13','reviewedAt'=>'2026-09-13','reviewStatus'=>'reviewed','publishedValueHash'=>hash('sha256',$canonical)]];
    $audit=['source_url'=>'https://official.example/menu','checked_at'=>'2026-09-13','source_host'=>'official.example','normalized_value'=>$value,'observed_at'=>'2026-09-13','reviewed_at'=>'2026-09-13'];
    if($category==='price'){$audit['duration_minutes']=90;$audit['price_type']='EXACT_STANDARD';}
    else{$audit['booking_purpose']='reservation';$audit['linked_from_url']=$audit['source_url'];}
    $p['audit']=[$field=>$audit];return $p;
}
function reset_foundation() {
    reset_fixture();
    $GLOBALS['meta']['price_60']='9000';$GLOBALS['meta']['price_90']='14000';
    $GLOBALS['meta']['shop_line']='https://line.me/R/ti/p/shop';$GLOBALS['meta']['shop_booking']='電話 / LINE';
}
reset_foundation();$p=foundation_payload('price_90','15000');
check(!is_wp_error(escomi_official_facts_validate($p)),'price_90 accepts canonical existing string storage');
reset_foundation();$p=foundation_payload('shop_booking_url','https://booking.example/reserve?shop=one&course=90');
check(!is_wp_error(escomi_official_facts_validate($p)),'booking canonical accepts absolute reservation URL');
foreach(['price_90','shop_booking_url'] as $field){
    reset_foundation();$value=$field==='price_90'?'15000':'https://booking.example/reserve?shop=one&course=90';$p=foundation_payload($field,$value);
    $r=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($r)&&$r->data['state']==='APPLIED',$field.' transaction applies');
    check($GLOBALS['meta'][$field]===$value,$field.' exact physical string readback');
    foreach(['price_60'=>'9000','shop_line'=>'https://line.me/R/ti/p/shop','shop_tel'=>'080-1234-5678','shop_booking'=>'電話 / LINE'] as $k=>$v)check($GLOBALS['meta'][$k]===$v,$field.' preserves '.$k);
    $again=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($again)&&$again->data['state']==='NOOP',$field.' idempotency');
    $rollback=['batch_id'=>$p['batch_id'],'wp_id'=>1,'slug'=>'shop-one','receipt'=>$r->data['receipt']];
    $back=escomi_official_facts_rollback(new FixtureRequest($rollback));check(!is_wp_error($back)&&escomi_official_facts_snapshot(1)===$p['expected'],$field.' exact rollback including absence');
    reset_foundation();$p=foundation_payload($field,$value);$GLOBALS['meta'][$field]='changed';$r=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($r)&&$r->code==='snapshot_conflict'&&count($GLOBALS['writes'])===0,$field.' stale value rejected without write');
    reset_foundation();$p=foundation_payload($field,$value);$GLOBALS['fail_key']='shop_fact_provenance';$before=$GLOBALS['meta'];$r=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($r)&&$GLOBALS['meta']===$before,$field.' midway error atomically rolled back');
    reset_foundation();$p=foundation_payload($field,$value);$p['canonical'][$field==='price_90'?'price':'booking']='[]';$p['provenance'][0]['publishedValueHash']=hash('sha256','[]');$r=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($r)&&count($GLOBALS['writes'])===0,$field.' rejects proper hash over incorrect aggregate');
    foreach(['source_host'=>'other.example','normalized_value'=>'different','observed_at'=>'2026-09-12','reviewed_at'=>'2099-01-01'] as $k=>$bad){reset_foundation();$p=foundation_payload($field,$value);$p['audit'][$field][$k]=$bad;check(is_wp_error(escomi_official_facts_validate($p)),$field.' rejects inconsistent audit '.$k);}
}
foreach(['',null,15000,0,-1,'0','-500','15000円','15,000','90分 15000円','120分 15000','15000〜','15000.0','1e5','<b>15000</b>',str_repeat('9',5001)] as $bad){reset_foundation();$p=foundation_payload('price_90',$bad);check(is_wp_error(escomi_official_facts_validate($p)),'invalid price rejected');}
foreach(['javascript:alert(1)','data:text/html,x','tel:123','mailto:x@example.com','/reserve','https://lin.ee/abc','https://line.me/R/ti/p/a','https://liff.line.me/a','https://user:pass@example.com/reserve','https://127.0.0.1/reserve','https://booking.example/r%0a','https://booking.example/reserve#x',''] as $bad){reset_foundation();$p=foundation_payload('shop_booking_url',$bad);check(is_wp_error(escomi_official_facts_validate($p)),'invalid booking URL rejected');}
reset_foundation();$p=foundation_payload('price_90','15000');$p['audit']['price_90']['duration_minutes']=120;check(is_wp_error(escomi_official_facts_validate($p)),'wrong duration evidence rejected');
$p=foundation_payload('price_90','15000');$p['audit']['price_90']['price_type']='CAMPAIGN';check(is_wp_error(escomi_official_facts_validate($p)),'campaign evidence rejected');
$p=foundation_payload('shop_booking_url','https://booking.example/reserve');$p['audit']['shop_booking_url']['booking_purpose']='contact';check(is_wp_error(escomi_official_facts_validate($p)),'contact evidence rejected');
foreach(['booking_url','reservation_url','shop_reservation_url','price_120','arbitrary_meta'] as $field){$p=foundation_payload($field,'15000');check(is_wp_error(escomi_official_facts_validate($p)),'canonical-only write target rejects '.$field);}
echo "PASS price / booking writer: $passed cumulative assertions; fixture only\n";

// Existing signed receipts serialize snapshots in this deployed read-key order.
$legacy_keys=['official_url','basic_price','shop_hours','shop_address','shop_tel','shop_line','shop_booking','shop_holiday','shop_price_60min','price_50','price_60','price_70','price_80','price_90','price_120','price_150','shop_station','nearest_station','station','shop_access','shop_booking_url','booking_url','reservation_url','shop_reservation_url','shop_fact_provenance'];
reset_fixture();$p=payload();$before=$p['expected'];$before['fields']=array_replace(array_fill_keys($legacy_keys,null),$before['fields']);
check(escomi_official_facts_snapshot_shape($before,1,'shop-one'),'pre-foundation signed receipt snapshot remains accepted');

foreach(['price_90'=>'15000','shop_booking_url'=>'https://booking.example/reserve?shop=one&course=90'] as $field=>$value){
 reset_foundation();$p=foundation_payload($field,$value);$before=$GLOBALS['meta'];$GLOBALS['corrupt_key']=$field;
 $r=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($r)&&$GLOBALS['meta']===$before,$field.' successful mutation but divergent readback is rolled back');
}
reset_foundation();$p=foundation_payload('price_90','15000');$GLOBALS['visible_price_keys']=['price_60','price_90'];
$r=escomi_official_facts_apply(new FixtureRequest($p));check(is_wp_error($r)&&count($GLOBALS['writes'])===0,'newly visible other duration requires full public aggregate');
$p['canonical']['price']='[{"durationMinutes":60,"priceYen":9000},{"durationMinutes":90,"priceYen":15000}]';$p['provenance'][0]['publishedValueHash']=hash('sha256',$p['canonical']['price']);
$r=escomi_official_facts_apply(new FixtureRequest($p));check(!is_wp_error($r),'publicly exposed other durations retained in aggregate');unset($GLOBALS['visible_price_keys']);
echo "PASS extended price-booking contracts: $passed\n";
