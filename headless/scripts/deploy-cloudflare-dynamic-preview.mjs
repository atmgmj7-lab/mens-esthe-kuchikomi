import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const accountId = "0641c11bf1431e5ee5cd3fca94c417e2";
const allowedFlags = new Set(["--message"]);

const separator = process.argv.indexOf("--");
const control = process.argv.slice(2, separator < 0 ? undefined : separator);
const forwarded = separator < 0 ? [] : process.argv.slice(separator + 1);
if (control.length !== 4 || control[0] !== "--root" || control[2] !== "--profile") {
  throw new Error("usage: deploy-cloudflare-dynamic-preview.mjs --root <derived-root> --profile eskomi-workers-deploy -- --message <message>");
}
const [root, profile] = [control[1], control[3]];
assert.equal(profile, "eskomi-workers-deploy", "preview deploy must use the approved named profile");
let messageCount = 0;
for (let index = 0; index < forwarded.length; index += 1) {
  const flag = forwarded[index];
  if (!allowedFlags.has(flag)) throw new Error(`unsupported preview deploy argument: ${flag}`);
  const value = forwarded[index + 1] ?? "";
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  if (flag === "--message") {
    messageCount += 1;
  }
  index += 1;
}
assert.equal(messageCount, 1, "preview deploy requires exactly one --message");

const verifier = spawnSync(process.execPath, [join(scriptsDirectory, "verify-cloudflare-dynamic-deploy-input.mjs"), "--root", root], {
  cwd: projectDirectory,
  encoding: "utf8",
});
if (verifier.status !== 0) throw new Error(`derived deployment input rejected: ${(verifier.stderr || verifier.stdout).trim()}`);

const wrangler = join(projectDirectory, "node_modules", "wrangler", "bin", "wrangler.js");
const deployment = spawnSync(process.execPath, [wrangler, "deploy", "--cwd", root, "--config", "wrangler.preview.jsonc", "--profile", profile, "--strict", ...forwarded], {
  cwd: projectDirectory,
  stdio: "inherit",
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId },
});
if (deployment.error) throw deployment.error;
process.exitCode = deployment.status ?? 1;
