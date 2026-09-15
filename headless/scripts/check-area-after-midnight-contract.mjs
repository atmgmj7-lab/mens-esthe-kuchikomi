import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load, root, setRouteShops } from './check-area-verified-line-comparison-contract.mjs';
assert.ok(existsSync(resolve(root,'lib/area-after-midnight-comparison.ts')), 'RED: after-midnight predicate and selector are missing');
const { isExplicitlyAfterMidnight, buildAreaAfterMidnightComparison } = load(resolve(root,'lib/area-after-midnight-comparison.ts'));
const { AreaAfterMidnightSection } = load(resolve(root,'components/area/hub/AreaAfterMidnightSection.tsx'));
const { normalizeShop } = load(resolve(root,'lib/wp/normalize.ts'));
const { buildShopDetailViewModel } = load(resolve(root,'lib/shop-detail-view-model.ts'));
const { hashShopFactValue } = load(resolve(root,'lib/shop-information-coverage.ts'));
const area={id:13,slug:'shinosaka',name:'新大阪'};
let checks=0;
function equal(a,b,label) { checks++; assert.deepEqual(JSON.parse(JSON.stringify(a)),b,label); }
for(const h of ['10:00～24:30','10:00-25:00','10:00〜26:00','10:00～翌1:00','10:00～翌日2:00','11：00～翌５：００','9：30‐翌5：00','10:00 - 翌 05:00','24時間営業','10:00 〜 28:00（受付開始9:00〜最終受付26:00迄）']) equal(isExplicitlyAfterMidnight(h),true,h);
for(const h of ['',null,'10:00～24:00','10:00～翌0:00','10:00～翌日00:00','10:00～05:00','深夜営業','遅くまで営業','10:00-LAST','10:00～ラスト（最終受付）','要確認','問い合わせ','予約状況による','不明','24時間受付','10:00～23:00（受付時間翌2:00）','10:00～翌2:00（最終受付）','受付時間10:00～翌3:00','10:00～翌25:00','25:00～26:00','10:60～25:00','10:00～24:60','10:00～48:00','10:00～翌2:00 要確認','10:00～翌2:00（予約状況による）']) equal(isExplicitlyAfterMidnight(h),false,String(h));
function shop(id, hours='10:00～翌2:00') {
 const s=normalizeShop({id,slug:`fixture-${id}`,title:{rendered:`店舗${id}`},content:{rendered:''},excerpt:{rendered:''},area:[13,17],acf:{shop_hours:hours,official_url:'https://example.com/'},_embedded:{'wp:term':[[{id:13,slug:'shinosaka',name:'新大阪',taxonomy:'area'},{id:17,slug:'sakai',name:'堺東',taxonomy:'area'}]]}});
 s.acf.shop_fact_provenance=[{field:'hours',sourceType:'official-site',sourceUrl:'https://example.com/hours',observedAt:'2026-09-12',reviewedAt:'2026-09-13',reviewStatus:'reviewed',publishedValueHash:hashShopFactValue('hours',buildShopDetailViewModel(s,area.name))}];return s;
}
const three=[shop(3),shop(1),shop(2)];
equal(buildAreaAfterMidnightComparison(area,three).map(s=>s.shopId),[3,1,2],'retains canonical input order');
equal(buildAreaAfterMidnightComparison(area,three.slice(0,2)),[],'minimum three');
const fiftyEight=Array.from({length:58},(_,i)=>shop(i+1));
for(let i=5;i<58;i++) fiftyEight[i].acf.shop_fact_provenance=[];
equal(buildAreaAfterMidnightComparison(area,fiftyEight),[],'5/58 below ten percent');
fiftyEight[5]=shop(6);equal(buildAreaAfterMidnightComparison(area,fiftyEight).length,6,'6/58 passes');
const twentyFive=Array.from({length:25},(_,i)=>shop(i+1));for(let i=3;i<25;i++) twentyFive[i].acf.shop_fact_provenance=[];
equal(buildAreaAfterMidnightComparison({id:17,slug:'sakai',name:'堺東'},twentyFive).length,3,'3/25 passes');
for (const patch of [{sourceType:'shop-provided'},{sourceType:'admin-verified'},{reviewStatus:'pending'},{sourceUrl:'https://other.example/'},{publishedValueHash:'0'.repeat(64)},{reviewedAt:'2026-02-30'}]) {
 const shops=[shop(1),shop(2),shop(3),shop(4)];Object.assign(shops[0].acf.shop_fact_provenance[0],patch);equal(buildAreaAfterMidnightComparison(area,shops).map(s=>s.shopId),[2,3,4],'bad provenance excluded');
}
const changed=[shop(1),shop(2),shop(3),shop(4)];changed[0].acf.shop_hours='10:00～翌3:00';equal(buildAreaAfterMidnightComparison(area,changed).length,3,'value hash mismatch');
for (const slug of ['.', '..','%2fexternal','bad%']) {const shops=[shop(1),shop(2),shop(3),shop(4)];shops[0].slug=slug;equal(buildAreaAfterMidnightComparison(area,shops).length,3,'unsafe slug excluded');}
equal(buildAreaAfterMidnightComparison({id:4,slug:'umeda',name:'梅田'},three),[],'target areas only');
const selected=buildAreaAfterMidnightComparison(area,three);
const html=renderToStaticMarkup(React.createElement(AreaAfterMidnightSection,{shops:selected}));
equal((html.match(/data-after-midnight-shop=/g)??[]).length,3,'SSR all rows');
assert.ok(html.includes('<details')&&!html.includes(' open=""')&&html.includes('現在営業中や予約の可否を示すものではありません'));checks++;
equal(renderToStaticMarkup(React.createElement(AreaAfterMidnightSection,{shops:[]})),'','empty DOM');
assert.ok(!html.includes('application/ld+json'));checks++;
if(process.env.MIDNIGHT_DATA_DIR) for(const [slug,id,name,count] of [['shinosaka',13,'新大阪',22],['sakai',17,'堺東',9]]) {
 const shops=JSON.parse(readFileSync(resolve(process.env.MIDNIGHT_DATA_DIR,`${slug}.json`))).map(normalizeShop);
 const actual=buildAreaAfterMidnightComparison({slug,id,name},shops);equal(actual.length,count,`${slug} audited count`);
 const audit=JSON.parse(readFileSync(resolve(process.env.MIDNIGHT_DATA_DIR,'readiness.json'))).find(a=>a.slug===slug);
 equal(actual.map(s=>s.shopId),audit.rows.filter(s=>s.qualified).map(s=>s.id),`${slug} audited IDs`);
}
const { renderAreaHubRouteContent } = load(resolve(root,'components/area/AreaHubRouteContent.tsx'));
setRouteShops(three);
const route = await renderAreaHubRouteContent(area,1);
const routeHtml=renderToStaticMarkup(route.props.slots.afterComparison);
equal((routeHtml.match(/id="area-after-midnight"/g)??[]).length,1,'route slot includes comparison exactly once');
equal((routeHtml.match(/data-after-midnight-shop=/g)??[]).length,3,'route SSR rows');
setRouteShops([]);
equal((await renderAreaHubRouteContent(area,1)).props.slots.afterComparison,null,'empty route slot');
console.log(JSON.stringify({pass:true,afterMidnightChecks:checks}));
