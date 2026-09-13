import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const fixture = Array.from({length: 213}, (_, i) => ({id:i+1,date:i < 110 ? '2026-01-01T12:00:00' : '2026-02-01T12:00:00',modified:'2026-03-01T12:00:00'}));
const canonical = rows => [...rows].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(x=>x.id);
const ids = rows => Array.from(rows,x=>x.id);
let calls=[];
let mutate = x=>x;
async function fetchPage(path) {
  calls.push(path);
  const q = new URL(path,'https://fixture.invalid').searchParams;
  const n=Number(q.get('per_page')), page=Number(q.get('page')||1);
  let data;
  if(q.has('include')) data=fixture.filter(x=>q.get('include').split(',').map(Number).includes(x.id)).reverse();
  else if(q.get('orderby')==='id' && q.get('order')==='asc') data=fixture.slice((page-1)*n,page*n);
  else { const start=Math.max(0,(page-1)*(n-1)); data=fixture.slice(start,start+n); }
  return mutate({data,pagination:{total:fixture.length,totalPages:Math.ceil(fixture.length/n)}},q);
}
function load(file) {
 const module={exports:{}};
 const require=id=>id==='next/cache'?{cacheLife(){},cacheTag(){}}:id==='@/lib/wp/client'?{wpFetchPaginated:fetchPage}:id==='@/lib/wp/normalize'?{normalizeShop:x=>x}:id==='@/lib/wp/build-resilience'?{logWpBuildFallback(){}}:id.startsWith('@/')?load(id.slice(2)+'.ts'):(()=>{throw Error(id)})();
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Date,Map,Set,URLSearchParams});
 return module.exports;
}
const legacy=[];
for(let page=1;page<=Math.ceil(fixture.length/24);page++) legacy.push(...(await fetchPage(`/wp/v2/shop?per_page=24&page=${page}`)).data);
assert.ok(new Set(ids(legacy)).size<legacy.length);
assert.ok(new Set(ids(legacy)).size<fixture.length);
console.log('Default transport duplicate/missing reproduced');
const areas=load('lib/wp/areas.ts');
for(const perPage of [12,24,50,100]) {
 const all=[];
 for(let page=1;page<=Math.ceil(fixture.length/perPage);page++) all.push(...(await areas.getAreaShops(1,page,{perPage})).shops);
 assert.deepEqual(ids(all),canonical(fixture),`actual adapter canonical membership/order perPage=${perPage}`);
}
assert.deepEqual(ids(await areas.getAreaRankingShops(1)),canonical(fixture));
if(existsSync('lib/wp/area-shop-order.ts')) {
 const helper=load('lib/wp/area-shop-order.ts');
 for(const n of [12,24,50,100]) assert.deepEqual(ids(await helper.fetchAreaShopOrderIndex(1,n)),canonical(fixture));
 const sorted=rows=>ids([...rows].sort(helper.compareAreaShopOrder));
 assert.deepEqual(sorted(fixture.map(x=>({...x,modified:'2099-01-01T00:00:00'}))),canonical(fixture));
 assert.notDeepEqual(sorted(fixture.map(x=>x.id===1?{...x,date:'2099-01-01T00:00:00'}:x)),canonical(fixture));
 for(const kind of ['duplicate','badId','badDate','badCalendar','missing','metadata','descending','fullMissing','fullDuplicate','fullExtra','fullDate','fullLateFailure']) {
  mutate=(r,q)=> {
   if(kind.startsWith('full') !== q.has('include')) return r;
   const data=r.data.map(x=>({...x}));
   if(kind==='duplicate'||kind==='fullDuplicate') data[1]=data[0];
   if(kind==='badId') data[0].id=-1;
   if(kind==='badDate') data[0].date='invalid';
   if(kind==='badCalendar') data[0].date='2026-02-30T00:00:00';
   if(kind==='missing'||kind==='fullMissing') data.pop();
   if(kind==='fullDate') data[0].date='1999-01-01T00:00:00';
   if(kind==='fullLateFailure' && q.get('include').split(',').includes('1')) throw Error('later chunk unavailable');
   if(kind==='fullExtra') data[0]={...data[0],id:99999};
   if(kind==='descending') data.reverse();
   return {data,pagination:kind==='metadata'?{total:213,totalPages:99}:r.pagination};
  };
  assert.equal((await areas.getAreaRankingShops(1)).length,0,`${kind} whole-result fallback`);
 }
 let attempts=0;
 mutate=(r,q)=>{if(!q.has('include')&&q.get('page')==='1') attempts++; return {...r,pagination:{...r.pagination,total:q.get('page')==='2'?214:213}}};
 calls=[];
 assert.equal((await areas.getAreaRankingShops(1)).length,0);
 assert.equal(attempts,2,'total drift retries exactly once');
 attempts=0;
 mutate=(r,q)=>{if(!q.has('include')&&q.get('page')==='1') attempts++;return {...r,pagination:{...r.pagination,total:attempts===1&&q.get('page')==='2'?214:213}}};
 assert.deepEqual(ids(await areas.getAreaRankingShops(1)),canonical(fixture));
 assert.equal(attempts,2);
 mutate=x=>x;
 assert.equal((await areas.getAreaShops(1,9999)).shops.length,0);
 assert.equal((await areas.getAreaShops(1,1,{perPage:0})).shops.length,0);
}
console.log('PASS stable pagination: 213 records, 24/100 boundaries, four page sizes, both adapters, corruption guards, bounded retry');
