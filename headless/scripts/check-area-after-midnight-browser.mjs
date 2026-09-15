import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
const origin=process.env.MIDNIGHT_QA_BASE_URL??'http://127.0.0.1:3137';
const url=new URL(origin);
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.pathname==='/'&&!url.username&&!url.password,'loopback only');
const dir=process.env.MIDNIGHT_DATA_DIR;
assert.ok(dir,'evidence directory required');
const capture=process.env.MIDNIGHT_CAPTURE_BASE==='1';
const browser=await chromium.launch({headless:true});
let checks=0;const results=[];
const equal=(a,b,label)=>{checks++;assert.deepEqual(a,b,label);};
try {
 for(const [slug,total,count,line] of [['shinosaka',58,22,19],['sakai',25,9,5]]) {
  const response=await fetch(`${origin}/area/${slug}/`);equal(response.status,200,slug);
  const html=await response.text();await fs.writeFile(resolve(dir,`${capture?'base':'after'}-${slug}.html`),html);
  for(const javaScriptEnabled of [true,false]) {
   const context=await browser.newContext({javaScriptEnabled,serviceWorkers:'block'});
   await context.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();
   for(const width of [320,390,1440]) {
    await page.setViewportSize({width,height:900});await page.goto(`${origin}/area/${slug}/`,{waitUntil:'networkidle'});
    const state=await page.evaluate(()=>({
     seo:{title:document.title,h1:[...document.querySelectorAll('h1')].map(n=>n.textContent),meta:[...document.querySelectorAll('meta[name="description"],meta[name="robots"],link[rel="canonical"]')].map(n=>n.outerHTML),schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent))},
     cards:document.querySelectorAll('[data-area-shop-card="true"]').length,
     line:document.querySelectorAll('[data-verified-line-shop]').length,
     firstShopY:document.querySelector('[data-area-shop-card="true"]').getBoundingClientRect().top+scrollY,
     overflow:document.documentElement.scrollWidth>innerWidth,
    }));
    equal(state.cards,total,'shop cards');equal(state.line,line,'LINE retained');equal(state.overflow,false,'page overflow');
    const itemLists=[];function visit(v){if(!v||typeof v!=='object')return;if(v['@type']==='ItemList')itemLists.push(v);for(const x of Object.values(v)) if(typeof x==='object')visit(x);}
    visit(state.seo.schema);assert.ok(itemLists.some(x=>x.numberOfItems===total&&x.itemListElement.length===total),'full ItemList');checks++;
    const key=`${slug}-${width}-${javaScriptEnabled}`;
    if(capture) await fs.writeFile(resolve(dir,`base-${key}.json`),JSON.stringify(state));
    else {
     const base=JSON.parse(await fs.readFile(resolve(dir,`base-${key}.json`),'utf8'));
     equal(state.seo,base.seo,'SEO/schema exact parity');equal(state.firstShopY,base.firstShopY,'first shop distance unchanged');
     const section=page.locator('#area-after-midnight');equal(await section.isVisible(),true,'new comparison visible');
     const rows=section.locator('[data-after-midnight-shop]');equal(await rows.count(),count,'qualified count');
     const readiness=JSON.parse(await fs.readFile(resolve(dir,'readiness.json'),'utf8')).find(a=>a.slug===slug);
     equal((await rows.evaluateAll(ns=>ns.map(n=>Number(n.dataset.afterMidnightShop)))).sort((a,b)=>a-b),readiness.rows.filter(s=>s.qualified).map(s=>s.id).sort((a,b)=>a-b),'audited IDs');
     const box=await section.boundingBox();assert.ok(box.height<360,'closed module under 360px');checks++;
     const summary=section.locator('summary');await summary.focus();await page.keyboard.press('Enter');
     equal(await section.locator('details').evaluate(n=>n.open),true,'keyboard opens without JS dependency');equal(await rows.last().isVisible(),true,'all shops accessible');
     for(const row of await rows.all()) {const links=row.locator('a');equal(await links.count(),2,'detail and source links');for(const link of await links.all()){const b=await link.boundingBox();assert.ok(b.height>=40,'tap target');checks++;}}
     equal(await section.evaluate(n=>n.scrollWidth<=n.clientWidth),true,'expanded module no overflow');
     if(javaScriptEnabled) await section.screenshot({path:resolve(dir,`midnight-${slug}-${width}.png`)});
     await summary.focus();await page.keyboard.press('Enter');equal(await section.locator('details').evaluate(n=>n.open),false,'keyboard closes');
     if(javaScriptEnabled){
      const drawer=page.locator('.area-shop-list-mobile-drawer');if(await drawer.isVisible())await drawer.locator('summary').click();
      const filter=page.locator('.area-filter-chips:visible').getByRole('button',{name:'料金掲載あり',exact:true});await filter.click();equal(await filter.getAttribute('aria-pressed'),'true','filter works');await filter.click();
      const sorts=page.locator('.area-sort-tabs:visible button');await sorts.nth(1).click();equal(await sorts.nth(1).getAttribute('aria-pressed'),'true','sort works');await sorts.first().click();
     }
    }
    results.push({slug,width,javaScriptEnabled,...state,pass:true});
   }
   await context.close();
  }
 }
} finally{await browser.close();}
await fs.writeFile(resolve(dir,`${capture?'base-browser':'browser'}.json`),JSON.stringify({pass:true,checks,results},null,2));
console.log(JSON.stringify({pass:true,checks,scenarios:results.length}));
