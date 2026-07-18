import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

const readRepositoryFile = (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

const [
  functionsSource,
  aiSource,
  priceMigratorSource,
  deployWorkflowSource,
  envExampleSource,
  packageSource,
] =
  await Promise.all([
    readRepositoryFile("functions.php"),
    readRepositoryFile("ai-update-log.php"),
    readRepositoryFile("ai-site-monitor/price_migrator.py"),
    readRepositoryFile(".github/workflows/deploy.yml"),
    readRepositoryFile("ai-site-monitor/.env.example"),
    readRepositoryFile("headless/package.json"),
  ]);

function assertUntrackedAndIgnored(relativePath) {
  const trackedPath = execFileSync(
    "git",
    ["ls-files", "--", relativePath],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  assert.equal(trackedPath, "", `${relativePath} must not be tracked`);

  try {
    execFileSync(
      "git",
      ["check-ignore", "--no-index", "--quiet", relativePath],
      { cwd: repositoryRoot, stdio: "ignore" },
    );
  } catch {
    assert.fail(`${relativePath} must remain ignored`);
  }
}

assertUntrackedAndIgnored("ai-site-monitor/.env");
assertUntrackedAndIgnored(".vscode/sftp.json");

const envExampleEntries = new Map();
for (const line of envExampleSource.split(/\r?\n/)) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) envExampleEntries.set(match[1], match[2].trim());
}
for (const requiredKey of [
  "WP_SITE_URL",
  "WP_USER",
  "WP_APP_PASSWORD",
  "GEMINI_API_KEY",
]) {
  assert.ok(envExampleEntries.has(requiredKey), `${requiredKey} example key is required`);
}
for (const secretKey of ["WP_APP_PASSWORD", "GEMINI_API_KEY"]) {
  assert.ok(envExampleEntries.get(secretKey) === "", `${secretKey} example must be empty`);
}
for (const [key, value] of envExampleEntries) {
  if (/(?:PASSWORD|SECRET|TOKEN|API_KEY)$/i.test(key)) {
    assert.ok(value === "", `${key} example must not contain a secret value`);
  }
}
assert.doesNotMatch(
  envExampleSource,
  /(?:[A-Za-z0-9]{4}\s+){5}[A-Za-z0-9]{4}/,
  "Application Password-shaped value must not appear in the example",
);
assert.doesNotMatch(
  envExampleSource,
  /AIza[0-9A-Za-z_-]{30,}/,
  "Gemini API key-shaped value must not appear in the example",
);

const packageJson = JSON.parse(packageSource);
assert.ok(
  packageJson.scripts["test:wp-phase0-security"].includes(
    "php ../tests/php/check-ai-update-route-security.php",
  ),
  "Phase 0 package test must execute the production PHP behavior test",
);

assert.doesNotMatch(functionsSource, /opcache_reset\s*\(/);
assert.doesNotMatch(functionsSource, /@?unlink\s*\(/);
assert.doesNotMatch(
  functionsSource,
  /register_rest_route\s*\(\s*['"]escomi\/v1['"]\s*,\s*['"]\/debug['"]/,
);
assert.doesNotMatch(
  functionsSource,
  /Missing API key[\s\S]{0,900}return null/,
);
assert.match(aiSource, /const ESKOMI_DAILY_UPDATE_META_KEYS\s*=\s*array\s*\(/);
assert.doesNotMatch(aiSource, /'ES'\s*\.\s*'COMI_DAILY_UPDATE_META_KEYS'/);
assert.match(
  aiSource,
  /current_user_can\(\s*['"]edit_post['"]\s*,\s*\$shop_id\s*\)/,
);
assert.match(aiSource, /escomi_update_daily_shop_data/);
assert.match(aiSource, /request_id/);
assert.match(aiSource, /'public'\s*=>\s*false/);
assert.match(aiSource, /'publicly_queryable'\s*=>\s*false/);
assert.match(aiSource, /'show_in_rest'\s*=>\s*false/);
assert.equal(
  (aiSource.match(/register_rest_route\s*\(\s*['"]escomi\/v1['"]\s*,\s*['"]\/update['"]/g) ?? []).length,
  1,
);
assert.doesNotMatch(
  functionsSource,
  /register_rest_route\s*\(\s*['"]escomi\/v1['"]\s*,\s*['"]\/update['"]/,
);
assert.doesNotMatch(aiSource, /['"]basic_price['"]\s*=>\s*\$params/);
assert.doesNotMatch(aiSource, /['"]official_url['"]\s*=>\s*\$params/);
assert.doesNotMatch(
  priceMigratorSource,
  /os\.environ\[["']WP_(?:USER|APP_PASSWORD)["']\]\s*=/,
);
assert.doesNotMatch(deployWorkflowSource, /escomi\/v1\/debug|opcache_reset/);

console.log("WordPress Phase 0 security contract: PASS");
