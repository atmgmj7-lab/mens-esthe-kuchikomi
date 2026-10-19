import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildProposedPublicationManifest,
  renderPublicationManifestApplySql,
  renderPublicationManifestPreflightSql,
  renderPublicationManifestRestoreSql
} from "./lib/supabase-publication-manifest.mjs";

const REVIEW_REQUIRED_WP_IDS = [5070, 5074, 5079, 5082, 5129, 5135, 5137, 5175, 5177, 5181, 5183, 5185, 5187, 5189];
const MANAGED_UNLISTED_WP_IDS = [1272];
const RETAINED_DRAFT_WP_IDS = [1255, 1259];
const FIXED_PAGE_ROUTES = ["/contact/", "/about/", "/sitemap/", "/storelisting/", "/advertise/", "/osaka-nihonbashi/"];
const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");

function parseLabel(value) {
  if (!/^\d{8}-publication-manifest(?:-v[1-9]\d*)?$/.test(value || "")) throw new Error("PUBLICATION_MANIFEST_OUTPUT_LABEL must be YYYYMMDD-publication-manifest or YYYYMMDD-publication-manifest-vN");
  return value;
}

function readJson(relativePath) { return JSON.parse(readFileSync(join(repoRoot, relativePath), "utf8")); }

function sourceTargets() {
  const plan = readJson("supabase/imports/primary-area-delta/20261019-primary-area-delta.plan.json");
  const imagePlan = readJson("supabase/imports/shop-image-url-switch/20261019-shop-images-public-switch-dry-run.json");
  const corpusSql = readFileSync(join(repoRoot, "supabase/imports/20261019-wordpress-corpus-dry-run.sql"), "utf8");
  const areaTermIds = [...corpusSql.matchAll(/^-- area wp_term_id=(\d+)$/gm)].map((match) => Number(match[1]));
  const imageWpMediaIds = imagePlan.operations.map((operation) => operation.wp_media_id);
  if (plan.candidateWpIds.length !== 379 || areaTermIds.length !== 34 || imageWpMediaIds.length !== 241) throw new Error("proposal source inventory changed; regenerate from a reviewed public-source snapshot");
  return { candidateWpIds: plan.candidateWpIds, areaTermIds, imageWpMediaIds };
}

export function buildProposedPublicationManifestArtifact(label) {
  const source = sourceTargets();
  const manifest = buildProposedPublicationManifest({
    ...source,
    reviewRequiredWpIds: REVIEW_REQUIRED_WP_IDS,
    managedUnlistedWpIds: MANAGED_UNLISTED_WP_IDS,
    retainedDraftWpIds: RETAINED_DRAFT_WP_IDS,
    fixedPageRoutes: FIXED_PAGE_ROUTES
  });
  return {
    manifest,
    preflightSql: renderPublicationManifestPreflightSql({ manifest, sourceLabel: label }),
    restoreSql: renderPublicationManifestRestoreSql({ manifest, sourceLabel: label }),
    applySql: renderPublicationManifestApplySql({ manifest, sourceLabel: label })
  };
}

function main() {
  const label = parseLabel(process.env.PUBLICATION_MANIFEST_OUTPUT_LABEL);
  const artifact = buildProposedPublicationManifestArtifact(label);
  const outputDir = join(repoRoot, "supabase", "imports", "publication-manifest");
  const paths = {
    manifest: join(outputDir, `${label}.proposed.json`),
    preflight: join(outputDir, `${label}.proposed.preflight.sql`),
    restore: join(outputDir, `${label}.proposed.restore.sql`),
    apply: join(outputDir, `${label}.proposed.apply-blocked.sql`)
  };
  for (const path of Object.values(paths)) if (existsSync(path)) throw new Error(`Publication manifest already exists: ${path}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(paths.manifest, `${JSON.stringify({ label, generatedAt: new Date().toISOString(), source: "reviewed-public-url-snapshot", ...artifact.manifest }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.preflight, artifact.preflightSql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.restore, artifact.restoreSql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.apply, artifact.applySql, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output: paths, state: artifact.manifest.state, approval: artifact.manifest.approval, targets: artifact.manifest.publicTargets, exclusions: artifact.manifest.exclusions }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
