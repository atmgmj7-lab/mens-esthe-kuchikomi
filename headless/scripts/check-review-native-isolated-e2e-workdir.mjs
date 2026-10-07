import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "scripts/check-review-native-isolated-e2e.mjs"), "utf8");

assert.match(source, /E2E_SUPABASE_WORKDIR/, "isolated E2E must permit an explicit separate Supabase workdir");
assert.match(source, /supabaseWorkdir/, "status and config must resolve from the selected isolated workdir");
assert.match(source, /\["status", "-o", "env", "--workdir", supabaseWorkdir\]/, "Supabase status must not fall back to the repository's existing DB");
assert.match(source, /join\(supabaseWorkdir, "supabase\/config\.toml"\)/, "workdir must be the Supabase project root, not its config directory");
assert.match(source, /"@\/lib\/supabase\/server-secret": serverSecret/, "isolated E2E must load the repository's server secret header helper");
assert.match(source, /loadTypeScript\("lib\/supabase\/partner-workspace\.ts", \{[\s\S]*?"@\/lib\/supabase\/server-secret": serverSecret/, "Partner workspace fixture must use the same server secret helper");

console.log("review native isolated E2E workdir contract: PASS");
