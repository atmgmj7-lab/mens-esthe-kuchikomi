import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const packageJson = JSON.parse(readFileSync(join(projectDirectory, "package.json"), "utf8"));
const previewConfig = readFileSync(join(projectDirectory, "wrangler.preview.jsonc"), "utf8");
const proxy = readFileSync(join(projectDirectory, "proxy.ts"), "utf8");
const staticHeaders = readFileSync(join(projectDirectory, "public", "_headers"), "utf8");

assert.equal(packageJson.scripts?.["workers:preview-prepare"], "node scripts/build-cloudflare-dynamic-public-read.mjs --prepare-only", "preview preparation must only create an isolated derived source tree");
assert.equal(packageJson.scripts?.["test:cloudflare-noindex-preview"], "node scripts/check-cloudflare-noindex-preview.mjs", "preview safety contract must be runnable");
assert.match(previewConfig, /"name":\s*"eskomi-workers-prep"/u, "preview must deploy only to the approved Worker name");
assert.match(previewConfig, /"ESKOMI_WORKERS_PREVIEW_NO_INDEX":\s*"true"/u, "preview must opt into global noindex");
assert.match(previewConfig, /"WP_API_BASE_URL":\s*"https:\/\/preview-origin-disabled\.invalid\/wp-json"/u, "preview must not read the WordPress origin");
assert.match(previewConfig, /"SUPABASE_CONTENT_URL":\s*"https:\/\/preview-data-disabled\.invalid"/u, "preview must not read public Supabase data");
assert.doesNotMatch(previewConfig, /mens-esthe-kuchikomi\.com|goeagrxjsjcbbatpotbu|account_id|routes|secret/iu, "preview config must contain neither production targeting nor secrets");
assert.match(proxy, /ESKOMI_WORKERS_PREVIEW_NO_INDEX/u, "middleware must recognize the preview noindex flag");
assert.match(proxy, /X-Robots-Tag.*noindex, nofollow/su, "preview responses must carry an HTTP noindex header");
assert.match(staticHeaders, /^\/\*\s*\n\s*X-Robots-Tag:\s*noindex, nofollow/mu, "static assets must receive the preview noindex header too");

const prepared = spawnSync(process.execPath, [join(projectDirectory, "scripts", "build-cloudflare-dynamic-public-read.mjs"), "--prepare-only"], { cwd: projectDirectory, encoding: "utf8" });
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const root = `${prepared.stdout}\n${prepared.stderr}`.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu)?.[1]?.trim();
assert.ok(root, "prepared source root must be reported");
assert.equal(existsSync(join(root, "wrangler.preview.jsonc")), true, "derived source must include the noindex preview config");
console.log("Cloudflare noindex preview contract: PASS");
