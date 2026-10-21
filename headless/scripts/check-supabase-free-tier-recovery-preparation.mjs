import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const headlessDirectory = resolve(scriptsDirectory, "..");
const repositoryDirectory = resolve(headlessDirectory, "..");
const capturePath = join(scriptsDirectory, "capture-supabase-encrypted-logical-backup.sh");
const verifyPath = join(scriptsDirectory, "verify-supabase-encrypted-logical-backup.sh");
const evidencePath = join(
  headlessDirectory,
  "docs/technical/artifacts/2026-10-18-cloudflare-workers-local-qa/FREE-TIER-LOGICAL-RECOVERY-PREPARATION-2026-10-21.md",
);

for (const path of [capturePath, verifyPath, evidencePath]) {
  assert.equal(existsSync(path), true, `required recovery preparation artifact is missing: ${path}`);
}

const capture = readFileSync(capturePath, "utf8");
assert.match(capture, /--execute-approved-encrypted-backup/u);
assert.match(capture, /ESKOMI_BACKUP_APPROVAL_ID/u);
assert.match(capture, /PGSERVICE is required/u);
assert.match(capture, /PGPASSWORD:-/u);
assert.match(capture, /DATABASE_URL:-/u);
assert.match(capture, /\/tmp \/workspace/u);
assert.match(capture, /pg_dump --format=custom --schema-only/u);
assert.match(capture, /pg_dump --format=custom --data-only/u);
assert.match(capture, /pg_dumpall --globals-only/u);
assert.match(capture, /pg_policies/u);
assert.match(capture, /storage_object_bytes=NOT_INCLUDED/u);
assert.match(capture, /gpg --batch --yes --trust-model always --encrypt/u);
assert.doesNotMatch(capture, /goeagrxjsjcbbatpotbu/u, "capture runner must not pin a production endpoint");

const verify = readFileSync(verifyPath, "utf8");
assert.match(verify, /--verify-approved-encrypted-backup/u);
assert.match(verify, /sha256sum --check/u);
assert.match(verify, /pg_restore --list/u);
assert.match(verify, /This did not restore data or validate Storage object bytes/u);
assert.doesNotMatch(verify, /psql .*restore/u);

const evidence = readFileSync(evidencePath, "utf8");
assert.match(evidence, /Free Plan does not\s+include project backups/u);
assert.match(evidence, /Storage object bytes/u);
assert.match(evidence, /not\s+an approved backup destination/u);
assert.match(evidence, /50 migration/u);
assert.match(evidence, /ed94f2641b9694bd4f249301ec4d586a4c13d6d1/u);
assert.match(evidence, /not run in this shared cloud/u);

console.log("Supabase free-tier recovery preparation contract: PASS");
