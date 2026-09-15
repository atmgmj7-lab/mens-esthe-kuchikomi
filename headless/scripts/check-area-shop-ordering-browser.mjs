import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
const origin=process.env.ORDERING_QA_BASE_URL??'http://127.0.0.1:3140';
const url=new URL(origin),dir=process.env.ORDERING_DATA_DIR;
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'&&!url.username&&!url.password,'loopback only');assert.ok(dir,'evidence directory');
const expected=JSON.parse(await fs.readFile(resolve(dir,'ordering.json'),'utf8'));
const browser=await chromium.launch({headless:true});let checks=0;const results=[];
const equal=(a,b,label)=>{checks++;assert.deepEqual(a,b,label);};
function itemLists(value,result=[]){if(!value||typeof value!=='object')return result;if(value['@type']==='ItemList')result.push(value);for(const v of Object.values(value))if(typeof v==='object')itemLists(v,result);return result;}
function orderInvariant(value){if(Array.isArray(value))return value.map(orderInvariant);if(!value||typeof value!=='object')return value;
 const output=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,orderInvariant(v)]));
 if(value['@type']==='ItemList')output.itemListElement=output.itemListElement.map(({position,...entry})=>entry).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 return output;
}
try{
 for(const [slug,total,midnight,line]of [['shinosaka',58,22,19],['sakai',25,9,5]]){
  const raw=JSON.parse(await fs.readFile(resolve(dir,`${slug}.json`),'utf8'));
  const byId=new Map(raw.map(s=>[s.id,s]));const ordered=expected.find(a=>a.slug===slug).entries;
  const slugs=ordered.map(e=>byId.get(e.id).slug);
  const response=await fetch(`${origin}/area/${slug}/`);equal(response.status,200,slug);await fs.writeFile(resolve(dir,`after-${slug}.html`),await response.text());
  for(const javaScriptEnabled of [true,false]){
   const context=await browser.newContext({javaScriptEnabled,serviceWorkers:'block'});
   await context.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`${origin}/area/${slug}/`,{waitUntil:'networkidle'});
    const state=await page.evaluate(()=>({
     seo:{title:document.title,h1:[...document.querySelectorAll('h1')].map(n=>n.textContent),meta:[...document.querySelectorAll('meta[name="description"],meta[name="robots"],link[rel="canonical"]')].map(n=>n.outerHTML),schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent))},
     slugs:[...document.querySelectorAll('#shop-list [data-area-shop-card="true"]')].map(n=>n.querySelector('a[href^="/shops/"]').getAttribute('href').split('/')[2]),
     firstShopY:document.querySelector('[data-area-shop-card="true"]').getBoundingClientRect().top+scrollY,
     overflow:document.documentElement.scrollWidth>innerWidth,
     sorts:[...document.querySelectorAll('#shop-list .area-sort-tabs button')].map(n=>n.textContent),
     ranking:document.querySelectorAll('#ranking,[aria-label^="おすすめランキング"]').length,
     midnight:document.querySelectorAll('[data-after-midnight-shop]').length,line:document.querySelectorAll('[data-verified-line-shop]').length,
    }));
    const base=JSON.parse(await fs.readFile(resolve(dir,`base-${slug}-${width}-${javaScriptEnabled}.json`),'utf8'));
    equal(state.slugs,slugs,'default visible DOM order is verified server order');equal(state.slugs.length,total,'all cards retained');
    equal(orderInvariant(state.seo),orderInvariant(base.seo),'SEO parity except permitted ItemList order/position');
    const list=itemLists(state.seo.schema).find(x=>x.numberOfItems===total);assert.ok(list,'full ItemList');checks++;
    equal(list.itemListElement.map(e=>e.position),Array.from({length:total},(_,i)=>i+1),'contiguous positions');
    equal(list.itemListElement.map(e=>e.url??e.item?.url),slugs.map(s=>`https://mens-esthe-kuchikomi.com/shops/${s}/`),'ItemList mirrors default DOM');
    equal(state.sorts,['情報充実順','情報充実順'],'only safe default sort');equal(state.ranking,0,'no misleading numerical rank');
    equal(state.midnight,midnight,'midnight module retained');equal(state.line,line,'LINE module retained');equal(state.overflow,false,'no horizontal overflow');
    assert.ok(state.firstShopY<=base.firstShopY,`first shop not farther: ${state.firstShopY} vs ${base.firstShopY}`);checks++;
    if(javaScriptEnabled){
     const first=page.locator('#shop-list [data-area-shop-card="true"]').first();await first.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(dir,`ordering-${slug}-${width}.png`)});
     const drawer=page.locator('.area-shop-list-mobile-drawer');if(await drawer.isVisible())await drawer.locator('summary').click();
     const filter=page.locator('.area-filter-chips:visible').getByRole('button',{name:'24時以降営業確認済み',exact:true});await filter.focus();await page.keyboard.press('Enter');equal(await filter.getAttribute('aria-pressed'),'true','keyboard filter');
     equal(await page.locator('#shop-list [data-area-shop-card="true"]').count(),midnight,'verified midnight filter count');
     await filter.focus();await page.keyboard.press('Enter');equal(await page.locator('#shop-list [data-area-shop-card="true"]').count(),total,'reset restores all shops');
     await page.goto(`${origin}/area/${slug}/?sort=price-asc`,{waitUntil:'networkidle'});equal(new URL(page.url()).searchParams.has('sort'),false,'unsafe legacy price query discarded');
     equal(await page.locator('#shop-list [data-area-shop-card="true"]').evaluateAll(ns=>ns.map(n=>n.querySelector('a[href^="/shops/"]').getAttribute('href').split('/')[2])),slugs,'legacy query cannot reorder by price');
    } else {
     await page.locator('#shop-list [data-area-shop-card="true"]').last().scrollIntoViewIfNeeded();equal(await page.locator('#shop-list [data-area-shop-card="true"]').last().isVisible(),true,'no-JS last shop accessible');
    }
    results.push({slug,width,javaScriptEnabled,...state,pass:true});
   }
   await context.close();
  }
 }
}finally{await browser.close();}
await fs.writeFile(resolve(dir,'browser.json'),JSON.stringify({pass:true,checks,results},null,2));console.log(JSON.stringify({pass:true,checks,scenarios:results.length}));
