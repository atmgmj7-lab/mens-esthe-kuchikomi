import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const accountId = "0641c11bf1431e5ee5cd3fca94c417e2";
const allowedFlags = new Set(["--message", "--supabase-url", "--supabase-publishable-key", "--contact-vercel-fallback-origin"]);
const approvedContactFallbackOrigin = "https://escomi-headless-narikiyos-projects.vercel.app";
const expectedPublicRuntimeVars = Object.freeze([
  "CONTENT_DATA_SOURCE:supabase",
  "SUPABASE_CONTENT_CUTOVER_APPROVED:true",
  "SUPABASE_CONTENT_EXPECTED_SHOPS:393",
  "SUPABASE_CONTENT_EXPECTED_AREAS:34",
  "SUPABASE_CONTENT_EXPECTED_POSTS:0",
  "SUPABASE_CONTENT_EXPECTED_PAGES:6",
]);

const separator = process.argv.indexOf("--");
const control = process.argv.slice(2, separator < 0 ? undefined : separator);
const forwarded = separator < 0 ? [] : process.argv.slice(separator + 1);
if (control.length !== 4 || control[0] !== "--root" || control[2] !== "--profile") {
  throw new Error("usage: deploy-cloudflare-dynamic-production.mjs --root <derived-root> --profile eskomi-workers-deploy -- --message <message> --supabase-url <https-url> --supabase-publishable-key <key> [--contact-vercel-fallback-origin <https-url>]");
}
const [root, profile] = [control[1], control[3]];
assert.equal(profile, "eskomi-workers-deploy", "direct production deploy must use the approved named profile");

const values = new Map();
for (let index = 0; index < forwarded.length; index += 1) {
  const flag = forwarded[index];
  if (!allowedFlags.has(flag)) throw new Error(`unsupported direct production deploy argument: ${flag}`);
  const value = forwarded[index + 1] ?? "";
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  if (values.has(flag)) throw new Error(`duplicate direct production deploy argument: ${flag}`);
  values.set(flag, value);
  index += 1;
}
const message = values.get("--message");
const supabaseUrl = values.get("--supabase-url");
const publishableKey = values.get("--supabase-publishable-key");
const contactFallbackOrigin = values.get("--contact-vercel-fallback-origin");
assert.ok(message, "direct production deploy requires exactly one --message");
assert.match(supabaseUrl ?? "", /^https:\/\/goeagrxjsjcbbatpotbu\.supabase\.co\/?$/u, "direct production deploy must use the approved public Supabase project URL");
assert.match(publishableKey ?? "", /^sb_publishable_[A-Za-z0-9._-]+$/u, "direct production deploy must use a publishable key, never a legacy anon or server key");
if (contactFallbackOrigin !== undefined) {
  assert.equal(contactFallbackOrigin, approvedContactFallbackOrigin, "direct production deploy must use the reviewed Vercel contact fallback alias only");
}
const runtimeVariables = [
  ...expectedPublicRuntimeVars.flatMap((value) => ["--var", value]),
  "--var", `SUPABASE_CONTENT_URL:${supabaseUrl}`,
  "--var", `SUPABASE_CONTENT_PUBLISHABLE_KEY:${publishableKey}`,
  ...(contactFallbackOrigin === undefined ? [] : ["--var", `CONTACT_VERCEL_FALLBACK_ORIGIN:${contactFallbackOrigin}`]),
];

const verifier = spawnSync(process.execPath, [join(scriptsDirectory, "verify-cloudflare-dynamic-deploy-input.mjs"), "--root", root, "--target", "production"], {
  cwd: projectDirectory,
  encoding: "utf8",
});
if (verifier.status !== 0) throw new Error(`derived direct production input rejected: ${(verifier.stderr || verifier.stdout).trim()}`);

const wrangler = join(projectDirectory, "node_modules", "wrangler", "bin", "wrangler.js");
const deployment = spawnSync(process.execPath, [wrangler, "deploy", "--cwd", root, "--config", "wrangler.production.jsonc", "--profile", profile, "--strict", "--message", message, ...runtimeVariables], {
  cwd: projectDirectory,
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId },
});
if (deployment.error) throw deployment.error;
process.exitCode = deployment.status ?? 1;
