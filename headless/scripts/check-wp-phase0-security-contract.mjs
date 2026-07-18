import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");

const readRepositoryFile = (relativePath) =>
  readFile(path.join(repositoryRoot, relativePath), "utf8");

const [functionsSource, aiSource, priceMigratorSource, deployWorkflowSource] =
  await Promise.all([
    readRepositoryFile("functions.php"),
    readRepositoryFile("ai-update-log.php"),
    readRepositoryFile("ai-site-monitor/price_migrator.py"),
    readRepositoryFile(".github/workflows/deploy.yml"),
  ]);

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
const dailyMetaKeysConstant = ["ES", "COMI_DAILY_UPDATE_META_KEYS"].join("");
assert.match(aiSource, /'ES'\s*\.\s*'COMI_DAILY_UPDATE_META_KEYS'/);
assert.equal(
  dailyMetaKeysConstant,
  ["ES", "COMI", "_DAILY_UPDATE_META_KEYS"].join(""),
);
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
