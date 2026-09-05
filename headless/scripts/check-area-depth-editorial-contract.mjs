import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import vm from "node:vm";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

function loadTypeScript(file) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports }, { filename: file });
  return module.exports;
}

function loadTsx(file, overrides = {}) {
  const compiled = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === "react/jsx-runtime") return jsxRuntime;
    if (Object.hasOwn(overrides, id)) return overrides[id];
    throw new Error(`Unexpected require from ${file}: ${id}`);
  };
  vm.runInNewContext(
    compiled,
    { module, exports: module.exports, require: localRequire },
    { filename: file },
  );
  return module.exports;
}

for (const file of [
  "lib/area-depth-editorial.ts",
  "components/area/AreaEditorialDepth.tsx",
  "components/area/AreaEditorialDepth.module.css",
]) {
  assert.ok(existsSync(join(root, file)), `${file} must exist`);
}

const dataModule = loadTypeScript("lib/area-depth-editorial.ts");
const {
  AREA_DEPTH_FEATURE_FLAGS,
  resolveAreaDepthEditorial,
  buildAreaDepthMethodologyFaq,
} = dataModule;

assert.equal(typeof resolveAreaDepthEditorial, "function");
assert.equal(typeof buildAreaDepthMethodologyFaq, "function");
assert.equal(Object.values(AREA_DEPTH_FEATURE_FLAGS).every(Boolean), true);

const shinosaka = resolveAreaDepthEditorial("shinosaka", 58);
const sakai = resolveAreaDepthEditorial("sakai", 25);
assert.ok(shinosaka);
assert.ok(sakai);
assert.equal(resolveAreaDepthEditorial("shinosaka", 57), null, "count drift must fail closed");
assert.equal(resolveAreaDepthEditorial("sakai", 26), null, "count drift must fail closed");
assert.equal(resolveAreaDepthEditorial("umeda", 58), null, "non-target areas must be unchanged");

assert.equal(shinosaka.expectedPublicShopCount, 58);
assert.equal(shinosaka.price.sampleSize, 18);
assert.equal(shinosaka.price.medianYen, 15000);
assert.equal(shinosaka.hours.verifiedCount, 26);
assert.equal(shinosaka.hours.parsableSampleSize, 21);
assert.equal(shinosaka.station.sampleSize, 15);
assert.equal(shinosaka.therapists.profileCount, 192);
assert.equal(shinosaka.portals.multiPortalShopCount, 22);
assert.equal(shinosaka.gscStatus, "EVIDENCE_AVAILABLE");
assert.equal(JSON.stringify(shinosaka.fieldCoverage.map((field) => field.verifiedCount)), JSON.stringify([30, 14, 15, 13, 27, 18, 26, 17]));
assert.equal(JSON.stringify(shinosaka.price.bands.map((band) => band.count)), JSON.stringify([1, 1, 4, 6, 6]));
assert.equal(JSON.stringify(shinosaka.station.buckets.map((bucket) => bucket.count)), JSON.stringify([13, 1, 0, 1, 0]));
assert.equal(JSON.stringify(shinosaka.therapists.ageBands.map((band) => band.count)), JSON.stringify([78, 54, 27, 3, 5]));
assert.equal(shinosaka.portals.presenceShopCount, 39);
assert.equal(shinosaka.portals.maximumConfirmedPortalCount, 4);

assert.equal(sakai.expectedPublicShopCount, 25);
assert.equal(sakai.price.status, "LIMITED_SAMPLE");
assert.equal(sakai.price.sampleSize, 5);
assert.equal(sakai.hours.afterMidnightCount, 12);
assert.equal(sakai.station.sampleSize, 6);
assert.equal(sakai.therapists.availableShopCount, 3);
assert.equal(sakai.portals.multiPortalShopCount, 6);
assert.equal(sakai.gscStatus, "DATA_REQUIRED");
assert.equal(JSON.stringify(sakai.fieldCoverage.map((field) => field.verifiedCount)), JSON.stringify([11, 5, 6, 5, 12, 5, 12, 10]));
assert.equal(JSON.stringify(sakai.price.bands.map((band) => band.count)), JSON.stringify([0, 3, 1, 0, 1]));
assert.equal(JSON.stringify(sakai.station.buckets.map((bucket) => bucket.count)), JSON.stringify([6, 0]));
assert.equal(JSON.stringify(sakai.therapists.ageBands.map((band) => band.count)), JSON.stringify([18, 34, 11, 0, 0]));
assert.equal(sakai.portals.presenceShopCount, 18);
assert.equal(sakai.portals.maximumConfirmedPortalCount, 4);

for (const editorial of [shinosaka, sakai]) {
  for (const field of editorial.fieldCoverage) {
    assert.equal(field.missingCount, editorial.expectedPublicShopCount - field.verifiedCount);
    assert.equal(
      field.verificationRate,
      Math.round((field.verifiedCount / editorial.expectedPublicShopCount) * 1000) / 10,
    );
  }
}

const components = loadTsx("components/area/AreaEditorialDepth.tsx", {
  "./AreaEditorialDepth.module.css": new Proxy({}, { get: (_target, key) => String(key) }),
});

assert.equal(
  typeof components.AreaSupportingInfoDisclosure,
  "function",
  "Area supporting information must expose a semantic disclosure wrapper",
);

function renderAll(editorial) {
  return [
    "AreaEditorialCoverageBlock",
    "AreaEditorialPortalTherapist",
    "AreaEditorialPriceSummary",
    "AreaEditorialHoursSummary",
    "AreaEditorialStationSummary",
  ].map((name) => {
    assert.equal(typeof components[name], "function", `${name} must be exported`);
    return renderToStaticMarkup(React.createElement(components[name], { editorial }));
  }).join("");
}

const shinosakaHtml = renderAll(shinosaka);
const sakaiHtml = renderAll(sakai);
const shinosakaCoverageHtml = renderToStaticMarkup(
  React.createElement(components.AreaEditorialCoverageBlock, { editorial: shinosaka }),
);
const shinosakaSupportingHtml = renderToStaticMarkup(
  React.createElement(
    components.AreaSupportingInfoDisclosure,
    { areaLabel: shinosaka.areaLabel },
    React.createElement(components.AreaEditorialCoverageBlock, { editorial: shinosaka }),
    React.createElement(components.AreaEditorialPortalTherapist, { editorial: shinosaka }),
  ),
);

for (const [html, expected] of [
  [shinosakaHtml, ["58店舗", "30件", "51.7%", "18件", "15,000円", "26件", "新大阪13件", "192名", "22店舗"]],
  [sakaiHtml, ["25店舗", "11件", "44%", "確認済み5件の限定標本", "11,000円", "12件", "堺東6件", "63名", "6店舗"]],
]) {
  const visibleText = html.replace(/<[^>]+>/g, "");
  for (const token of expected) assert.ok(visibleText.includes(token), `SSR markup must include ${token}`);
  assert.ok(visibleText.includes("2026年8月29日"), "SSR markup must show observed date");
  assert.ok(visibleText.includes("公式情報"), "SSR markup must label first-party evidence");
}

assert.match(sakaiHtml, /全体の相場を示すものではありません/);
assert.match(shinosakaHtml, /複数の外部媒体で掲載を確認した店舗/);
assert.match(shinosakaHtml, /外部媒体は公開掲載の確認事実/);
assert.doesNotMatch(shinosakaHtml + sakaiHtml, /No\.1|掲載数No\.1|地域最多|一番多い|最大\d+媒体|おすすめ順位|口コミ評価|星評価/);
assert.doesNotMatch(shinosakaHtml + sakaiHtml, />0円</);
assert.doesNotMatch(shinosakaCoverageHtml, /<p[^>]*>未確認/, "coverage dl must keep missing counts in dt/dd semantics");
assert.match(shinosakaSupportingHtml, /^<details[^>]*data-area-supporting-disclosure="true"/);
assert.doesNotMatch(shinosakaSupportingHtml, /^<details[^>]*\sopen(?:=|\s|>)/, "supporting information must be collapsed by default");
assert.match(shinosakaSupportingHtml, /<summary[^>]*>[^<]*新大阪の調査データ・選び方を見る/);
const shinosakaSupportingText = shinosakaSupportingHtml.replace(/<[^>]+>/g, "");
for (const token of ["公開58店舗", "30件", "51.7%", "192名", "22店舗", "2026年8月29日"]) {
  assert.ok(shinosakaSupportingText.includes(token), `collapsed SSR markup must retain ${token}`);
}

const shinosakaFaq = buildAreaDepthMethodologyFaq(shinosaka);
const sakaiFaq = buildAreaDepthMethodologyFaq(sakai);
assert.match(shinosakaFaq.answer, /58店舗/);
assert.match(sakaiFaq.answer, /25店舗/);
assert.match(shinosakaFaq.answer, /2026年8月29日/);
assert.doesNotMatch(sakaiFaq.answer, /検索数|順位は0/);

const template = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(template.includes("const editorial = resolveAreaDepthEditorial(area.slug, mainShops.length)"));
assert.ok(template.includes("faqJsonLd(faqItems)"));
assert.ok(template.includes("<AreaFaqSection items={faqItems}"));
assert.ok(
  template.includes("shopItemListJsonLd(mainShops.filter((shop) => !shop.ranking.isPr)"),
  "ItemList must retain the visible-list source and PR guard",
);
const coverageIndex = template.indexOf("<AreaEditorialCoverageBlock");
const decisionIndex = template.indexOf("<AreaHubDecisionGuide");
const editorialIndex = template.indexOf("<AreaEditorialPortalTherapist");
const shopListIndex = template.indexOf('id="shop-list"');
assert.ok(coverageIndex >= 0 && coverageIndex < decisionIndex, "coverage must be first below the hero");
assert.ok(editorialIndex >= 0 && editorialIndex < shopListIndex, "portal/therapist must precede shop list");
assert.equal((template.match(/<AreaEditorialCoverageBlock/g) ?? []).length, 1, "coverage renderer must not be duplicated");
assert.equal((template.match(/<AreaEditorialPortalTherapist/g) ?? []).length, 1, "cross-source renderer must not be duplicated");
assert.match(template, /const supportingInformation = \([\s\S]*?<AreaEditorialCoverageBlock[\s\S]*?<AreaHubDecisionGuide[\s\S]*?<AreaEditorialPortalTherapist/);
assert.match(template, /editorial \? \([\s\S]*?<AreaSupportingInfoDisclosure areaLabel=\{editorial\.areaLabel\}>[\s\S]*?\{supportingInformation\}[\s\S]*?<\/AreaSupportingInfoDisclosure>[\s\S]*?: supportingInformation/);

const css = read("components/area/AreaEditorialDepth.module.css");
assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(css, /@media\s*\(max-width:\s*767px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.match(css, /min-width:\s*0/);
assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden|opacity:\s*0/);

console.log("area depth editorial contract checks passed");
