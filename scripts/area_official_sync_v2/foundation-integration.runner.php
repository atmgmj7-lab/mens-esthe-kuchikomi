<?php
// Entire WordPress/DB boundary is local fixture code. No network or credentials.
ob_start();require __DIR__.'/../../tests/php/check-official-facts.php';ob_end_clean();
class WP_REST_Request { public $params=[]; function __construct($method,$route){} function set_param($key,$value){$this->params[$key]=$value;} }
function rest_do_request($request){return new WP_REST_Response(['acf'=>['price_90'=>$GLOBALS['meta']['price_90']??null]],200);}
reset_fixture();
$GLOBALS['meta']['price_60']='9000';
$GLOBALS['meta']['price_90']='14000';
$GLOBALS['meta']['shop_line']='https://line.me/R/ti/p/shop';
$GLOBALS['meta']['shop_booking']='電話 / LINE';
if (($argv[1]??'')==='snapshot') { echo json_encode(escomi_official_facts_snapshot(1));exit; }
$p=json_decode(stream_get_contents(STDIN),true);
$r=escomi_official_facts_apply(new FixtureRequest($p));
echo json_encode(is_wp_error($r)?['error'=>$r->code,'writes'=>$GLOBALS['writes']]:$r->data);
