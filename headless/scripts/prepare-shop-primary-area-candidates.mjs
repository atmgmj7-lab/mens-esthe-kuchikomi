import { mkdirSync, writeFileSync } from "node:fs";
import https from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShopPrimaryAreaReport } from "./lib/shop-primary-area-candidates.mjs";
import { fetchAllWordPressPages } from "./lib/shop-primary-area-candidate-source.mjs";

const API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";
const WORDPRESS_ORIGIN_IP = "85.131.213.108";
const SHOP_PATH = "/shop/?per_page=100&_fields=id,slug,title,area";
const AREA_PATH = "/area/?per_page=100&hide_empty=false&_fields=id,slug,name,parent,count,taxonomy";
const OUTPUT_PATH = join(
  fileURLToPath(new URL("../..", import.meta.url)),
  "docs/data/shop-primary-area-candidates-2026-08-16.json",
);

async function requestPage(url) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      lookup: (hostname, options, callback) => {
        if (hostname !== "mens-esthe-kuchikomi.com") {
          callback(new Error(`Unexpected public read hostname: ${hostname}`));
          return;
        }
        if (options?.all) callback(null, [{ address: WORDPRESS_ORIGIN_IP, family: 4 }]);
        else callback(null, WORDPRESS_ORIGIN_IP, 4);
      },
    }, (incoming) => {
      const chunks = [];
      let bytes = 0;
      incoming.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 20 * 1024 * 1024) {
          request.destroy(new Error(`WordPress public read exceeded response limit: ${url}`));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on("end", () => resolve({
        status: incoming.statusCode,
        headers: incoming.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.setTimeout(30000, () => request.destroy(new Error(`WordPress public read timed out: ${url}`)));
    request.on("error", reject);
    request.end();
  });
}

const [shopResult, areaResult] = await Promise.all([
  fetchAllWordPressPages({ apiBase: API_BASE, path: SHOP_PATH, requestPage }),
  fetchAllWordPressPages({ apiBase: API_BASE, path: AREA_PATH, requestPage }),
]);
const generatedAt = new Date().toISOString();
const report = buildShopPrimaryAreaReport({
  shops: shopResult.rows,
  areas: areaResult.rows,
  generatedAt,
  source: {
    mode: "public-read-only",
    apiBase: API_BASE,
    shopPath: SHOP_PATH,
    areaPath: AREA_PATH,
    shopResponseDate: shopResult.responseDate,
    areaResponseDate: areaResult.responseDate,
    shopTotal: shopResult.total,
    areaTotal: areaResult.total,
  },
});

if (report.summary.totalShops !== shopResult.total) {
  throw new Error(`Candidate report total mismatch: ${report.summary.totalShops} !== ${shopResult.total}`);
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ outputPath: OUTPUT_PATH, ...report.summary }, null, 2));
