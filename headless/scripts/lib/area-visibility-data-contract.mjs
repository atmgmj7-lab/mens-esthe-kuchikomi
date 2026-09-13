import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Only these two positive count tokens are derived from current WP ShopViews.
// Everything else, including fixed copy and versioned editorial numbers, stays.
function supportingEvidence(text) {
  assert.equal(typeof text, 'string');
  const values = {};
  let fixed = text;
  for (const [key, label] of [['priced', '料金掲載'], ['lateNight', '深夜候補']]) {
    const pattern = new RegExp(`${label} ([0-9]+)店舗`, 'g');
    const matches = [...text.matchAll(pattern)];
    assert.equal(matches.length, 1, `${label}: exactly one positive-count token required`);
    values[key] = Number(matches[0][1]);
    assert.ok(Number.isSafeInteger(values[key]) && values[key] > 0, `${label}: positive integer`);
    fixed = fixed.replace(pattern, `${label} {${key}}店舗`);
  }
  return { fixed, values };
}

export function compareImmutableEvidence(before, after) {
  const immutable = (evidence) => ({
    ...evidence,
    supportingDomText: supportingEvidence(evidence.supportingDomText).fixed,
    supportingSsrText: supportingEvidence(evidence.supportingSsrText).fixed,
  });
  assert.deepEqual(immutable(after), immutable(before), 'immutable SEO/schema/fixed supporting copy');
}

export function assertCurrentFacts(source, { ssr, dom, noJs }) {
  assert.equal(ssr, dom, 'same-run full SSR/hydrated supporting text');
  assert.equal(dom, noJs, 'same-run full hydrated/no-JS supporting text');
  for (const [surface, text] of Object.entries({ ssr, dom, noJs })) {
    assert.deepEqual(supportingEvidence(text).values, source, `${surface}: counts must match source ShopViews`);
  }
}

export function extractShopViews(html) {
  // Decode JSON Flight envelopes, never execute scripts from the response.
  const chunks = [];
  for (const match of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)) {
    const envelope = JSON.parse(match[1]);
    if (envelope[0] === 1) {
      assert.equal(typeof envelope[1], 'string');
      chunks.push(envelope[1]);
    }
  }
  const candidates = [];
  function visit(value, inShopList = false) {
    if (!value || typeof value !== 'object') return;
    const inside = inShopList || value.id === 'shop-list';
    if (inside && Object.hasOwn(value, 'shops')) candidates.push(value.shops);
    for (const nested of Object.values(value)) visit(nested, inside);
  }
  for (const row of chunks.join('').split('\n')) {
    const match = row.match(/^[0-9a-f]+:(\[.*|\{.*)$/i);
    if (match) visit(JSON.parse(match[1]));
  }
  assert.equal(candidates.length, 1, 'exactly one shop-list source ShopView array');
  const shops = candidates[0];
  assert.ok(Array.isArray(shops) && shops.length > 0, 'source shops present');
  assert.equal(new Set(shops.map((shop) => shop.id)).size, shops.length, 'source shop IDs unique');
  for (const shop of shops) {
    assert.ok(Number.isInteger(shop.id) && typeof shop.slug === 'string');
    assert.ok(shop.acf && typeof shop.acf === 'object' && !Array.isArray(shop.acf));
    for (const value of Object.values(shop.acf)) {
      assert.ok(typeof value !== 'string' || !/^\$[0-9a-f]+(?::|$)/i.test(value), 'unresolved Flight source reference');
    }
  }
  return shops;
}

function compile(source, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, ...globals });
  return module.exports;
}

let predicates;
export function currentSourceFacts(shops) {
  if (!predicates) {
    const read = (name) => fs.readFileSync(new URL(`../../lib/${name}`, import.meta.url), 'utf8');
    const normalization = compile(read('shop-fact-normalization.ts'));
    const price = compile(read('price-normalization.ts'));
    const source = read('area-shop-utils.ts');
    const ast = ts.createSourceFile('area-shop-utils.ts', source, ts.ScriptTarget.Latest, true);
    const names = ['shopHoursText', 'isLateNightShop', 'extractShopConfirmedPriceYen', 'hasPublishedPrice'];
    const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
    assert.equal(declarations.length, names.length, 'production predicate declarations available');
    predicates = compile(declarations.map((node) => node.getText(ast)).join('\n'), {
      normalizeShopDisplayText: normalization.normalizeShopDisplayText,
      resolveShopPrimaryPrice: price.resolveShopPrimaryPrice,
    });
  }
  return {
    priced: shops.filter(predicates.hasPublishedPrice).length,
    lateNight: shops.filter(predicates.isLateNightShop).length,
  };
}
export function currentSourcePrices(shops) {
  currentSourceFacts(shops);
  return shops.map(predicates.extractShopConfirmedPriceYen);
}
