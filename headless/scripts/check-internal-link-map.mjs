import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shopDetailIntegrationEvidence } from "./check-final-design-preservation.mjs";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const areaHubTemplate = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(
  areaHubTemplate.includes("escomi-s40-area-link-map"),
  "area hub pages must expose an S-40 internal link map"
);
for (const href of ["#shop-list", "#ranking", "#price-table", "#beginner", "#related-areas"]) {
  assert.ok(areaHubTemplate.includes(href), `area hub internal links must include ${href}`);
}

const shopCardLuxury = read("components/area/hub/ShopCardLuxury.tsx");
assert.ok(
  shopCardLuxury.includes("詳細を見る") && shopCardLuxury.includes('href={`/shops/${shop.slug}/`}'),
  "area detail shop cards must link to shop detail pages"
);

const shopDetail = [
  read("components/ShopDetail.tsx"),
  read("components/shop-detail/ShopDetailSections.tsx")
].join("\n");
assert.ok(
  shopDetail.includes("同エリアランキング") && shopDetail.includes('`${areaPath}#ranking`'),
  "shop detail top navigation must link to same-area ranking"
);
assert.ok(
  shopDetail.includes("この店舗の口コミを投稿する") &&
    shopDetail.includes("buildReviewSubmitUrl(shop.slug)") &&
    shopDetail.includes("reviewSubmitUrl={reviewSubmitUrl}") &&
    shopDetail.includes("href={reviewSubmitUrl}"),
  "shop detail must link to review submission"
);
assert.ok(
  shopDetail.includes("料金比較") && shopDetail.includes('`${areaPath}#price-table`'),
  "shop detail top navigation must link back to same-area price comparison"
);

const shopAreaLinks = read("components/common/ShopAreaHubLinks.tsx");
for (const href of ["#ranking", "#price-table", "#reviews"]) {
  assert.ok(shopAreaLinks.includes(href), `shop area related links must include ${href}`);
}

const fullShopDetailHtml = shopDetailIntegrationEvidence.full.html;
for (const href of [
  'href="#shop-price"',
  'href="#shop-data"',
  'href="#shop-reviews"',
  'href="/area/osaka/#ranking"',
  'href="/area/osaka/#price-table"',
  'href="/reviews/submit/?shop=integration-shop"'
]) {
  assert.ok(fullShopDetailHtml.includes(href), `rendered full shop detail must include ${href}`);
}

const sparseShopDetailHtml = shopDetailIntegrationEvidence.sparse.html;
assert.ok(!sparseShopDetailHtml.includes('href="#shop-price"'));
assert.ok(!sparseShopDetailHtml.includes('href="#shop-data"'));
assert.ok(sparseShopDetailHtml.includes('href="#shop-reviews"'));
assert.ok(!sparseShopDetailHtml.includes("#ranking"));
assert.ok(!sparseShopDetailHtml.includes("#price-table"));
assert.ok(
  sparseShopDetailHtml.includes('href="/reviews/submit/?shop=sparse-shop"'),
  "rendered sparse shop detail must keep the review submission link"
);
assert.equal(shopDetailIntegrationEvidence.full.captures.areaHubProps.length, 1);
assert.equal(shopDetailIntegrationEvidence.full.captures.areaQuickProps[0].current, "osaka");
assert.equal(shopDetailIntegrationEvidence.sparse.captures.areaHubProps.length, 0);

const css = read("app/globals.css");
assert.ok(
  css.includes("S-40 internal links"),
  "S-40 internal link styles must be present"
);

console.log("internal link map checks passed");
