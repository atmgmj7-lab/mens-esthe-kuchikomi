import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..", "..");
const database = process.env.ESKOMI_V11_PUBLIC_REVIEW_DB;
assert.ok(database, "ESKOMI_V11_PUBLIC_REVIEW_DB must name the retained local v1.1 fixture container");
const migration = readFileSync(resolve(root, "supabase/migrations/20261020030000_eskomi_public_review_read_rpc.sql"), "utf8");
const verification = readFileSync(resolve(root, "supabase/tests/verify_eskomi_public_review_read_rpc.sql"), "utf8");
const result = spawnSync("docker", ["exec", "-i", database, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], {
  input: `begin;\n${migration}\n${verification}\nrollback;\n`, encoding: "utf8",
});
assert.equal(result.status, 0, result.stderr || result.stdout);
assert.match(result.stdout, /anon_global_only_published[\s\S]*t/iu);
assert.match(result.stdout, /anon_area_count_only_published[\s\S]*t/iu);
assert.match(result.stdout, /anon_shop_detail_only_published[\s\S]*t/iu);
assert.match(result.stdout, /anon_empty_shop_summary[\s\S]*t/iu);
console.log("Eskomi public review anonymous local contract: PASS");
