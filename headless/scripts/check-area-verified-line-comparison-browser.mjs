import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { extractShopViews } from './lib/area-visibility-data-contract.mjs';
import { load, root } from './check-area-verified-line-comparison-contract.mjs';

const origin = process.env.LINE_QA_BASE_URL ?? 'http://127.0.0.1:3133';
const target = new URL(origin);
assert.ok(target.protocol === 'http:' && target.hostname === '127.0.0.1' && target.pathname === '/' && !target.username && !target.password, 'loopback only');
const evidenceDir = process.env.LINE_QA_EVIDENCE_DIR;
assert.ok(evidenceDir, 'LINE_QA_EVIDENCE_DIR must contain Step0 data and pre-change base HTML');
const step0 = JSON.parse(await fs.readFile(resolve(evidenceDir, 'step0.json'), 'utf8'));
const { buildAreaVerifiedLineComparison } = load(resolve(root, 'lib/area-verified-line-comparison.ts'));
const browser = await chromium.launch({ headless: true });
let checks = 0;
const results = [];
function equal(a,b,label) { checks++; assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label); }
try {
  for (const [slug,id] of [['shinosaka',13],['sakai',17],['umeda',4],['sakaisujihonmachi',46],['nihonbashi',7]]) {
    const response = await fetch(`${origin}/area/${slug}/`); equal(response.status,200,slug);
    const html = await response.text();
    await fs.writeFile(resolve(evidenceDir, `after-${slug}.html`), html);
    const before = await fs.readFile(resolve(evidenceDir, `base-${slug}.html`), 'utf8');
    const expected = buildAreaVerifiedLineComparison({ id,slug,name:slug }, extractShopViews(html));
    if (step0[slug]) equal(expected.map(s=>s.shopId).sort((a,b)=>a-b),step0[slug].shops.map(s=>s.id).sort((a,b)=>a-b),'fresh module IDs equal pre-implementation audited IDs');
    for (const javaScriptEnabled of [true,false]) {
      const context = await browser.newContext({ javaScriptEnabled, serviceWorkers:'block' });
      await context.route('**/*', route => route.request().method()==='GET' && new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const width of step0[slug] ? [320,390,1024,1440] : [390,1440]) {
        await page.setViewportSize({ width,height:900 });
        await page.goto(`${origin}/area/${slug}/`,{ waitUntil:'networkidle' });
        const section = page.locator('#area-verified-line');
        equal(await section.count(),expected.length ? 1:0,`${slug} ${width} JS=${javaScriptEnabled} section`);
        const parity = await page.evaluate(base => {
          const previous = new DOMParser().parseFromString(base,'text/html');
          const seo = doc => ({ title:doc.title, h1:[...doc.querySelectorAll('h1')].map(n=>n.textContent),
            meta:[...doc.querySelectorAll('meta[name="description"],meta[name="robots"],link[rel="canonical"]')].map(n=>n.outerHTML),
            relatedLinks:[...doc.querySelectorAll('#area-discovery-links a,#related-areas a')].map(n=>[n.textContent,n.getAttribute('href')]),
            schema:[...doc.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)) });
          return { before:seo(previous),after:seo(document),overflow:document.documentElement.scrollWidth>innerWidth };
        },before);
        equal(parity.after,parity.before,'title/meta/H1/canonical/robots/schema and ItemList parity');
        equal(parity.overflow,false,'no page overflow');
        if (expected.length) {
          const rows=section.locator('[data-verified-line-shop]');
          equal(await rows.evaluateAll(ns=>ns.map(n=>Number(n.dataset.verifiedLineShop))),expected.map(s=>s.shopId),'canonical subset order');
          for (let i=0;i<expected.length;i++) {
            equal(await rows.nth(i).locator('a').evaluateAll(ns=>ns.map(n=>n.getAttribute('href'))),[expected[i].lineUrl,expected[i].shopDetailUrl,expected[i].sourceUrl],'all three SSR links');
            equal(await rows.nth(i).locator('time').getAttribute('datetime'),expected[i].reviewedAt,'date provenance');
          }
          const summary=section.locator('summary');
          if (await summary.count()) {
            equal(await section.locator('details').getAttribute('open'),null,'details initially closed');
            await summary.focus(); await page.keyboard.press('Enter');
            equal(await section.locator('details').evaluate(n=>n.open),true,'keyboard opens native details');
            equal(await rows.last().isVisible(),true,'last row visible without JS dependency');
            await summary.focus(); await page.keyboard.press('Enter');
            equal(await section.locator('details').evaluate(n=>n.open),false,'keyboard closes native details');
          }
          await rows.first().locator('a').first().focus(); await page.keyboard.press('Tab');
          equal(await rows.first().locator('a').nth(1).evaluate(n=>n===document.activeElement),true,'keyboard link navigation');
          equal(await section.evaluate(n=>n.scrollWidth<=n.clientWidth),true,'module no overflow');
          if (javaScriptEnabled) await section.screenshot({ path:resolve(evidenceDir,`line-${slug}-${width}.png`) });
        }
        if (javaScriptEnabled && expected.length) {
          const drawer = page.locator('.area-shop-list-mobile-drawer');
          if (await drawer.isVisible()) await drawer.locator('summary').click();
          const filter = page.locator('.area-filter-chips:visible').getByRole('button', { name:'料金掲載あり',exact:true });
          await filter.click(); equal(await filter.getAttribute('aria-pressed'),'true','existing filter toggles');
          assert.ok(new URL(page.url()).searchParams.get('filters')?.includes('price')); checks++;
          await filter.click(); equal(await filter.getAttribute('aria-pressed'),'false','existing filter clears');
          const sorts = page.locator('.area-sort-tabs:visible button');
          await sorts.nth(1).click(); equal(await sorts.nth(1).getAttribute('aria-pressed'),'true','existing sort toggles');
          await sorts.first().click(); equal(await sorts.first().getAttribute('aria-pressed'),'true','canonical listing restored');
          const tabs=page.locator('#compare-tabs [role="tab"]');
          for (let i=0;i<await tabs.count();i++) {
            await tabs.nth(i).click(); equal(await tabs.nth(i).getAttribute('aria-selected'),'true','existing comparison tab');
          }
          const faq=page.locator('#faq button[aria-expanded]').first();
          const oldOpen=await faq.getAttribute('aria-expanded'); await faq.click();
          equal(await faq.getAttribute('aria-expanded'),oldOpen==='true'?'false':'true','existing FAQ toggles');
          equal(await section.locator('[data-verified-line-shop]').count(),expected.length,'existing interactions preserve LINE subset');
        }
        results.push({slug,width,javaScriptEnabled,displayCount:expected.length,pass:true});
      }
      await context.close();
    }
  }
} finally { await browser.close(); }
await fs.writeFile(resolve(evidenceDir,'browser.json'),JSON.stringify({pass:true,checks,results},null,2));
console.log(JSON.stringify({pass:true,checks,scenarios:results.length}));
