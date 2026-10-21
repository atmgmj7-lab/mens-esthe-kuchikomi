import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const packet = join(root, "headless/docs/technical/artifacts/2026-10-18-cloudflare-workers-local-qa/manual-sql-editor-v11-2026-10-21");
const generator = join(root, "headless/scripts/generate-eskomi-v11-sql-editor-packet.mjs");
const rehearsal = join(root, "headless/scripts/run-eskomi-v11-sql-editor-packet-rehearsal.sh");

assert.equal(existsSync(generator), true, "packet generator must exist");
assert.equal(existsSync(rehearsal), true, "synthetic rehearsal runner must exist");
for (const stage of ["01", "02", "03", "04", "05"]) {
  const source = readFileSync(join(packet, `${stage}-stage-${stage}.sql`), "utf8");
  assert.match(source, /^begin;$/mu, `${stage} must start an explicit transaction`);
  assert.match(source, /pg_advisory_xact_lock/u, `${stage} must lock its transaction`);
  assert.match(source, /stage .*already partly or wholly recorded/u, `${stage} must reject replay/partial state`);
  assert.match(source, /insert into supabase_migrations\.schema_migrations/u, `${stage} must record source ledger text`);
  assert.match(source, /^commit;$/mu, `${stage} must have an explicit commit`);
  assert.doesNotMatch(source, /goeagrxjsjcbbatpotbu[^\n]*key|service_role[^\n]*=/iu, `${stage} must not contain credentials`);
}
const runner = readFileSync(rehearsal, "utf8");
assert.match(runner, /docker network create --internal/u);
assert.doesNotMatch(runner, /--network host/u);
assert.match(runner, /select 1\\\/0/u, "runner must inject a rollback proof");
assert.match(runner, /packet failure did not roll back/u);
assert.doesNotMatch(runner, /goeagrxjsjcbbatpotbu/u, "runner must not target production");
console.log("Eskomi manual SQL Editor packet static contract: PASS");
