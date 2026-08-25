import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const functionsSource = await readFile(path.join(repositoryRoot, "functions.php"), "utf8");
const packageJson = JSON.parse(
  await readFile(path.join(repositoryRoot, "headless/package.json"), "utf8"),
);

assert.match(
  functionsSource,
  /is_readable\s*\(\s*\$coverage_batch_writer\s*\)[\s\S]{0,160}require_once\s+\$coverage_batch_writer/,
  "functions.php must load the readable dedicated coverage writer",
);
assert.ok(
  packageJson.scripts["test:coverage-batch"],
  "test:coverage-batch package script is required",
);
assert.match(packageJson.scripts.test, /npm run test:coverage-batch/);

execFileSync(
  "python3",
  ["-m", "unittest", "discover", "-s", "tools/eskomi_coverage_batch/tests", "-v"],
  { cwd: repositoryRoot, stdio: "inherit" },
);
execFileSync("php", ["tests/php/check-coverage-batch-hash-contract.php"], {
  cwd: repositoryRoot,
  stdio: "inherit",
});
execFileSync("php", ["tests/php/check-coverage-batch-writer-contract.php"], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

console.log("Coverage batch integration contract: PASS");
