import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const script = readFileSync(
  fileURLToPath(new URL("./run-eskomi-v11-replay-e2e.sh", import.meta.url)),
  "utf8",
);

assert.match(
  script,
  /ESKOMI_E2E_CHROMIUM="\$\{ESKOMI_E2E_CHROMIUM:-\/usr\/bin\/chromium\}"/,
  "the localhost replay runner must allow a Mac Chrome executable to override the Linux Chromium default",
);
assert.match(
  script,
  /curl -s -o \/dev\/null "http:\/\/127\.0\.0\.1:57001\//,
  "the localhost replay runner must wait for an actual host TCP connection before calling its RPC",
);

console.log("Eskomi v1.1 localhost replay browser launcher contract: PASS");
