/** Offline projection adapter. Hash/canonicalization are imported from the public reader. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { isIP } from 'node:net';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../headless');
const require=createRequire(resolve(root,'package.json'));
const ts=require('typescript');
const loaded=new Map();
function productionModule(path) {
  if(loaded.has(path)) return loaded.get(path).exports;
  const module={exports:{}};loaded.set(path,module);
  const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const localRequire=(id)=>{
    if(id==='server-only')return {};
    if(id==='node:crypto')return require(id);
    if(id==='node:https')return Object.freeze({request(){throw new Error('NETWORK_DISABLED_IN_PROJECTION');}});
    if(id.startsWith('@/lib/'))return productionModule(resolve(root,id.slice(2)+(id.endsWith('.mjs')?'':'.ts')));
    throw new Error(`Unexpected public reader dependency: ${id}`);
  };
  vm.runInNewContext(source,{module,exports:module.exports,require:localRequire,URL,Date,Headers,Buffer,process:Object.freeze({env:Object.freeze({})}),fetch(){throw new Error('NETWORK_DISABLED_IN_PROJECTION');}},{filename:path});
  return module.exports;
}
const {buildShopDetailViewModel}=productionModule(resolve(root,'lib/shop-detail-view-model.ts'));
const {canonicalizeShopFactValue,hashShopFactValue}=productionModule(resolve(root,'lib/shop-information-coverage.ts'));
export function productionNormalizeShop(post) {
  return productionModule(resolve(root,'lib/wp/normalize.ts')).normalizeShop(post);
}
export const CATEGORIES=Object.freeze(['price','hours','access','booking','official','image']);
const stationKeys=['shop_station','nearest_station','station'];
const bookingKeys=['shop_booking_url','booking_url','reservation_url','shop_reservation_url'];
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function date(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function sourceUrl(value) {
  if(typeof value!=='string'||/[\x00-\x20\x7f]/.test(value))return false;
  try {
    const u=new URL(value),host=u.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
    // Sources are public DNS names. IP literals, local names and credential-bearing
    // query/fragment forms are unnecessary for this bounded official-site task.
    return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&host.includes('.')&&!isIP(host)&&host!=='localhost'&&!/\.(localhost|local|internal|test)$/.test(host)&&['','80','443'].includes(u.port)&&!u.search&&!u.hash&&!/%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value);
  } catch { return false; }
}
function validEvidence(e,value,asOf) {
  return !!e&&same(e.value,value)&&sourceUrl(e.sourceUrl)&&date(e.observedAt)&&date(e.reviewedAt)&&e.observedAt<=e.reviewedAt&&e.reviewedAt<=asOf&&e.reviewStatus==='reviewed'&&['official-site','shop-provided','admin-verified'].includes(e.sourceType);
}
export function productionProjection(shop) {
  const model=buildShopDetailViewModel(shop,'');
  return Object.fromEntries(CATEGORIES.map(category=>[category,{canonical:canonicalizeShopFactValue(category,model),hash:hashShopFactValue(category,model)}]));
}
function contributingFields(category,shop,model) {
  const acf=shop.acf;
  if(category==='price')return model.prices.map(p=>p.key);
  if(category==='hours')return model.infoRows.some(r=>r.key==='hours')?['shop_hours']:[];
  if(category==='access')return [model.infoRows.some(r=>r.key==='station')?stationKeys.find(k=>buildShopDetailViewModel({...shop,acf:{[k]:acf[k]}},'').infoRows.some(r=>r.key==='station')):null,model.infoRows.some(r=>r.key==='address')?'shop_address':null].filter(Boolean);
  if(category==='booking')return model.actions.filter(a=>a.kind!=='official').map(a=>a.kind==='tel'?'shop_tel':a.kind==='line'?'shop_line':bookingKeys.find(k=>buildShopDetailViewModel({...shop,acf:{[k]:acf[k]}},'').actions.some(v=>v.kind==='reservation'))).filter(Boolean);
  if(category==='official')return model.actions.some(a=>a.kind==='official')?['official_url']:[];
  return [];
}
/**
 * shop is the current ShopView (the application's normalizeShop output).
 * evidence is keyed by the physical ACF field and binds its exact candidate value.
 * One public category has one source, so mixed-source aggregates fail closed.
 * Return `blocked` must be empty before any resulting provenance is considered.
 */
export function buildProvenancePlan({shop,updates,evidence={},existingProvenance=shop.acf?.shop_fact_provenance||[],batchId,asOf=new Date().toISOString().slice(0,10)}) {
  if(!date(asOf))throw new Error('INVALID_AS_OF');
  if(!Number.isSafeInteger(shop.id)||shop.id<=0||!shop.slug||!batchId)throw new Error('INVALID_IDENTITY_OR_BATCH');
  if(!updates||typeof updates!=='object'||Array.isArray(updates))throw new Error('INVALID_UPDATES');
  for(const [field,value] of Object.entries(updates))if(value===null||value===undefined||value===''||(typeof value==='string'&&!value.trim()))throw new Error(`EMPTY_UPDATE:${field}`);
  const candidate={...shop,acf:{...shop.acf,...updates},officialUrl:Object.hasOwn(updates,'official_url')?updates.official_url:shop.officialUrl};
  const current=productionProjection(shop),next=productionProjection(candidate);
  const model=buildShopDetailViewModel(candidate,'');
  const categories={},blocked=[],replacements=new Map(),privateAudit=[],fieldAudit=[];
  const allContributors=new Set();
  for(const category of CATEGORIES) {
    const fields=Array.from(contributingFields(category,candidate,model));fields.forEach(f=>allContributors.add(f));
    categories[category]={currentCanonical:current[category].canonical,currentHash:current[category].hash,candidateCanonical:next[category].canonical,candidateHash:next[category].hash,contributingFields:fields};
    if(current[category].hash===next[category].hash)continue;
    if(!fields.length){blocked.push({category,reason:'EMPTY_OR_UNSUPPORTED_CATEGORY',missingFields:[]});continue;}
    const missingFields=fields.filter(f=>!validEvidence(evidence[f],candidate.acf[f],asOf));
    if(missingFields.length){blocked.push({category,reason:'INCOMPLETE_COMPONENT_EVIDENCE',missingFields});continue;}
    const signatures=new Set(fields.map(f=>JSON.stringify([evidence[f].sourceUrl,evidence[f].sourceType,evidence[f].observedAt,evidence[f].reviewedAt])));
    if(signatures.size!==1){blocked.push({category,reason:'MULTIPLE_CATEGORY_SOURCES',missingFields:[]});continue;}
    const e=evidence[fields[0]];replacements.set(category,{field:category,sourceUrl:e.sourceUrl,sourceType:e.sourceType,observedAt:e.observedAt,reviewedAt:e.reviewedAt,reviewStatus:'reviewed',publishedValueHash:next[category].hash});
  }
  for(const [field,value] of Object.entries(updates)) {
    if(same(value,shop.acf[field]))continue;
    if((field==='price_90'&&(evidence[field]?.duration_minutes!==90||evidence[field]?.price_type!=='EXACT_STANDARD'))||(field==='shop_booking_url'&&(evidence[field]?.booking_purpose!=='reservation'||evidence[field]?.linked_from_url!==evidence[field]?.sourceUrl)))blocked.push({field,reason:'INVALID_FIELD_SEMANTIC_EVIDENCE',missingFields:[field]});
    if(!validEvidence(evidence[field],value,asOf))blocked.push({field,reason:'INVALID_CHANGED_FIELD_EVIDENCE',missingFields:[field]});
    const e=evidence[field];
    if(validEvidence(e,value,asOf)){
      const category=field==='price_90'?'price':field==='shop_booking_url'?'booking':null;
      const fields=category?categories[category].contributingFields:[field];
      fieldAudit.push({field,batch_id:batchId,wp_id:shop.id,slug:shop.slug,old_value:shop.acf[field]??null,new_value:value,source_url:e.sourceUrl,source_host:new URL(e.sourceUrl).hostname.toLowerCase(),normalized_value:value,observed_at:e.observedAt,reviewed_at:e.reviewedAt,checked_at:e.observedAt,...(field==='price_90'?{duration_minutes:e.duration_minutes,price_type:e.price_type}:{}),...(field==='shop_booking_url'?{booking_purpose:e.booking_purpose,linked_from_url:e.linked_from_url}:{}),evidence_by_field:Object.fromEntries(fields.filter(f=>evidence[f]).map(f=>[f,structuredClone(evidence[f])]))});
    }
    if(!allContributors.has(field))privateAudit.push({batchId,wp_id:shop.id,slug:shop.slug,field,oldValue:shop.acf[field]??null,newValue:value,sourceUrl:sourceUrl(evidence[field]?.sourceUrl)?evidence[field].sourceUrl:null,checked_at:evidence[field]?.observedAt??null,reason:'OUTSIDE_PUBLIC_HASH'});
  }
  const provenance=existingProvenance.filter(record=>!replacements.has(record.field)).map(record=>structuredClone(record));
  provenance.push(...replacements.values());
  return {wp_id:shop.id,slug:shop.slug,batchId,categories,provenance,blocked,privateAudit,fieldAudit,expectedShop:structuredClone(shop),candidateShop:structuredClone(candidate)};
}

/** Offline exact batch adapter. Physical snapshot is passed unchanged for server CAS. */
export function buildWriterPayload({shop,snapshot,updates,evidence,batchId,asOf}) {
  if(!snapshot||snapshot.wp_id!==shop.id||snapshot.slug!==shop.slug||!snapshot.fields)throw new Error('SNAPSHOT_IDENTITY_MISMATCH');
  if(!Object.keys(updates).length||Object.keys(updates).some(f=>!['price_90','shop_booking_url'].includes(f)))throw new Error('UNSUPPORTED_FOUNDATION_FIELD');
  for(const [field,value] of Object.entries(updates))if(typeof value!=='string'||!value.trim())throw new Error(`INVALID_PHYSICAL_STRING:${field}`);
  const plan=buildProvenancePlan({shop,updates,evidence,batchId,asOf});
  if(plan.blocked.length)throw new Error('PROVENANCE_BLOCKED:'+JSON.stringify(plan.blocked));
  const relevant=new Set([...Object.keys(updates),'shop_fact_provenance',...Object.keys(updates).flatMap(f=>plan.categories[f==='price_90'?'price':'booking'].contributingFields)]);
  for(const field of relevant){
    const raw=snapshot.fields[field];
    if(!raw||typeof raw.exists!=='boolean')throw new Error(`SNAPSHOT_FIELD_MISSING:${field}`);
    const current=shop.acf[field];
    // REST projects blank target metadata to null and absent provenance to [].
    // Accept only these exact empty equivalences; retain the physical CAS snapshot.
    const blankTarget=['price_90','shop_booking_url'].includes(field)&&raw.exists&&raw.value===''&&current===null;
    const absentProvenance=field==='shop_fact_provenance'&&!raw.exists&&raw.value===null&&Array.isArray(current)&&current.length===0;
    if(!blankTarget&&!absentProvenance&&(raw.exists?!same(raw.value,current):current!==undefined&&current!==null&&current!==''))throw new Error(`SNAPSHOT_READER_MISMATCH:${field}`);
  }
  const audit={},canonical={};
  for(const entry of plan.fieldAudit){
    const keys=['source_url','source_host','normalized_value','observed_at','reviewed_at','checked_at',...(entry.field==='price_90'?['duration_minutes','price_type']:['booking_purpose','linked_from_url'])];
    audit[entry.field]=Object.fromEntries(keys.map(k=>[k,entry[k]]));
    const category=entry.field==='price_90'?'price':'booking';
    canonical[category]=plan.categories[category].candidateCanonical;
  }
  if(Object.keys(audit).length!==Object.keys(updates).length)throw new Error('NOOP_UPDATE');
  return {batch_id:batchId,wp_id:shop.id,slug:shop.slug,expected:structuredClone(snapshot),updates:structuredClone(updates),provenance:plan.provenance,canonical,audit};
}
