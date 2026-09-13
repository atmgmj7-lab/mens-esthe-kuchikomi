import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = process.cwd();
let routeShops = [];
const cache = new Map();
const stubs = {
  'server-only': {},
  'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/lib/wp/client': null,
  '@/components/area/AreaHubPageTemplate': { AreaHubPageTemplate: () => null },
  '@/lib/wp/areas': {
    getChildAreas: async () => [], getSiblingAreas: async () => [], getParentArea: async () => null,
    getAreaRankingShops: async () => routeShops, getAreaBySlug: async () => null,
  },
  '@/lib/wp/area-shop-rankings': { getAreaShopRankings: async () => ({}) },
  '@/lib/wp/home-featured-areas': { getHomeFeaturedAreas: async () => [] },
  '@/lib/priority-area-hub': { loadPriorityAreaApprovedReviews: async () => null },
  '@/lib/wp/build-resilience': { withWpBuildFallback: async (_name, run) => run() },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }}).outputText;
  function localRequire(id) {
    if (id === '@/lib/wp/client') return load(resolve(root, 'lib/wp/text.ts'));
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(file), id);
      return load(['', '.ts', '.tsx', '.mjs'].map(ext => base + ext).find(existsSync) ?? base);
    }
    return require(id);
  }
  vm.runInNewContext(compiled, { module, exports: module.exports, require: localRequire, URL, Date, console, Intl, process }, { filename: file });
  return module.exports;
}
const { normalizeShop } = load(resolve(root, 'lib/wp/normalize.ts'));
const { buildShopDetailViewModel } = load(resolve(root, 'lib/shop-detail-view-model.ts'));
const { hashShopFactValue, buildShopInformationCoverage } = load(resolve(root, 'lib/shop-information-coverage.ts'));
assert.ok(existsSync(resolve(root, 'lib/area-verified-line-comparison.ts')), 'RED: verified LINE selector is not implemented');
const { buildAreaVerifiedLineComparison } = load(resolve(root, 'lib/area-verified-line-comparison.ts'));
const { AreaVerifiedLineSection } = load(resolve(root, 'components/area/hub/AreaVerifiedLineSection.tsx'));
const { renderAreaHubRouteContent } = load(resolve(root, 'components/area/AreaHubRouteContent.tsx'));
let checks = 0;
function equal(a, b, label) { checks++; assert.deepEqual(JSON.parse(JSON.stringify(a)), b, label); }
const area = { id: 13, slug: 'shinosaka', name: '新大阪', count: 3, acf: {} };
function shop(id = 1, overrides = {}) {
  const s = normalizeShop({ id, slug: `fixture-${id}`, title: { rendered: `店舗${id}` }, content: { rendered: '' }, excerpt: { rendered: '' },
    area: [13,17], acf: { shop_line: `https://lin.ee/Shop${id}`, shop_tel: '0612345678', official_url: 'https://example.com/', ...overrides },
    _embedded: { 'wp:term': [[{ id: 13, slug: 'shinosaka', name: '新大阪', taxonomy: 'area' }, { id: 17, slug: 'sakai', name: '堺東', taxonomy: 'area' }]] } });
  s.acf.shop_fact_provenance = [{ field: 'booking', sourceType: 'official-site', sourceUrl: 'https://www.example.com/contact/',
    observedAt: '2026-09-01', reviewedAt: '2026-09-02', reviewStatus: 'reviewed', publishedValueHash: hashShopFactValue('booking', buildShopDetailViewModel(s, area.name)) }];
  return s;
}
const select = s => buildAreaVerifiedLineComparison(area, [s]);
equal(select(shop()).map(s => s.shopId), [1], 'verified included');
for (const [field, value] of Object.entries({ sourceType: 'shop-provided', reviewStatus: 'pending', reviewedAt: '2026-02-30', observedAt: 'bad-date', publishedValueHash: '0'.repeat(64), sourceUrl: '' })) {
  const s = shop(); s.acf.shop_fact_provenance[0][field] = value; equal(select(s), [], `exclude ${field}`);
}
for (const patch of [{ sourceType: 'admin-verified' }, { reviewStatus: 'rejected' }, { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://other.example.com/' }, { sourceUrl: 'https://user:password@example.com/' }, { reviewedAt: '' }, { observedAt: '2026-02-30' }]) {
  const s = shop(); Object.assign(s.acf.shop_fact_provenance[0], patch); equal(select(s), [], `exclude ${JSON.stringify(patch)}`);
}
for (const value of [undefined, [], 'invalid']) { const s = shop(); s.acf.shop_fact_provenance = value; equal(select(s), [], 'raw only/missing provenance excluded'); }
for (const line of ['', 'javascript:alert(1)', 'https://example.com/line', 'https://line.me/', 'https://lin.ee/', 'https://line.me/ti/p/', 'https://line.me/ti/p/@', 'https://line.me.evil.example/ti/p/@shop', 'https://lin.ee/Shop/extra', 'https://user:pass@lin.ee/Shop', 'https://line.me/R/']) {
  equal(select(shop(1, { shop_line: line })), [], `exclude non shop LINE ${line}`);
}
for (const line of ['https://line.me/ti/p/@fixture', 'https://line.me/ti/p/%40fixture', 'https://lin.ee/Shop1']) equal(select(shop(1, { shop_line: line })).length, 1, 'valid shop LINE');
const changedTel = shop(); changedTel.acf.shop_tel = '0699999999'; equal(select(changedTel), [], 'full booking hash includes changed telephone');
const conflict = shop(); conflict.acf.shop_fact_provenance.push({ ...conflict.acf.shop_fact_provenance[0], reviewStatus: 'rejected' }); equal(select(conflict), [], 'conflicting same field');
const malformedConflict = shop(); malformedConflict.acf.shop_fact_provenance.push({ field: 'booking', reviewedAt: 'invalid' }); equal(select(malformedConflict), [], 'malformed same field cannot be ignored');
const duplicate = shop(); duplicate.acf.shop_fact_provenance.push({ ...duplicate.acf.shop_fact_provenance[0] }); equal(select(duplicate).length, 1, 'identical evidence is not conflict');
const unrelated = shop(); unrelated.acf.shop_fact_provenance.push({ field: 'hours' }); equal(select(unrelated).length, 1, 'unrelated evidence does not conflict');
const beforeCoverage = shop(); beforeCoverage.acf.shop_fact_provenance[0].sourceType = 'shop-provided';
equal(buildShopInformationCoverage(buildShopDetailViewModel(beforeCoverage, area.name), beforeCoverage.acf.shop_fact_provenance).verifiedCount, 1, 'legacy coverage keeps accepted source types');
const ordered = [shop(9), shop(3), shop(7, { is_pr: true })]; ordered[1].acf.shop_fact_provenance[0].reviewedAt = '2026-09-09';
equal(buildAreaVerifiedLineComparison(area, ordered).map(s => s.shopId), [9,3,7], 'input canonical order retained, not date/PR/rank sorted');
equal(buildAreaVerifiedLineComparison(area, ordered).at(-1).isPr, true, 'PR state retained');
for (const slug of ['.', '..', '%2e%2e', 'bad/slug', '%2Fexternal', 'bad%']) {
  const s = shop(); s.slug = slug; equal(select(s), [], 'unsafe slug excluded');
}
const outside = shop(); outside.terms = []; equal(select(outside), [], 'Area membership retained');
for (const a of [area, { ...area, id: 17, slug: 'sakai' }, { ...area, id: 4, slug: 'umeda' }, { ...area, id: 46, slug: 'sakaisujihonmachi' }, { ...area, id: 7, slug: 'nihonbashi' }]) {
  routeShops = ordered;
  const tree = await renderAreaHubRouteContent(a, 1);
  const slot = tree.props.slots?.afterComparison;
  const html = slot ? renderToStaticMarkup(slot) : '';
  const target = ['shinosaka','sakai'].includes(a.slug);
  equal((html.match(/id="area-verified-line"/g) ?? []).length, target ? 1 : 0, `${a.slug} slot exactly once or DOM0`);
  if (target) {
    equal((html.match(/data-verified-line-shop=/g) ?? []).length, 3, 'all shops SSR');
    assert.ok(html.includes('空き状況や即時予約の可否を示すものではありません')); checks++;
    assert.ok(html.includes('sponsored') && html.includes('PR広告')); checks++;
    equal((html.match(/<time /g) ?? []).length, 3, 'verified dates');
    equal((html.match(/<a /g) ?? []).length, 9, 'three links per shop');
  } else equal(html, '', 'no placeholder or empty wrappers');
  routeShops = []; const empty = await renderAreaHubRouteContent(a, 1); equal(empty.props.slots?.afterComparison ?? null, null, 'empty route slot');
}
equal(renderToStaticMarkup(React.createElement(AreaVerifiedLineSection, { shops: [] })), '', 'empty component DOM0');
const many = buildAreaVerifiedLineComparison(area, Array.from({ length: 9 }, (_, i) => shop(i + 1)));
const manyHtml = renderToStaticMarkup(React.createElement(AreaVerifiedLineSection, { shops: many }));
equal((manyHtml.match(/data-verified-line-shop=/g) ?? []).length, 9, 'collapsed items retain SSR content without JS');
assert.ok(!manyHtml.includes('application/ld+json')); checks++;
console.log(JSON.stringify({ pass: true, checks }));
export { load, root };
