import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeTrialArea,
  normalizeTrialShop,
  renderFullImportSql,
  renderFullVerifySql
} from "./lib/supabase-trial-sql.mjs";

const BATCH_ID = "f9949784-0aad-419b-bb69-cd35a3be2256";
const DEFAULT_API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";

function normalizeApiBase(value) {
  const base = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  if (/\/wp-json\/wp\/v2$/i.test(base)) return base;
  if (/\/wp-json$/i.test(base)) return `${base}/wp/v2`;
  return `${base}/wp-json/wp/v2`;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) {
    throw new Error(`WordPress API failed: ${response.status} ${url}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`WordPress API returned a non-array payload: ${url}`);
  }
  return {
    data,
    responseDate: response.headers.get("date"),
    totalPages: Math.max(1, Number(response.headers.get("x-wp-totalpages")) || 1)
  };
}

async function fetchAll(apiBase, path) {
  const rows = [];
  let responseDate = null;
  let page = 1;
  let totalPages = 1;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const result = await fetchPage(`${apiBase}${path}${separator}page=${page}`);
    rows.push(...result.data);
    responseDate ||= result.responseDate;
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return { rows, responseDate };
}

function count(rows, predicate) {
  return rows.reduce((total, row) => total + (predicate(row) ? 1 : 0), 0);
}

const apiBase = normalizeApiBase(process.env.WP_API_BASE_URL);
const [shopResult, areaResult] = await Promise.all([
  fetchAll(apiBase, "/shop?per_page=100&_embed=1"),
  fetchAll(apiBase, "/area?per_page=100&hide_empty=false")
]);

if (shopResult.rows.length !== 382) {
  throw new Error(`Expected 382 WordPress shops, received ${shopResult.rows.length}`);
}
if (areaResult.rows.length !== 34) {
  throw new Error(`Expected 34 WordPress areas, received ${areaResult.rows.length}`);
}

const shops = shopResult.rows.map(normalizeTrialShop);
const areas = areaResult.rows.map(normalizeTrialArea);
const expected = {
  prices: count(shops, (shop) => Boolean(shop.basic_price)),
  images: count(shops, (shop) => Boolean(shop.image_url)),
  officialUrls: count(shops, (shop) => Boolean(shop.official_url)),
  withoutArea: count(shops, (shop) => shop.area_ids.length === 0),
  multipleAreas: count(shops, (shop) => shop.area_ids.length > 1),
  links: shops.reduce((total, shop) => total + shop.area_ids.length, 0)
};

if (
  expected.prices !== 252
  || expected.images !== 241
  || expected.officialUrls !== 333
  || expected.withoutArea !== 75
  || expected.multipleAreas !== 230
) {
  throw new Error(`WordPress completeness changed: ${JSON.stringify(expected)}`);
}

const selectedAt = process.env.FULL_IMPORT_SELECTED_AT
  || (shopResult.responseDate ? new Date(shopResult.responseDate).toISOString() : new Date().toISOString());
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const importDir = join(repoRoot, "supabase", "imports");
const importPath = join(importDir, "20260714_wordpress_382_shops.sql");
const verifyPath = join(importDir, "verify_20260714_wordpress_382_shops.sql");
const sourceUrl = `${apiBase}/shop?per_page=100&_embed=1`;

mkdirSync(importDir, { recursive: true });
writeFileSync(importPath, renderFullImportSql({
  shops,
  areas,
  batchId: BATCH_ID,
  sourceUrl,
  selectedAt
}));
writeFileSync(verifyPath, renderFullVerifySql({ shops, areas, batchId: BATCH_ID }));

console.log(JSON.stringify({
  selectedAt,
  batchId: BATCH_ID,
  shops: shops.length,
  areas: areas.length,
  ...expected,
  importPath,
  verifyPath
}, null, 2));
