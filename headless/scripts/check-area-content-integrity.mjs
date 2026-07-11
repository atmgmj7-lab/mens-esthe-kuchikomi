import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");

const checks = [
  {
    file: "lib/area-content-integrity.ts",
    includes: [
      "slug: \"shinosaka\"",
      "近鉄日本橋",
      "谷町九丁目",
      "slug: \"sakai\"",
      "梅田駅",
      "filterAreaFaqRows",
      "sanitizeAreaHtml",
      "sanitizeAreaText",
    ],
  },
  {
    file: "lib/area-seo.ts",
    includes: ["getAreaStationNames", "extractStationKeywords(shops, 4, area.slug)"],
    excludes: ["for (const keyword of STATION_KEYWORDS)"],
  },
  {
    file: "components/AreaPageView.tsx",
    includes: ["sanitizeAreaHtml", "filterAreaFaqRows"],
  },
  {
    file: "app/area/[slug]/page.tsx",
    includes: ["sanitizeAreaText(area.slug, area.acf.area_characteristics || area.description)"],
  },
  {
    file: "components/ShopDetail.tsx",
    excludes: ["日本橋・近鉄日本橋・なんば周辺で検討しやすい"],
  },
  {
    file: "app/shops/[slug]/page.tsx",
    excludes: ["日本橋メンズエステの口コミ・料金・営業時間", "isNihonbashiShop(shop)"],
  },
];

const failures = [];

for (const check of checks) {
  const source = read(check.file);
  for (const needle of check.includes ?? []) {
    if (!source.includes(needle)) {
      failures.push(`${check.file}: missing ${needle}`);
    }
  }
  for (const needle of check.excludes ?? []) {
    if (source.includes(needle)) {
      failures.push(`${check.file}: forbidden ${needle}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Area content integrity check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Area content integrity check passed.");
