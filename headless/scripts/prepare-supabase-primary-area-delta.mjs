import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import https from "node:https";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSourceGroundedPrimaryAreaPlan,
  renderPrimaryAreaDeltaRollbackSql,
  renderPrimaryAreaDeltaSql
} from "./lib/supabase-primary-area-delta.mjs";
import { fetchAllWordPressPages } from "./lib/shop-primary-area-candidate-source.mjs";

const API_BASE = "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";
const WORDPRESS_ORIGIN_IP = "85.131.213.108";
const SHOP_PATH = "/shop/?per_page=100&_fields=id,status,area,acf,modified_gmt";
const REVIEW_REQUIRED_WP_IDS = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
const UNLISTED_MANAGED_WP_IDS = [1272];
// Current reconciled source membership: 394 WordPress published shops, minus 14
// review-required source-only rows and one operator-unlisted legacy identity.
const CANDIDATE_WP_IDS = [
  ...Array.from({ length: 255 }, (_, index) => 640 + index),
  ...Array.from({ length: 90 }, (_, index) => 1165 + index),
  1256, 1257, 1258,
  ...Array.from({ length: 12 }, (_, index) => 1260 + index),
  ...Array.from({ length: 19 }, (_, index) => 1273 + index)
];

function parseLabel(value) {
  if (!/^\d{8}-primary-area-delta(?:-v[1-9]\d*)?$/.test(value || "")) {
    throw new Error("PRIMARY_AREA_DELTA_OUTPUT_LABEL must be YYYYMMDD-primary-area-delta or YYYYMMDD-primary-area-delta-vN");
  }
  return value;
}

function parseBatchId(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "")) {
    throw new Error("PRIMARY_AREA_DELTA_BATCH_ID must be a UUID");
  }
  return value;
}

function requestPage(url) {
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
      }
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
        body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    request.setTimeout(30000, () => request.destroy(new Error(`WordPress public read timed out: ${url}`)));
    request.on("error", reject);
    request.end();
  });
}

function summarizeDeferred(deferred) {
  return Object.fromEntries(
    [...new Set(deferred.map((item) => item.reason))]
      .sort()
      .map((reason) => [reason, deferred.filter((item) => item.reason === reason).length])
  );
}

export function buildPrimaryAreaDeltaArtifact({ label, batchId, sourceShops, generatedAt, source }) {
  const plan = buildSourceGroundedPrimaryAreaPlan({
    sourceShops,
    candidateWpIds: CANDIDATE_WP_IDS,
    reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
    unlistedManagedWpIds: UNLISTED_MANAGED_WP_IDS
  });
  const options = { plan, batchId, sourceLabel: label };
  return {
    plan,
    applySql: renderPrimaryAreaDeltaSql(options),
    rollbackSql: renderPrimaryAreaDeltaRollbackSql(options),
    report: {
      generatedAt,
      source,
      batchId,
      candidateWpIds: CANDIDATE_WP_IDS,
      reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
      unlistedManagedWpIds: UNLISTED_MANAGED_WP_IDS,
      assignments: plan.assignments,
      deferred: plan.deferred,
      deferredSummary: summarizeDeferred(plan.deferred),
      excluded: plan.excluded,
      safety: {
        inferredPrimaryAreas: false,
        shopRowsMutated: false,
        areaRowsMutated: false,
        imageRowsMutated: false,
        storageObjectsMutated: false,
        expectedPrimaryFlagUpdates: plan.assignments.length
      }
    }
  };
}

async function main() {
  const label = parseLabel(process.env.PRIMARY_AREA_DELTA_OUTPUT_LABEL);
  const batchId = parseBatchId(process.env.PRIMARY_AREA_DELTA_BATCH_ID);
  const fetched = await fetchAllWordPressPages({ apiBase: API_BASE, path: SHOP_PATH, requestPage });
  if (fetched.total !== 394 || fetched.rows.length !== 394) {
    throw new Error(`Refusing to package primary-area delta from incomplete WordPress source: expected 394, got ${fetched.total}/${fetched.rows.length}`);
  }
  const artifact = buildPrimaryAreaDeltaArtifact({
    label,
    batchId,
    sourceShops: fetched.rows,
    generatedAt: new Date().toISOString(),
    source: {
      mode: "public-read-only",
      apiBase: API_BASE,
      shopPath: SHOP_PATH,
      responseDate: fetched.responseDate,
      shopTotal: fetched.total
    }
  });
  if (artifact.report.candidateWpIds.length !== 379) throw new Error("candidate set unexpectedly changed");
  const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
  const outputDir = join(repoRoot, "supabase", "imports", "primary-area-delta");
  const paths = {
    plan: join(outputDir, `${label}.plan.json`),
    apply: join(outputDir, `${label}.apply.sql`),
    rollback: join(outputDir, `${label}.rollback.sql`)
  };
  for (const path of Object.values(paths)) {
    if (existsSync(path)) throw new Error(`Generated primary-area artifact already exists: ${path}`);
  }
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(paths.plan, `${JSON.stringify(artifact.report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.apply, artifact.applySql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.rollback, artifact.rollbackSql, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output: paths, assignments: artifact.plan.assignments.length, deferred: artifact.plan.deferred.length, deferredSummary: artifact.report.deferredSummary }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
