import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {chromium} from '@playwright/test';
import {createSourceLoader} from './lib/shop-detail-source-loader.mjs';
const load=createSourceLoader();
const {buildShopDetailViewModel}=load(resolve('lib/shop-detail-view-model.ts'));
const {ShopDetailActions}=load(resolve('components/shop-detail/ShopDetailActions.tsx'));
const css=fs.readFileSync('components/shop-detail/ShopDetail.module.css','utf8')+'\n'+fs.readFileSync('app/globals.css','utf8');
const cases=[
 ['A',{shop_tel:'070-1234-5678',shop_line:'https://line.me/example',official_url:'https://example.com'},['official','line'],true],
 ['A-safe-area',{shop_tel:'070-1234-5678',shop_line:'https://line.me/example',official_url:'https://example.com'},['official','line'],true],
 ['B',{shop_line:'https://line.me/example',official_url:'https://example.com'},['official','line'],false],
 ['C',{shop_tel:'070-1234-5678'},['tel'],true],
 ['D',{shop_tel:'070-1234-5678',shop_booking_url:'https://example.com/book'},['reservation','tel'],true],
 ['E',{shop_line:'https://line.me/example'},['line'],false],
 ['F',{shop_tel:'invalid',official_url:'https://example.com'},['official'],false],
 ['F-empty',{shop_tel:''},[],false],
 ['D-dedupe',{shop_tel:'070-1234-5678',shop_booking_url:'https://example.com',official_url:'https://example.com',shop_line:'https://line.me/example'},['reservation','line'],true],
];
const browser=await chromium.launch({headless:true});const results=[];const failures=[];let checks=0;
const check=(ok,message)=>{checks++;if(!ok)failures.push(message);};
try {for(const [name,acf,fixedKinds,hasTel]of cases){
 const model=buildShopDetailViewModel({id:1,slug:'fixture',title:'Fixture',acf,officialUrl:acf.official_url??'',imageUrl:'',contentHtml:''},'');
 const action=props=>renderToStaticMarkup(React.createElement(ShopDetailActions,{model,rel:'noreferrer',...props}));
 const markup=`<style>${css}</style><main class="page" data-shop-detail-root><header class="hero">${action({position:'hero'})}</header>${action({position:'fixed',fixed:true})}</main><footer><a class="hl-back-to-top" href="#" aria-label="ページトップへ">↑</a></footer>`;
 for(const js of [true,false]){const context=await browser.newContext({javaScriptEnabled:js});const page=await context.newPage();
 for(const width of [320,375,390,1440]){await page.setViewportSize({width,height:900});await page.setContent(name==='A-safe-area'?markup.replaceAll('env(safe-area-inset-bottom)','34px'):markup);
 const state=await page.evaluate(()=>{const anchors=[...document.querySelectorAll('[data-shop-cta-kind]')];const visible=anchors.filter(n=>!!n.getClientRects().length);const top=document.querySelector('.hl-back-to-top').getBoundingClientRect();const fixed=visible.filter(n=>n.dataset.shopCtaPosition==='fixed');return {visibleTel:visible.filter(n=>n.dataset.shopCtaKind==='tel').map(n=>n.getAttribute('href')),fixedKinds:fixed.map(n=>n.dataset.shopCtaKind),overlap:fixed.some(n=>{const r=n.getBoundingClientRect();return Math.min(r.right,top.right)>Math.max(r.left,top.left)&&Math.min(r.bottom,top.bottom)>Math.max(r.top,top.top)}),topSize:[top.width,top.height],targets:visible.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height]}),clipping:visible.some(n=>n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1),overflow:document.documentElement.scrollWidth>innerWidth,allTel:anchors.filter(n=>n.dataset.shopCtaKind==='tel').map(n=>n.getAttribute('href'))};});
 const key=`${name}/${width}/${js}`;
 check(state.visibleTel.length===(hasTel?1:0),key+' exactly one visible canonical phone');
 check(state.allTel.every(h=>h===model.actions.find(a=>a.kind==='tel')?.href),key+' href from existing model');
 check(!state.overlap,key+' top/CTA hit overlap zero');check(!state.clipping&&!state.overflow,key+' clipping/overflow0');
 if(width<761){check(JSON.stringify(state.fixedKinds)===JSON.stringify(fixedKinds),key+' fixed priority/dedupe');check(state.targets.every(([w,h])=>w>=44&&h>=44),key+' CTA44px');if(fixedKinds.length)check(state.topSize.every(n=>n>=44),key+' top44px');}
 for(const a of await page.locator('[data-shop-cta-kind]:visible,.hl-back-to-top').all()){await a.focus();check(await a.evaluate(n=>n===document.activeElement),key+' focus reachable');}
 results.push({case:name,width,js,...state});
 }await context.close();}
}}finally{await browser.close();}
if(process.env.MOBILE_CONTACT_EVIDENCE)fs.writeFileSync(process.env.MOBILE_CONTACT_EVIDENCE,JSON.stringify({checks,failures,results},null,2));
console.log(JSON.stringify({checks,scenarios:results.length,failures:failures.length,firstFailures:failures.slice(0,6)}));assert.equal(failures.length,0,'mobile phone / hit-area contract');
