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

function stripOuterTransaction(sql, name) {
  const beginMatches = sql.match(/^begin(?: read only)?;$/gimu) ?? [];
  const commitMatches = sql.match(/^commit;$/gimu) ?? [];
  if (beginMatches.length !== 1 || commitMatches.length !== 1) {
    throw new Error(`${name} must contain exactly one outer transaction`);
  }
  const withoutBegin = sql.replace(/^begin(?: read only)?;\n/imu, "");
  const withoutCommit = withoutBegin.replace(/\ncommit;\n?$/iu, "");
  if (withoutCommit === sql || /^begin(?: read only)?;$/imu.test(withoutCommit) || /^commit;$/imu.test(withoutCommit)) {
    throw new Error(`${name} must contain exactly one outer transaction`);
  }
  return withoutCommit;
}

function renderProductionSqlEditorTransaction({ plan, approval, body, title }) {
  return `-- ${title} for ${approval.approvalId}.
-- Run this complete generated file as one statement batch. Do not edit its scope.
-- Any failed guard aborts the complete transaction before commit.
begin;
set local eskomi.publication_manifest_mode = 'production-approved';
set local eskomi.publication_manifest_approval = '${approval.approvalId}';
set local eskomi.publication_manifest_proposal_sha256 = '${approval.proposalSha256}';
set local eskomi.fixed_page_media_357_verified = '${plan.fixedPageMedia.sourceSha256}';
${body}
commit;
`;
}

export function renderProductionSqlEditorApplySql({ plan, approval, preflightSql }) {
  if (typeof preflightSql !== "string" || !preflightSql.includes("publication proposal draft shop mismatch")) {
    throw new Error("a complete proposed-scope preflight SQL artifact is required");
  }
  const preflight = stripOuterTransaction(
    preflightSql,
    "preflight SQL"
  );
  const apply = stripOuterTransaction(
    renderProductionExecutionApplySql({ plan, approval }),
    "production apply SQL"
  );
  return renderProductionSqlEditorTransaction({ plan, approval, title: "SQL Editor production apply", body: `${preflight}\n${apply}` });
}

export function renderProductionSqlEditorRollbackSql({ plan, approval }) {
  const rollback = stripOuterTransaction(
    renderProductionExecutionRollbackSql({ plan, approval }),
    "production rollback SQL"
  );
  return renderProductionSqlEditorTransaction({ plan, approval, title: "SQL Editor production conditional rollback", body: rollback });
}

export function renderProductionReadbackSql({ plan, sourceManifest, sourceLabel }) {
  if (sourceManifest?.state !== "proposed" || sourceManifest?.approval?.application !== "blocked") throw new Error("a blocked proposed source manifest is required for production readback");
  const targets = sourceManifest.publicTargets;
  const reviewRequired = sourceManifest.exclusions.filter((entry) => entry.reason === "wordpress-only-publication-decision-required").map((entry) => entry.wpPostId);
  const managedUnlisted = sourceManifest.exclusions.filter((entry) => entry.reason === "managed-unlisted").map((entry) => entry.wpPostId);
  const retainedDrafts = sourceManifest.exclusions.filter((entry) => entry.reason === "supabase-only-draft").map((entry) => entry.wpPostId);
  const ids = (values) => values.join(", ");
  const pages = plan.pages.map((page) => `(id = '${page.contentId}'::uuid and route_key = '${page.routeKey}' and publication_status = 'published')`).join(" or ");
  return `-- post-apply readback: ${sourceLabel}; read-only proof of the reviewed production scope.
begin read only;
set local statement_timeout = '30s';
do $$
declare actual_count integer;
begin
  select count(*) into actual_count from app.shops where wp_post_id = any(array[${ids(targets.shops)}]) and publication_status = 'published' and published_at is not null;
  if actual_count <> ${targets.shops.length} then raise exception 'post-apply shop count mismatch: expected %, got %', ${targets.shops.length}, actual_count; end if;
  select count(*) into actual_count from app.areas where wp_term_id = any(array[${ids(targets.areas)}]) and is_published and published_at is not null;
  if actual_count <> ${targets.areas.length} then raise exception 'post-apply area count mismatch: expected %, got %', ${targets.areas.length}, actual_count; end if;
  select count(*) into actual_count from app.shop_images where wp_media_id = any(array[${ids(targets.imageWpMediaIds)}]) and is_public and verified_at is not null;
  if actual_count <> ${targets.imageWpMediaIds.length} then raise exception 'post-apply image count mismatch: expected %, got %', ${targets.imageWpMediaIds.length}, actual_count; end if;
  select count(*) into actual_count from app.contents where ${pages};
  if actual_count <> ${plan.pages.length} then raise exception 'post-apply fixed-page identity mismatch: expected %, got %', ${plan.pages.length}, actual_count; end if;
  if exists (select 1 from app.shops where wp_post_id = any(array[${ids(reviewRequired)}])) then raise exception 'post-apply unresolved WordPress-only shops were introduced'; end if;
  select count(*) into actual_count from private.managed_shops managed join app.shops shop on shop.wp_post_id = managed.existing_wp_shop_id where managed.existing_wp_shop_id = any(array[${ids(managedUnlisted)}]) and managed.publication_state = 'unlisted' and shop.publication_status = 'draft';
  if actual_count <> ${managedUnlisted.length} then raise exception 'post-apply managed-unlisted exclusion changed'; end if;
  select count(*) into actual_count from app.shops where wp_post_id = any(array[${ids(retainedDrafts)}]) and publication_status = 'draft';
  if actual_count <> ${retainedDrafts.length} then raise exception 'post-apply retained draft exclusion changed'; end if;
  if exists (select 1 from app.shop_images where wp_media_id = 357) then raise exception 'post-apply media 357 entered shop-image scope'; end if;
end
$$;
commit;
`;
}

export function buildPublicationExecutionArtifact({ label, capturedPages, productionApproval = null }) {
  if (!/^\d{8}-publication-execution-v\d+$/u.test(label ?? "")) throw new Error("label must be YYYYMMDD-publication-execution-vN");
  if (!capturedPages?.pages || !capturedPages?.fixedPageMedia) throw new Error("a readonly fixed-page capture is required");
  const sourceManifest = buildProposedPublicationManifestArtifact("20261019-publication-manifest-v4").manifest;
  const plan = buildPublicationExecutionPlan({ publicationManifest: sourceManifest, pageInputs: capturedPages.pages, fixedPageMedia: capturedPages.fixedPageMedia });
  const proposalSha256 = sha256(plan);
  const approval = buildLocalFixtureExecutionApproval({ plan, proposalId: label, approvalId: `${label}-local-fixture` });
  const preflightSql = renderPublicationManifestPreflightSql({ manifest: sourceManifest, sourceLabel: label });
  const result = { plan, proposalSha256, approval, preflightSql, applySql: renderExecutionApplySql({ plan, approval }), rollbackSql: renderExecutionRollbackSql({ plan, approval }) };
  if (productionApproval) {
    result.productionApplySql = renderProductionExecutionApplySql({ plan, approval: productionApproval });
    result.productionRollbackSql = renderProductionExecutionRollbackSql({ plan, approval: productionApproval });
    result.productionSqlEditorApplySql = renderProductionSqlEditorApplySql({ plan, approval: productionApproval, preflightSql });
    result.productionSqlEditorRollbackSql = renderProductionSqlEditorRollbackSql({ plan, approval: productionApproval });
    result.productionReadbackSql = renderProductionReadbackSql({ plan, sourceManifest, sourceLabel: label });
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
  if (productionApproval) Object.assign(paths, {
    productionApply: join(outputDir, `${label}.production.apply.sql`),
    productionRollback: join(outputDir, `${label}.production.rollback.sql`),
    productionSqlEditorApply: join(outputDir, `${label}.production.sql-editor.apply.sql`),
    productionSqlEditorRollback: join(outputDir, `${label}.production.sql-editor.rollback.sql`),
    productionReadback: join(outputDir, `${label}.production.readback.sql`)
  });
  for (const path of Object.values(paths)) if (existsSync(path)) throw new Error(`execution artifact already exists: ${path}`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(paths.proposal, `${JSON.stringify({ label, generatedAt: new Date().toISOString(), proposalSha256: artifact.proposalSha256, state: artifact.plan.state, approval: artifact.plan.approval, localFixtureApproval: artifact.approval, plan: artifact.plan }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.preflight, artifact.preflightSql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.apply, artifact.applySql, { encoding: "utf8", flag: "wx" });
  writeFileSync(paths.rollback, artifact.rollbackSql, { encoding: "utf8", flag: "wx" });
  if (productionApproval) {
    writeFileSync(paths.productionApply, artifact.productionApplySql, { encoding: "utf8", flag: "wx" });
    writeFileSync(paths.productionRollback, artifact.productionRollbackSql, { encoding: "utf8", flag: "wx" });
    writeFileSync(paths.productionSqlEditorApply, artifact.productionSqlEditorApplySql, { encoding: "utf8", flag: "wx" });
    writeFileSync(paths.productionSqlEditorRollback, artifact.productionSqlEditorRollbackSql, { encoding: "utf8", flag: "wx" });
    writeFileSync(paths.productionReadback, artifact.productionReadbackSql, { encoding: "utf8", flag: "wx" });
  }
  console.log(JSON.stringify({ paths, state: artifact.plan.state, approval: artifact.plan.approval, summary: artifact.plan.summary, proposalSha256: artifact.proposalSha256 }, null, 2));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
