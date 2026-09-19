import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProvenancePlan, productionProjection } from './provenance.mjs';
const shop=(acf={})=>({id:42,slug:'verified-shop',title:'Shop',acf,officialUrl:acf.official_url||'',contentHtml:'',imageUrl:'',media:{cardSquare:{source:'fallback',url:'',alt:''}}});
const ev=(value,sourceUrl='https://official.example/system')=>({value,sourceUrl,sourceType:'official-site',observedAt:'2026-09-13',reviewedAt:'2026-09-13',reviewStatus:'reviewed'});
const plan=(acf,updates,evidence={},existing=[])=>buildProvenancePlan({shop:shop(acf),updates,evidence,existingProvenance:existing,batchId:'batch-1',asOf:'2026-09-13'});
test('production canonical and hash use actual reader',()=>{
 const p=plan({shop_hours:'10:00〜20:00'},{shop_hours:'11:00〜21:00'},{shop_hours:ev('11:00〜21:00')});
 assert.equal(p.blocked.length,0);assert.equal(p.categories.hours.candidateCanonical,'"11:00〜21:00"');
 assert.equal(p.provenance[0].publishedValueHash,productionProjection(shop({shop_hours:'11:00〜21:00'})).hours.hash);
});
test('booking requires unchanged phone evidence when adding LINE',()=>{
 const p=plan({shop_tel:'090-1111-2222'},{shop_line:'https://lin.ee/example'},{shop_line:ev('https://lin.ee/example')});
 assert.equal(p.blocked[0].category,'booking');assert.deepEqual(p.blocked[0].missingFields,['shop_tel']);assert.equal(p.provenance.length,0);
});
test('complete phone and LINE evidence generates combined booking hash',()=>{
 const p=plan({shop_tel:'090-1111-2222'},{shop_line:'https://lin.ee/example'},{shop_line:ev('https://lin.ee/example'),shop_tel:ev('090-1111-2222')});
 assert.equal(p.blocked.length,0);assert.deepEqual(JSON.parse(p.categories.booking.candidateCanonical),[{kind:'line',href:'https://lin.ee/example'},{kind:'tel',href:'tel:09011112222'}]);
});
test('unrelated provenance entries survive byte-equivalent object preservation',()=>{
 const image={field:'image',sourceUrl:'https://official.example/image',opaque:'keep-me'};
 const p=plan({shop_hours:'10:00〜20:00'},{shop_hours:'11:00〜21:00'},{shop_hours:ev('11:00〜21:00')},[image]);assert.deepEqual(p.provenance[0],image);
});
test('access hash excludes shop_access and requires selected station and address',()=>{
 const p=plan({shop_station:'新大阪駅',shop_address:'大阪市淀川区宮原1丁目'},{shop_address:'大阪市淀川区宮原2丁目'},{shop_address:ev('大阪市淀川区宮原2丁目')});assert.deepEqual(p.blocked[0].missingFields,['shop_station']);
 const q=plan({shop_access:'徒歩5分'},{shop_access:'徒歩3分'},{shop_access:ev('徒歩3分')});assert.equal(q.provenance.length,0);assert.equal(q.privateAudit[0].field,'shop_access');
});
test('basic_price cannot claim reviewed empty course category',()=>{
 const p=plan({basic_price:10000},{basic_price:12000},{basic_price:ev(12000)});assert.equal(p.provenance.length,0);assert.equal(p.categories.price.candidateCanonical,'[]');assert.equal(p.privateAudit[0].field,'basic_price');
});
test('price needs all rendered durations, never unrelated raw primary price',()=>{
 const p=plan({price_90:15000,price_120:20000},{price_90:16000},{price_90:ev(16000)});assert.deepEqual(p.blocked[0].missingFields,['price_120']);
});
test('multiple sources cannot be collapsed into one public source record',()=>{
 const p=plan({shop_tel:'090-1111-2222'},{shop_line:'https://lin.ee/example'},{shop_line:ev('https://lin.ee/example'),shop_tel:ev('090-1111-2222','https://official.example/access')});assert.equal(p.blocked[0].reason,'MULTIPLE_CATEGORY_SOURCES');
});
test('stale evidence rejected and invalid date never reviewed',()=>{
 const p=plan({shop_hours:'10:00〜20:00'},{shop_hours:'11:00〜21:00'},{shop_hours:ev('12:00〜21:00')});assert.ok(p.blocked.length>=1);
 const q=plan({shop_hours:'10:00〜20:00'},{shop_hours:'11:00〜21:00'},{shop_hours:{...ev('11:00〜21:00'),observedAt:'2026-02-30'}});assert.ok(q.blocked.length>=1);
});
test('official URL update projects top-level override consistently',()=>{
 const p=plan({official_url:'https://old.example/'},{official_url:'https://new.example/'},{official_url:ev('https://new.example/')});assert.equal(p.categories.official.candidateCanonical,'"https://new.example/"');assert.equal(p.blocked.length,0);
});
test('private audit captures outside-category field metadata',()=>{
 const p=plan({shop_holiday:'月曜'},{shop_holiday:'火曜'},{shop_holiday:ev('火曜')});assert.deepEqual(p.privateAudit[0],{batchId:'batch-1',wp_id:42,slug:'verified-shop',field:'shop_holiday',oldValue:'月曜',newValue:'火曜',sourceUrl:'https://official.example/system',checked_at:'2026-09-13',reason:'OUTSIDE_PUBLIC_HASH'});
});
test('unchanged values yield no added provenance and missing updates rejected',()=>{
 const p=plan({shop_tel:'090-1111-2222'},{shop_tel:'090-1111-2222'});assert.equal(p.provenance.length,0);assert.equal(p.blocked.length,0);
 assert.throws(()=>plan({shop_tel:'090-1111-2222'},{shop_tel:null}),/EMPTY_UPDATE/);
});
test('private-only changed fields require exact complete source evidence',()=>{
 for(const evidence of [{},{shop_holiday:ev('水曜')},{shop_holiday:{...ev('火曜'),reviewedAt:''}}]){
  const p=plan({shop_holiday:'月曜'},{shop_holiday:'火曜'},evidence);assert.ok(p.blocked.some(x=>x.reason==='INVALID_CHANGED_FIELD_EVIDENCE'));
 }
});
test('future observation or review dates fail against explicit asOf',()=>{
 const p=buildProvenancePlan({shop:shop({shop_holiday:'月曜'}),updates:{shop_holiday:'火曜'},evidence:{shop_holiday:{...ev('火曜'),observedAt:'2026-09-14',reviewedAt:'2026-09-14'}},batchId:'batch-1',asOf:'2026-09-13'});assert.ok(p.blocked.length);
 assert.throws(()=>buildProvenancePlan({shop:shop(),updates:{},batchId:'batch-1',asOf:'invalid'}),/INVALID_AS_OF/);
});
test('unsafe source URLs cannot enter private or category provenance',()=>{
 for(const url of ['https://user:pass@example.com/','http://127.0.0.1/a','http://10.0.0.1/a','http://169.254.169.254/','http://[::1]/','http://localhost/','https://official.example/?token=secret','https://official.example/?api_key=secret','https://official.example/?Authorization=secret','https://official.example/\nsecret','http://2130706433/']){
  const p=plan({shop_holiday:'月曜'},{shop_holiday:'火曜'},{shop_holiday:ev('火曜',url)});assert.ok(p.blocked.length,url);
 }
});
test('actual raw REST normalizer feeds projection without network or real environment',async()=>{
 const {productionNormalizeShop}=await import('./provenance.mjs');
 const model=productionNormalizeShop({id:42,slug:'wp-shop',link:'https://example.com/shops/wp-shop',title:{rendered:'Shop &amp; Spa'},content:{rendered:''},excerpt:{rendered:''},acf:{shop_hours:'１１：００ ～ 翌５：００',shop_tel:'090-1111-2222',official_url:'https://official.example/'},official_url:'https://official.example/',area:[]});
 assert.equal(model.title,'Shop &amp; Spa');assert.equal(model.id,42);assert.equal(productionProjection(model).hours.canonical,'"11:00 ~ 翌5:00"');
});
test('new field audits retain constituent evidence and field-specific verified meaning',()=>{
 const acf={price_120:20000,shop_line:'https://lin.ee/example',shop_tel:'090-1111-2222'};
 const evidence={price_90:{...ev('15,000円'),duration_minutes:90,price_type:'EXACT_STANDARD'},price_120:ev(20000),shop_booking_url:{...ev('https://official.example/reserve'),booking_purpose:'reservation',linked_from_url:'https://official.example/system'},shop_line:ev(acf.shop_line),shop_tel:ev(acf.shop_tel)};
 const p=plan(acf,{price_90:'15,000円',shop_booking_url:'https://official.example/reserve'},evidence);
 assert.equal(p.blocked.length,0);
 assert.equal(p.fieldAudit.length,2);
 const audit=p.fieldAudit.find(x=>x.field==='shop_booking_url');
 assert.equal(audit.source_host,'official.example');assert.equal(audit.normalized_value,'https://official.example/reserve');
 assert.equal(audit.observed_at,'2026-09-13');assert.equal(audit.reviewed_at,'2026-09-13');
 assert.deepEqual(audit.evidence_by_field.shop_line,evidence.shop_line);assert.deepEqual(audit.evidence_by_field.shop_tel,evidence.shop_tel);
 assert.deepEqual(JSON.parse(p.categories.price.candidateCanonical),[{durationMinutes:90,priceYen:15000},{durationMinutes:120,priceYen:20000}]);
 assert.equal(JSON.parse(p.categories.booking.candidateCanonical).length,3);
 assert.equal(p.expectedShop.acf.shop_line,acf.shop_line);
});
test('new field audits reject unconfirmed price meaning and booking purpose',()=>{
 assert.ok(plan({},{price_90:15000},{price_90:ev(15000)}).blocked.some(x=>x.reason==='INVALID_FIELD_SEMANTIC_EVIDENCE'));
 assert.ok(plan({},{shop_booking_url:'https://official.example/reserve'},{shop_booking_url:ev('https://official.example/reserve')}).blocked.some(x=>x.reason==='INVALID_FIELD_SEMANTIC_EVIDENCE'));
});
test('actual reader preserves canonical priority and all fallback aliases',async()=>{
 const {productionNormalizeShop}=await import('./provenance.mjs');
 const reservation=(acf)=>JSON.parse(productionProjection(productionNormalizeShop({id:42,slug:'wp-shop',title:{rendered:'Shop'},acf,area:[]})).booking.canonical).find(x=>x.kind==='reservation')?.href??null;
 assert.equal(reservation({shop_booking_url:'https://official.example/canonical',booking_url:'https://official.example/fallback'}),'https://official.example/canonical');
 for(const key of ['booking_url','reservation_url','shop_reservation_url'])for(const canonical of ['',null,'javascript:alert(1)','invalid'])assert.equal(reservation({shop_booking_url:canonical,[key]:'https://official.example/fallback'}),'https://official.example/fallback');
 assert.equal(reservation({shop_booking:'Web予約可能'}),null);
});
test('exact offline payload uses raw CAS snapshot and bounded server audit',async()=>{
 const {buildWriterPayload}=await import('./provenance.mjs');
 const before=shop({price_90:'14000',shop_fact_provenance:[{field:'image',opaque:'preserve'}]});
 const snapshot={wp_id:42,slug:before.slug,fields:{price_90:{exists:true,value:'14000'},shop_fact_provenance:{exists:true,value:before.acf.shop_fact_provenance}}};
 const args={shop:before,snapshot,updates:{price_90:'15000'},evidence:{price_90:{...ev('15000'),duration_minutes:90,price_type:'EXACT_STANDARD'}},batchId:'batch-1',asOf:'2026-09-13'};
 const payload=buildWriterPayload(args);
 assert.deepEqual(payload.expected,snapshot);assert.notEqual(payload.expected,snapshot);
 assert.equal(payload.audit.price_90.normalized_value,'15000');assert.equal(payload.audit.price_90.duration_minutes,90);
 assert.equal(payload.audit.price_90.evidence_by_field,undefined);assert.deepEqual(Object.keys(payload.canonical),['price']);
 assert.deepEqual(payload.provenance[0],before.acf.shop_fact_provenance[0]);
 assert.throws(()=>buildWriterPayload({...args,snapshot:{...snapshot,wp_id:1}}),/SNAPSHOT_IDENTITY/);
 assert.throws(()=>buildWriterPayload({...args,updates:{booking_url:'https://official.example/'}}),/UNSUPPORTED_FOUNDATION_FIELD/);
 assert.throws(()=>buildWriterPayload({...args,evidence:{}}),/PROVENANCE_BLOCKED/);
});
test('public price hash excludes hidden physical courses while CAS archives them',async()=>{
 const {buildWriterPayload}=await import('./provenance.mjs');
 const before=shop({price_90:'14000',shop_fact_provenance:[]});
 const snapshot={wp_id:42,slug:before.slug,status:'publish',area:[1],fields:{price_90:{exists:true,value:'14000'},price_60:{exists:true,value:'9000'},shop_fact_provenance:{exists:true,value:[]}}};
 const args={shop:before,snapshot,updates:{price_90:'15000'},evidence:{price_90:{...ev('15000'),duration_minutes:90,price_type:'EXACT_STANDARD'}},batchId:'12345678-1234-4123-8123-123456789012',asOf:'2026-09-13'};
 const p=buildWriterPayload(args);
 assert.equal(p.canonical.price,'[{"durationMinutes":90,"priceYen":15000}]');
 assert.deepEqual(p.expected.fields.price_60,{exists:true,value:'9000'});
 assert.throws(()=>buildWriterPayload({...args,snapshot:{...snapshot,fields:{...snapshot.fields,price_90:{exists:true,value:'15500'}}}}),/SNAPSHOT_READER_MISMATCH/);
});
test('blank physical targets and absent provenance accept their public empty projections',async()=>{
 const {buildWriterPayload}=await import('./provenance.mjs');
 for(const field of ['price_90','shop_booking_url'])for(const exists of [true,false]){
  const value=field==='price_90'?'15000':'https://booking.example/reserve';
  const before=shop({[field]:null,shop_fact_provenance:[]});
  const snapshot={wp_id:42,slug:before.slug,fields:{[field]:{exists,value:exists?'':null},shop_fact_provenance:{exists:false,value:null}}};
  const proof={...ev(value),...(field==='price_90'?{duration_minutes:90,price_type:'EXACT_STANDARD'}:{booking_purpose:'reservation',linked_from_url:'https://official.example/system'})};
  const args={shop:before,snapshot,updates:{[field]:value},evidence:{[field]:proof},batchId:'batch-1',asOf:'2026-09-13'};
  const result=buildWriterPayload(args);assert.deepEqual(result.expected,snapshot);
  assert.throws(()=>buildWriterPayload({...args,shop:shop({...before.acf,shop_fact_provenance:[{field:'image'}]})}),/SNAPSHOT_READER_MISMATCH/);
  assert.throws(()=>buildWriterPayload({...args,snapshot:{...snapshot,fields:{...snapshot.fields,[field]:{exists:true,value:'different'}}}}),/SNAPSHOT_READER_MISMATCH/);
 }
});
