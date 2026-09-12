import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateExactDeploymentRelease } from "./lib/exact-deployment-release-contract.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const workflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/deploy-headless.yml"),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "headless/package.json"), "utf8"),
);
const xserverWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/deploy.yml"),
  "utf8",
);

const failures = [];
let assertions = 0;

function check(condition, label) {
  assertions += 1;
  if (!condition) failures.push(label);
}

function workflowStep(name) {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return "";
  const next = workflow.indexOf("\n      - name:", start + marker.length);
  return workflow.slice(start, next < 0 ? undefined : next);
}

const stagedDeployStep = workflowStep("Create staged Vercel production deployment");
const exactQaStep = workflowStep("Verify exact staged deployment");

check(
  workflow.includes("npm install --global vercel@54.13.0"),
  "workflow must pin Vercel CLI 54.13.0",
);
check(
  stagedDeployStep.includes("vercel deploy")
    && stagedDeployStep.includes("--prebuilt")
    && stagedDeployStep.includes("--prod")
    && stagedDeployStep.includes("--skip-domain"),
  "deployment must use --prebuilt --prod --skip-domain",
);
check(
  stagedDeployStep.includes('--meta eskomiGitSha="$GITHUB_SHA"'),
  "deployment must bind eskomiGitSha metadata to GITHUB_SHA",
);
check(
  stagedDeployStep.includes("id=$DEPLOYMENT_ID") && stagedDeployStep.includes("url=$DEPLOYMENT_URL"),
  "deployment step must expose exact deployment ID and URL",
);
check(
  exactQaStep.includes("qa:exact-deployment-release")
    && exactQaStep.includes("steps.deploy.outputs.url")
    && exactQaStep.includes("steps.deploy.outputs.id")
    && exactQaStep.includes("github.sha"),
  "workflow must run the primary exact-deployment release QA",
);
check(
  !workflow.includes('CHECK_URL="${HEADLESS_CI_CHECK_URL:-$DEPLOYMENT_URL}"'),
  "legacy public-domain URL must never replace the exact deployment target",
);
check(
  !/^\s*(?:vercel|vc)\s+(?:promote|alias)\b/m.test(workflow),
  "workflow must not promote or alias a deployment",
);
check(
  workflow.includes("PROMOTION_STATUS=NOT_PROMOTED"),
  "workflow must report PROMOTION_STATUS=NOT_PROMOTED",
);
check(
  typeof packageJson.scripts["test:exact-deployment-release"] === "string",
  "package.json must expose the exact-deployment release contract",
);

check(
  /paths-ignore:[\s\S]*['"]\.github\/workflows\/\*\*['"]/.test(xserverWorkflow),
  "headless workflow changes must remain ignored by the Xserver deploy trigger",
);

const expectedSha = "a".repeat(40);
const exactUrl = "https://escomi-headless-test-user.vercel.app";
const deploymentId = "dpl_exactTest123";
const areaFixtures = [
  {
    slug: "shinosaka",
    label: "新大阪",
    title: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較 | Eskomi",
    h1: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較",
    shopCount: 58,
    tokens: ["公開58店舗", "30件", "51.7%", "編集部の横断確認データ", "192名", "22店舗"],
  },
  {
    slug: "sakai",
    label: "堺東",
    title: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較 | Eskomi",
    h1: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較",
    shopCount: 25,
    tokens: ["公開25店舗", "11件", "44%", "編集部の横断確認データ", "63名", "6店舗"],
  },
];

function jsonLd(value) {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

function areaHtml(fixture) {
  const shops = Array.from({ length: fixture.shopCount }, (_, index) =>
    `<article data-area-shop-card="true">shop ${index + 1}</article>`).join("");
  const items = Array.from({ length: fixture.shopCount }, (_, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: `https://mens-esthe-kuchikomi.com/shops/test-${fixture.slug}-${index + 1}/`,
  }));
  return `<!doctype html><html><head><title>${fixture.title}</title>`
    + `<link rel="canonical" href="https://mens-esthe-kuchikomi.com/area/${fixture.slug}/">`
    + `<meta name="robots" content="index, follow"></head><body><h1>${fixture.h1}</h1>`
    + `<details data-area-supporting-disclosure="true"><summary>${fixture.label}の調査データ・選び方を見る</summary>`
    + `<div data-area-supporting-content="true"><section data-area-depth="coverage">${fixture.tokens.join(" ")}</section>`
    + `<section id="area-decision-guide">選び方</section><section data-area-depth="portal-therapist">横断確認</section>`
    + `<a href="#shop-list">店舗一覧へ</a></div></details><div hidden id="S:unrelated">unrelated</div>`
    + `<main id="shop-list">${shops}</main>`
    + jsonLd({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [] })
    + jsonLd({ "@context": "https://schema.org", "@type": "ItemList", numberOfItems: fixture.shopCount, itemListElement: items })
    + jsonLd({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [] })
    + "</body></html>";
}

function validEvidence() {
  return {
    exactDeploymentUrl: exactUrl,
    deploymentId,
    expectedSha,
    inspect: {
      id: deploymentId,
      url: new URL(exactUrl).host,
      target: "production",
      readyState: "READY",
    },
    deployment: {
      id: deploymentId,
      url: new URL(exactUrl).host,
      target: "production",
      readyState: "READY",
      aliases: ["escomi-headless-main-user.vercel.app"],
      meta: { eskomiGitSha: expectedSha },
    },
    areas: Object.fromEntries(areaFixtures.map((fixture) => [
      fixture.slug,
      {
        status: 200,
        headers: { server: "Vercel", "x-robots-tag": "noindex" },
        html: areaHtml(fixture),
      },
    ])),
  };
}

function clone(value) {
  return structuredClone(value);
}

function expectFailure(label, mutate, expectedMessage) {
  const evidence = clone(validEvidence());
  mutate(evidence);
  try {
    validateExactDeploymentRelease(evidence);
    check(false, `${label}: expected failure`);
  } catch (error) {
    check(
      error instanceof Error && error.message.includes(expectedMessage),
      `${label}: expected ${JSON.stringify(expectedMessage)}, got ${JSON.stringify(error?.message)}`,
    );
  }
}

try {
  const result = validateExactDeploymentRelease(validEvidence());
  check(result.status === "PASS", "valid exact deployment evidence must pass");
  check(result.promotionStatus === "NOT_PROMOTED", "valid evidence must stop before promotion");
} catch (error) {
  check(false, `valid exact deployment evidence failed: ${error?.message}`);
}

expectFailure("missing URL", (value) => { value.exactDeploymentUrl = ""; }, "exact deployment URL is required");
expectFailure("deployment ID mismatch", (value) => { value.inspect.id = "dplSEDifferent"; }, "deployment ID mismatch");
expectFailure("SHA mismatch", (value) => { value.deployment.meta.eskomiGitSha = "0".repeat(40); }, "deployment SHA mismatch");
expectFailure("shinosaka 404", (value) => { value.areas.shinosaka.status = 404; }, "shinosaka HTTP status must be 200");
expectFailure("sakai 404", (value) => { value.areas.sakai.status = 404; }, "sakai HTTP status must be 200");
expectFailure("Next notFound", (value) => { value.areas.shinosaka.html += '<meta name="next-error" content="not-found">'; }, "shinosaka Next notFound fallback detected");
expectFailure("HTML noindex", (value) => { value.areas.shinosaka.html = value.areas.shinosaka.html.replace("index, follow", "noindex, nofollow"); }, "shinosaka HTML robots must not contain noindex");
expectFailure("shop count", (value) => { value.areas.sakai.html = value.areas.sakai.html.replace(' data-area-shop-card="true"', ""); }, "sakai shop card count must be 25");
expectFailure("ItemList count", (value) => { value.areas.shinosaka.html = value.areas.shinosaka.html.replace('"numberOfItems":58', '"numberOfItems":57'); }, "shinosaka ItemList numberOfItems must be 58");
expectFailure("outside hidden PPR dependency", (value) => { value.areas.sakai.html = value.areas.sakai.html.replace('<div hidden id="S:unrelated">unrelated</div>', '<div hidden id="S:leak"><section data-area-depth="coverage">leak</section></div>'); }, "sakai coverage must not depend on an outside hidden PPR segment");
expectFailure("details hidden by PPR segment", (value) => {
  value.areas.shinosaka.html = value.areas.shinosaka.html
    .replace('<details data-area-supporting-disclosure="true">', '<div hidden id="S:wrapped"><details data-area-supporting-disclosure="true">')
    .replace("</details>", "</details></div>");
}, "shinosaka details must not be inside a hidden PPR segment");
expectFailure("already promoted", (value) => { value.deployment.aliases.push("mens-esthe-kuchikomi.com"); }, "deployment must not be promoted to the production domain");

const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), "eskomi-exact-deployment-"));
try {
  const fixture = validEvidence();
  writeFileSync(path.join(fixtureDirectory, "inspect.json"), JSON.stringify(fixture.inspect));
  writeFileSync(path.join(fixtureDirectory, "deployment.json"), JSON.stringify(fixture.deployment));
  for (const [slug, response] of Object.entries(fixture.areas)) {
    writeFileSync(path.join(fixtureDirectory, `${slug}.json`), JSON.stringify(response));
  }
  const cliPath = path.join(scriptDirectory, "check-exact-deployment-release.mjs");
  const cliResult = spawnSync(process.execPath, [
    cliPath,
    "--url", exactUrl,
    "--id", deploymentId,
    "--expected-sha", expectedSha,
    "--fixture-dir", fixtureDirectory,
  ], { encoding: "utf8" });
  check(cliResult.status === 0, `fixture transport CLI must pass: ${cliResult.stderr.trim()}`);
  if (cliResult.status === 0) {
    const cliEvidence = JSON.parse(cliResult.stdout);
    check(cliEvidence.exactQa === "PASS", "fixture transport CLI must report exact QA PASS");
    check(cliEvidence.promotionStatus === "NOT_PROMOTED", "fixture transport CLI must report NOT_PROMOTED");
  }
  const missingUrlResult = spawnSync(process.execPath, [
    cliPath,
    "--id", deploymentId,
    "--expected-sha", expectedSha,
    "--fixture-dir", fixtureDirectory,
  ], { encoding: "utf8" });
  check(missingUrlResult.status !== 0, "transport CLI must reject a missing exact deployment URL");
  check(missingUrlResult.stderr.includes("exact deployment URL is required"), "transport CLI missing-URL error must be explicit");
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({ assertions, failures }, null, 2));
if (failures.length > 0) process.exitCode = 1;
