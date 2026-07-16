import { existsSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PHASE4_VERIFIED_ON,
  SAKAISUJIHONMACHI_PHASE4_SHOP_IDS,
  validatePhase4Dataset
} from "./lib/sakaisujihonmachi-phase4-data.mjs";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const outputPath = join(repoRoot, "docs", "data", "sakaisujihonmachi-phase4-30-shops-2026-07-15.json");
const evidencePath = join(repoRoot, "docs", "data", "sakaisujihonmachi-phase4-evidence-2026-07-15.json");

function fetchWordPressShops() {
  const path = "/wp-json/wp/v2/shop?area=46&per_page=30&page=1&_embed=1";
  return new Promise((resolve, reject) => {
    const request = http.get({
      hostname: "85.131.213.108",
      path,
      headers: {
        Accept: "application/json",
        Host: "mens-esthe-kuchikomi.com",
        "User-Agent": "EscomiPhase4Research/1.0"
      },
      timeout: 20000
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`WordPress REST API returned ${response.statusCode}`));
          return;
        }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve({ body, total: Number(response.headers["x-wp-total"] || 0) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("WordPress REST API timed out")));
    request.on("error", reject);
  });
}

function text(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function fact() {
  return { status: "unverified", value: null, source_ids: [] };
}

function snapshot(shop) {
  const acf = shop.acf && typeof shop.acf === "object" ? shop.acf : {};
  return {
    captured_on: PHASE4_VERIFIED_ON,
    official_url: text(shop.official_url || acf.official_url),
    shop_address: text(acf.shop_address),
    shop_hours: text(acf.shop_hours),
    shop_tel: text(acf.shop_tel),
    shop_booking: text(acf.shop_booking),
    basic_price: text(acf.basic_price),
    price_90: text(acf.price_90),
    price_120: text(acf.price_120),
    price_150: text(acf.price_150),
    price_textarea: text(acf.price_textarea)
  };
}

function skeleton(shop, index) {
  return {
    selection_position: index + 1,
    wp_post_id: Number(shop.id),
    wp_slug: text(shop.slug),
    wordpress_title: text(shop.title?.rendered),
    wordpress_snapshot: snapshot(shop),
    official_name: fact(),
    official_url: fact(),
    address: { ...fact(), visibility: "unknown" },
    access_points: [],
    business_hours: { ...fact() },
    prices: {
      status: "unverified",
      courses: [],
      representative_course_index: null,
      source_ids: []
    },
    contact: {
      phone: fact(),
      booking_methods: []
    },
    beginner_guidance: fact(),
    verified_on: PHASE4_VERIFIED_ON,
    sources: [],
    unverified_fields: [
      "official_name",
      "official_url",
      "address",
      "access_points",
      "business_hours",
      "prices",
      "contact.phone",
      "contact.booking_methods",
      "beginner_guidance"
    ],
    notes: []
  };
}

function mergeRecord(base, update) {
  if (Array.isArray(update)) return structuredClone(update);
  if (!update || typeof update !== "object") return update;
  const merged = { ...base };
  for (const [key, value] of Object.entries(update)) {
    const baseValue = base?.[key];
    merged[key] = (
      value && typeof value === "object" && !Array.isArray(value) &&
      baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)
    ) ? mergeRecord(baseValue, value) : structuredClone(value);
  }
  return merged;
}

const { body: shops, total } = await fetchWordPressShops();
if (!Array.isArray(shops) || shops.length !== 30) {
  throw new Error(`Expected 30 WordPress shops, received ${Array.isArray(shops) ? shops.length : "non-array"}`);
}
const ids = shops.map((shop) => Number(shop.id));
if (JSON.stringify(ids) !== JSON.stringify(SAKAISUJIHONMACHI_PHASE4_SHOP_IDS)) {
  throw new Error(`WordPress top 30 changed: ${ids.join(",")}`);
}

const evidence = existsSync(evidencePath)
  ? JSON.parse(readFileSync(evidencePath, "utf8"))
  : {};
const dataset = {
  schema_version: 1,
  area: {
    wp_term_id: 46,
    slug: "sakaisujihonmachi",
    name: "堺筋本町",
    wordpress_total_at_selection: total
  },
  selection: {
    method: "wordpress-rest-default-order",
    selected_on: PHASE4_VERIFIED_ON,
    endpoint: "/wp-json/wp/v2/shop?area=46&per_page=30&page=1&_embed=1",
    ranking_claim: false
  },
  shops: shops.map((shop, index) => mergeRecord(skeleton(shop, index), evidence[String(shop.id)] || {}))
};

validatePhase4Dataset(dataset);
writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
console.log(`Prepared ${dataset.shops.length} WordPress shop skeletons at ${outputPath}`);
