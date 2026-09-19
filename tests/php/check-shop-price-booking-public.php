<?php
declare(strict_types=1);
define('ABSPATH', __DIR__);
class WP_Post { public $ID = 1; }
class WP_REST_Response { private $data; function __construct($data){$this->data=$data;} function get_data(){return $this->data;} function set_data($data){$this->data=$data;} }
function add_filter(...$args) { $GLOBALS['filters'][]=$args; }
function get_post_meta($id,$key,$single){$GLOBALS['reads'][]=$key;return $GLOBALS['meta'][$key]??'';}
function expect($ok,$message){if(!$ok){fwrite(STDERR,"FAIL: $message\n");exit(1);}}
$path=__DIR__.'/../../shop-price-booking-public.php';
expect(file_exists($path),'price_90 and booking public projection absent');
require $path;
foreach (array('14000',14000,'',null,false,'-1','90分 14000円','<b>14000</b>',array('secret')) as $value) {
 $GLOBALS['meta']=array('price_90'=>$value,'shop_booking_url'=>'https://book.example.test/reserve?a=1&b=2','private_key'=>'secret');
 $GLOBALS['reads']=array();
 $response=escomi_prepare_shop_price_booking_public(new WP_REST_Response(array('acf'=>array('shop_booking'=>'完全予約制','shop_line'=>'keep'))),new WP_Post());
 $acf=$response->get_data()['acf'];
 expect($acf['price_90']===((is_string($value)&&$value==='14000')||$value===14000?'14000':null),'price normalized safely');
 expect($acf['shop_booking_url']==='https://book.example.test/reserve?a=1&b=2','URL exact readback');
 expect($acf['shop_booking']==='完全予約制'&&$acf['shop_line']==='keep','existing ACF untouched');
 expect($GLOBALS['reads']===array('price_90','shop_booking_url'),'only two keys read');
}
foreach(array('',null,'javascript:alert(1)','data:x','tel:123','mailto:x@y.com','/relative','https://user:pass@example.test','https://example.test/ bad') as $url){expect(escomi_public_shop_booking_url($url)===null,'invalid URL suppressed');}
$artifact=json_decode(file_get_contents(__DIR__.'/../../docs/schema/shop-booking-url-field.json'),true);
expect($artifact['name']==='shop_booking_url'&&$artifact['type']==='url'&&$artifact['required']===0,'canonical optional URL schema artifact');
expect($artifact['parent']==='group_6961cc89d86dc','existing DB group target');
expect(function_exists('escomi_shop_price_booking_rest_schema'),'OPTIONS schema projection absent');
$GLOBALS['wp_rest_additional_fields']=['shop'=>['acf'=>['schema'=>['type'=>'object','properties'=>['official_url'=>['type'=>'string']]],'get_callback'=>'existing_get','update_callback'=>'existing_update']]];
function register_rest_field($type,$field,$args){$GLOBALS['wp_rest_additional_fields'][$type][$field]=$args;}
class SchemaRequest { function get_route(){return '/wp/v2/shop/1';} }
escomi_shop_price_booking_rest_schema(null,null,new SchemaRequest());
$registration=$GLOBALS['wp_rest_additional_fields']['shop']['acf'];
expect($registration['get_callback']==='existing_get'&&$registration['update_callback']==='existing_update','ACF callbacks untouched');
expect($registration['schema']['properties']['official_url']===['type'=>'string'],'existing schema unchanged');
foreach(['price_90','shop_booking_url'] as $field){expect($registration['schema']['properties'][$field]['readonly']===true&&$registration['schema']['properties'][$field]['type']===['string','null'],'narrow nullable read-only schema');}
expect(count($registration['schema']['properties'])===3,'only intended schema properties added');
echo "PASS shop price and booking public projection/schema\n";
expect(function_exists('escomi_shop_price_booking_native_write_guard'),'native REST target-field write guard absent');
class WP_Error { public $code; function __construct($code,...$rest){$this->code=$code;} }
class WriteRequest { private $method;private $acf;function __construct($method,$acf){$this->method=$method;$this->acf=$acf;}function get_route(){return '/wp/v2/shop/1';}function get_method(){return $this->method;}function get_param($key){return $key==='acf'?$this->acf:null;} }
foreach(['POST','PUT','PATCH'] as $method){foreach(['price_90','shop_booking_url'] as $key){$r=escomi_shop_price_booking_native_write_guard(null,null,new WriteRequest($method,[$key=>null]));expect($r instanceof WP_Error&&$r->code==='dedicated_official_facts_writer_required','native target write rejected even empty');}expect(escomi_shop_price_booking_native_write_guard(null,null,new WriteRequest($method,['shop_hours'=>'11:00']))===null,'unrelated native ACF write unchanged');}
foreach(['GET','HEAD','OPTIONS'] as $method){expect(escomi_shop_price_booking_native_write_guard(null,null,new WriteRequest($method,['price_90'=>'15000']))===null,'read requests unaffected');}
echo "PASS native REST target-field write guard\n";
foreach(['field_696fcb4e89be6','field_escomi_shop_booking_url_v1'] as $key){expect(escomi_shop_price_booking_native_write_guard(null,null,new WriteRequest('POST',[$key=>'15000'])) instanceof WP_Error,'native field-key bypass rejected');expect(escomi_shop_price_booking_native_write_guard(null,null,new WriteRequest('POST',['alias'=>'15000','_acf_field_key_map'=>['alias'=>$key]])) instanceof WP_Error,'ACF field-key mapping bypass rejected');}
echo "PASS native ACF key-map bypass guard\n";
