import assert from "node:assert/strict";
import {
  buildPublicationExecutionPlan,
  buildLocalFixtureExecutionApproval,
  renderExecutionApplySql,
  renderExecutionRollbackSql
} from "./lib/supabase-publication-execution-plan.mjs";
import { buildPublicationExecutionArtifact } from "./prepare-supabase-publication-execution-plan.mjs";

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
