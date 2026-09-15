import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const origin=process.env.FEATURED_QA_BASE_URL??'http://127.0.0.1:3142';
const url=new URL(origin),dir=process.env.FEATURED_DATA_DIR;
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'&&!url.username&&!url.password,'loopback only');assert.ok(dir,'evidence directory');
const expected=JSON.parse(await fs.readFile(resolve(dir,'featured.json'),'utf8'));
const browser=await chromium.launch({headless:true});let checks=0;const results=[];
const equal=(a,b,label)=>{checks++;assert.deepEqual(a,b,label);};
try{
 for(const [slug,total,midnight,line]of [['shinosaka',58,22,19],['sakai',25,9,5]]){
  const raw=JSON.parse(await fs.readFile(resolve(dir,`${slug}.json`),'utf8'));const byId=new Map(raw.map(s=>[s.id,s]));
  const order=expected.find(a=>a.slug===slug).naturalOrder.map(id=>byId.get(id).slug);
  const featureIds=slug==='shinosaka'?[712,768]:[];
  for(const id of featureIds){const response=await fetch(`${origin}/shops/${byId.get(id).slug}/`);equal(response.status,200,'featured detail link HTTP200');}
  const response=await fetch(`${origin}/area/${slug}/`);equal(response.status,200,'Area HTTP200');await fs.writeFile(resolve(dir,`after-${slug}.html`),await response.text());
  for(const javaScriptEnabled of [true,false]){
   const context=await browser.newContext({javaScriptEnabled,serviceWorkers:'block'});
   await context.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`${origin}/area/${slug}/`,{waitUntil:'domcontentloaded'});await page.locator('#shop-list [data-area-shop-card="true"]').first().waitFor({state:'visible'});
    const state=await page.evaluate(()=>({
     seo:{title:document.title,h1:[...document.querySelectorAll('h1')].map(n=>n.textContent),meta:[...document.querySelectorAll('meta[name="description"],meta[name="robots"],link[rel="canonical"]')].map(n=>n.outerHTML),schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent))},
     naturalSlugs:[...document.querySelectorAll('#shop-list [data-area-shop-card="true"]')].map(n=>n.querySelector('a[href^="/shops/"]').getAttribute('href').split('/')[2]),
     firstShopY:document.querySelector('#shop-list [data-area-shop-card="true"]').getBoundingClientRect().top+scrollY,
     overflow:document.documentElement.scrollWidth>innerWidth,
     featured:[...document.querySelectorAll('[data-editorial-featured-shop]')].map(n=>Number(n.dataset.editorialFeaturedShop)),
     midnight:document.querySelectorAll('[data-after-midnight-shop]').length,line:document.querySelectorAll('[data-verified-line-shop]').length,
     sorts:[...document.querySelectorAll('#shop-list .area-sort-tabs button')].map(n=>n.textContent),
    }));
    const base=JSON.parse(await fs.readFile(resolve(dir,`base-${slug}-${width}-${javaScriptEnabled}.json`),'utf8'));
    equal(state.seo,base.seo,'exact metadata and all schema parity');equal(state.naturalSlugs,order,'natural order unchanged');equal(state.naturalSlugs.length,total,'natural cards retained');
    equal(state.featured,featureIds,'exact featured IDs and order');equal(state.midnight,midnight,'midnight retained');equal(state.line,line,'LINE retained');equal(state.overflow,false,'page no overflow');equal(state.sorts,['情報充実順','情報充実順'],'ordering controls unchanged');
    const module=page.locator('#area-editorial-featured');let moduleHeight=0;
    if(featureIds.length){
     equal(await module.isVisible(),true,'featured visible without JS');
     const box=await module.boundingBox();moduleHeight=box.height;assert.ok(box.height<=320,'compact module at all widths');checks++;
     const links=module.locator('a');equal(await links.count(),2,'one unambiguous CTA per shop');equal(await module.locator('img').count(),2,'two existing images');
     equal(await links.evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),featureIds.map(id=>`/shops/${byId.get(id).slug}/`),'correct store links');
     equal(await module.locator('[aria-label^="おすすめランキング"],script[type="application/ld+json"]').count(),0,'no rank/schema');equal(await module.locator('[aria-label="PR広告"]').count(),0,'current data non-PR');
     await links.first().focus();await page.keyboard.press('Tab');equal(await links.nth(1).evaluate(n=>n===document.activeElement),true,'keyboard CTA sequence');
     assert.ok(state.firstShopY-base.firstShopY<=352,'natural first-shop added distance within compact module budget');checks++;
     const featureY=await links.first().evaluate(n=>n.getBoundingClientRect().top+scrollY);assert.ok(featureY<base.firstShopY,'first editorial shop reachable before previous first shop');checks++;
     if(javaScriptEnabled){await module.scrollIntoViewIfNeeded();await module.screenshot({path:resolve(dir,`featured-${slug}-${width}.png`)});}
    }else{equal(await module.count(),0,'Sakai no empty module');equal(state.firstShopY,base.firstShopY,'Sakai first-shop position unchanged');}
    if(!javaScriptEnabled){const last=page.locator('#shop-list [data-area-shop-card="true"]').last();await last.scrollIntoViewIfNeeded();equal(await last.isVisible(),true,'no-JS complete natural list');}
    results.push({slug,width,javaScriptEnabled,moduleHeight,firstShopDelta:state.firstShopY-base.firstShopY,...state,pass:true});
   }
   await context.close();
  }
 }
}finally{await browser.close();}
await fs.writeFile(resolve(dir,'browser.json'),JSON.stringify({pass:true,checks,results},null,2));console.log(JSON.stringify({pass:true,checks,scenarios:results.length}));
