import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = join(headlessRoot, "..");
const readHeadless = (file) => readFileSync(join(headlessRoot, file), "utf8");
const readRepository = (file) => readFileSync(join(repositoryRoot, file), "utf8");

const visibleBrandFiles = [
  "components/SiteHeader.tsx",
  "components/SiteFooter.tsx",
  "lib/seo.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/column/page.tsx",
  "lib/static-pages.ts",
  "app/api/contact/route.ts",
  "lib/contact-validation.ts",
  "app/dashboard/page.tsx",
  "components/area/hub/ShopImageThumb.tsx",
  "lib/home-hero-config.ts",
  "scripts/check-contact-env.mjs",
  "scripts/performance-check.mjs",
  "scripts/seo-cutover-check.mjs",
  "scripts/url-parity-check.mjs"
];

const visibleBrandRepositoryFiles = [
  "area-seo-hooks.php",
  "front-page.php",
  "functions.php",
  "single-shop.php"
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/<!--?[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, " "));
}

function oldVisibleBrandOccurrences(file, source) {
  const visibleSource = stripComments(source);
  const matches = [];
  const pattern = /(?:Escomi|ESCOMI)(?!_)/g;
  for (const match of visibleSource.matchAll(pattern)) {
    const line = visibleSource.slice(0, match.index).split("\n").length;
    matches.push(`${file}:${line}:${match[0]}`);
  }
  return matches;
}

const oldVisibleBrand = [
  ...visibleBrandFiles.flatMap((file) => oldVisibleBrandOccurrences(`headless/${file}`, readHeadless(file))),
  ...visibleBrandRepositoryFiles.flatMap((file) => oldVisibleBrandOccurrences(file, readRepository(file)))
];

assert.deepEqual(
  oldVisibleBrand,
  [],
  `可視ラテン英字の旧ブランド表記が残っています:\n${oldVisibleBrand.join("\n")}`
);

const expectedVisibleBrand = [
  ["components/SiteHeader.tsx", "Eskomi<span"],
  ["components/SiteFooter.tsx", "Eskomi<span"],
  ["lib/seo.ts", 'SITE_NAME = "Eskomi | 関西メンズエステ口コミナビ"'],
  ["lib/seo.ts", 'siteName: "Eskomi"'],
  ["lib/seo.ts", 'name: "Eskomi"'],
  ["app/layout.tsx", 'template: "%s | Eskomi"'],
  ["app/layout.tsx", 'siteName: "Eskomi"'],
  ["app/page.tsx", 'title: "Eskomi | 関西メンズエステ口コミナビ"'],
  ["app/column/page.tsx", 'description: "Eskomiの新着コラム・体験レポート一覧です。"'],
  ["lib/static-pages.ts", "Eskomi（エスコミ）"],
  ["app/api/contact/route.ts", "【Eskomi】お問い合わせ"],
  ["lib/contact-validation.ts", "【Eskomi お問い合わせフォーム】"],
  ["app/dashboard/page.tsx", "Eskomi Growth Command"],
  ["components/area/hub/ShopImageThumb.tsx", ">Eskomi</span>"],
  ["lib/home-hero-config.ts", 'eyebrow: "ESKOMI GUIDE"'],
  ["scripts/check-contact-env.mjs", "Eskomi Headless"],
  ["scripts/performance-check.mjs", "Eskomi Headless"],
  ["scripts/seo-cutover-check.mjs", "Eskomi Headless"],
  ["scripts/url-parity-check.mjs", "Eskomi Headless"]
];

for (const [file, expected] of expectedVisibleBrand) {
  assert.ok(readHeadless(file).includes(expected), `headless/${file} に可視ブランド ${expected} が必要です`);
}

const expectedVisibleRepositoryBrand = [
  ["area-seo-hooks.php", "Eskomi編集部"],
  ["front-page.php", 'alt="Eskomi（エスコミ）| 関西メンズエステ口コミナビ"'],
  ["functions.php", "[Eskomi] ai-update-log.php が読み込めません"],
  ["single-shop.php", "Eskomi編集部 Review"],
  ["single-shop.php", "※ Eskomi編集部が独自の視点で店舗の魅力を分析しています。"]
];

for (const [file, expected] of expectedVisibleRepositoryBrand) {
  assert.ok(readRepository(file).includes(expected), `${file} に可視ブランド ${expected} が必要です`);
}

const preservedInternalIdentifiers = [
  ["functions.php", "register_rest_route( 'escomi/v1', '/area-shop-rankings'"],
  ["functions.php", "ESCOMI_HEADLESS_REVALIDATE_URL"],
  ["functions.php", "ESCOMI_REVALIDATE_SECRET"],
  ["functions.php", "get_option( 'escomi_home_featured_areas'"],
  ["area-seo-hooks.php", "function escomi_area_characteristics_text"],
  ["area-seo-hooks.php", "add_filter('get_the_archive_description', 'escomi_area_characteristics_text')"],
  ["area-seo-hooks.php", 'id="escomi-area-pagination-fix"'],
  ["headless/components/SiteHeader.tsx", "escomi-final-site-header"],
  ["headless/package.json", '"name": "escomi-headless"'],
  ["headless/lib/seo.ts", 'SITE_URL = "https://mens-esthe-kuchikomi.com"'],
  ["headless/scripts/prepare-sakaisujihonmachi-phase4-data.mjs", "EscomiPhase4Research/1.0"],
  ["headless/scripts/check-content-provenance.mjs", 'includes("Escomi編集部 Review")'],
  ["ai-site-monitor/hourly_schedule_updater.py", "EscomiScheduleBot/1.0"],
  ["ai-site-monitor/ai_auto_updater.py", '"escomi_crawler.db"'],
  ["ai-site-monitor/ai_auto_updater.py", "EscomiAiUpdater/1.0"],
  [".github/workflows/deploy-headless.yml", "VERCEL_PROJECT_ID"]
];

for (const [file, expected] of preservedInternalIdentifiers) {
  assert.ok(readRepository(file).includes(expected), `内部識別子を維持してください: ${file} -> ${expected}`);
}

const preservedJapaneseBrand = [
  ["headless/components/SiteFooter.tsx", "関西メンズエステ口コミナビ エスコミ"],
  ["headless/lib/static-pages.ts", "Eskomi（エスコミ）"],
  ["headless/app/dashboard/page.tsx", "エスコミ管理ダッシュボード"],
  ["front-page.php", "関西メンズエステの口コミ情報サイト【エスコミ】"]
];

for (const [file, expected] of preservedJapaneseBrand) {
  assert.ok(readRepository(file).includes(expected), `日本語ブランド表記を維持してください: ${file}`);
}

const packageJson = JSON.parse(readHeadless("package.json"));
assert.equal(
  packageJson.scripts["test:visible-eskomi-brand"],
  "node scripts/check-visible-eskomi-brand.mjs",
  "可視ブランド検査用npm scriptが必要です"
);
assert.ok(
  packageJson.scripts.test.includes("npm run test:visible-eskomi-brand"),
  "可視ブランド検査をnpm testへ接続してください"
);

console.log("visible Eskomi brand and preserved internal identifier checks passed");
