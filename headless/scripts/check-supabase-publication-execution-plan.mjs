import assert from "node:assert/strict";
import {
  buildPublicationExecutionPlan,
  buildLocalFixtureExecutionApproval,
  renderExecutionApplySql,
  renderExecutionRollbackSql,
  renderProductionExecutionApplySql,
  renderProductionExecutionRollbackSql
} from "./lib/supabase-publication-execution-plan.mjs";
import { renderPublicationManifestPreflightSql } from "./lib/supabase-publication-manifest.mjs";
import { buildPublicationExecutionArtifact, renderProductionReadbackSql, renderProductionSqlEditorApplySql, renderProductionSqlEditorRollbackSql } from "./prepare-supabase-publication-execution-plan.mjs";

const routes = ["/about/", "/advertise/", "/contact/", "/osaka-nihonbashi/", "/sitemap/", "/storelisting/"];
const pageInputs = routes.map((route) => ({
  contentId: `98000000-0000-4000-8000-${String(routes.indexOf(route) + 1).padStart(12, "0")}`,
  routeKey: route,
  title: `fixture ${route}`,
  bodyHtml: route === "/osaka-nihonbashi/" ? '<img src="https://project.test/storage/357.png">' : `<p>${route}</p>`,
  bodyText: route,
  source: route === "/advertise/" ? "application-fallback" : "wordpress-readonly",
  sourceId: route === "/advertise/" ? null : 1,
  sourceModified: route === "/advertise/" ? null : "2026-10-20T00:00:00Z"
}));

const publicationManifest = {
  state: "proposed",
  approval: { state: "not-approved", application: "blocked" },
  publicTargets: { shops: [100, 101], areas: [2, 4], pages: routes, imageWpMediaIds: [900, 901] },
  exclusions: [{ wpMediaId: 357, reason: "fixed-page-media-not-shop-image" }],
  before: { publicShopCount: 0, publicAreaCount: 0, publicPageCount: 0, publicImageCount: 0 },
  proposedAfter: { publicShopCount: 2, publicAreaCount: 2, publicPageCount: 6, publicImageCount: 2 }
};

const plan = buildPublicationExecutionPlan({
  publicationManifest,
  pageInputs,
  fixedPageMedia: {
    wpMediaId: 357,
    sourceSha256: "a".repeat(64),
    targetUrl: "https://project.test/storage/357.png",
    referencedByRoute: "/osaka-nihonbashi/"
  }
});

assert.equal(plan.state, "proposed");
assert.equal(plan.approval.application, "blocked");
assert.equal(plan.summary, "2 shops, 2 areas, 6 pages, 2 shop images, and fixed-page media 357");
assert.equal(plan.pages.find((page) => page.routeKey === "/about/").sourceId, 1, "the plan must retain the read-only WordPress source identity");
assert.throws(() => buildPublicationExecutionPlan({ publicationManifest, pageInputs: pageInputs.slice(1), fixedPageMedia: plan.fixedPageMedia }), /six canonical fixed-page inputs/i);

const approval = buildLocalFixtureExecutionApproval({ plan, proposalId: "publication-execution-fixture", approvalId: "publication-execution-fixture-local-fixture" });
const applySql = renderExecutionApplySql({ plan, approval, transactionMode: "caller" });
const rollbackSql = renderExecutionRollbackSql({ plan, approval, transactionMode: "caller" });
assert.match(applySql, /insert into app\.contents/i);
assert.match(applySql, /publication_status = 'published'/i);
assert.match(applySql, /is_public = true/i);
assert.match(applySql, /https:\/\/project\.test\/storage\/357\.png/i);
assert.match(rollbackSql, /delete from app\.contents/i);
assert.match(rollbackSql, /local-fixture/i);

assert.throws(() => renderProductionExecutionApplySql({ plan, approval: { ...approval, state: "approved-local-fixture" } }), /separately approved production/i);
const productionApproval = { state: "approved-production", environment: "production-approved-only", proposalId: "production-execution-fixture", approvalId: "production-execution-fixture-approved", proposalSha256: approval.proposalSha256 };
const productionApply = renderProductionExecutionApplySql({ plan, approval: productionApproval });
const productionRollback = renderProductionExecutionRollbackSql({ plan, approval: productionApproval });
assert.match(productionApply, /production-approved/i);
assert.match(productionApply, /shop execution precondition changed/i);
assert.match(productionRollback, /rollback requires every image target/i);
const sqlEditorApply = renderProductionSqlEditorApplySql({
  plan,
  approval: productionApproval,
  preflightSql: renderPublicationManifestPreflightSql({ manifest: publicationManifest, sourceLabel: "publication-execution-fixture" })
});
assert.match(sqlEditorApply, /^begin;$/mu, "SQL Editor apply must own one outer transaction");
assert.equal((sqlEditorApply.match(/^begin;$/gmu) ?? []).length, 1, "SQL Editor apply must not nest transactions");
assert.equal((sqlEditorApply.match(/^commit;$/gmu) ?? []).length, 1, "SQL Editor apply must commit only its outer transaction");
assert.match(sqlEditorApply, /set local eskomi\.publication_manifest_mode = 'production-approved';/i);
assert.match(sqlEditorApply, /set local eskomi\.publication_manifest_approval = 'production-execution-fixture-approved';/i);
assert.match(sqlEditorApply, /set local eskomi\.publication_manifest_proposal_sha256 = '[a-f0-9]{64}';/i);
assert.match(sqlEditorApply, /set local eskomi\.fixed_page_media_357_verified = 'a{64}';/i);
assert.match(sqlEditorApply, /WordPress-only shops pending a publication decision/i, "SQL Editor apply must retain the preflight exclusions");
assert.match(sqlEditorApply, /shop execution precondition changed/i, "SQL Editor apply must retain the production apply guard");
const sqlEditorRollback = renderProductionSqlEditorRollbackSql({ plan, approval: productionApproval });
assert.equal((sqlEditorRollback.match(/^begin;$/gmu) ?? []).length, 1, "SQL Editor rollback must own one outer transaction");
assert.match(sqlEditorRollback, /rollback requires every image target/i);
assert.match(sqlEditorRollback, /set local eskomi\.fixed_page_media_357_verified = 'a{64}';/i);
const readbackSql = renderProductionReadbackSql({ plan, sourceManifest: publicationManifest, sourceLabel: "publication-execution-fixture" });
assert.match(readbackSql, /^begin read only;$/mu);
assert.match(readbackSql, /post-apply shop count mismatch/i);
assert.match(readbackSql, /unresolved WordPress-only shops were introduced/i);
assert.match(readbackSql, /media 357 entered shop-image scope/i);

const artifact = buildPublicationExecutionArtifact({
  label: "20261020-publication-execution-v1",
  capturedPages: { pages: pageInputs, fixedPageMedia: plan.fixedPageMedia }
});
assert.equal(artifact.plan.sourceManifest.publicTargets.shops.length, 379, "the executable bundle must retain the reviewed shop scope");
assert.equal(artifact.plan.sourceManifest.publicTargets.areas.length, 34, "the executable bundle must retain the reviewed area scope");
assert.equal(artifact.plan.sourceManifest.publicTargets.imageWpMediaIds.length, 241, "the executable bundle must retain the reviewed image scope");
assert.equal(artifact.plan.approval.application, "blocked", "the captured-page bundle must remain a proposal");
assert.match(artifact.applySql, /local-fixture-only/i, "only a local-fixture apply artifact may be emitted");

console.log("Supabase publication execution-plan contract: PASS");
