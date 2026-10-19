import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeTrialArea,
  normalizeTrialShop,
  renderFullImportSql,
  renderFullVerifySql
} from "./lib/supabase-trial-sql.mjs";

const DEFAULT_API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";

function expectedInteger(name) {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    throw new Error(`${name} must be an explicit non-negative integer for a corpus dry run`);
  }
  return Number(raw);
}

function expectedUuid(name) {
  const raw = process.env[name]?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
    throw new Error(`${name} must be an explicit UUID for an isolated corpus dry run`);
  }
  return raw.toLowerCase();
}

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

const expectedSource = {
  shops: expectedInteger("FULL_IMPORT_EXPECTED_SHOPS"),
  areas: expectedInteger("FULL_IMPORT_EXPECTED_AREAS"),
  prices: expectedInteger("FULL_IMPORT_EXPECTED_PRICES"),
  images: expectedInteger("FULL_IMPORT_EXPECTED_IMAGES"),
  officialUrls: expectedInteger("FULL_IMPORT_EXPECTED_OFFICIAL_URLS"),
  withoutArea: expectedInteger("FULL_IMPORT_EXPECTED_WITHOUT_AREA"),
  multipleAreas: expectedInteger("FULL_IMPORT_EXPECTED_MULTIPLE_AREAS")
};
const batchId = expectedUuid("FULL_IMPORT_BATCH_ID");
if (shopResult.rows.length !== expectedSource.shops || areaResult.rows.length !== expectedSource.areas) {
  throw new Error(`WordPress source count drift: expected ${JSON.stringify(expectedSource)}, received shops=${shopResult.rows.length}, areas=${areaResult.rows.length}`);
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

if (Object.entries(expected).some(([key, value]) => key !== "links" && value !== expectedSource[key])) {
  throw new Error(`WordPress completeness changed: ${JSON.stringify(expected)}`);
}

const selectedAt = process.env.FULL_IMPORT_SELECTED_AT
  || (shopResult.responseDate ? new Date(shopResult.responseDate).toISOString() : new Date().toISOString());
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const importDir = join(repoRoot, "supabase", "imports");
const label = process.env.FULL_IMPORT_OUTPUT_LABEL?.trim();
if (!/^[0-9]{8}-wordpress-[a-z0-9-]+$/.test(label || "")) {
  throw new Error("FULL_IMPORT_OUTPUT_LABEL must be an explicit YYYYMMDD-wordpress-label value; refusing to overwrite a prior import artifact");
}
const importPath = join(importDir, `${label}.sql`);
const verifyPath = join(importDir, `verify_${label}.sql`);
const sourceUrl = `${apiBase}/shop?per_page=100&_embed=1`;
if (existsSync(importPath) || existsSync(verifyPath)) {
  throw new Error(`Generated import artifact already exists for ${label}; choose a new FULL_IMPORT_OUTPUT_LABEL`);
}

mkdirSync(importDir, { recursive: true });
writeFileSync(importPath, renderFullImportSql({
  shops,
  areas,
  batchId,
  sourceUrl,
  selectedAt
}));
writeFileSync(verifyPath, renderFullVerifySql({ shops, areas, batchId }));

console.log(JSON.stringify({
  selectedAt,
  batchId,
  shops: shops.length,
  areas: areas.length,
  ...expected,
  importPath,
  verifyPath
}, null, 2));
