import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const headlessRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(headlessRoot, "..");
const readHeadless = (file) => readFileSync(join(headlessRoot, file), "utf8");
const readRepository = (file) => readFileSync(join(repositoryRoot, file), "utf8");

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".htm",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".less",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".xml",
  ".yaml",
  ".yml"
]);

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".cache",
  ".git",
  ".next",
  ".superpowers",
  ".turbo",
  ".venv",
  ".worktrees",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "reports",
  "vendor",
  "venv"
]);

const OLD_BRAND_VARIANTS = [
  { kind: "title", value: ["Es", "comi"].join("") },
  { kind: "upper", value: ["ES", "COMI"].join("") }
];

const STRICT_ALLOWED_LINES = [
  {
    path: "taxonomy-area.php",
    lineHash: "63fb3e476e3d8691e8f9421967d1972a6f89c9da146762c135b87f8ffe303794",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "PHP file header comment"
  },
  {
    path: "front-page.php",
    lineHash: "6a497bbf27513299c7effec23edeb8560331efb88e2a1ed5c85c47f302db0e10",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "PHP file header comment"
  },
  {
    path: "single-shop.php",
    lineHash: "efa7dce1624b3bc724717e613f66a7a17c38c3b90f8c5a184c4f09c6e8612612",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "PHP file header comment"
  },
  {
    path: "css/base.css",
    lineHash: "2c38aefce366bea3ff6b63b79afb802a904fd4cbf9cf39324b8706931fa46868",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/base.css",
    lineHash: "ef5f8fe2ef869926ef3a9fba5c3227cd98a1e037b49a387303f1605456981d3c",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS inline color comment"
  },
  {
    path: "css/front-page.css",
    lineHash: "955c4570da43ed027bb69a7a5814b65fd61b229df3ae22eb57bb740f6d9222b6",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/front-page.css",
    lineHash: "30445af8cd59f51a8f72447d40c150bb1ec6a6df8250bb98d8b6a86226bcb46b",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS palette comment"
  },
  {
    path: "css/front-page.css",
    lineHash: "b8958a82d8b9f6f65a4163f2f8653fb3ae39e5c1f03b864cfe73939391673acb",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/single.css",
    lineHash: "840b57c5449d10fb3e6bd7d1797667924128069dc245ca0e5a83291966db78cf",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/single.css",
    lineHash: "4bce541b8f2fb56c0e7f02e7239c11c5673b876e9e0c61f8a4ba834720088d0d",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/single.css",
    lineHash: "59c873057d3283613a7d5bbe96de0b11bf1aea17e09b5763230d24b7e7bf492a",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: "css/single.css",
    lineHash: "6dfe7d16cab157eef5864387b1d0d10fd1ed0fdb1f2b6afb7d721fd50f2b695d",
    counts: { title: 1, upper: 0 },
    category: "comment",
    reason: "CSS section comment"
  },
  {
    path: ".vscode/sftp.json",
    lineHash: "fdeb77809950d9d8bd56b50be048052e792cf0144d6955f769e7728ce9cef34c",
    counts: { title: 1, upper: 0 },
    category: "internal-identifier",
    reason: "local deployment connection name"
  },
  {
    path: "functions.php",
    lineHash: "38157551f2cdfec1737f43be37b2b2e6944399777c8b4fca26e233cd318b0ff5",
    counts: { title: 0, upper: 2 },
    category: "internal-identifier",
    reason: "WordPress revalidation constant"
  },
  {
    path: "functions.php",
    lineHash: "57b56a4b869c10c6a181fc2f8814c9318faf13d289d5450619b2b3baec73f869",
    counts: { title: 0, upper: 1 },
    category: "internal-identifier",
    reason: "WordPress revalidation constant"
  },
  {
    path: "functions.php",
    lineHash: "43ade6fb55636ea2394079dd4131c90b77f3a72aa291eaab1b4ae7d12a8292d8",
    counts: { title: 0, upper: 2 },
    category: "internal-identifier",
    reason: "WordPress revalidation secret constant"
  },
  {
    path: "functions.php",
    lineHash: "b024f92703b3b7c6b8c618ce0792b494c498359d6052bdf0869b33f8209cb670",
    counts: { title: 0, upper: 1 },
    category: "internal-identifier",
    reason: "WordPress revalidation secret constant"
  },
  {
    path: "functions.php",
    lineHash: "52d86271bb7522bb2946ee9ed16b821858200527d73265488cf0187aceeaec57",
    counts: { title: 0, upper: 1 },
    category: "internal-identifier",
    reason: "WordPress revalidation secret environment variable"
  },
  {
    path: "headless/scripts/prepare-sakaisujihonmachi-phase4-data.mjs",
    lineHash: "b0e237ef174c01e6e92eb7ee31bbacf921c0bda0b6c07803b744511ade9df558",
    counts: { title: 1, upper: 0 },
    category: "user-agent",
    reason: "Phase 4 research User-Agent identifier"
  },
  {
    path: "ai-site-monitor/hourly_schedule_updater.py",
    lineHash: "9d8a0227299656da0a7be60ace829e67551aa2fefad6427fe95180abe0243e41",
    counts: { title: 1, upper: 0 },
    category: "user-agent",
    reason: "schedule bot User-Agent identifier"
  },
  {
    path: "ai-site-monitor/ai_auto_updater.py",
    lineHash: "abb61dd7de73ed04fa4445ef13ddb94960914eac8b13a5d02795d5e3a39e7182",
    counts: { title: 1, upper: 0 },
    category: "user-agent",
    reason: "AI updater User-Agent identifier"
  },
  {
    path: "headless/scripts/check-content-provenance.mjs",
    lineHash: "c34779fc7a633b4c049459dea3dd1933a765d7fd5e685632e21e28e1d7ecf89f",
    counts: { title: 1, upper: 0 },
    category: "fixture",
    reason: "negative regression fixture for the former editorial label"
  }
];

function toRepositoryPath(path) {
  return relative(repositoryRoot, path).split(sep).join("/");
}

function listSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
        files.push(...listSourceFiles(join(directory, entry.name)));
      }
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function allowedLineKey(path, lineHash) {
  return `${path}\u0000${lineHash}`;
}

function countOldBrandVariants(line) {
  const counts = { title: 0, upper: 0 };
  const occurrences = [];

  for (const variant of OLD_BRAND_VARIANTS) {
    let fromIndex = 0;
    while (fromIndex < line.length) {
      const index = line.indexOf(variant.value, fromIndex);
      if (index < 0) break;
      counts[variant.kind] += 1;
      occurrences.push({ kind: variant.kind, column: index + 1 });
      fromIndex = index + variant.value.length;
    }
  }

  return { counts, occurrences: occurrences.sort((a, b) => a.column - b.column) };
}

const strictAllowlist = new Map();
for (const entry of STRICT_ALLOWED_LINES) {
  const key = allowedLineKey(entry.path, entry.lineHash);
  assert.ok(!strictAllowlist.has(key), `strict allowlistに重複があります: ${entry.path}`);
  strictAllowlist.set(key, entry);
}

function scanSource(path, source) {
  const allowed = [];
  const violations = [];

  source.split(/\r?\n/).forEach((line, index) => {
    const { counts, occurrences } = countOldBrandVariants(line);
    if (occurrences.length === 0) return;

    const lineHash = sha256(line);
    const allowEntry = strictAllowlist.get(allowedLineKey(path, lineHash));
    const countsMatch =
      allowEntry &&
      allowEntry.counts.title === counts.title &&
      allowEntry.counts.upper === counts.upper;

    if (countsMatch) {
      allowed.push({ entry: allowEntry, line: index + 1, occurrenceCount: occurrences.length });
      return;
    }

    for (const occurrence of occurrences) {
      violations.push(`${path}:${index + 1}:${occurrence.column}:${occurrence.kind}`);
    }
  });

  return { allowed, violations };
}

const mutationCases = [
  {
    path: "headless/components/unlisted/BrandMutation.tsx",
    source: `export const BrandMutation = () => <p>${OLD_BRAND_VARIANTS[0].value}</p>;`
  },
  {
    path: "headless/styles/unlisted-brand-mutation.css",
    source: `.brand-mutation::before { content: "${OLD_BRAND_VARIANTS[1].value}"; }`
  }
];

for (const mutation of mutationCases) {
  const result = scanSource(mutation.path, mutation.source);
  assert.ok(result.violations.length > 0, `未列挙mutationを検出できません: ${mutation.path}`);
}

const sourceFiles = listSourceFiles(repositoryRoot);
const repositoryResults = sourceFiles.map((file) =>
  scanSource(toRepositoryPath(file), readFileSync(file, "utf8"))
);
const violations = repositoryResults.flatMap((result) => result.violations);
const allowed = repositoryResults.flatMap((result) => result.allowed);

assert.deepEqual(
  violations,
  [],
  `再帰走査で許可されていない旧ブランド表記を検出しました:\n${violations.join("\n")}`
);

const allowlistUsageCounts = new Map();
for (const { entry } of allowed) {
  const key = allowedLineKey(entry.path, entry.lineHash);
  allowlistUsageCounts.set(key, (allowlistUsageCounts.get(key) ?? 0) + 1);
}
const invalidAllowlistUsage = STRICT_ALLOWED_LINES
  .filter((entry) => allowlistUsageCounts.get(allowedLineKey(entry.path, entry.lineHash)) !== 1)
  .map((entry) => {
    const uses = allowlistUsageCounts.get(allowedLineKey(entry.path, entry.lineHash)) ?? 0;
    return `${entry.path}:${entry.category}:uses=${uses}:${entry.lineHash}`;
  });
assert.deepEqual(
  invalidAllowlistUsage,
  [],
  `strict allowlistは各行ちょうど1回だけ一致する必要があります:\n${invalidAllowlistUsage.join("\n")}`
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

const oldTitleBrand = OLD_BRAND_VARIANTS[0].value;
const oldUpperBrand = OLD_BRAND_VARIANTS[1].value;
const preservedInternalIdentifiers = [
  ["functions.php", "register_rest_route( 'escomi/v1', '/area-shop-rankings'"],
  ["functions.php", `${oldUpperBrand}_HEADLESS_REVALIDATE_URL`],
  ["functions.php", `${oldUpperBrand}_REVALIDATE_SECRET`],
  ["functions.php", "get_option( 'escomi_home_featured_areas'"],
  ["area-seo-hooks.php", "function escomi_area_characteristics_text"],
  ["area-seo-hooks.php", "add_filter('get_the_archive_description', 'escomi_area_characteristics_text')"],
  ["area-seo-hooks.php", 'id="escomi-area-pagination-fix"'],
  ["headless/components/SiteHeader.tsx", "escomi-final-site-header"],
  ["headless/package.json", '"name": "escomi-headless"'],
  ["headless/lib/seo.ts", 'SITE_URL = "https://mens-esthe-kuchikomi.com"'],
  ["headless/scripts/prepare-sakaisujihonmachi-phase4-data.mjs", `${oldTitleBrand}Phase4Research/1.0`],
  ["headless/scripts/check-content-provenance.mjs", `includes("${oldTitleBrand}編集部 Review")`],
  ["ai-site-monitor/hourly_schedule_updater.py", `${oldTitleBrand}ScheduleBot/1.0`],
  ["ai-site-monitor/ai_auto_updater.py", '"escomi_crawler.db"'],
  ["ai-site-monitor/ai_auto_updater.py", `${oldTitleBrand}AiUpdater/1.0`],
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

const oldWordPressLogoPath =
  "/wp-content/uploads/2026/01/8f838967-4eb4-4f6d-a847-23979ce77873.png";
const siteHeaderSource = readHeadless("components/SiteHeader.tsx");
const shopThumbSource = readHeadless("components/area/hub/ShopImageThumb.tsx");
const homePageSource = readHeadless("components/HomePageContent.tsx");
const shopCardSource = readHeadless("components/ShopCard.tsx");
const areaShopCardSource = readHeadless("components/common/AreaShopCard.tsx");
const areaShopCardViewModelSource = readHeadless("lib/area-shop-card-view-model.ts");
const shopDetailGallerySource = readHeadless("components/shop-detail/ShopDetailGallery.tsx");
const designConstantsSource = readHeadless("lib/design-constants.ts");
const seoSource = readHeadless("lib/seo.ts");
const globalCssSource = readHeadless("app/globals.css");
const frontPageSource = readRepository("front-page.php");

assert.ok(!siteHeaderSource.includes(oldWordPressLogoPath), "ヘッダーは旧WordPressロゴURLを公開DOMへ出してはいけません");
assert.ok(!siteHeaderSource.includes("HEADER_LOGO"), "ヘッダーから旧ロゴ定数を削除してください");
assert.ok(!siteHeaderSource.includes("legacy-logo"), "ヘッダーからdisplay:noneの旧ロゴimgを削除してください");
assert.ok(!frontPageSource.includes(oldWordPressLogoPath), "WordPress予備トップは旧WordPressロゴURLを参照してはいけません");
assert.ok(
  frontPageSource.includes("get_theme_file_uri('/assets/img/eskomi-logo.svg')"),
  "WordPress予備トップはサイト所有のEskomi SVGを参照してください"
);
assert.ok(
  designConstantsSource.includes('DEFAULT_SHOP_IMAGE = "/images/eskomi-shop-fallback.svg"'),
  "店舗画像fallbackはサイト所有のEskomi SVGへ切り替えてください"
);
assert.ok(!designConstantsSource.includes("shop-default-image.webp"), "旧fallbackラスタの公開参照を削除してください");
assert.ok(
  designConstantsSource.includes('SHOP_FALLBACK_IMAGE_ALT = "Eskomi 店舗画像準備中"'),
  "fallbackの読み上げ名を全消費経路で共有してください"
);
for (const expected of [
  'aspectRatio: "4 / 3"',
  'objectFit: "contain"',
  'height: "auto"',
  'minHeight: "0"',
  'maxHeight: "none"'
]) {
  assert.ok(
    designConstantsSource.includes(expected),
    `fallback専用styleに ${expected} が必要です`
  );
}
assert.ok(
  seoSource.includes('logo: "https://mens-esthe-kuchikomi.com/images/eskomi-logo.svg"'),
  "Organization schemaはサイト所有のEskomi SVGを参照してください"
);
assert.ok(!seoSource.includes(oldWordPressLogoPath), "Organization schemaに旧WordPressロゴURLを残してはいけません");
const fallbackImageContracts = [
  {
    label: "HomePageContent",
    source: homePageSource,
    required: [
      "const hasImage = Boolean(shop.imageUrl);",
      "src={hasImage ? shop.imageUrl : DEFAULT_SHOP_IMAGE}",
      "alt={hasImage ? shop.title : SHOP_FALLBACK_IMAGE_ALT}",
      "height={hasImage ? 210 : 270}",
      "style={hasImage ? undefined : SHOP_FALLBACK_IMAGE_STYLE}"
    ],
    altMarker: "alt={hasImage ? shop.title : SHOP_FALLBACK_IMAGE_ALT}",
    styleMarker: "style={hasImage ? undefined : SHOP_FALLBACK_IMAGE_STYLE}",
    ratioMarker: "height={hasImage ? 210 : 270}",
    wrongRatioMarker: "height={hasImage ? 210 : 210}"
  },
  {
    label: "AreaShopCard",
    source: `${areaShopCardViewModelSource}\n${areaShopCardSource}`,
    required: [
      "const imageSrc = assetUrl(shop.imageUrl);",
      "? { src: imageSrc, alt: title, isFallback: false }",
      ": { src: DEFAULT_SHOP_IMAGE, alt: SHOP_FALLBACK_IMAGE_ALT, isFallback: true }",
      "src={model.image.src}",
      "alt={model.image.alt}",
      "height={360}",
      "style={model.image.isFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}"
    ],
    altMarker: ": { src: DEFAULT_SHOP_IMAGE, alt: SHOP_FALLBACK_IMAGE_ALT, isFallback: true }",
    styleMarker: "style={model.image.isFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}",
    ratioMarker: "height={360}",
    wrongRatioMarker: "height={320}"
  },
  {
    label: "ShopDetailGallery",
    source: shopDetailGallerySource,
    required: [
      "image.alt = SHOP_FALLBACK_IMAGE_ALT;",
      "Object.assign(image.style, SHOP_FALLBACK_IMAGE_STYLE);",
      "alt={mainImageFallback ? SHOP_FALLBACK_IMAGE_ALT : mainImage.alt}",
      "style={mainImageFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}",
      "alt={image.isFallback ? SHOP_FALLBACK_IMAGE_ALT : image.alt}",
      "style={image.isFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}",
      "width={960}",
      "height={720}",
      "width={240}",
      "height={180}"
    ],
    altMarker: "alt={mainImageFallback ? SHOP_FALLBACK_IMAGE_ALT : mainImage.alt}",
    styleMarker: "style={mainImageFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}",
    ratioMarker: "height={720}",
    wrongRatioMarker: "height={640}"
  },
  {
    label: "ShopImageThumb",
    source: shopThumbSource,
    required: [
      "const hasImage = Boolean(src);",
      "alt={hasImage ? alt : SHOP_FALLBACK_IMAGE_ALT}",
      "const imageHeight = hasImage ? height : Math.round(width * 0.75);",
      "style={hasImage ? undefined : SHOP_FALLBACK_IMAGE_STYLE}"
    ],
    altMarker: "alt={hasImage ? alt : SHOP_FALLBACK_IMAGE_ALT}",
    styleMarker: "style={hasImage ? undefined : SHOP_FALLBACK_IMAGE_STYLE}",
    ratioMarker: "const imageHeight = hasImage ? height : Math.round(width * 0.75);",
    wrongRatioMarker: "const imageHeight = hasImage ? height : Math.round(width * 0.66);"
  }
];

assert.ok(
  shopCardSource.includes("<AreaShopCard"),
  "ShopCardはfallback分岐を持つ共通AreaShopCardへ委譲してください"
);

function fallbackContractViolations(source, contract) {
  return contract.required.filter((required) => !source.includes(required));
}

let rejectedFallbackMutationCount = 0;
for (const contract of fallbackImageContracts) {
  assert.deepEqual(
    fallbackContractViolations(contract.source, contract),
    [],
    `${contract.label} は実写真を維持しfallbackだけ4:3/contain/Eskomi altへ切り替える必要があります`
  );

  for (const [mutation, marker, replacement] of [
    ["old alt", contract.altMarker, contract.altMarker.replace("SHOP_FALLBACK_IMAGE_ALT", '"画像準備中"')],
    [
      "cover",
      contract.styleMarker,
      contract.styleMarker.replace(
        "SHOP_FALLBACK_IMAGE_STYLE",
        '{ aspectRatio: "4 / 3", objectFit: "cover" }'
      )
    ],
    ["wrong ratio", contract.ratioMarker, contract.wrongRatioMarker]
  ]) {
    const mutatedSource = contract.source.replace(marker, replacement);
    assert.notEqual(mutatedSource, contract.source, `${contract.label} ${mutation} mutationを適用できる必要があります`);
    assert.ok(
      fallbackContractViolations(mutatedSource, contract).length > 0,
      `${contract.label} の${mutation} mutationを契約検査が拒否する必要があります`
    );
    rejectedFallbackMutationCount += 1;
  }
}

assert.match(
  globalCssSource,
  /\.shop-image-thumb--placeholder \.shop-image-thumb__img\s*\{[^}]*opacity:\s*1;[^}]*mix-blend-mode:\s*normal;[^}]*\}/s,
  "ShopImageThumb fallbackだけを不透明・通常合成で表示してください"
);

const svgAssets = [
  ["headless/public/images/eskomi-logo.svg", "logo"],
  ["headless/public/images/eskomi-shop-fallback.svg", "fallback"],
  ["assets/img/eskomi-logo.svg", "WordPress logo"]
];
for (const [path, label] of svgAssets) {
  const absolutePath = join(repositoryRoot, path);
  assert.ok(existsSync(absolutePath), `${label} SVGが必要です: ${path}`);
  const source = readFileSync(absolutePath, "utf8");
  assert.ok(source.includes("Eskomi"), `${label} SVGに正確なEskomi文字が必要です`);
  assert.ok(/<title[^>]*>[^<]*Eskomi/.test(source), `${label} SVGにEskomiの読み上げ名が必要です`);
  assert.equal(/<script\b/i.test(source), false, `${label} SVGにscriptを含めてはいけません`);
  assert.equal(/(?:href|xlink:href)\s*=/i.test(source), false, `${label} SVGに外部参照を含めてはいけません`);
  assert.equal(/<image\b/i.test(source), false, `${label} SVGに外部画像を含めてはいけません`);
}

const fallbackSvg = readRepository("headless/public/images/eskomi-shop-fallback.svg");
assert.ok(/viewBox="0 0 800 600"/.test(fallbackSvg), "店舗画像fallback SVGは4:3 viewBoxが必要です");
assert.ok(fallbackSvg.includes("店舗画像準備中"), "店舗画像fallback SVGに読みやすい準備中ラベルが必要です");
assert.equal(
  existsSync(join(repositoryRoot, "headless/public/shop-default-image.webp")),
  false,
  "旧fallbackラスタをリポジトリから削除してください"
);

const allowedOccurrenceCount = allowed.reduce((sum, item) => sum + item.occurrenceCount, 0);
const allowedCategoryCounts = Object.fromEntries(
  [...new Set(allowed.map(({ entry }) => entry.category))]
    .sort()
    .map((category) => [
      category,
      allowed
        .filter(({ entry }) => entry.category === category)
        .reduce((sum, item) => sum + item.occurrenceCount, 0)
    ])
);
console.log(
  `visible Eskomi brand checks passed (${sourceFiles.length} source files; ${allowedOccurrenceCount} strictly allowed legacy occurrences across ${allowed.length} lines; ${rejectedFallbackMutationCount} fallback mutations rejected; ${JSON.stringify(allowedCategoryCounts)})`
);
