import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..", "..");
const database = process.env.ESKOMI_V11_PUBLIC_REVIEW_DB;
assert.ok(database, "ESKOMI_V11_PUBLIC_REVIEW_DB must name the retained local v1.1 fixture container");
const migration = readFileSync(resolve(root, "supabase/migrations/20261022023612_eskomi_public_widget_anon_reader.sql"), "utf8");
const verification = readFileSync(resolve(root, "supabase/tests/verify_eskomi_public_widget_anon_reader.sql"), "utf8");
const result = spawnSync("docker", ["exec", "-i", database, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
  input: `begin;\n${migration}\n${verification}\nrollback;\n`, encoding: "utf8",
});
assert.equal(result.status, 0, result.stderr || result.stdout);
for (const assertion of [
  "anon_widget_only_approved_published", "anon_widget_reply_only_approved", "anon_widget_limit_and_offset_clamped",
  "anon_widget_disabled_or_unlisted_hidden", "anon_widget_direct_tables_denied",
]) assert.match(result.stdout, new RegExp(`${assertion}[\\s\\S]*t`, "u"));
console.log("Eskomi public widget anonymous local contract: PASS");
