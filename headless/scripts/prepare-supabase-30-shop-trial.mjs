import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SAKAISUJIHONMACHI_30_SHOP_IDS,
  normalizeTrialShop,
  renderTrialImportSql,
  renderTrialVerifySql
} from "./lib/supabase-trial-sql.mjs";

const AREA_WP_TERM_ID = 46;
const BATCH_ID = "0f17f6a1-3bf4-4d66-8ee6-3f589da4b030";
const TRIAL_KEY = "20260714-sakaisujihonmachi-30-shops";
const DEFAULT_API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";

function normalizeApiBase(value) {
  const base = String(value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  if (/\/wp-json\/wp\/v2$/i.test(base)) return base;
  if (/\/wp-json$/i.test(base)) return `${base}/wp/v2`;
  return `${base}/wp-json/wp/v2`;
}

async function fetchJson(url) {
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
  return { data, responseDate: response.headers.get("date") };
}

function missingIds(rows, key) {
  return rows.filter((shop) => !shop[key]).map((shop) => shop.wp_post_id);
}

function assertSelectedIncludesAll(selectedIds, requiredIds, label) {
  const missing = requiredIds.filter((id) => !selectedIds.has(id));
  if (missing.length > 0) {
    throw new Error(`30-shop selection is missing ${label}: ${missing.join(", ")}`);
  }
}

const apiBase = normalizeApiBase(process.env.WP_API_BASE_URL);
const sourceUrl = `${apiBase}/shop/?area=${AREA_WP_TERM_ID}&per_page=100&_embed=1`;
const { data: sourceShops, responseDate } = await fetchJson(sourceUrl);

if (sourceShops.length !== 93) {
  throw new Error(`Expected 93 Sakaisujihonmachi shops, received ${sourceShops.length}`);
}

const normalizedSource = sourceShops.map(normalizeTrialShop);
const sourceById = new Map(normalizedSource.map((shop) => [shop.wp_post_id, shop]));
const selected = SAKAISUJIHONMACHI_30_SHOP_IDS.map((id) => {
  const shop = sourceById.get(id);
  if (!shop) throw new Error(`Selected WordPress shop ${id} was not returned by the API`);
  return shop;
});
const selectedIds = new Set(selected.map((shop) => shop.wp_post_id));

assertSelectedIncludesAll(selectedIds, missingIds(normalizedSource, "basic_price"), "missing-price shops");
assertSelectedIncludesAll(selectedIds, missingIds(normalizedSource, "image_url"), "missing-image shops");
assertSelectedIncludesAll(selectedIds, missingIds(normalizedSource, "official_url"), "missing-official-url shops");

const selectedAt = process.env.TRIAL_SELECTED_AT
  || (responseDate ? new Date(responseDate).toISOString() : new Date().toISOString());
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const trialDir = join(repoRoot, "supabase", "trials");
const importPath = join(trialDir, "20260714_sakaisujihonmachi_30_shops.sql");
const verifyPath = join(trialDir, "verify_20260714_sakaisujihonmachi_30_shops.sql");

writeFileSync(importPath, renderTrialImportSql({
  shops: selected,
  batchId: BATCH_ID,
  trialKey: TRIAL_KEY,
  sourceUrl,
  selectedAt,
  area: {
    wp_term_id: AREA_WP_TERM_ID,
    slug: "sakaisujihonmachi",
    name: "堺筋本町",
    parent_wp_term_id: 2,
    source_count: sourceShops.length
  }
}));

writeFileSync(verifyPath, renderTrialVerifySql({
  shops: selected,
  batchId: BATCH_ID,
  areaWpTermId: AREA_WP_TERM_ID
}));

console.log(JSON.stringify({
  selectedAt,
  sourceCount: sourceShops.length,
  selectedCount: selected.length,
  selectedIds: [...selectedIds].sort((left, right) => left - right),
  missingPriceIncluded: missingIds(normalizedSource, "basic_price").length,
  missingImageIncluded: missingIds(normalizedSource, "image_url").length,
  missingOfficialUrlIncluded: missingIds(normalizedSource, "official_url").length,
  importPath,
  verifyPath
}, null, 2));
