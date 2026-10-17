import assert from 'node:assert/strict';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load,root} from './check-area-verified-line-comparison-contract.mjs';
assert.ok(existsSync(resolve(root,'lib/area-shop-ordering.ts')),'RED: explainable natural ordering is not implemented');
const {buildAreaShopOrdering,normalizeAreaOrderingFacts,isAreaInformationOrderingTarget,paginateAreaShopInformationOrder}=load(resolve(root,'lib/area-shop-ordering.ts'));
const {normalizeShop}=load(resolve(root,'lib/wp/normalize.ts'));
const {buildShopDetailViewModel}=load(resolve(root,'lib/shop-detail-view-model.ts'));
const {hashShopFactValue}=load(resolve(root,'lib/shop-information-coverage.ts'));
const {buildAreaAfterMidnightComparison}=load(resolve(root,'lib/area-after-midnight-comparison.ts'));
const {buildAreaVerifiedLineComparison}=load(resolve(root,'lib/area-verified-line-comparison.ts'));
const {AreaPromotionSection}=load(resolve(root,'components/area/hub/AreaPromotionSection.tsx'));
const {AreaShopList}=load(resolve(root,'components/area/hub/AreaShopList.tsx'));
const area={id:13,slug:'shinosaka',name:'新大阪'};
let checks=0;
const equal=(a,b,label)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),b,label);};
function shop(id,acf={},name=`店舗${id}`){return normalizeShop({id,slug:`fixture-${id}`,title:{rendered:name},content:{rendered:''},excerpt:{rendered:''},area:[13],acf:{shop_address:'新大阪',shop_hours:'10:00～22:00',official_url:'https://example.com/',shop_line:'https://lin.ee/Fixture',...acf},_embedded:{'wp:term':[[{id:13,slug:'shinosaka',name:'新大阪',taxonomy:'area'}]]}});}
function verify(s,fields,date='2026-09-01'){s.acf.shop_fact_provenance=fields.map(field=>({field,sourceType:'official-site',sourceUrl:'https://example.com/',reviewStatus:'reviewed',observedAt:date,reviewedAt:date,publishedValueHash:hashShopFactValue(field,buildShopDetailViewModel(s,area.name))}));return s;}
const ordered=s=>buildAreaShopOrdering(s,area).entries.map(e=>e.shop.id);
const many=verify(shop(2,{area_rank:99}),['hours','official']);const manual=shop(1,{area_rank:1});
equal(ordered([manual,many]),[2,1],'manual rank cannot override verified facts');
equal(ordered([verify(shop(3,{shop_address:'梅田'}),['hours','official','booking']),shop(1)]),[1,3],'core precedes related despite more facts');
equal(normalizeAreaOrderingFacts(shop(1),area).totalScore,0,'unverified strings score zero');
equal(normalizeAreaOrderingFacts(many,area).totalScore,2,'one point per accepted field');
equal(ordered([verify(shop(3,{is_pr:true,area_rank:1}),['hours','official','booking']),many]),[2],'PR is outside natural list');
const changed=shop(1,{basic_price:1,price_90:1,review_count:99999,area_rank:1,shop_hours:'24時間営業'});
equal(normalizeAreaOrderingFacts(changed,area).totalScore,0,'price reviews manual and long hours add no score');
const original=verify(shop(2),['hours']);const long=verify(shop(1,{shop_hours:'24時間営業'}),['hours']);
equal(normalizeAreaOrderingFacts(original,area).totalScore,normalizeAreaOrderingFacts(long,area).totalScore,'after midnight itself adds no point');
const stale=verify(shop(1),['hours'],'2026-08-01'),fresh=verify(shop(2),['hours'],'2026-09-01');stale.acf.updated_at='2099-01-01';
equal(ordered([stale,fresh]),[2,1],'newer of each shop’s oldest verified confirmation, not generic modification time, breaks ties');
assert.equal(isAreaInformationOrderingTarget({id:999,slug:'all-areas'}),true,'R1–R4 is enabled for every published area slug');checks++;
const priceOnly=verify(shop(31,{price_90:12000,shop_hours:''}),['price']);
equal(normalizeAreaOrderingFacts(priceOnly,area).totalScore,1,'confirmed price is counted even when hours are absent');
const bookingOnly=verify(shop(32,{shop_hours:''}),['booking']);
equal(normalizeAreaOrderingFacts(bookingOnly,area).totalScore,1,'confirmed LINE or booking evidence is an alternative to official-url evidence');
const sameNameA=verify(shop(41,{app_shop_id:'00000000-0000-4000-8000-0000000000b2'},'同名'),['hours']);
const sameNameB=verify(shop(42,{app_shop_id:'00000000-0000-4000-8000-0000000000a1'},'同名'),['hours']);
sameNameA.canonicalShopId='00000000-0000-4000-8000-0000000000b2'; sameNameB.canonicalShopId='00000000-0000-4000-8000-0000000000a1';
equal(ordered([sameNameA,sameNameB]),[42,41],'same-name ties use canonical app.shops UUID rather than directory/WP ID');
const pagedFixture=Array.from({length:14},(_,index)=>verify(shop(index+1),['hours'],new Date(Date.now()-(index+1)*86400000).toISOString().slice(0,10))).reverse();
const full=buildAreaShopOrdering(pagedFixture,area).entries.map(entry=>entry.shop.id);
const firstPage=paginateAreaShopInformationOrder(pagedFixture,area,1,5),secondPage=paginateAreaShopInformationOrder(pagedFixture,area,2,5),thirdPage=paginateAreaShopInformationOrder(pagedFixture,area,3,5);
equal([...firstPage.shops,...secondPage.shops,...thirdPage.shops].map(item=>item.id),full,'two-plus page formal order is computed from the full candidate set before slicing');
equal(firstPage.shops.map(item=>item.id),[1,2,3,4,5],'page one contains the newest valid-confirmation candidates even when source input is reversed');
assert.match(readFileSync(resolve(root,'lib/wp/areas.ts'),'utf8'),/paginateAreaShopInformationOrder\(candidates, area, page, perPage\)/,'area reader calls formal full-candidate pagination before slicing');checks++;
assert.match(readFileSync(resolve(root,'components/AreaPageView.tsx'),'utf8'),/buildAreaShopOrdering\(shops, area\)\.entries/,'non-hub AreaPageView uses the same formal natural order instead of legacy manual ranks');checks++;
const a=shop(8,{},'A'),b=shop(2,{},'B'),same=shop(4,{},'A');
equal(ordered([b,a,same]),[4,8,2],'name then numeric WP ID');
equal(ordered([same,a,b]),[4,8,2],'API order independent');
const invalid=verify(shop(1),['hours']);invalid.acf.shop_fact_provenance[0].publishedValueHash='0'.repeat(64);
equal(normalizeAreaOrderingFacts(invalid,area).totalScore,0,'invalid hash excluded');
for(const patch of [{sourceType:'shop-provided'},{reviewStatus:'pending'},{sourceUrl:'https://other.example/'},{reviewedAt:'2026-02-30'}]){const s=verify(shop(1),['hours']);Object.assign(s.acf.shop_fact_provenance[0],patch);equal(normalizeAreaOrderingFacts(s,area).totalScore,0,'invalid provenance excluded');}
const ads=Array.from({length:5},(_,i)=>shop(i+10,{is_pr:true}));
equal(buildAreaShopOrdering(ads,area).entries.length,0,'all ads are outside natural order');
const adHtml=renderToStaticMarkup(React.createElement(AreaPromotionSection,{shops:ads,targetArea:area,limit:ads.length}));
equal((adHtml.match(/class="area-promotion-card"/g)??[]).length,5,'separate PR section can retain every ad beyond its legacy default limit');
const result=buildAreaShopOrdering([manual,many],area);
for(const e of result.entries){for(const k of ['totalScore','breakdown','eligibleSignals','verifiedSignals','tieBreakReason'])assert.ok(k in e,k);checks++;}
equal(result.entries[1].tieBreakReason,'verified-information-count','explanation identifies decisive comparison');
const markup=renderToStaticMarkup(React.createElement(AreaShopList,{shops:[many,manual],targetArea:area,precisionMode:true,informationOrder:{afterMidnightShopIds:[2]}}));
assert.ok(markup.includes('情報充実順')&&!markup.includes('料金が安い順')&&!markup.includes('更新順')&&!markup.includes('おすすめ順'));checks++;
assert.ok(markup.includes('24時以降営業確認済み'));checks++;
equal((markup.match(/data-area-shop-card="true"/g)??[]).length,2,'SSR preserves all cards');
if(process.env.ORDERING_DATA_DIR){
 const evidence=[];
 for(const [slug,id,name,total,midnight,line] of [['shinosaka',13,'新大阪',58,22,19],['sakai',17,'堺東',25,9,5]]){
  const shops=JSON.parse(readFileSync(resolve(process.env.ORDERING_DATA_DIR,`${slug}.json`))).map(normalizeShop),area={slug,id,name};
  const result=buildAreaShopOrdering(shops,area);equal(result.entries.length,total,`${slug} count`);
  equal(buildAreaAfterMidnightComparison(area,shops).length,midnight,'after midnight live regression');
  equal(buildAreaVerifiedLineComparison(area,shops).length,line,'LINE live regression');
  equal(buildAreaShopOrdering([...shops].reverse(),area).entries.map(e=>e.shop.id),result.entries.map(e=>e.shop.id),'live reverse input stability');
  evidence.push({slug,entries:result.entries.map(({shop,...e})=>({id:shop.id,name:shop.title,...e})),excludedPrShopIds:result.excludedPrShopIds});
 }
 writeFileSync(resolve(process.env.ORDERING_DATA_DIR,'ordering.json'),JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({pass:true,orderingChecks:checks}));
