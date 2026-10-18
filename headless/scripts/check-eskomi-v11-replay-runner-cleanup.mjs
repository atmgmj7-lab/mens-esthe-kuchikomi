import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runner = await readFile(join(root, "scripts/run-eskomi-v11-replay-docker-http-e2e.sh"), "utf8");

for (const resource of ["network", "database", "postgrest", "next", "browser"]) {
  assert.match(runner, new RegExp(`${resource}_created=0`));
  assert.match(runner, new RegExp(`\\[ "\\$${resource}_created" -eq 1 \\] && docker`));
}
assert.match(runner, /Refusing existing Docker resource/);
assert.match(runner, /Refusing to use existing runtime volume/);
assert.match(runner, /if \[ "\$runtime_volume_created" -eq 1 \]; then docker volume rm/);
assert.ok(runner.indexOf("Refusing existing Docker resource") < runner.indexOf("trap cleanup EXIT"), "resource collision check must happen before cleanup trap");
console.log("eskomi v1.1 replay runner cleanup contract: PASS");
