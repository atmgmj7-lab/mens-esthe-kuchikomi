import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function declarationsFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

const packageJson = read("package.json");
const shopRankCell = read("components/common/ShopRankCell.tsx");
const shopRankCss = read("components/common/ShopRankCell.module.css");
const shopCard = read("components/area/hub/ShopCardLuxury.tsx");
const areaShopCard = read("components/common/AreaShopCard.tsx");
const areaShopCardCss = read("components/common/AreaShopCard.module.css");
const comparison = read("components/area/hub/RankingComparisonTable.tsx");
const globalCss = read("app/globals.css");

check(
  packageJson.includes('"test:area-ranking-responsive": "node scripts/check-area-ranking-responsive-contract.mjs"'),
  "area ranking responsive check must have its focused npm script"
);
check(
  packageJson.includes("npm run test:area-ranking-responsive"),
  "area ranking responsive check must be connected to the serial npm test chain"
);

check(
  /export function ShopRankCell\s*\(\s*\{\s*rank\s*,\s*className\s*\}/.test(shopRankCell),
  "ShopRankCell must expose the reusable rank and optional className API"
);
check(
  /rank:\s*number/.test(shopRankCell) && /className\?:\s*string/.test(shopRankCell),
  "ShopRankCell props must keep rank required and className optional"
);
check(
  /ShopRankCell/.test(areaShopCard) && /rank=\{model\.rank\}/.test(areaShopCard),
  "the shared AreaShopCard must render the independent ShopRankCell"
);
const mediaWrapIndex = areaShopCard.indexOf("className={styles.mediaWrap}");
check(
  mediaWrapIndex >= 0 && areaShopCard.indexOf("<ShopRankCell", mediaWrapIndex) > mediaWrapIndex,
  "AreaShopCard must render ShopRankCell inside the media wrapper"
);
check(
  !areaShopCard.includes("styles.rankSlot") && !areaShopCardCss.includes(".rankSlot"),
  "AreaShopCard must not reserve an independent rank column"
);
check(
  !areaShopCard.includes("styles.cardNoRank") && !areaShopCardCss.includes(".cardNoRank"),
  "ranked and unranked AreaShopCards must share one column structure"
);
check(
  /\.mediaWrap\s*\{[^}]*position:\s*relative/s.test(areaShopCardCss),
  "AreaShopCard media wrapper must establish the rank overlay containing block"
);
check(
  /\.rankOverlay\s*\{[^}]*position:\s*absolute/s.test(areaShopCardCss),
  "AreaShopCard rank badge must be positioned as an image overlay"
);
check(
  /\.card\s*\{[^}]*grid-template-columns:\s*240px minmax\(0,\s*1fr\) 164px/s.test(
    areaShopCardCss
  ),
  "AreaShopCard desktop columns must be media, content, and actions"
);
check(
  /@media \(max-width:\s*1280px\)[\s\S]*?\.card\s*\{[^}]*grid-template-columns:\s*220px minmax\(0,\s*1fr\) 164px/s.test(
    areaShopCardCss
  ),
  "AreaShopCard columns must use the 220px media width at 1280px and narrower"
);
check(
  /@media \(max-width:\s*1024px\)[\s\S]*?\.card\s*\{[^}]*grid-template-columns:\s*220px minmax\(0,\s*1fr\) 148px/s.test(
    areaShopCardCss
  ),
  "AreaShopCard columns must use the 148px action width at 1024px and narrower"
);
check(
  /@media \(max-width:\s*900px\)[\s\S]*?\.card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*grid-template-areas:\s*"header"\s*"media"\s*"body"\s*"actions"/s.test(
    areaShopCardCss
  ),
  "AreaShopCard must stack title, media, body, and actions in one column at 900px and narrower"
);
check(
  /AreaShopCard/.test(shopCard) && /rank=\{rank\}/.test(shopCard),
  "ShopCardLuxury must pass its compatible rank prop to AreaShopCard"
);
check(
  !/className="shop-card-luxury__rank"|shop-card-luxury__rank-(?:num|label)/.test(shopCard),
  "ShopCardLuxury must remove the image-overlay rank markup"
);

const rankRoot = declarationsFor(shopRankCss, ".root");
const rankNumber = declarationsFor(shopRankCss, ".number");
const rankUnit = declarationsFor(shopRankCss, ".unit");
check(
  /display:\s*inline-flex/.test(rankRoot) &&
    /align-items:\s*center/.test(rankRoot) &&
    /justify-content:\s*center/.test(rankRoot),
  "ShopRankCell must center its contents in both axes"
);
const numberLineHeight = rankNumber.match(/line-height:\s*(\d+)px/)?.[1];
const unitLineHeight = rankUnit.match(/line-height:\s*(\d+)px/)?.[1];
check(
  Boolean(numberLineHeight) && numberLineHeight === unitLineHeight,
  "rank number and unit must use the same fixed pixel line-height"
);
check(
  /display:\s*inline-flex/.test(rankNumber) &&
    /align-items:\s*center/.test(rankNumber) &&
    /display:\s*inline-flex/.test(rankUnit) &&
    /align-items:\s*center/.test(rankUnit),
  "rank number and unit must share centered inline-flex boxes so their vertical centers differ by at most 2px"
);

check(
  (comparison.match(/shops\.map\s*\(/g) ?? []).length === 1,
  "RankingComparisonTable must map shops exactly once"
);
check(
  (comparison.match(/data-comparison-row/g) ?? []).length === 1,
  "RankingComparisonTable must define one reusable row DOM"
);
check(
  /role="table"/.test(comparison) &&
    /role="columnheader"/.test(comparison) &&
    /role="row"/.test(comparison) &&
    /role="cell"/.test(comparison),
  "desktop comparison grid must retain table semantics"
);
check(
  !/<table\b|<thead\b|<tbody\b|<tr\b|<td\b|<th\b/.test(comparison),
  "comparison must use one responsive grid DOM instead of a fixed-width table"
);

const desktopRows = declarationsFor(globalCss, ".ranking-comparison-table__header,\n.ranking-comparison-table__row");
const mobileStart = globalCss.indexOf("@media (max-width: 760px)");
const mobileCss = mobileStart >= 0 ? globalCss.slice(mobileStart) : "";
check(
  /display:\s*grid/.test(desktopRows) && /grid-template-columns:/.test(desktopRows),
  "comparison rows must be a labelled grid at 761px and wider"
);
check(
  mobileStart >= 0 &&
    /\.ranking-comparison-table__header\s*\{[^}]*display:\s*none/s.test(mobileCss) &&
    /\.ranking-comparison-table__row\s*\{[^}]*grid-template-columns:\s*1fr/s.test(mobileCss),
  "comparison rows must become cards at 760px and narrower"
);
check(
  !/\.ranking-comparison-table\s*\{[^}]*min-width:\s*640px/s.test(globalCss),
  "comparison must remove the fixed 640px minimum width"
);
check(
  !/html,\s*\nbody\s*\{[^}]*overflow-x:\s*hidden/s.test(globalCss),
  "the page body must not hide horizontal overflow to mask responsive defects"
);

assert.deepEqual(failures, [], `Area ranking responsive contract failed:\n- ${failures.join("\n- ")}`);
console.log("area ranking responsive contract checks passed");
