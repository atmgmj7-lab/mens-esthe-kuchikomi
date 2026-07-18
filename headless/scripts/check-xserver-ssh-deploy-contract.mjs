#!/usr/bin/env node

import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const workflowSource = await readFile(
  path.join(repositoryRoot, ".github/workflows/deploy.yml"),
  "utf8",
);
const packageSource = await readFile(
  path.join(repositoryRoot, "headless/package.json"),
  "utf8",
);
const packageJson = JSON.parse(packageSource);
const functionsSource = await readFile(path.join(repositoryRoot, "functions.php"), "utf8");
const predeployListPath = path.join(
  repositoryRoot,
  "scripts/xserver-predeploy-php-dependencies.txt",
);
const predeployListSource = await readFile(predeployListPath, "utf8");
const stageValidatorPath = path.join(
  repositoryRoot,
  "scripts/validate-xserver-deploy-stage.sh",
);
const stageValidatorSource = await readFile(stageValidatorPath, "utf8");

const EXPECTED_THEME_PATH =
  "/home/xs454693/mens-esthe-kuchikomi.com/public_html/wp-content/themes/swell_child/";

function extractWorkflowStep(stepName) {
  const marker = `      - name: ${stepName}\n`;
  const start = workflowSource.indexOf(marker);
  assert.notEqual(start, -1, `workflow step is required: ${stepName}`);
  const nextStep = workflowSource.indexOf("\n      - name:", start + marker.length);
  return workflowSource.slice(start, nextStep === -1 ? undefined : nextStep);
}

function assertNoRemoteDelete(stepSource) {
  assert.doesNotMatch(
    stepSource,
    /--delete\b/,
    "remote deploy step must never delete files that are absent from the stage",
  );
}

const validationStep = extractWorkflowStep("Validate SSH deployment inputs");
const buildDashboardStep = extractWorkflowStep("Build Dashboard");
const stageStep = extractWorkflowStep("Prepare safe deployment stage");
const configureSshStep = extractWorkflowStep("Configure SSH client");
const remoteDeployStep = extractWorkflowStep("Verify remote theme directory and deploy");
const restCheckStep = extractWorkflowStep("Post-deploy REST check");
assert.match(
  restCheckStep,
  /WP_SITE_URL="\$\{WP_SITE_URL%\/\}"/,
  "post-deploy REST check must remove a trailing slash from WP_SITE_URL",
);
assert.match(
  restCheckStep,
  /REST_UPDATE_URL="\$\{WP_SITE_URL\}\/wp-json\/escomi\/v1\/update\/"/,
  "post-deploy REST check must use the canonical trailing-slash endpoint",
);
assert.match(restCheckStep, /-X POST "\$\{REST_UPDATE_URL\}"/);

assert.doesNotMatch(
  workflowSource,
  /FTP|ftps|SamKirkland\/FTP-Deploy-Action/i,
  "deploy workflow must not retain FTP dependencies",
);
assert.doesNotMatch(workflowSource, /secrets\.FTP_|vars\.FTP_/);
assert.doesNotMatch(workflowSource, /set\s+-[^\n]*x|set\s+-x/);

for (const secretName of [
  "XSERVER_SSH_PRIVATE_KEY",
  "XSERVER_SSH_KNOWN_HOSTS",
]) {
  assert.match(
    workflowSource,
    new RegExp(`secrets\\.${secretName}\\b`),
    `${secretName} must come from GitHub secrets`,
  );
}
for (const variableName of [
  "XSERVER_SSH_HOST",
  "XSERVER_SSH_PORT",
  "XSERVER_SSH_USER",
  "XSERVER_SSH_PATH",
]) {
  assert.match(
    workflowSource,
    new RegExp(`vars\\.${variableName}\\b`),
    `${variableName} must come from GitHub variables`,
  );
}

assert.match(validationStep, /\[\[\s+-z\s+"\$XSERVER_SSH_HOST"\s+\]\]/);
assert.ok(validationStep.includes("=~ ^([A-Za-z0-9]"), "host must use a DNS allow-list");
assert.ok(validationStep.includes("=~ ^[0-9.]+$"), "numeric IP-shaped hosts must be rejected");
assert.match(validationStep, /10#\$XSERVER_SSH_PORT\s*<\s*1/);
assert.match(validationStep, /10#\$XSERVER_SSH_PORT\s*>\s*65535/);
assert.ok(
  validationStep.includes("=~ ^[A-Za-z0-9_][A-Za-z0-9_-]*$"),
  "SSH user must not start with a hyphen",
);
assert.ok(
  validationStep.includes(`EXPECTED_THEME_PATH="${EXPECTED_THEME_PATH}"`),
  "the only accepted remote path must be explicit",
);
assert.match(
  validationStep,
  /\[\[\s+"\$XSERVER_SSH_PATH"\s+!=\s+"\$EXPECTED_THEME_PATH"\s+\]\]/,
  "remote path must be checked by exact equality",
);

const stagePosition = workflowSource.indexOf("      - name: Prepare safe deployment stage");
const configureSshPosition = workflowSource.indexOf("      - name: Configure SSH client");
const remoteDeployPosition = workflowSource.indexOf(
  "      - name: Verify remote theme directory and deploy",
);
assert.ok(
  stagePosition < configureSshPosition && configureSshPosition < remoteDeployPosition,
  "SSH credentials must be written only after local build and stage validation",
);
assert.match(configureSshStep, /install\s+-d\s+-m\s+700\s+"\$HOME\/\.ssh"/);
assert.match(configureSshStep, /chmod\s+600\s+"\$HOME\/\.ssh\/xserver_deploy"/);
assert.match(configureSshStep, /chmod\s+600\s+"\$HOME\/\.ssh\/known_hosts"/);

assert.match(buildDashboardStep, /npm ci[\s\S]*npm run build/);
assert.match(buildDashboardStep, /test\s+-d\s+out/);
assert.match(buildDashboardStep, /test\s+-f\s+out\/index\.html/);
assert.match(buildDashboardStep, /test\s+-d\s+out\/_next/);
assert.doesNotMatch(buildDashboardStep, /cp\s+-r\s+out\/\.\s+\./);
assert.doesNotMatch(buildDashboardStep, /rm\s+-rf\s+out/);

assert.match(stageStep, /STAGE_DIR:\s*\$\{\{ runner\.temp \}\}\/xserver-theme-stage/);
assert.match(stageStep, /rsync\s+-a\s+"\$GITHUB_WORKSPACE\/"\s+"\$STAGE_DIR\/"/);
const rootCopyStart = stageStep.indexOf('rsync -a "$GITHUB_WORKSPACE/" "$STAGE_DIR/"');
const dashboardSourceGuardStart = stageStep.indexOf(
  'if ! test -d "$GITHUB_WORKSPACE/dashboard/out"',
);
assert.ok(rootCopyStart !== -1 && dashboardSourceGuardStart > rootCopyStart);
const rootCopyBlock = stageStep.slice(rootCopyStart, dashboardSourceGuardStart);
const forbiddenScanStart = stageStep.indexOf('FORBIDDEN_PATH="$(find "$STAGE_DIR"');
const forbiddenScanEnd = stageStep.indexOf('if [[ -n "$FORBIDDEN_PATH" ]]', forbiddenScanStart);
assert.ok(forbiddenScanStart !== -1 && forbiddenScanEnd > forbiddenScanStart);
const forbiddenScanBlock = stageStep.slice(forbiddenScanStart, forbiddenScanEnd);

const forbiddenDirectories = [
  ".github",
  ".deploy",
  ".superpowers",
  ".vscode",
  ".cursor",
  "docs",
  "headless",
  "pm",
  "scripts",
  "tools",
  "ai-site-monitor",
  "content",
  "agent-foundation",
  "MensEsthe-Notes",
  "supabase",
  "tests",
  "node_modules",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".idea",
];
const forbiddenFiles = [
  ".cursorrules",
  ".DS_Store",
  "import-test.php",
  "import-shops-web.php",
  "extract_target_list.py",
  "requirements-extract*.txt",
  "shops.csv",
  "wp_shops.example.json",
  "opcache-reset.php",
  "github-test.txt",
  "start.sh",
  "screenshot.png",
];
const forbiddenPatterns = [
  { exclude: "*.[mM][dD]", find: "*.md", operator: "-iname" },
  {
    exclude: "*.[mM][aA][rR][kK][dD][oO][wW][nN]",
    find: "*.markdown",
    operator: "-iname",
  },
  { exclude: "*.[lL][oO][gG]", find: "*.log", operator: "-iname" },
  { exclude: ".env", find: ".env", operator: "-name" },
  { exclude: ".env.*", find: ".env.*", operator: "-name" },
  {
    exclude: "*.[sS][eE][cC][rR][eE][tT]",
    find: "*.secret",
    operator: "-iname",
  },
  { exclude: "*.[pP][eE][mM]", find: "*.pem", operator: "-iname" },
];

const gitMetadataFixtures = [".gitkeep", ".gitattributes", ".gitmodules"];
assert.ok(
  rootCopyBlock.includes("--exclude='.git*'"),
  "all .git* files and directories must be excluded at any depth",
);
assert.ok(
  forbiddenScanBlock.includes("-name '.git*'"),
  "the post-copy scan must reject every .git* basename",
);
for (const fixtureName of gitMetadataFixtures) {
  assert.match(fixtureName, /^\.git.*$/, `${fixtureName} must be covered by the generic .git* guard`);
}

for (const directoryName of forbiddenDirectories) {
  assert.ok(
    rootCopyBlock.includes(`--exclude='${directoryName}/'`),
    `${directoryName}/ must be excluded by basename at any depth`,
  );
  assert.ok(
    forbiddenScanBlock.includes(`-name '${directoryName}'`),
    `${directoryName} must be rejected by the post-copy scan`,
  );
}
for (const fileName of forbiddenFiles) {
  assert.ok(
    rootCopyBlock.includes(`--exclude='${fileName}'`),
    `${fileName} must be excluded by basename at any depth`,
  );
  assert.ok(
    forbiddenScanBlock.includes(`-name '${fileName}'`),
    `${fileName} must be rejected by the post-copy scan`,
  );
}
for (const pattern of forbiddenPatterns) {
  assert.ok(
    rootCopyBlock.includes(`--exclude='${pattern.exclude}'`),
    `${pattern.exclude} must be excluded at any depth`,
  );
  assert.ok(
    forbiddenScanBlock.includes(`${pattern.operator} '${pattern.find}'`),
    `${pattern.find} must be rejected by the post-copy scan`,
  );
}

assert.ok(
  rootCopyBlock.includes("--exclude='dashboard/'"),
  "root copy must exclude all dashboard source",
);
assert.match(stageStep, /test\s+-d\s+"\$GITHUB_WORKSPACE\/dashboard\/out"/);
assert.match(stageStep, /test\s+-f\s+"\$GITHUB_WORKSPACE\/dashboard\/out\/index\.html"/);
assert.match(stageStep, /test\s+-d\s+"\$GITHUB_WORKSPACE\/dashboard\/out\/_next"/);
assert.match(
  stageStep,
  /rsync\s+-a\s+"\$GITHUB_WORKSPACE\/dashboard\/out\/"\s+"\$STAGE_DIR\/dashboard\/"/,
  "only the dashboard export may be copied into the stage",
);
assert.match(stageStep, /test\s+-f\s+"\$STAGE_DIR\/dashboard\/index\.html"/);
assert.match(stageStep, /test\s+-d\s+"\$STAGE_DIR\/dashboard\/_next"/);
assert.match(stageStep, /find\s+"\$STAGE_DIR"\s+-mindepth 1\s+-print\s+-quit/);
assert.match(stageStep, /test\s+-f\s+"\$STAGE_DIR\/functions\.php"/);
assert.match(stageStep, /test\s+-f\s+"\$STAGE_DIR\/style\.css"/);
assert.match(stageStep, /forbidden deploy file/i);

const literalRequirePattern =
  /require_once\s+(?:__DIR__|get_stylesheet_directory\(\))\s*\.\s*["']\/([^"']+\.php)["']\s*;/g;
const literalRequiredPhp = [...functionsSource.matchAll(literalRequirePattern)].map(
  (match) => match[1],
);
for (const knownRequiredPhp of [
  "shop-public-meta.php",
  "area-seo-hooks-optimized.php",
  "reviews-cpt.php",
  "reviews-public-rest.php",
]) {
  assert.ok(
    literalRequiredPhp.includes(knownRequiredPhp),
    `known functions.php literal require is missing: ${knownRequiredPhp}`,
  );
}
const predeployPhp = predeployListSource
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter((entry) => entry !== "" && !entry.startsWith("#"));
assert.equal(new Set(predeployPhp).size, predeployPhp.length, "predeploy PHP list must be unique");
for (const requiredPhp of literalRequiredPhp) {
  assert.ok(
    predeployPhp.includes(requiredPhp),
    `functions.php literal require is missing from predeploy list: ${requiredPhp}`,
  );
}
for (const conditionalDependency of ["ai-update-security.php", "ai-update-log.php"]) {
  assert.ok(
    predeployPhp.includes(conditionalDependency),
    `conditional AI dependency must be predeployed: ${conditionalDependency}`,
  );
}
assert.ok(
  predeployPhp.indexOf("ai-update-security.php") < predeployPhp.indexOf("ai-update-log.php"),
  "AI security helpers must be transferred before the AI update route",
);
assert.match(
  stageStep,
  /validate-xserver-deploy-stage\.sh"\s*\\?\s+"\$STAGE_DIR"\s*\\?\s+"\$GITHUB_WORKSPACE\/scripts\/xserver-predeploy-php-dependencies\.txt"/,
);
assert.match(stageValidatorSource, /set -euo pipefail/);
assert.match(stageValidatorSource, /Deployment stage is missing required PHP dependency/);
assert.match(stageValidatorSource, /Deployment stage contains forbidden scripts directory/);

const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "eskomi-deploy-stage-"));
const validFixture = path.join(fixtureRoot, "valid");
try {
  await mkdir(path.join(validFixture, "dashboard/_next"), { recursive: true });
  await writeFile(path.join(validFixture, "functions.php"), "<?php\n");
  await writeFile(path.join(validFixture, "style.css"), "/* fixture */\n");
  await writeFile(path.join(validFixture, "dashboard/index.html"), "<!doctype html>\n");
  for (const dependency of predeployPhp) {
    await writeFile(path.join(validFixture, dependency), "<?php\n");
  }
  execFileSync("bash", [stageValidatorPath, validFixture, predeployListPath], {
    stdio: "pipe",
  });

  for (const missingDependency of predeployPhp) {
    const missingFixture = path.join(fixtureRoot, `missing-${missingDependency}`);
    await cp(validFixture, missingFixture, { recursive: true });
    await unlink(path.join(missingFixture, missingDependency));
    assert.throws(
      () =>
        execFileSync("bash", [stageValidatorPath, missingFixture, predeployListPath], {
          stdio: "pipe",
        }),
      /Command failed/,
      `stage validation must fail without ${missingDependency}`,
    );
  }

  const scriptsLeakFixture = path.join(fixtureRoot, "scripts-leak");
  await cp(validFixture, scriptsLeakFixture, { recursive: true });
  await mkdir(path.join(scriptsLeakFixture, "scripts"));
  assert.throws(
    () =>
      execFileSync("bash", [stageValidatorPath, scriptsLeakFixture, predeployListPath], {
        stdio: "pipe",
      }),
    /Command failed/,
    "stage validation must reject deployment helper scripts",
  );
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

for (const sshOption of [
  "BatchMode=yes",
  "IdentitiesOnly=yes",
  "StrictHostKeyChecking=yes",
]) {
  assert.ok(
    (remoteDeployStep.match(new RegExp(sshOption, "g")) ?? []).length >= 2,
    `${sshOption} must protect both ssh and rsync`,
  );
}
assert.match(
  remoteDeployStep,
  /ssh[\s\S]*test -d[\s\S]*style\.css[\s\S]*rsync\s+-rltz/,
  "remote theme directory and style.css must be checked before rsync",
);
assert.match(remoteDeployStep, /--no-perms\s+--no-owner\s+--no-group/);
assertNoRemoteDelete(remoteDeployStep);
const dependencyTransferPosition = remoteDeployStep.indexOf('for dependency in "${PREDEPLOY_PHP_DEPENDENCIES[@]}"');
const fullStageTransferPosition = remoteDeployStep.indexOf('"$STAGE_DIR/"');
const functionsTransferPosition = remoteDeployStep.lastIndexOf('"$STAGE_DIR/functions.php"');
assert.ok(
  dependencyTransferPosition !== -1 &&
    dependencyTransferPosition < fullStageTransferPosition &&
    fullStageTransferPosition < functionsTransferPosition,
  "required PHP must transfer first, the stage second, and functions.php last",
);
assert.match(
  remoteDeployStep,
  /rsync[\s\S]*--exclude=["']functions\.php["'][\s\S]*"\$STAGE_DIR\/"/,
  "the full stage transfer must exclude functions.php",
);
assert.throws(
  () => assertNoRemoteDelete(remoteDeployStep.replace("rsync -rltz", "rsync \\\n+            --delete \\\n+            -rltz")),
  assert.AssertionError,
  "the remote-delete contract must catch --delete even when it is moved to another line",
);

assert.match(restCheckStep, /\/wp-json\/escomi\/v1\/update/);
assert.match(restCheckStep, /"\$HTTP_CODE"\s*=\s*"401"/);
assert.match(restCheckStep, /"\$HTTP_CODE"\s*=\s*"403"/);

assert.equal(
  packageJson.scripts["test:xserver-ssh-deploy"],
  "node scripts/check-xserver-ssh-deploy-contract.mjs",
);
assert.match(packageJson.scripts.test, /npm run test:xserver-ssh-deploy/);

console.log("XServer SSH deploy contract: PASS");
