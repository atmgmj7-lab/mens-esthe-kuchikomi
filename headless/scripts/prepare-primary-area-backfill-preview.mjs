import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllWordPressPages } from "./lib/shop-primary-area-candidate-source.mjs";
import {
  buildPrimaryAreaBackfillPreview,
  renderPrimaryAreaBackfillSummary,
  validateVerificationInput,
} from "./lib/primary-area-backfill-preview.mjs";

const API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";
const WORDPRESS_ORIGIN_IP = "85.131.213.108";
const REPOSITORY_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_JSON_OUTPUT = join(REPOSITORY_ROOT, "docs/data-clean/priority5/primary-area-backfill-preview-2026-08-16.json");
const DEFAULT_SUMMARY_OUTPUT = join(REPOSITORY_ROOT, "docs/data-clean/priority5/primary-area-backfill-preview-summary.md");

function argumentsFrom(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || !value) throw new Error("Usage: --input <verification.json> [--json-output <path>] [--summary-output <path>]");
    values.set(flag, value);
  }
  const input = values.get("--input");
  if (!input) throw new Error("Verification input is required: --input <verification.json>");
  return {
    input: resolve(input),
    jsonOutput: resolve(values.get("--json-output") ?? DEFAULT_JSON_OUTPUT),
    summaryOutput: resolve(values.get("--summary-output") ?? DEFAULT_SUMMARY_OUTPUT),
  };
}

async function requestPage(url) {
  return new Promise((resolveRequest, reject) => {
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
      incoming.on("end", () => resolveRequest({
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

const paths = argumentsFrom(process.argv.slice(2));
const inputText = readFileSync(paths.input, "utf8");
const inputSha256 = createHash("sha256").update(inputText).digest("hex");
const verification = JSON.parse(inputText);
const validated = validateVerificationInput(verification);
const exactIds = validated.exactRecords.map((record) => record.wpShopId).sort((left, right) => left - right);
const shopPath = `/shop/?include=${exactIds.join(",")}&per_page=100&orderby=include&_fields=id,slug,status,modified_gmt,title,area`;
const areaPath = "/area/?per_page=100&hide_empty=false&_fields=id,slug,name,parent,taxonomy";

const [shopResult, areaResult] = await Promise.all([
  fetchAllWordPressPages({ apiBase: API_BASE, path: shopPath, requestPage }),
  fetchAllWordPressPages({ apiBase: API_BASE, path: areaPath, requestPage }),
]);
const generatedAt = new Date().toISOString();
const preview = buildPrimaryAreaBackfillPreview({
  verification,
  currentShops: shopResult.rows,
  currentAreas: areaResult.rows,
  generatedAt,
  inputSha256,
  source: Object.freeze({
    mode: "public-read-only",
    apiBase: API_BASE,
    requestedShopCount: exactIds.length,
    receivedShopCount: shopResult.total,
    areaCount: areaResult.total,
    shopResponseDate: shopResult.responseDate,
    areaResponseDate: areaResult.responseDate,
  }),
});

mkdirSync(dirname(paths.jsonOutput), { recursive: true });
mkdirSync(dirname(paths.summaryOutput), { recursive: true });
writeFileSync(paths.jsonOutput, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
writeFileSync(paths.summaryOutput, renderPrimaryAreaBackfillSummary(preview), "utf8");

console.log(JSON.stringify({
  jsonOutput: paths.jsonOutput,
  summaryOutput: paths.summaryOutput,
  inputSha256,
  currentWordPressShopCount: shopResult.total,
  ...preview.summary.byStatus,
}, null, 2));
