import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const headlessRoot = process.cwd();
const repoRoot = join(headlessRoot, "..");
const sql = readFileSync(join(repoRoot, "supabase/tests/verify_review_native_db_contract.sql"), "utf8");
const config = readFileSync(join(repoRoot, "supabase/config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];

if (!projectId) {
  throw new Error("supabase/config.toml must define project_id.");
}

const database = `supabase_db_${projectId}`;
const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

if (!containers.includes(database)) {
  throw new Error(`Local Supabase database ${database} is not running; run supabase start in this project first.`);
}

execFileSync(
  "docker",
  ["exec", "-i", database, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { input: sql, stdio: ["pipe", "pipe", "pipe"] },
);

console.log("review native DB contract check passed");
