import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderStatePreservingDeltaPreflightSql } from "./lib/supabase-primary-delta-sql.mjs";

const REVIEW_REQUIRED_WP_IDS = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
const RETAINED_DRAFT_WP_IDS = [1255, 1259];
const RETAINED_UNLISTED_MANAGED_WP_IDS = [1272];

function parseCount(value, name) {
  if (!/^(0|[1-9]\d*)$/.test(value || "")) throw new Error(`${name} must be an explicit non-negative integer`);
  return Number(value);
}

function parseLabel(value) {
  if (!/^\d{8}-primary-preflight(?:-v[1-9]\d*)?$/.test(value || "")) {
    throw new Error("PRIMARY_DELTA_OUTPUT_LABEL must be YYYYMMDD-primary-preflight or YYYYMMDD-primary-preflight-vN");
  }
  return value;
}

export function buildStatePreservingDeltaArtifact({
  label,
  expectedShopCount,
  expectedAreaCount,
  expectedImageCount,
  expectedPublishedShopCount,
  expectedPublishedAreaCount,
  expectedPublishedContentCount
}) {
  const parsedLabel = parseLabel(label);
  const current = {
    shops: parseCount(expectedShopCount, "PRIMARY_DELTA_EXPECTED_SHOPS"),
    areas: parseCount(expectedAreaCount, "PRIMARY_DELTA_EXPECTED_AREAS"),
    images: parseCount(expectedImageCount, "PRIMARY_DELTA_EXPECTED_IMAGES")
  };
  const publicTarget = {
    shops: parseCount(expectedPublishedShopCount, "PRIMARY_DELTA_EXPECTED_PUBLISHED_SHOPS"),
    areas: parseCount(expectedPublishedAreaCount, "PRIMARY_DELTA_EXPECTED_PUBLISHED_AREAS"),
    contents: parseCount(expectedPublishedContentCount, "PRIMARY_DELTA_EXPECTED_PUBLISHED_CONTENTS")
  };
  const sql = renderStatePreservingDeltaPreflightSql({
    expectedShopCount: current.shops,
    expectedAreaCount: current.areas,
    expectedImageCount: current.images,
    expectedPublishedShopCount: publicTarget.shops,
    expectedPublishedAreaCount: publicTarget.areas,
    expectedPublishedContentCount: publicTarget.contents,
    reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
    retainedDraftWpIds: RETAINED_DRAFT_WP_IDS,
    retainedUnlistedManagedWpIds: RETAINED_UNLISTED_MANAGED_WP_IDS,
    imageCutoverSourceSystem: "wordpress-media-url-cutover"
  });
  return {
    label: parsedLabel,
    sql,
    metadata: {
      mutatesData: false,
      current,
      publicTarget,
      reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
      retainedDraftWpIds: RETAINED_DRAFT_WP_IDS,
      retainedUnlistedManagedWpIds: RETAINED_UNLISTED_MANAGED_WP_IDS,
      imageCutoverSourceSystem: "wordpress-media-url-cutover"
    }
  };
}

function main() {
  const artifact = buildStatePreservingDeltaArtifact({
    label: process.env.PRIMARY_DELTA_OUTPUT_LABEL,
    expectedShopCount: process.env.PRIMARY_DELTA_EXPECTED_SHOPS,
    expectedAreaCount: process.env.PRIMARY_DELTA_EXPECTED_AREAS,
    expectedImageCount: process.env.PRIMARY_DELTA_EXPECTED_IMAGES,
    expectedPublishedShopCount: process.env.PRIMARY_DELTA_EXPECTED_PUBLISHED_SHOPS,
    expectedPublishedAreaCount: process.env.PRIMARY_DELTA_EXPECTED_PUBLISHED_AREAS,
    expectedPublishedContentCount: process.env.PRIMARY_DELTA_EXPECTED_PUBLISHED_CONTENTS
  });
  const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
  const outputDir = join(repoRoot, "supabase", "imports");
  const outputPath = join(outputDir, `${artifact.label}.sql`);
  if (existsSync(outputPath)) throw new Error(`Generated delta artifact already exists: ${outputPath}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, artifact.sql, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ outputPath, ...artifact.metadata }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
