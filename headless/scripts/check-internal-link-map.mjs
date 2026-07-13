import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const shopDetail = read("components/ShopDetail.tsx");
assert.ok(
  shopDetail.includes("同エリアランキング") && shopDetail.includes('`${areaPath}#ranking`'),
  "shop detail top navigation must link to same-area ranking"
);
assert.ok(
  shopDetail.includes("口コミ投稿") && shopDetail.includes("buildReviewSubmitUrl(shop.slug)"),
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

const css = read("app/globals.css");
assert.ok(
  css.includes("S-40 internal links"),
  "S-40 internal link styles must be present"
);

console.log("internal link map checks passed");
