import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProposedPublicationManifestArtifact } from "./prepare-supabase-publication-manifest.mjs";
import { renderPublicationManifestPreflightSql } from "./lib/supabase-publication-manifest.mjs";
import { buildPublicationExecutionPlan, buildLocalFixtureExecutionApproval, renderExecutionApplySql, renderExecutionRollbackSql, renderProductionExecutionApplySql, renderProductionExecutionRollbackSql } from "./lib/supabase-publication-execution-plan.mjs";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const canonicalJson = (value) => Array.isArray(value) ? `[${value.map(canonicalJson).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}` : JSON.stringify(value);
const sha256 = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

export function buildPublicationExecutionArtifact({ label, capturedPages, productionApproval = null }) {
  if (!/^\d{8}-publication-execution-v\d+$/u.test(label ?? "")) throw new Error("label must be YYYYMMDD-publication-execution-vN");
  if (!capturedPages?.pages || !capturedPages?.fixedPageMedia) throw new Error("a readonly fixed-page capture is required");
  const sourceManifest = buildProposedPublicationManifestArtifact("20261019-publication-manifest-v4").manifest;
  const plan = buildPublicationExecutionPlan({ publicationManifest: sourceManifest, pageInputs: capturedPages.pages, fixedPageMedia: capturedPages.fixedPageMedia });
  const proposalSha256 = sha256(plan);
  const approval = buildLocalFixtureExecutionApproval({ plan, proposalId: label, approvalId: `${label}-local-fixture` });
  const result = { plan, proposalSha256, approval, preflightSql: renderPublicationManifestPreflightSql({ manifest: sourceManifest, sourceLabel: label }), applySql: renderExecutionApplySql({ plan, approval }), rollbackSql: renderExecutionRollbackSql({ plan, approval }) };
  if (productionApproval) {
    result.productionApplySql = renderProductionExecutionApplySql({ plan, approval: productionApproval });
    result.productionRollbackSql = renderProductionExecutionRollbackSql({ plan, approval: productionApproval });
  }
  return result;
}

function main() {
  const label = process.env.PUBLICATION_EXECUTION_OUTPUT_LABEL;
  const capturePath = process.env.PUBLICATION_EXECUTION_PAGE_CAPTURE;
  if (!capturePath || !capturePath.includes("supabase/imports/publication-execution/")) throw new Error("PUBLICATION_EXECUTION_PAGE_CAPTURE must be the private capture path");
  const approvalPath = process.env.PUBLICATION_EXECUTION_PRODUCTION_APPROVAL_RECORD;
  const productionApproval = approvalPath ? JSON.parse(readFileSync(approvalPath, "utf8")).approval : null;
  const artifact = buildPublicationExecutionArtifact({ label, capturedPages: JSON.parse(readFileSync(capturePath, "utf8")), productionApproval });
  const outputDir = join(repoRoot, "supabase", "imports", "publication-execution");
  const paths = { proposal: join(outputDir, `${label}.proposed.json`), preflight: join(outputDir, `${label}.proposed.preflight.sql`), apply: join(outputDir, `${label}.local-fixture.apply.sql`), rollback: join(outputDir, `${label}.local-fixture.rollback.sql`) };
  if (productionApproval) Object.assign(paths, { productionApply: join(outputDir, `${label}.production.apply.sql`), productionRollback: join(outputDir, `${label}.production.rollback.sql`) });
  for (const path of Object.values(paths)) if (existsSync(path)) throw new Error(`execution artifact already exists: ${path}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(paths.proposal, `${JSON.stringify({ label, generatedAt: new Date().toISOString(), proposalSha256: artifact.proposalSha256, state: artifact.plan.state, approval: artifact.plan.approval, localFixtureApproval: artifact.approval, plan: artifact.plan }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.preflight, artifact.preflightSql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.apply, artifact.applySql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.rollback, artifact.rollbackSql, { encoding: "utf8", flag: "wx" });
  if (productionApproval) { writeFileSync(paths.productionApply, artifact.productionApplySql, { encoding: "utf8", flag: "wx" }); writeFileSync(paths.productionRollback, artifact.productionRollbackSql, { encoding: "utf8", flag: "wx" }); }
  console.log(JSON.stringify({ paths, state: artifact.plan.state, approval: artifact.plan.approval, summary: artifact.plan.summary, proposalSha256: artifact.proposalSha256 }, null, 2));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
