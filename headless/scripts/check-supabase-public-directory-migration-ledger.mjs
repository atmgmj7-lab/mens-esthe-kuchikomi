import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  publicDirectoryMigrationLedger,
  renderPublicDirectoryMigrationLedgerPreflightSql
} from "./lib/supabase-public-directory-migration-ledger.mjs";

const migration = readFileSync(new URL(`../../${publicDirectoryMigrationLedger.sourcePath}`, import.meta.url), "utf8");
const preflight = renderPublicDirectoryMigrationLedgerPreflightSql();
const savedPreflight = readFileSync(new URL("../../supabase/imports/migration-ledger/20261020-public-directory-rpc.preflight.sql", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../supabase/imports/migration-ledger/20261020-public-directory-rpc.json", import.meta.url), "utf8"));

assert.equal(manifest.source.version, publicDirectoryMigrationLedger.sourceVersion);
assert.equal(manifest.source.name, publicDirectoryMigrationLedger.sourceName);
assert.equal(manifest.remoteApplied.version, publicDirectoryMigrationLedger.appliedVersion);
assert.equal(manifest.remoteApplied.name, publicDirectoryMigrationLedger.appliedName);
assert.equal(manifest.source.sha256, createHash("sha256").update(migration).digest("hex"));
assert.equal(savedPreflight, preflight, "committed read-only preflight must match the tested renderer");
assert.match(preflight, /begin read only/i);
assert.match(preflight, /already_applied_do_not_apply_source/);
assert.match(preflight, /old_source_version_absent/);
assert.match(preflight, /no_duplicate_named_record/);
assert.doesNotMatch(preflight, /\b(?:insert|update|delete|alter|create|drop|grant|revoke|notify)\b/i);
assert.doesNotMatch(preflight, /\bcommit\b[\s\S]*\b(?:insert|update|delete|alter|create|drop|grant|revoke|notify)\b/i);
console.log("Supabase public-directory migration-ledger preflight contract: PASS");
