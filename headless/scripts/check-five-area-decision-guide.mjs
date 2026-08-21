import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const config = read("lib/area-hub-config.ts");
const template = read("components/area/AreaHubPageTemplate.tsx");
const component = read("components/area/hub/AreaHubDecisionGuide.tsx");
const css = read("app/globals.css");

const priorityAreas = ["sakaisujihonmachi", "sakai", "nihonbashi", "shinosaka", "umeda"];
const configuredAreas = ["sakaisujihonmachi", "shinosaka", "nihonbashi", "nanba", "umeda", "sakai"];
const uniqueIntroductions = [
  "掲載料金、営業時間、承認済み口コミ、店舗詳細の公式導線など、確認できる項目から比較",
  "URLは変えず堺東をページの主語とし、確認できる料金、営業時間、口コミ、店舗詳細から候補を比較",
  "東京の日本橋と混同せず、確認できる料金、営業時間、口コミ、店舗詳細から大阪日本橋の候補を比較",
  "掲載料金、営業時間、承認済み口コミ、店舗詳細の公開情報から、新大阪の候補を比較",
  "確認できる掲載料金、営業時間、承認済み口コミ、店舗詳細から梅田の候補を比較"
];

function areaConfigBlock(slug) {
  const start = config.indexOf(`  ${slug}: {`);
  assert.notEqual(start, -1, `Missing area config: ${slug}`);
  const laterStarts = configuredAreas
    .map((candidate) => config.indexOf(`  ${candidate}: {`, start + 1))
    .filter((candidateStart) => candidateStart > start);
  const end = laterStarts.length > 0 ? Math.min(...laterStarts) : config.indexOf("\n};", start);
  return config.slice(start, end);
}

for (const slug of priorityAreas) {
  assert.ok(
    areaConfigBlock(slug).includes("decisionGuide:"),
    `${slug} must have decision-guide content`
  );
}

for (const introduction of uniqueIntroductions) {
  assert.ok(config.includes(introduction), `Missing unique area introduction: ${introduction}`);
}

assert.doesNotMatch(
  areaConfigBlock("nanba"),
  /decisionGuide:/,
  "Non-priority Nanba must not receive the five-area decision guide"
);

for (const href of ["#shop-list", "#price-table", "#late-night", "#reviews"]) {
  assert.ok(component.includes(`href: "${href}"`), `Decision guide must link to ${href}`);
}

for (const helper of ["hasPublishedPrice", "isLateNightShop", "aggregateReviewCountLabel"]) {
  assert.ok(component.includes(helper), `Decision guide must reuse safe helper ${helper}`);
}

for (const safeFallback of ["料金情報を確認中", "営業時間から確認", "口コミ募集中"]) {
  assert.ok(component.includes(safeFallback), `Decision guide must include safe fallback: ${safeFallback}`);
}

assert.ok(!component.includes("★"), "Decision guide must not invent star ratings");
assert.ok(!component.includes("0円"), "Decision guide must not render zero-yen pricing");

assert.ok(
  template.includes("escomi-final-area-hero__inner"),
  "Area hero must have an inner content-width wrapper"
);
assert.ok(template.includes("AreaHubDecisionGuide"), "Area template must render the decision guide");
assert.ok(!template.includes("NEXT CHECK"), "Legacy NEXT CHECK panel must be removed");
assert.ok(!template.includes("SECTION_NAV_CHIPS"), "Legacy hero chips must be removed");
assert.ok(!template.includes("PAGE_ANCHOR_LINKS"), "Legacy anchor navigation must be removed");

assert.match(
  css,
  /\.escomi-final-area-hero\.escomi-final-area-hero--photo\s*\{[\s\S]*?border-radius:\s*0;/,
  "Photo hero must have square corners"
);
assert.match(
  css,
  /\.escomi-final-area-hero__inner\s*\{[\s\S]*?max-width:\s*var\(--hl-area-container-max,[\s\S]*?padding-inline:\s*var\(--hl-area-gutter,/,
  "Hero content must use the same desktop width and gutter as the area body"
);
assert.match(
  css,
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.escomi-final-area-hero__inner\s*\{[\s\S]*?padding-inline:\s*var\(--hl-gutter-sm\)/,
  "Hero content must use the same mobile gutter as the area body"
);
assert.match(
  css,
  /\.area-decision-guide__grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  "Decision guide must use four desktop columns"
);
assert.match(
  css,
  /@media\s*\(max-width:\s*767px\)[\s\S]*?\.area-decision-guide__grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "Decision guide must use a two-by-two mobile grid"
);

console.log("five area decision guide checks passed");
