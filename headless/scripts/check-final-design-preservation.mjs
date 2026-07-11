import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const kansai = read("components/KansaiAreaGrid.tsx");
assert.ok(kansai.includes("KANSAI_AREAS.map"), "accordion must render every prefecture from KANSAI_AREAS");
assert.ok(kansai.startsWith('"use client";'), "accordion interactivity must stay localized to KansaiAreaGrid");
assert.ok(kansai.includes("aria-expanded"), "accordion must expose aria-expanded state");
assert.ok(kansai.includes("onFocus"), "accordion must react to keyboard focus");
assert.ok(kansai.includes("onPointerEnter"), "accordion must react to pointer hover");
assert.ok(kansai.includes("掲載準備中"), "zero-count prefectures must show preparing state");
assert.ok(!kansai.includes("DB:"), "implementation DB notes must not be rendered in public UI");

const constants = read("lib/design-constants.ts");
for (const slug of ["osaka", "kyoto", "hyogo", "nara", "shiga", "wakayama"]) {
  assert.ok(constants.includes(`${slug}:`), `${slug} image source must remain`);
}
assert.ok(constants.includes("AREA_FEATURES"), "featured area section must be reusable, not single hard-coded component data only");

const feature = read("components/AreaFeatureSection.tsx");
assert.ok(feature.includes("AREA_FEATURES"), "feature section must render from reusable AREA_FEATURES");
assert.ok(feature.includes("areas?: AreaView[]"), "feature section must accept data from WordPress area view");
assert.ok(!feature.includes("DB:"), "feature section must not render DB notes");

const home = read("components/HomePageContent.tsx");
assert.ok(home.includes("<KansaiAreaGrid areas={areas} />"), "top page must keep image accordion");
assert.ok(home.includes("<AreaFeatureSection areas={areas} />"), "top page must keep image-based featured area section");
assert.ok(home.includes("編集部コメント・店舗提供情報・PRは口コミに含めません"), "top page must explain source separation");

const css = read("app/globals.css");
assert.ok(css.includes("Q-DESIGN final top accordion"), "final design CSS block must exist");
assert.ok(css.includes("prefers-reduced-motion"), "reduced motion support is required");
assert.ok(css.includes(":focus-visible"), "keyboard focus style is required");

const areaHub = read("components/area/AreaHubPageTemplate.tsx");
assert.ok(areaHub.includes("escomi-final-area-hero"), "area hub pages must use the final area hero layout");
assert.ok(areaHub.includes("AREA GUIDE"), "area hub hero must expose an area guide label");
assert.ok(areaHub.includes("shopCountLabel"), "area hub hero must use real area count state");
assert.ok(areaHub.includes("口コミ・編集部コメント・PR情報は分けて掲載"), "area hub hero must explain source separation");
assert.ok(!areaHub.includes("DB:"), "area hub page must not render implementation DB notes");

const areaPage = read("components/AreaPageView.tsx");
assert.ok(areaPage.includes("escomi-final-area-summary"), "standard area pages must keep final summary block");
assert.ok(areaPage.includes("掲載準備中"), "standard area pages must handle zero-count states safely");
assert.ok(areaPage.includes("口コミ・編集部コメント・PR情報は分けて掲載"), "standard area pages must explain source separation");
assert.ok(!areaPage.includes("DB:"), "standard area page must not render implementation DB notes");

assert.ok(css.includes("Q-DESIGN final area pages"), "final area page CSS block must exist");
assert.ok(css.includes("escomi-final-area-hero"), "area hero styles must exist");
assert.ok(css.includes("escomi-final-area-summary"), "standard area summary styles must exist");

const shopDetail = read("components/ShopDetail.tsx");
assert.ok(shopDetail.includes("escomi-final-shop-page"), "shop detail page must use final shop page shell");
assert.ok(shopDetail.includes("escomi-final-shop-header"), "shop detail page must use final shop hero header");
assert.ok(shopDetail.includes("primaryPriceLabel"), "shop detail hero must use normalized primary price display");
assert.ok(shopDetail.includes("料金は店舗へお問い合わせください。"), "shop detail hero must keep safe unknown-price copy");
assert.ok(shopDetail.includes("ユーザー口コミ、編集部コメント、店舗提供情報、PR情報は分けて掲載"), "shop detail hero must explain source separation");
assert.ok(shopDetail.includes('id="shop-price"'), "shop detail page must expose price anchor");
assert.ok(shopDetail.includes('id="shop-reviews"'), "shop detail page must expose reviews anchor");
assert.ok(shopDetail.includes('id="shop-data"'), "shop detail page must expose data anchor");
assert.ok(!shopDetail.includes("DB:"), "shop detail page must not render implementation DB notes");

const shopContact = read("components/ShopContactCta.tsx");
assert.ok(shopContact.includes('id="shop-contact"'), "shop contact CTA must expose contact anchor");

assert.ok(css.includes("Q-DESIGN final shop detail pages"), "final shop detail CSS block must exist");
assert.ok(css.includes("escomi-final-shop-header"), "shop hero styles must exist");
assert.ok(css.includes("escomi-final-shop-intro__quick-nav"), "shop quick-nav styles must exist");

const siteHeader = read("components/SiteHeader.tsx");
assert.ok(siteHeader.includes("escomi-final-site-header"), "site header must use final shared shell");
for (const label of ["店舗を探す", "エリアから探す", "口コミについて", "掲載について", "検索"]) {
  assert.ok(siteHeader.includes(label), `site header must keep ${label} navigation`);
}
assert.ok(!siteHeader.includes("DB:"), "site header must not render implementation DB notes");

const siteFooter = read("components/SiteFooter.tsx");
assert.ok(siteFooter.includes("escomi-final-site-footer"), "site footer must use final shared shell");
assert.ok(siteFooter.includes("ユーザー口コミ、編集部コメント、店舗提供情報、PR情報は分けて掲載"), "site footer must explain source separation");
for (const label of ["店舗を探す", "エリアから探す", "口コミ投稿", "お問い合わせ", "掲載について", "運営者情報"]) {
  assert.ok(siteFooter.includes(label), `site footer must keep ${label} navigation`);
}
assert.ok(!siteFooter.includes("DB:"), "site footer must not render implementation DB notes");

assert.ok(css.includes("Q-DESIGN final shared shell"), "final shared shell CSS block must exist");
assert.ok(css.includes("escomi-final-site-header"), "final site header styles must exist");
assert.ok(css.includes("escomi-final-site-footer"), "final site footer styles must exist");

console.log("final design preservation checks passed");
