import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const script = readFileSync(
  fileURLToPath(new URL("./verify-eskomi-v11-mutation-races.sh", import.meta.url)),
  "utf8",
);

assert.doesNotMatch(script, /\b(?:mapfile|readarray)\b/, "the race runner must work with macOS Bash 3.2");
assert.match(script, /while IFS= read -r row; do/, "the fixture rows must be collected with a Bash 3.2-compatible loop");

console.log("Eskomi v1.1 mutation-race runner Bash 3.2 portability: PASS");
