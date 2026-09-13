import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareImmutableEvidence, assertCurrentFacts, extractShopViews } from './lib/area-visibility-data-contract.mjs';
const text=(price,late)=>`固定見出し 料金掲載 ${price}店舗 固定説明 深夜候補 ${late}店舗 公式URL30件`;
const evidence=(p,l)=>({title:'title',h1:'heading',canonical:'https://example.test/area/a/',itemList:[{numberOfItems:2,itemListElement:[{url:'/shops/a/'},{url:'/shops/b/'}]}],supportingDomText:text(p,l),supportingSsrText:text(p,l),jsonLdTypes:['ItemList'],shopCards:2});
test('verified current counts can drift without masking fixed copy',()=>compareImmutableEvidence(evidence(2,2),evidence(1,1)));
for(const key of ['title','h1','canonical','jsonLdTypes','shopCards'])test(`immutable ${key} regression fails`,()=>{const changed=evidence(1,1);changed[key]='broken';assert.throws(()=>compareImmutableEvidence(evidence(2,2),changed));});
test('ItemList identity regression fails',()=>{const changed=evidence(1,1);changed.itemList[0].itemListElement[0].url='/shops/wrong/';assert.throws(()=>compareImmutableEvidence(evidence(2,2),changed));});
test('fixed supporting copy and unrelated coverage count stay immutable',()=>{for(const token of ['固定説明','公式URL30件']){const changed=evidence(1,1);changed.supportingDomText=changed.supportingDomText.replace(token,'broken');assert.throws(()=>compareImmutableEvidence(evidence(2,2),changed));}});
for(const key of ['ssr','dom','noJs'])test(`same-run ${key} count mismatch fails`,()=>{const values={ssr:text(1,1),dom:text(1,1),noJs:text(1,1)};values[key]=text(1,2);assert.throws(()=>assertCurrentFacts({priced:1,lateNight:1},values));});
test('all surfaces consistently wrong against source must fail',()=>assert.throws(()=>assertCurrentFacts({priced:2,lateNight:2},{ssr:text(1,1),dom:text(1,1),noJs:text(1,1)})));
test('exact source SSR hydrated noJS counts pass',()=>assertCurrentFacts({priced:1,lateNight:1},{ssr:text(1,1),dom:text(1,1),noJs:text(1,1)}));
test('duplicate/missing mutable tokens fail closed',()=>{for(const bad of [text(1,1)+' 深夜候補 1店舗','固定文だけ'])assert.throws(()=>assertCurrentFacts({priced:1,lateNight:1},{ssr:bad,dom:bad,noJs:bad}));});
function flight(value){const row='a:'+JSON.stringify(value)+'\n';return '<script>self.__next_f.push('+JSON.stringify([1,row])+')</script>';}
test('read source ShopView only from shop-list Flight props, without evaluation',()=>{const shops=[{id:1,slug:'a',acf:{shop_hours:'10:00〜翌3:00'}},{id:2,slug:'b',acf:{shop_hours:'10:00〜20:00'}}];const html=flight(['$','section',null,{id:'shop-list',children:['$','client',null,{shops}]}]);assert.deepEqual(extractShopViews(html),shops);});
test('missing ambiguous or duplicate source shops fail closed',()=>{assert.throws(()=>extractShopViews('<script>evil()</script>'));assert.throws(()=>extractShopViews(flight(['$','section',null,{id:'shop-list',children:{shops:[{id:1,slug:'a',acf:{}},{id:1,slug:'b',acf:{}}]}}])));});
test('production predicates count literal known/unknown source values', async () => {
  const { currentSourceFacts } = await import('./lib/area-visibility-data-contract.mjs');
  assert.deepEqual(currentSourceFacts([
    { acf: { price_90: '12000', shop_hours: '10:00〜翌3:00' } },
    { acf: { basic_price: '未確認', shop_hours: '10:00〜20:00' } },
  ]), { priced: 1, lateNight: 1 });
});
test('price ordering oracle preserves known prices and unknown-last distinction', async () => {
  const { currentSourcePrices } = await import('./lib/area-visibility-data-contract.mjs');
  assert.deepEqual(currentSourcePrices([{acf:{price_90:'14000'}},{acf:{basic_price:'未確認'}},{acf:{price_90:'9000'}}]), [14000,null,9000]);
});
