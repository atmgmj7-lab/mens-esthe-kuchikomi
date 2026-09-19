<?php
/** Dedicated static facts writer. Existing daily update route is independent. */
if (!defined('ABSPATH')) { exit; }
require_once __DIR__.'/official-facts-projection.php';

function escomi_official_facts_fields() {
    return array('official_url','basic_price','shop_hours','shop_address','shop_tel','shop_line','shop_booking','shop_holiday','price_90','shop_booking_url');
}

function escomi_official_facts_read_keys() {
    // Preserve deployed snapshot key order so existing signed rollback receipts remain valid.
    // Lock all public hash contributors, including unchanged fallback fields.
    return array_values(array_unique(array_merge(array('official_url','basic_price','shop_hours','shop_address','shop_tel','shop_line','shop_booking','shop_holiday'), array(
        'shop_price_60min','price_50','price_60','price_70','price_80','price_90','price_120','price_150',
        'shop_station','nearest_station','station','shop_access','shop_booking_url','booking_url',
        'reservation_url','shop_reservation_url','shop_fact_provenance'
    ))));
}

function escomi_official_facts_error($code, $status=400) {
    return new WP_Error($code, 'Official facts request rejected', array('status'=>$status));
}

function escomi_official_facts_category($field) {
    $map=array('official_url'=>'official','shop_hours'=>'hours','shop_address'=>'access','shop_tel'=>'booking','shop_line'=>'booking','price_90'=>'price','shop_booking_url'=>'booking');
    // basic_price is not an explicit course in the existing reader's price hash.
    return $map[$field] ?? null;
}

function escomi_official_facts_date($value) {
    if (!is_string($value) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) { return false; }
    // Evidence dates use the WordPress site's calendar (Asia/Tokyo here).
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]) && $value <= current_time('Y-m-d');
}

function escomi_official_facts_url($value) {
    if (!is_string($value) || preg_match('/[\x00-\x20\x7f]/', $value)) { return false; }
    $parts=parse_url($value);
    if (!$parts || !in_array($parts['scheme'] ?? '', array('https','http'), true) || empty($parts['host'])
        || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
        || (isset($parts['port']) && !in_array($parts['port'],array(80,443),true))) { return false; }
    return (bool)wp_http_validate_url($value);
}

/** The writer validates syntax; upstream reviewed evidence establishes reservation purpose. */
function escomi_official_facts_booking_url($value) {
    if (!is_string($value) || strlen($value)>2048 || preg_match('/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i',$value)) { return false; }
    $url=escomi_official_projection_url($value);
    if ($url===false || $url==='' || $url!==$value || !wp_http_validate_url($value)) { return false; }
    $host=parse_url($value,PHP_URL_HOST);
    foreach (array('line.me','lin.ee','line.naver.jp','line-apps.com') as $denied) {
        if ($host===$denied || str_ends_with($host,'.'.$denied)) { return false; }
    }
    return true;
}

function escomi_official_facts_target_audit($field,$value,$audit) {
    $keys=array('source_url','checked_at','source_host','normalized_value','observed_at','reviewed_at');
    $keys=array_merge($keys,$field==='price_90'?array('duration_minutes','price_type'):array('booking_purpose','linked_from_url'));
    if (!is_array($audit) || array_diff(array_keys($audit),$keys) || array_diff($keys,array_keys($audit))
        || !escomi_official_facts_url($audit['source_url'])
        || $audit['source_host']!==parse_url($audit['source_url'],PHP_URL_HOST)
        || $audit['normalized_value']!==$value
        || !escomi_official_facts_date($audit['observed_at']) || !escomi_official_facts_date($audit['reviewed_at'])
        || $audit['checked_at']!==$audit['observed_at'] || $audit['observed_at']>$audit['reviewed_at']) { return false; }
    return $field==='price_90'
        ? $audit['duration_minutes']===90 && $audit['price_type']==='EXACT_STANDARD'
        : $audit['booking_purpose']==='reservation' && $audit['linked_from_url']===$audit['source_url'];
}

/** ACF initializes per REST route: a real internal view request is required.
 * Only visibility is used, never the possibly cached values. Raw CAS remains full.
 */
function escomi_official_facts_public_price_keys($id) {
    $request=new WP_REST_Request('GET','/wp/v2/shop/'.(int)$id);
    $request->set_param('context','view');
    $response=rest_do_request($request);
    if (is_wp_error($response) || $response->get_status()!==200) { return false; }
    $data=$response->get_data();
    if (!is_array($data) || !isset($data['acf']) || !is_array($data['acf']) || !array_key_exists('price_90',$data['acf'])) { return false; }
    return array_keys($data['acf']);
}

function escomi_official_facts_snapshot($id) {
    global $wpdb;
    $post=$wpdb->get_row($wpdb->prepare("SELECT ID,post_name,post_status,post_type FROM {$wpdb->posts} WHERE ID=%d",$id));
    if (!$post || $post->post_type !== 'shop' || $post->post_status !== 'publish') { return escomi_official_facts_error('invalid_shop',409); }
    // Read taxonomy from SQL, not a potentially cached WP_Term_Query result.
    $area=$wpdb->get_col($wpdb->prepare("SELECT tt.term_id FROM {$wpdb->term_relationships} tr INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id=tr.term_taxonomy_id WHERE tr.object_id=%d AND tt.taxonomy='area' ORDER BY tt.term_id",$id));
    if (!is_array($area) || $wpdb->last_error) { return escomi_official_facts_error('area_read_failed',503); }
    $area=array_map('intval',$area); sort($area);
    $keys=escomi_official_facts_read_keys();
    $sql="SELECT meta_key,meta_value FROM {$wpdb->postmeta} WHERE post_id=%d AND meta_key IN (".implode(',',array_fill(0,count($keys),'%s')).") ORDER BY meta_id";
    $records=$wpdb->get_results($wpdb->prepare($sql,$id,...$keys));
    if (!is_array($records) || $wpdb->last_error) { return escomi_official_facts_error('meta_read_failed',503); }
    $all=array(); foreach ($records as $record) { $all[$record->meta_key][]=maybe_unserialize($record->meta_value); }
    $fields=array();
    foreach ($keys as $key) {
        $values=$all[$key] ?? array();
        if (count($values)>1) { return escomi_official_facts_error('duplicate_meta',409); }
        $fields[$key]=array('exists'=>count($values)===1,'value'=>$values[0] ?? null);
    }
    return array('wp_id'=>(int)$id,'slug'=>$post->post_name,'status'=>$post->post_status,'area'=>$area,'fields'=>$fields);
}

/** Transaction-internal writes bypass metadata cache/hook publication until COMMIT. */
function escomi_official_facts_store($id,$key,$value,$exists) {
    global $wpdb;
    $record=array('meta_value'=>maybe_serialize($value));
    $result=$exists ? $wpdb->update($wpdb->postmeta,$record,array('post_id'=>$id,'meta_key'=>$key))
        : $wpdb->insert($wpdb->postmeta,array('post_id'=>$id,'meta_key'=>$key,'meta_value'=>$record['meta_value']));
    if ($result===false) { throw new RuntimeException(); }
}

function escomi_official_facts_publish_hooks($id,$fields,$before) {
    try {
        clean_post_cache($id); wp_cache_delete($id,'post_meta');
        // Do not impersonate WP metadata notifications with a nonexistent meta_id.
        // The dedicated event is emitted only after COMMIT, with field names only.
        do_action('escomi_official_facts_committed',$id,array_keys($fields));
        return true;
    } catch (Throwable $error) {
        // A post-commit listener cannot erase the successful response/receipt.
        return false;
    }
}

function escomi_official_facts_snapshot_shape($snapshot,$id,$slug) {
    if (!is_array($snapshot) || array_keys($snapshot)!==array('wp_id','slug','status','area','fields')
        || $snapshot['wp_id']!==$id || $snapshot['slug']!==$slug || $snapshot['status']!=='publish'
        || !is_array($snapshot['area']) || !is_array($snapshot['fields'])
        || array_keys($snapshot['fields'])!==escomi_official_facts_read_keys()) { return false; }
    foreach ($snapshot['area'] as $area) { if (!is_int($area) || $area<1) { return false; } }
    foreach ($snapshot['fields'] as $field) {
        if (!is_array($field) || array_keys($field)!==array('exists','value') || !is_bool($field['exists'])
            || (!$field['exists'] && $field['value']!==null)) { return false; }
    }
    return true;
}

function escomi_official_facts_receipt($data,$before,$after) {
    $payload=array('version'=>1,'batch_id'=>$data['batch_id'],'wp_id'=>$data['wp_id'],'slug'=>$data['slug'],
        'before'=>$before,'after'=>$after,'touched'=>array_merge(array_keys($data['updates']),array('shop_fact_provenance')),
        'issued_at'=>current_time('mysql',true));
    $encoded=wp_json_encode($payload);
    if (!is_string($encoded)) { throw new RuntimeException(); }
    return array('payload'=>$payload,'signature'=>hash_hmac('sha256',$encoded,wp_salt('auth')));
}

function escomi_official_facts_permission($request) {
    $data=$request->get_json_params();
    $id=$request->get_method()==='GET' ? $request->get_param('id') : ($data['wp_id'] ?? 0);
    $user=wp_get_current_user();
    if (!is_numeric($id) || (int)$id<1 || empty($user->caps['manage_shop_public_meta'])
        || !escomi_shop_public_meta_auth(false,'shop_fact_provenance',(int)$id)) {
        return escomi_official_facts_error('official_facts_forbidden',403);
    }
    return true;
}

function escomi_official_facts_validate($data) {
    $keys=array('batch_id','wp_id','slug','expected','updates','provenance','canonical','audit');
    if (!is_array($data) || array_diff(array_keys($data),$keys) || array_diff($keys,array_keys($data))) { return escomi_official_facts_error('invalid_envelope'); }
    if (!is_int($data['wp_id']) || $data['wp_id']<1 || !is_string($data['slug']) || !$data['slug']
        || !is_string($data['batch_id']) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/',$data['batch_id'])) { return escomi_official_facts_error('invalid_identity'); }
    foreach (array('expected','updates','provenance','canonical','audit') as $key) {
        if (!is_array($data[$key])) { return escomi_official_facts_error('invalid_'.$key); }
    }
    if (!$data['updates'] || count($data['updates'])>10 || array_diff(array_keys($data['updates']),escomi_official_facts_fields())
        || array_diff(array_keys($data['audit']),array_keys($data['updates'])) || array_diff(array_keys($data['updates']),array_keys($data['audit']))) { return escomi_official_facts_error('unknown_field'); }
    $required=array();
    foreach ($data['updates'] as $key=>$value) {
        if ($key==='price_90') {
            // ACF number metadata is stored as decimal strings; do not coerce input.
            if (!is_string($value) || !preg_match('/^[1-9][0-9]{0,6}$/D',$value)) { return escomi_official_facts_error('invalid_price_90'); }
        } elseif ($key==='basic_price') {
            if (!is_int($value) || $value<=0) { return escomi_official_facts_error('invalid_price'); }
        } elseif (!is_string($value) || trim($value)==='' || strlen($value)>5000
            || in_array(strtolower(trim($value)),array('null','unknown','undefined'),true)
            || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/',$value)
            || sanitize_textarea_field($value)!==$value) { return escomi_official_facts_error('invalid_value'); }
        if (in_array($key,array('official_url','shop_line'),true) && !escomi_official_facts_url($value)) { return escomi_official_facts_error('invalid_url_value'); }
        if ($key==='shop_booking_url' && !escomi_official_facts_booking_url($value)) { return escomi_official_facts_error('invalid_booking_url'); }
        $audit=$data['audit'][$key];
        if (in_array($key,array('price_90','shop_booking_url'),true)) {
            if (!escomi_official_facts_target_audit($key,$value,$audit)) { return escomi_official_facts_error('invalid_target_audit'); }
        } elseif (!is_array($audit) || array_diff(array_keys($audit),array('source_url','checked_at'))
            || !escomi_official_facts_url($audit['source_url'] ?? null) || !escomi_official_facts_date($audit['checked_at'] ?? null)) { return escomi_official_facts_error('invalid_audit'); }
        $category=escomi_official_facts_category($key);
        if ($category) { $required[$category]=true; }
    }
    if (array_diff(array_keys($data['canonical']),array_keys($required)) || array_diff(array_keys($required),array_keys($data['canonical']))) { return escomi_official_facts_error('invalid_categories'); }
    $sanitized=escomi_sanitize_shop_fact_provenance($data['provenance']);
    if ($sanitized !== $data['provenance']) { return escomi_official_facts_error('invalid_provenance'); }
    $by_field=array();
    foreach ($data['provenance'] as $record) {
        if (!is_array($record) || !isset($record['field']) || isset($by_field[$record['field']])) { return escomi_official_facts_error('duplicate_provenance'); }
        $by_field[$record['field']]=$record;
    }
    foreach ($required as $category=>$_) {
        $canonical=$data['canonical'][$category]; $record=$by_field[$category] ?? null;
        if (!is_string($canonical) || strlen($canonical)>40000 || !is_array($record)
            || !isset($record['publishedValueHash']) || !is_string($record['publishedValueHash'])
            || !hash_equals(hash('sha256',$canonical),$record['publishedValueHash'])
            || ($record['reviewStatus'] ?? '')!=='reviewed' || ($record['sourceType'] ?? '')!=='official-site'
            || !escomi_official_facts_date($record['observedAt'] ?? null) || !escomi_official_facts_date($record['reviewedAt'] ?? null)
            || $record['observedAt']>$record['reviewedAt']) { return escomi_official_facts_error('provenance_hash_or_date'); }
        foreach ($data['updates'] as $field=>$value) {
            if (escomi_official_facts_category($field)===$category
                && ($data['audit'][$field]['source_url']!==$record['sourceUrl'] || $data['audit'][$field]['checked_at']!==$record['observedAt']
                    || (isset($data['audit'][$field]['reviewed_at']) && $data['audit'][$field]['reviewed_at']!==$record['reviewedAt']))) { return escomi_official_facts_error('provenance_source_mismatch'); }
        }
    }
    return $data;
}

/** One shop transaction; caller batch stops at first failure and never retries POST. */
function escomi_official_facts_apply($request) {
    global $wpdb;
    $permission=escomi_official_facts_permission($request);
    if (is_wp_error($permission)) { return $permission; }
    if (strlen($request->get_body())>262144) { return escomi_official_facts_error('payload_too_large',413); }
    $data=escomi_official_facts_validate($request->get_json_params());
    if (is_wp_error($data)) { return $data; }
    $id=$data['wp_id'];
    $public_price_keys=isset($data['canonical']['price'])?escomi_official_facts_public_price_keys($id):array();
    if ($public_price_keys===false) { return escomi_official_facts_error('public_price_projection_unavailable',503); }
    if (!escomi_official_facts_snapshot_shape($data['expected'],$id,$data['slug'])) { return escomi_official_facts_error('invalid_expected_snapshot'); }
    $engines=$wpdb->get_col($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (%s,%s,%s,%s)',$wpdb->posts,$wpdb->postmeta,$wpdb->term_relationships,$wpdb->term_taxonomy));
    if (count($engines)!==4 || array_filter($engines,function($engine){return strtolower($engine)!=='innodb';})) { return escomi_official_facts_error('transaction_engine_unavailable',503); }
    $previous_errors=$wpdb->suppress_errors(true);
    $started=false;
    try {
        // Next transaction only: gap locks must hold even on READ COMMITTED sessions.
        if ($wpdb->query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')===false) { throw new RuntimeException(); }
        if ($wpdb->query('START TRANSACTION')===false) { throw new RuntimeException(); }
        $started=true;
        // InnoDB row/range locks coordinate with normal WP metadata updates too.
        foreach (array(
            $wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT object_id FROM {$wpdb->term_relationships} WHERE object_id=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT tt.term_taxonomy_id FROM {$wpdb->term_taxonomy} tt INNER JOIN {$wpdb->term_relationships} tr ON tr.term_taxonomy_id=tt.term_taxonomy_id WHERE tr.object_id=%d FOR UPDATE",$id)
        ) as $query) { if ($wpdb->query($query)===false) { throw new RuntimeException(); } }
        $current=escomi_official_facts_snapshot($id);
        if (is_wp_error($current) || $current['slug']!==$data['slug']) { $wpdb->query('ROLLBACK'); $started=false; return escomi_official_facts_error('identity_conflict',409); }
        $desired=$data['expected'];
        if (!isset($desired['fields']) || !is_array($desired['fields'])) { throw new RuntimeException(); }
        foreach ($data['updates'] as $key=>$value) { $desired['fields'][$key]=array('exists'=>true,'value'=>(string)$value); }
        $desired['fields']['shop_fact_provenance']=array('exists'=>true,'value'=>$data['provenance']);
        $desired_acf=array(); foreach ($desired['fields'] as $field=>$state) { $desired_acf[$field]=$state['exists']?$state['value']:null; }
        foreach ($data['canonical'] as $category=>$canonical) {
            $public_acf=$desired_acf;
            if ($category==='price') {
                foreach (array('price_50','price_60','price_70','price_80','price_90','price_120','price_150') as $field) {
                    if (!in_array($field,$public_price_keys,true)) { unset($public_acf[$field]); }
                }
            }
            if (!escomi_official_verify_projection($category,$public_acf,$canonical)) {
                $wpdb->query('ROLLBACK'); $started=false; return escomi_official_facts_error('canonical_projection_mismatch',409);
            }
        }
        if ($current===$desired) { $wpdb->query('ROLLBACK'); $started=false; return new WP_REST_Response(array('state'=>'NOOP','wp_id'=>$id,'slug'=>$data['slug'],'batch_id'=>$data['batch_id']),200); }
        if ($current!==$data['expected']) { $wpdb->query('ROLLBACK'); $started=false; return escomi_official_facts_error('snapshot_conflict',409); }
        // Keep every unrelated provenance category byte-for-byte at PHP value level.
        $before=$current['fields']['shop_fact_provenance']['value'] ?? array();
        if (!is_array($before)) { throw new RuntimeException(); }
        $after=array(); foreach ($data['provenance'] as $record) { $after[$record['field']]=$record; }
        foreach ($before as $record) {
            if (!is_array($record) || !isset($record['field'])) { throw new RuntimeException(); }
            if (!isset($data['canonical'][$record['field']]) && ($after[$record['field']] ?? null)!==$record) { throw new RuntimeException(); }
            unset($after[$record['field']]);
        }
        if (array_diff(array_keys($after),array_keys($data['canonical']))) { throw new RuntimeException(); }
        foreach ($data['updates'] as $key=>$value) {
            escomi_official_facts_store($id,$key,(string)$value,$current['fields'][$key]['exists']);
        }
        escomi_official_facts_store($id,'shop_fact_provenance',$data['provenance'],$current['fields']['shop_fact_provenance']['exists']);
        if (escomi_official_facts_snapshot($id)!==$desired) { throw new RuntimeException(); }
        $receipt=escomi_official_facts_receipt($data,$current,$desired);
        if ($wpdb->query('COMMIT')===false) { throw new RuntimeException(); }
        $started=false;
        $cache_published=escomi_official_facts_publish_hooks($id,array_merge($data['updates'],array('shop_fact_provenance'=>$data['provenance'])),$current);
        return new WP_REST_Response(array('state'=>'APPLIED','wp_id'=>$id,'slug'=>$data['slug'],'batch_id'=>$data['batch_id'],'snapshot'=>$desired,'receipt'=>$receipt,'cache_published'=>$cache_published),200);
    } catch (Throwable $error) {
        if ($started) { $wpdb->query('ROLLBACK'); }
        clean_post_cache($id); wp_cache_delete($id,'post_meta');
        // Never expose DB error, raw payload, headers, credentials or exception text.
        return escomi_official_facts_error('official_facts_transaction_failed',503);
    } finally { $wpdb->suppress_errors($previous_errors); }
}

/** Compensating restore, exclusively from a server-signed exact before/after receipt. */
function escomi_official_facts_rollback($request) {
    global $wpdb;
    $permission=escomi_official_facts_permission($request);
    if (is_wp_error($permission)) { return $permission; }
    if (strlen($request->get_body())>262144) { return escomi_official_facts_error('payload_too_large',413); }
    $data=$request->get_json_params();
    if (!is_array($data) || array_keys($data)!==array('batch_id','wp_id','slug','receipt') || !is_array($data['receipt'])
        || array_keys($data['receipt'])!==array('payload','signature') || !is_array($data['receipt']['payload'])
        || !is_string($data['receipt']['signature']) || !preg_match('/^[a-f0-9]{64}$/D',$data['receipt']['signature'])) { return escomi_official_facts_error('invalid_rollback_receipt'); }
    $receipt=$data['receipt']; $payload=$receipt['payload'];
    $encoded=wp_json_encode($payload);
    if (!is_string($encoded) || !hash_equals(hash_hmac('sha256',$encoded,wp_salt('auth')),$receipt['signature'])
        || array_keys($payload)!==array('version','batch_id','wp_id','slug','before','after','touched','issued_at')
        || $payload['version']!==1 || $payload['batch_id']!==$data['batch_id'] || $payload['wp_id']!==$data['wp_id'] || $payload['slug']!==$data['slug']
        || !is_int($data['wp_id']) || $data['wp_id']<1 || !is_string($data['slug'])
        || !escomi_official_facts_snapshot_shape($payload['before'],$data['wp_id'],$data['slug'])
        || !escomi_official_facts_snapshot_shape($payload['after'],$data['wp_id'],$data['slug'])
        || !is_array($payload['touched']) || !$payload['touched']
        || count($payload['touched'])!==count(array_unique($payload['touched']))
        || array_diff($payload['touched'],array_merge(escomi_official_facts_fields(),array('shop_fact_provenance')))) { return escomi_official_facts_error('invalid_rollback_receipt'); }
    $id=$data['wp_id'];
    $engines=$wpdb->get_col($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (%s,%s,%s,%s)',$wpdb->posts,$wpdb->postmeta,$wpdb->term_relationships,$wpdb->term_taxonomy));
    if (count($engines)!==4 || array_filter($engines,function($engine){return strtolower($engine)!=='innodb';})) { return escomi_official_facts_error('transaction_engine_unavailable',503); }
    $previous_errors=$wpdb->suppress_errors(true); $started=false;
    try {
        // Next transaction only: gap locks must hold even on READ COMMITTED sessions.
        if ($wpdb->query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')===false) { throw new RuntimeException(); }
        if ($wpdb->query('START TRANSACTION')===false) { throw new RuntimeException(); } $started=true;
        foreach (array(
            $wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE ID=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT meta_id FROM {$wpdb->postmeta} WHERE post_id=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT object_id FROM {$wpdb->term_relationships} WHERE object_id=%d FOR UPDATE",$id),
            $wpdb->prepare("SELECT tt.term_taxonomy_id FROM {$wpdb->term_taxonomy} tt INNER JOIN {$wpdb->term_relationships} tr ON tr.term_taxonomy_id=tt.term_taxonomy_id WHERE tr.object_id=%d FOR UPDATE",$id)
        ) as $query) { if ($wpdb->query($query)===false) { throw new RuntimeException(); } }
        $current=escomi_official_facts_snapshot($id);
        if (is_wp_error($current) || $current['slug']!==$data['slug']) { $wpdb->query('ROLLBACK'); $started=false; return escomi_official_facts_error('identity_conflict',409); }
        if ($current===$payload['before']) { $wpdb->query('ROLLBACK'); $started=false; return new WP_REST_Response(array('state'=>'NOOP','wp_id'=>$id,'batch_id'=>$data['batch_id']),200); }
        if ($current!==$payload['after']) { $wpdb->query('ROLLBACK'); $started=false; return escomi_official_facts_error('rollback_snapshot_conflict',409); }
        foreach ($payload['touched'] as $key) {
            $old=$payload['before']['fields'][$key];
            if ($old['exists']) { escomi_official_facts_store($id,$key,$old['value'],$current['fields'][$key]['exists']); }
            elseif ($wpdb->delete($wpdb->postmeta,array('post_id'=>$id,'meta_key'=>$key))===false) { throw new RuntimeException(); }
        }
        if (escomi_official_facts_snapshot($id)!==$payload['before']) { throw new RuntimeException(); }
        if ($wpdb->query('COMMIT')===false) { throw new RuntimeException(); } $started=false;
        $cache_published=escomi_official_facts_publish_hooks($id,array_fill_keys($payload['touched'],true),$current);
        return new WP_REST_Response(array('state'=>'ROLLED_BACK','wp_id'=>$id,'slug'=>$data['slug'],'batch_id'=>$data['batch_id'],'snapshot'=>$payload['before'],'cache_published'=>$cache_published),200);
    } catch (Throwable $error) {
        if ($started) { $wpdb->query('ROLLBACK'); }
        clean_post_cache($id); wp_cache_delete($id,'post_meta');
        return escomi_official_facts_error('official_facts_rollback_failed',503);
    } finally { $wpdb->suppress_errors($previous_errors); }
}

add_action('rest_api_init',function(){
    register_rest_route('escomi/v1','/official-facts/rollback',array('methods'=>'POST','callback'=>'escomi_official_facts_rollback','permission_callback'=>'escomi_official_facts_permission'));
    register_rest_route('escomi/v1','/official-facts',array('methods'=>'POST','callback'=>'escomi_official_facts_apply','permission_callback'=>'escomi_official_facts_permission'));
    register_rest_route('escomi/v1','/official-facts/(?P<id>\d+)',array('methods'=>'GET','permission_callback'=>'escomi_official_facts_permission','callback'=>function($request){
        $snapshot=escomi_official_facts_snapshot((int)$request->get_param('id'));
        if (is_wp_error($snapshot)) { return $snapshot; }
        $response=new WP_REST_Response($snapshot,200); $response->header('Cache-Control','no-store'); return $response;
    }));
});
