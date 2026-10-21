import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(scriptsDirectory, "run-eskomi-v11-synthetic-atomic-migration-rehearsal.sh");

assert.equal(existsSync(runnerPath), true, "atomic migration rehearsal runner must exist");
const runner = readFileSync(runnerPath, "utf8");

assert.match(runner, /docker network create --internal/u);
assert.doesNotMatch(runner, /--network host/u);
assert.doesNotMatch(runner, /(?:^|\s)-p\s|--publish/u);
assert.match(runner, /create table supabase_migrations\.schema_migrations/u);
assert.match(runner, /printf 'begin;/u);
assert.match(runner, /insert into supabase_migrations\.schema_migrations/u);
assert.match(runner, /commit;/u);
assert.match(runner, /synthetic atomic migration failure/u);
assert.match(runner, /failed migration or its ledger row was not rolled back/u);
assert.match(runner, /verify_eskomi_public_review_read_rpc/u);
assert.doesNotMatch(runner, /goeagrxjsjcbbatpotbu/u, "runner must not name the production project");

console.log("Eskomi synthetic atomic migration rehearsal contract: PASS");
