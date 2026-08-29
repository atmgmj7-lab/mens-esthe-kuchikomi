import assert from "node:assert/strict";

const baseUrl = process.env.AREA_DEPTH_BASE_URL ?? "http://127.0.0.1:3101";
const fixtures = [
  {
    slug: "shinosaka",
    title: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較 | Eskomi",
    h1: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較",
    publicShopCount: 58,
    faqCount: 4,
    methodologyToken: "公開58店舗を母数",
  },
  {
    slug: "sakai",
    title: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較 | Eskomi",
    h1: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較",
    publicShopCount: 25,
    faqCount: 4,
    methodologyToken: "公開25店舗を母数",
  },
];

function jsonLdObjects(html) {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function collectTypes(value, types = []) {
  if (!value || typeof value !== "object") return types;
  if (typeof value["@type"] === "string") types.push(value["@type"]);
  for (const nested of Object.values(value)) collectTypes(nested, types);
  return types;
}

for (const fixture of fixtures) {
  const url = `${baseUrl}/area/${fixture.slug}/`;
  const response = await fetch(url);
  assert.equal(response.status, 200, `${fixture.slug} must return 200`);
  const html = await response.text();
  assert.ok(html.length > 250_000, `${fixture.slug} SSR response must contain the full area page`);

  assert.ok(html.includes(`<title>${fixture.title}</title>`), `${fixture.slug} title must be preserved`);
  assert.ok(html.includes(`>${fixture.h1}</h1>`), `${fixture.slug} H1 must be preserved`);
  assert.ok(
    html.includes(`<link rel="canonical" href="https://mens-esthe-kuchikomi.com/area/${fixture.slug}/"/>`),
    `${fixture.slug} canonical must be preserved`,
  );

  for (const block of ["coverage", "price", "hours", "station", "portal-therapist"]) {
    assert.ok(html.includes(`data-area-depth="${block}"`), `${fixture.slug} must SSR-render ${block}`);
  }
  assert.ok(
    html.indexOf('data-area-depth="coverage"') < html.indexOf("area-decision-guide"),
    `${fixture.slug} coverage must precede decision guide`,
  );
  assert.ok(
    html.indexOf('data-area-depth="portal-therapist"') < html.indexOf('id="shop-list"'),
    `${fixture.slug} cross-source data must precede the shop list`,
  );

  const schemas = jsonLdObjects(html);
  const itemLists = schemas.filter((schema) => schema["@type"] === "ItemList");
  const faqPages = schemas.filter((schema) => schema["@type"] === "FAQPage");
  assert.equal(itemLists.length, 1, `${fixture.slug} must emit one ItemList`);
  assert.equal(faqPages.length, 1, `${fixture.slug} must emit one FAQPage`);
  const itemList = itemLists[0];
  assert.equal(itemList.numberOfItems, fixture.publicShopCount);
  assert.equal(itemList.itemListElement.length, fixture.publicShopCount);
  assert.equal((html.match(/data-area-shop-card="true"/g) ?? []).length, fixture.publicShopCount);
  itemList.itemListElement.forEach((item, index) => assert.equal(item.position, index + 1));

  const faq = faqPages[0].mainEntity;
  assert.equal(faq.length, fixture.faqCount);
  assert.ok(faq.some((entry) => entry.acceptedAnswer.text.includes(fixture.methodologyToken)));
  for (const entry of faq) {
    assert.ok(html.includes(entry.name), `${fixture.slug} visible FAQ must include schema question`);
    assert.ok(html.includes(entry.acceptedAnswer.text), `${fixture.slug} visible FAQ must include schema answer`);
  }

  const types = schemas.flatMap((schema) => collectTypes(schema));
  assert.equal(types.includes("Review"), false, `${fixture.slug} must not emit Review schema`);
  assert.equal(types.includes("Rating"), false, `${fixture.slug} must not emit Rating schema`);
  assert.equal(types.includes("AggregateRating"), false, `${fixture.slug} must not emit AggregateRating schema`);
}

console.log(`area depth SSR checks passed (${baseUrl})`);
