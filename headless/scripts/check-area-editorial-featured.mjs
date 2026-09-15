import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load,root} from './check-area-verified-line-comparison-contract.mjs';
assert.ok(existsSync(resolve(root,'lib/area-editorial-featured.ts')),'RED: editorial feature config and selector missing');
const {AREA_EDITORIAL_FEATURES,buildAreaEditorialFeature}=load(resolve(root,'lib/area-editorial-featured.ts'));
const {AreaEditorialFeaturedShops}=load(resolve(root,'components/area/hub/AreaEditorialFeaturedShops.tsx'));
const {normalizeShop}=load(resolve(root,'lib/wp/normalize.ts'));
const {buildAreaShopOrdering}=load(resolve(root,'lib/area-shop-ordering.ts'));
const {buildAreaAfterMidnightComparison}=load(resolve(root,'lib/area-after-midnight-comparison.ts'));
const {buildAreaVerifiedLineComparison}=load(resolve(root,'lib/area-verified-line-comparison.ts'));
const area={id:13,slug:'shinosaka',name:'新大阪'};
let checks=0;
const equal=(a,b,label)=>{checks++;assert.deepEqual(JSON.parse(JSON.stringify(a)),b,label);};
const shop=(id,overrides={})=>normalizeShop({id,status:'publish',slug:`fixture-${id}`,title:{rendered:`店舗${id}`},content:{rendered:''},excerpt:{rendered:''},area:[13],acf:{shop_address:'新大阪'},_embedded:{'wp:term':[[{id:13,slug:'shinosaka',name:'新大阪',taxonomy:'area'}]]},...overrides});
const shops=[shop(768),shop(9),shop(712)];
const selected=(input=shops,a=area)=>buildAreaEditorialFeature(a,input)?.shops.map(s=>s.id)??[];
equal(selected(),[712,768],'only configured IDs in config order');
equal(selected(shops,{id:17,slug:'sakai',name:'堺東'}),[],'Sakai hidden');
equal(selected(shops,{...area,id:99}),[],'exact Area identity required');
equal(selected([shop(712,{status:'draft'}),shop(768)]),[768],'draft excluded');
for(const status of ['private','trash','future',undefined])equal(selected([shop(712,{status})]),[],'only explicit publish accepted');
const moved=shop(712);moved.terms=[];equal(selected([moved,shop(768)]),[768],'membership removal excludes');
equal(selected([shop(9,{title:{rendered:'SPALOT.Mrs 新大阪店（スパロットミセス）'}})]),[],'missing ID never name fallback');
for(const slug of ['..','%2Fexternal','bad%'])equal(selected([shop(712,{slug})]),[],'unsafe slug excluded');
equal(selected([shop(712),shop(712),shop(768)]),[768],'ambiguous duplicate excluded');
equal(selected([]),[],'fetch failure empty input');
const before=buildAreaShopOrdering(shops,area).entries.map(e=>e.shop.id);buildAreaEditorialFeature(area,shops);
equal(buildAreaShopOrdering(shops,area).entries.map(e=>e.shop.id),before,'feature does not change natural order');
equal(shops.map(s=>s.id),[768,9,712],'input membership and order not mutated');
const html=renderToStaticMarkup(React.createElement(AreaEditorialFeaturedShops,{area,shops}));
equal((html.match(/data-editorial-featured-shop=/g)??[]).length,2,'SSR cards2');
equal((html.match(/data-area-shop-card=/g)??[]).length,0,'shortcut cards do not count as natural list');
assert.ok(html.includes('掲載順はランキングではありません')&&!html.includes('おすすめランキング')&&!html.includes('application/ld+json'));checks++;
assert.ok(html.includes('新大阪の編集部ピックアップ'));checks++;
assert.ok(html.includes('<img')&&html.includes('/shops/fixture-712/'));checks++;
for(const acf of [{is_pr:true},{sponsored:true},{affiliate:true}]){
 const ad=shop(712,{acf});const markup=renderToStaticMarkup(React.createElement(AreaEditorialFeaturedShops,{area,shops:[ad]}));
 assert.ok(markup.includes('aria-label="PR広告"'),'PR badge cannot be bypassed');checks++;
}
equal(renderToStaticMarkup(React.createElement(AreaEditorialFeaturedShops,{area,shops:[]})),'','empty module hidden');
assert.ok(AREA_EDITORIAL_FEATURES.shinosaka.enabled);checks++;
if(process.env.FEATURED_DATA_DIR){
 const evidence=[];
 for(const [slug,id,name,total,midnight,line]of [['shinosaka',13,'新大阪',58,22,19],['sakai',17,'堺東',25,9,5]]){
  const raw=JSON.parse(readFileSync(resolve(process.env.FEATURED_DATA_DIR,`${slug}.json`)));const shops=raw.map(normalizeShop),a={id,slug,name};
  equal(shops.length,total,'public population');
  const order=buildAreaShopOrdering(shops,a).entries.map(e=>e.shop.id);
  const previous=JSON.parse(readFileSync(process.env.FEATURED_ORDERING_BASELINE)).find(a=>a.slug===slug).entries.map(e=>e.id);
  equal(order,previous,'accepted natural order unchanged');
  const feature=buildAreaEditorialFeature(a,shops);equal(feature?.shops.map(s=>s.id)??[],slug==='shinosaka'?[712,768]:[],'live featured IDs');
  equal(buildAreaAfterMidnightComparison(a,shops).length,midnight,'live midnight');equal(buildAreaVerifiedLineComparison(a,shops).length,line,'live LINE');
  evidence.push({slug,total,naturalOrder:order,featured:feature?.shops.map(s=>({id:s.id,name:s.title,publicationStatus:s.publicationStatus,promotion:s.ranking.promotion}))??[]});
 }
 writeFileSync(resolve(process.env.FEATURED_DATA_DIR,'featured.json'),JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({pass:true,featuredChecks:checks}));
