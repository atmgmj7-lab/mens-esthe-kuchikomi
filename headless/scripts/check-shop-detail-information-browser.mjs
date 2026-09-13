import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import { createSourceLoader } from './lib/shop-detail-source-loader.mjs';
const out = '/tmp/shop-detail-information-ux-template-02';
fs.mkdirSync(out, { recursive: true });
const load = createSourceLoader();
const { normalizeShop } = load(resolve('lib/wp/normalize.ts'));
const { buildShopDetailViewModel } = load(resolve('lib/shop-detail-view-model.ts'));
const { buildShopInformationCoverage } = load(resolve('lib/shop-information-coverage.ts'));
const changed = ['ShopAccessSection','ShopBasicInformationSection','ShopDetailModuleList','ShopInformationCoverage','ShopOverviewSection'];
const overrides = new Map(changed.map(name => [resolve(`components/shop-detail/${name}.tsx`), execFileSync('git', ['show', `9dcab69:headless/components/shop-detail/${name}.tsx`], {encoding:'utf8'})]));
const beforeLoad = createSourceLoader(overrides);
const zero = {status:'available',page:{total:0,reviews:[],metrics:Object.fromEntries(['total','price','service','cleanliness'].map(k=>[k,{responseCount:0,average:null}])),dateRange:null}};
const browser = await chromium.launch({ headless: true });
const report = { observedAt: new Date().toISOString(), shops: [], scenarios: [] };
try {
for (const area of ['shinosaka','sakai']) {
 const { requestWpOrigin } = load(resolve('lib/wp/origin-request.ts'));
 const wpResponse = await requestWpOrigin(`/wp-json/wp/v2/shop/${area === 'shinosaka' ? 775 : 5137}?_embed=1`);
 assert.equal(wpResponse.status, 200);
 const raw = await wpResponse.json();
 const shop = normalizeShop(raw); const model = buildShopDetailViewModel(shop,shop.primaryArea?.name??'');
 const coverage = buildShopInformationCoverage(model,shop.acf.shop_fact_provenance);
 const props = { shop, reviewResult:zero };
 const html = renderToStaticMarkup(React.createElement(load(resolve('components/ShopDetail.tsx')).ShopDetail,props));
 const before = renderToStaticMarkup(React.createElement(beforeLoad(resolve('components/ShopDetail.tsx')).ShopDetail,props));
 const extract = text => ({schema:[...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(x=>JSON.parse(x[1])),h1:text.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1],links:[...new Set([...text.matchAll(/href="(.*?)"/g)].map(x=>x[1]))].sort()});
 assert.deepEqual(extract(html),extract(before),'SEO schema H1 and link destinations unchanged');
 const page = await browser.newPage();
 // Never send analytics, submit forms, or activate external booking destinations.
 await page.route(/google-analytics|googletagmanager|analytics\.google/, route=>route.abort());
 const response=await page.goto(`http://127.0.0.1:3127/shops/${shop.slug}/`,{waitUntil:'networkidle'});
 assert.equal(response.status(),200);
 const schema = await page.locator('main[data-shop-detail-root] script[type="application/ld+json"]').allTextContents();
 assert.deepEqual(schema.map(x=>JSON.parse(x)),extract(html).schema,'real route schema matches source');
 for (const row of model.infoRows) {
  const section=['address','station','access'].includes(row.key)?'#map-access':'#basic-information';
  assert.ok((await page.locator(section).innerText()).includes(row.value),`WP→VM→route ${row.key}`);
 }
 report.shops.push({area,id:shop.id,title:shop.title,slug:shop.slug,infoRows:model.infoRows,actions:model.actions.map(a=>({kind:a.kind,present:true})),coverage:coverage?{verifiedCount:coverage.verifiedCount,totalCount:coverage.totalCount,latestReviewedAt:coverage.latestReviewedAt}:null,seoParity:true});
 for (const width of [1440,1280,1024,390,375,320]) {
  await page.setViewportSize({width,height:900});
  const facts=await page.evaluate(()=>{
   const root=document.documentElement;
   const rows=[...document.querySelectorAll('#basic-information dl > div, #map-access dl > div')];
   return {overflow:Math.max(0,root.scrollWidth-innerWidth),tables:document.querySelectorAll('#basic-information table,#map-access table').length,vertical:rows.every(row=>{const a=row.querySelector('dt').getBoundingClientRect(),b=row.querySelector('dd').getBoundingClientRect();return b.top>=a.bottom && Math.abs(a.left-b.left)<1;}),reviewHeight:document.querySelector('#reviews').getBoundingClientRect().height,trustHeight:document.querySelector('#shop-information')?.getBoundingClientRect().height??null};
  });
  assert.equal(facts.overflow,0,`${area} ${width} overflow`);assert.equal(facts.tables,0);assert.equal(facts.vertical,true);
  const trust=page.locator('#shop-information details');
  if(await trust.count()) {
   await trust.locator('summary').focus();await page.keyboard.press('Enter');assert.ok(await trust.evaluate(el=>el.open));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   await page.keyboard.press('Enter');assert.equal(await trust.evaluate(el=>el.open),false);
  }
  const official=page.locator('#basic-information [data-shop-cta-kind="official"]');
  if(await official.count()) { await official.focus();assert.ok(await official.evaluate(el=>el===document.activeElement&&getComputedStyle(el).outlineStyle!=='none'));assert.equal(await official.getAttribute('href'),model.actions.find(a=>a.kind==='official').href); }
  for(const action of model.actions) assert.ok(await page.locator(`[data-shop-cta-kind="${action.kind}"]`).count()>0);
  await page.locator('#nearby').scrollIntoViewIfNeeded();assert.ok(await page.locator('#nearby a').count()>0);
  assert.ok(await page.locator('footer').count()>0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:`${out}/${area}-${width}.png`,fullPage:true});
  if (width === 390 || width === 1440 || width === 320) {
   for (const id of ['reviews', 'map-access', 'basic-information', 'nearby']) {
    await page.locator(`#${id}`).evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-230));
    await page.screenshot({path:`${out}/${area}-${width}-${id}.png`});
   }
  }
  report.scenarios.push({area,width,...facts,keyboardFocus:true,relatedFooter:true});
 }
 await page.close();
}
fs.writeFileSync(`${out}/browser-report.json`,JSON.stringify(report,null,2));
console.log(`PASS ${report.scenarios.length} scenarios; WordPress mapping and baseline SEO parity; ${out}`);
} finally {await browser.close();}
