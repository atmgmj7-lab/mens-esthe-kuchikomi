#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const EXPECTED_THEME_PATH =
  "/home/xs454693/mens-esthe-kuchikomi.com/public_html/wp-content/themes/swell_child/";

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

assert.match(workflowSource, /\[\[\s+-z\s+"\$XSERVER_SSH_HOST"\s+\]\]/);
assert.ok(
  workflowSource.includes("=~ ^([A-Za-z0-9]"),
  "host must use a DNS allow-list",
);
assert.ok(
  workflowSource.includes("=~ ^[0-9.]+$"),
  "numeric IP-shaped hosts must be rejected",
);
assert.match(workflowSource, /10#\$XSERVER_SSH_PORT\s*<\s*1/);
assert.match(workflowSource, /10#\$XSERVER_SSH_PORT\s*>\s*65535/);
assert.ok(
  workflowSource.includes("=~ ^[A-Za-z0-9_-]+$"),
  "SSH user must use a strict allow-list",
);
assert.ok(
  workflowSource.includes(`EXPECTED_THEME_PATH="${EXPECTED_THEME_PATH}"`),
  "the only accepted remote path must be explicit",
);
assert.match(
  workflowSource,
  /\[\[\s+"\$XSERVER_SSH_PATH"\s+!=\s+"\$EXPECTED_THEME_PATH"\s+\]\]/,
  "remote path must be checked by exact equality",
);

assert.match(workflowSource, /install\s+-d\s+-m\s+700\s+"\$HOME\/\.ssh"/);
assert.match(workflowSource, /chmod\s+600\s+"\$HOME\/\.ssh\/xserver_deploy"/);
assert.match(workflowSource, /chmod\s+600\s+"\$HOME\/\.ssh\/known_hosts"/);
for (const sshOption of [
  "BatchMode=yes",
  "IdentitiesOnly=yes",
  "StrictHostKeyChecking=yes",
]) {
  assert.ok(
    (workflowSource.match(new RegExp(sshOption, "g")) ?? []).length >= 2,
    `${sshOption} must protect both ssh and rsync`,
  );
}

assert.match(workflowSource, /STAGE_DIR:\s*\$\{\{ runner\.temp \}\}\/xserver-theme-stage/);
assert.match(workflowSource, /rsync\s+-a\s+"\$GITHUB_WORKSPACE\/"\s+"\$STAGE_DIR\/"/);
for (const excludedPath of [
  "/.git",
  "/.git/",
  "/.github/",
  "/.deploy/",
  "/docs/",
  "/headless/",
  "/pm/",
  "/tools/",
  "/ai-site-monitor/",
  "/content/",
  "/agent-foundation/",
  "/MensEsthe-Notes/",
  "/dashboard/app/",
  "/dashboard/lib/",
  "/dashboard/components/",
  "/dashboard/public/",
  "/dashboard/node_modules/",
  "/dashboard/.next/",
  "/dashboard/out/",
]) {
  assert.ok(workflowSource.includes(`--exclude='${excludedPath}'`), `${excludedPath} must be excluded`);
}
for (const excludedPattern of [
  "*.md",
  "*.markdown",
  "*.log",
  ".env",
  ".env.*",
  "*.secret",
  "*.pem",
]) {
  assert.ok(
    workflowSource.includes(`--exclude='${excludedPattern}'`),
    `${excludedPattern} must be excluded`,
  );
}

assert.match(workflowSource, /find\s+"\$STAGE_DIR"\s+-mindepth 1\s+-print\s+-quit/);
assert.match(workflowSource, /test\s+-f\s+"\$STAGE_DIR\/functions\.php"/);
assert.match(workflowSource, /test\s+-f\s+"\$STAGE_DIR\/style\.css"/);
assert.match(workflowSource, /forbidden deploy file/i);

assert.match(
  workflowSource,
  /ssh[\s\S]{0,900}test -d[\s\S]{0,300}style\.css/,
  "remote theme directory and style.css must be checked before rsync",
);
assert.match(workflowSource, /rsync\s+-rltz/);
assert.match(workflowSource, /--no-perms\s+--no-owner\s+--no-group/);
assert.doesNotMatch(workflowSource, /rsync[^\n]*--delete/);

assert.match(workflowSource, /Post-deploy REST check/);
assert.match(workflowSource, /\/wp-json\/escomi\/v1\/update/);
assert.match(workflowSource, /"\$HTTP_CODE"\s*=\s*"401"/);
assert.match(workflowSource, /"\$HTTP_CODE"\s*=\s*"403"/);

assert.equal(
  packageJson.scripts["test:xserver-ssh-deploy"],
  "node scripts/check-xserver-ssh-deploy-contract.mjs",
);
assert.match(packageJson.scripts.test, /npm run test:xserver-ssh-deploy/);

console.log("XServer SSH deploy contract: PASS");
