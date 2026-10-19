import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConservativePublicationManifest,
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} from "./lib/supabase-publication-manifest.mjs";

const REVIEW_REQUIRED_WP_IDS = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
const MANAGED_UNLISTED_WP_IDS = [1272];
const RETAINED_DRAFT_WP_IDS = [1255, 1259];
const CANDIDATE_WP_IDS = [
  ...Array.from({ length: 255 }, (_, index) => 640 + index),
  ...Array.from({ length: 90 }, (_, index) => 1165 + index),
  1256, 1257, 1258,
  ...Array.from({ length: 12 }, (_, index) => 1260 + index),
  ...Array.from({ length: 19 }, (_, index) => 1273 + index)
];

function parseLabel(value) {
  if (!/^\d{8}-publication-manifest(?:-v[1-9]\d*)?$/.test(value || "")) {
    throw new Error("PUBLICATION_MANIFEST_OUTPUT_LABEL must be YYYYMMDD-publication-manifest or YYYYMMDD-publication-manifest-vN");
  }
  return value;
}

export function buildZeroTargetPublicationManifest(label) {
  const manifest = buildConservativePublicationManifest({
    candidateWpIds: CANDIDATE_WP_IDS,
    reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
    managedUnlistedWpIds: MANAGED_UNLISTED_WP_IDS,
    retainedDraftWpIds: RETAINED_DRAFT_WP_IDS,
    imageCount: 241,
    publicTargets: { shops: [], areas: [], pages: [], imageRows: [] }
  });
  return {
    manifest,
    preflightSql: renderPublicationManifestPreflightSql({ manifest, sourceLabel: label }),
    restoreSql: renderPublicationManifestRestoreSql({ manifest, sourceLabel: label })
  };
}

function main() {
  const label = parseLabel(process.env.PUBLICATION_MANIFEST_OUTPUT_LABEL);
  const artifact = buildZeroTargetPublicationManifest(label);
  if (artifact.manifest.candidateWpIds.length !== 379) throw new Error("candidate manifest changed unexpectedly");
  const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
  const outputDir = join(repoRoot, "supabase", "imports", "publication-manifest");
  const paths = {
    manifest: join(outputDir, `${label}.json`),
    preflight: join(outputDir, `${label}.preflight.sql`),
    restore: join(outputDir, `${label}.restore.sql`)
  };
  for (const path of Object.values(paths)) if (existsSync(path)) throw new Error(`Publication manifest already exists: ${path}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(paths.manifest, `${JSON.stringify({ label, generatedAt: new Date().toISOString(), ...artifact.manifest }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.preflight, artifact.preflightSql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.restore, artifact.restoreSql, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output: paths, candidateCount: artifact.manifest.candidateWpIds.length, publicTargets: artifact.manifest.publicTargets, exclusions: artifact.manifest.exclusions }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
