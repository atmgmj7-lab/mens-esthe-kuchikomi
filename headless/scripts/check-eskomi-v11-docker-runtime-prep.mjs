import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const script = readFileSync(
  fileURLToPath(new URL("./run-eskomi-v11-replay-docker-http-e2e.sh", import.meta.url)),
  "utf8",
);

assert.match(script, /runtime_volume=/, "the isolated runner must create a Linux runtime volume");
assert.match(script, /npm ci --ignore-scripts/, "the Linux runtime must install lockfile-pinned dependencies before joining the internal network");
assert.match(script, /--network "\$network_name"[\s\S]*--mount "type=volume,src=\$runtime_volume,dst=\/app"/, "Next must run from the prepared Linux runtime on the internal network");
assert.match(script, /docker volume rm "\$runtime_volume"/, "the temporary Linux runtime volume must be removed by cleanup");
assert.doesNotMatch(script, /docker logs[^\n]*\|/, "readiness checks must not fail from a SIGPIPE under pipefail");

console.log("Eskomi v1.1 Docker Linux runtime preparation contract: PASS");
