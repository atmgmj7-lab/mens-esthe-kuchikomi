import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSourceLoader } from './lib/shop-detail-source-loader.mjs';
const load = createSourceLoader();
const model = { slug: 'test-shop', infoRows: [
  { key: 'hours', label: '営業時間', value: '10:00〜2:00' },
  { key: 'access', label: 'アクセス案内', value: '複数駅の案内を分割しない長文' },
  { key: 'official', label: '公式サイト', value: '公式サイトを見る', href: 'https://example.com/' }
], verifiedAt: '2026年9月13日', prices: [], featureNames: [] };
const render = (name, props) => renderToStaticMarkup(React.createElement(load(resolve(`components/shop-detail/${name}.tsx`))[name], props));
const failures = [];
function check(name, fn) { try { fn(); console.log(`PASS ${name}`); } catch (e) { failures.push(name + ': ' + e.message); } }
for (const [name, label, value, anchor] of [
  ['ShopBasicInformationSection', '営業時間', '10:00〜2:00', 'basic-information'],
  ['ShopAccessSection', 'アクセス案内', '複数駅の案内を分割しない長文', 'map-access']
]) check(name + ' semantic single column', () => {
  const html = render(name, { model, rel: 'noopener noreferrer' });
  assert.doesNotMatch(html, /<(table|th|td)\b/);
  assert.match(html, new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${value}`));
  assert.ok(html.includes(`id="${anchor}"`));
});
check('official tracking and verification preserved', () => {
 const html = render('ShopBasicInformationSection', { model, rel: 'noopener noreferrer' });
 for (const token of ['data-shop-cta-kind="official"', 'data-shop-cta-position="info"', 'data-shop-slug="test-shop"', '2026年9月13日', 'https://example.com/']) assert.ok(html.includes(token));
});
const coverage = { verifiedCount: 1, totalCount: 6, latestReviewedAt: '2026-09-13', items: [{ key: 'hours', label: '営業時間', verified: true }] };
check('coverage-only overview is compact disclosure', () => {
 const html = render('ShopOverviewSection', { model, coverage });
 assert.doesNotMatch(html, /こだわり・店舗紹介/);
 assert.match(html, /<details/); assert.match(html, /<summary/);
 assert.ok(html.includes('id="shop-information"')); assert.ok(html.includes('2026年9月13日'));
});
const context = { model, coverage, review: { status: 'available', totalApproved: 0, showGraph: false, latest: [], metrics: [], aggregateRating: null, aggregateRatingCount: 0, dateRange: { oldestSubmittedAt: null, latestSubmittedAt: null } } };
const reviewProps = { context, modules: [{ id: 'reviews', renderer: 'reviews' }], nearbyContent: null, rel: '', reviewSubmitUrl: '/review-submit/?shop=test-shop', reviewResult: { status: 'available', page: { total: 0, reviews: [] } } };
check('zero reviews compact and retains destinations', () => {
 const html = render('ShopDetailModuleList', reviewProps);
 assert.ok(html.includes('この店舗の承認済み口コミはまだありません。'));
 assert.doesNotMatch(html, /評価グラフは|承認済みユーザー口コミを、/);
 for (const href of ['/shops/test-shop/reviews', '/reviews', '/review-submit?shop=test-shop']) assert.ok(html.includes(href), html);
});
check('unavailable reviews must not become zero', () => {
 const html = render('ShopDetailModuleList', { ...reviewProps, context: { ...context, review: { status: 'unavailable', reason: 'request-failed' } } });
 assert.match(html, /口コミ情報を現在取得できません/);
 assert.doesNotMatch(html, /この店舗の承認済み口コミはまだありません/);
});
check('existing nonzero review rendering and threshold retained', () => {
 for (const count of [1, 2, 3]) {
  const review = { ...context.review, totalApproved: count, showGraph: count >= 3, aggregateRating: count >= 3 ? 4 : null, aggregateRatingCount: count };
  const html = render('ShopDetailModuleList', { ...reviewProps, context: { ...context, review } });
  assert.equal(html.includes('<svg'), count >= 3);
  assert.match(html, /承認済みユーザー口コミを、/);
 }
});
check('description retains introduction and empty overview is absent', () => {
 assert.match(render('ShopOverviewSection', { model: { ...model, introductionText: '公開された紹介本文' }, coverage }), /公開された紹介本文/);
 assert.equal(render('ShopOverviewSection', { model, coverage: null }), '');
});
check('empty WordPress values omitted by real ViewModel', () => {
 const { buildShopDetailViewModel } = load(resolve('lib/shop-detail-view-model.ts'));
 const empty = buildShopDetailViewModel({ id: 1, slug: 'empty', title: 'Empty', acf: {}, contentHtml: '', officialUrl: '', imageUrl: '' }, '');
 assert.equal(empty.infoRows.length, 0);
 assert.equal(empty.actions.length, 0);
 assert.doesNotMatch(render('ShopBasicInformationSection', { model: empty, rel: '' }), /<dt|未確認|情報なし/);
 assert.match(render('ShopBasicInformationSection', { model: empty, rel: '' }), /id="hours-access"/);
});
assert.equal(failures.length, 0, failures.join('\n'));
