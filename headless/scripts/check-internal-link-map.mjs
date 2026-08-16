import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shopDetailIntegrationEvidence } from "./check-final-design-preservation.mjs";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const areaHubTemplate = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(
  areaHubTemplate.includes("AreaHubDecisionGuide"),
  "area hub pages must expose the consolidated decision guide"
);

const areaDecisionGuide = read("components/area/hub/AreaHubDecisionGuide.tsx");
for (const href of ["#shop-list", "#price-table", "#late-night", "#reviews"]) {
  assert.ok(areaDecisionGuide.includes(href), `area hub decision links must include ${href}`);
}

const shopCardLuxury = read("components/area/hub/ShopCardLuxury.tsx");
const areaShopCard = read("components/common/AreaShopCard.tsx");
const areaShopCardViewModel = read("lib/area-shop-card-view-model.ts");
assert.ok(
  shopCardLuxury.includes("<AreaShopCard") &&
    areaShopCard.includes("href={model.title.href}") &&
    areaShopCardViewModel.includes('const shopPath = `/shops/${shop.slug}/`;'),
  "area detail shop cards must link to shop detail pages"
);

const shopDetail = [
  read("components/ShopDetail.tsx"),
  read("components/shop-detail/ShopDetailSections.tsx"),
  read("components/shop-detail/ShopDetailModuleList.tsx")
].join("\n");
assert.ok(
  shopDetail.includes("ShopRelatedLinks") && shopDetail.includes('id="nearby"'),
  "shop detail must expose a focused related-page section"
);
assert.ok(
  shopDetail.includes("この店舗の口コミを書く") &&
    shopDetail.includes("buildReviewSubmitUrl(shop.slug)") &&
    shopDetail.includes("reviewSubmitUrl={reviewSubmitUrl}") &&
    shopDetail.includes("href={reviewSubmitUrl}"),
  "shop detail must link to review submission"
);
const shopRelatedLinks = read("components/shop-detail/ShopRelatedLinks.tsx");
for (const href of ["/area/", "/reviews/", "/shops/"]) {
  assert.ok(shopRelatedLinks.includes(href), `shop related links must include ${href}`);
}
assert.ok(shopRelatedLinks.includes("href={reviewSubmitUrl}"), "shop related links must use the approved submit URL");

const fullShopDetailHtml = shopDetailIntegrationEvidence.full.html;
for (const href of [
  'href="#prices"',
  'href="#map-access"',
  'href="#reviews"',
  'href="#nearby"',
  'href="/reviews/submit?shop=integration-shop"'
]) {
  assert.ok(fullShopDetailHtml.includes(href), `rendered full shop detail must include ${href}`);
}

const sparseShopDetailHtml = shopDetailIntegrationEvidence.sparse.html;
assert.ok(!sparseShopDetailHtml.includes('href="#prices"'));
assert.ok(!sparseShopDetailHtml.includes('href="#map-access"'));
assert.ok(sparseShopDetailHtml.includes('href="#reviews"'));
assert.ok(sparseShopDetailHtml.includes('href="#nearby"'));
assert.ok(!sparseShopDetailHtml.includes("#ranking"));
assert.ok(!sparseShopDetailHtml.includes("#price-table"));
assert.ok(
  sparseShopDetailHtml.includes('href="/reviews/submit?shop=sparse-shop"'),
  "rendered sparse shop detail must keep the review submission link"
);
assert.equal(shopDetailIntegrationEvidence.full.captures.relatedProps.length, 1);
assert.equal(shopDetailIntegrationEvidence.full.captures.relatedProps[0].primaryArea.slug, "osaka");
assert.equal(shopDetailIntegrationEvidence.sparse.captures.relatedProps[0].primaryArea, null);

const css = read("app/globals.css");
assert.ok(
  css.includes("area-decision-guide__grid"),
  "consolidated area decision link styles must be present"
);

console.log("internal link map checks passed");
