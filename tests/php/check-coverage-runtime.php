<?php
declare(strict_types=1);
function ensure($ok, $message) { if (!$ok) { fwrite(STDERR,"FAIL: $message\n"); exit(1); } }
$root=dirname(__DIR__,2);
ensure(is_file($root.'/coverage-batch-writer.php'),'sanitized coverage source is available');
define('ABSPATH', sys_get_temp_dir().'/coverage-combined-no-private/public_html/');
$GLOBALS['hooks']=[]; $GLOBALS['routes']=[];
function add_action($hook,$callback,...$rest) { $GLOBALS['hooks'][$hook][]=$callback; }
function add_filter(...$args) { $GLOBALS['filters'][]=$args; }
function register_rest_route($namespace,$route,$args) { $key=$namespace.$route; ensure(!isset($GLOBALS['routes'][$key]),'no duplicate route '.$key); $GLOBALS['routes'][$key]=$args; }
function register_post_type($type,$args) { $GLOBALS['post_types'][$type]=$args; }
class WP_Error { function __construct(public $code,public $message='',public $data=[]) {} }
function is_wp_error($x) { return $x instanceof WP_Error; }
function current_user_can(...$args) { return true; }
require_once $root.'/coverage-batch-writer.php';
require_once $root.'/official-facts-rest.php';
require_once $root.'/shop-price-booking-public.php';
require_once $root.'/coverage-batch-writer.php';
foreach ($GLOBALS['hooks']['rest_api_init'] as $callback) { $callback(); }
ensure(isset($GLOBALS['routes']['escomi/v1/coverage-batch']),'coverage route present');
ensure($GLOBALS['routes']['escomi/v1/coverage-batch']['permission_callback']==='escomi_coverage_permission','same capability callback');
ensure(count(array_filter($GLOBALS['hooks']['rest_api_init'],fn($x)=>$x==='escomi_coverage_register_route'))===1,'coverage hook once');
ensure(in_array('escomi_coverage_register_audit_post_type',$GLOBALS['hooks']['init'],true),'audit hook present');
escomi_coverage_register_audit_post_type();
ensure($GLOBALS['post_types']['coverage_batch_audit']['public']===false,'audit remains non-public');
ensure(count($GLOBALS['routes'])===4,'coverage plus three official-facts routes');
ensure(in_array('price_90',escomi_official_facts_fields(),true),'price allowlist retained');
ensure(in_array('shop_booking_url',escomi_official_facts_fields(),true),'booking allowlist retained');
// No coverage apply/reconcile is invoked. Missing private inputs must reject at entry.
$r=escomi_coverage_handle_request(new stdClass());
ensure(is_wp_error($r)&&$r->code==='coverage_private_unavailable','private failure precedes dispatch');
$source=file_get_contents($root.'/functions.php');
ensure(str_contains($source,"\$coverage_batch_writer = __DIR__ . '/coverage-batch-writer.php';\nif (is_readable(\$coverage_batch_writer)) {\n    require_once \$coverage_batch_writer;\n}"),'live guarded include preserved');
ensure(substr_count($source,"'/coverage-batch-writer.php'")===1,'no duplicate include');
ensure(str_contains($source,"require_once __DIR__ . '/official-facts-rest.php';"),'official include preserved');
ensure(str_contains($source,"require_once __DIR__ . '/shop-price-booking-public.php';"),'public include preserved');
echo "PASS combined runtime; routes, hooks, includes, foundations and fail-closed dispatch\n";
