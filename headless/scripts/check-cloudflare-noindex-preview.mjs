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

assert.equal(packageJson.scripts?.["workers:preview-prepare"], "node scripts/build-cloudflare-dynamic-public-read.mjs --prepare-only", "preview preparation must only create an isolated derived source tree");
assert.equal(packageJson.scripts?.["test:cloudflare-noindex-preview"], "node scripts/check-cloudflare-noindex-preview.mjs", "preview safety contract must be runnable");
assert.match(previewConfig, /"name":\s*"eskomi-workers-prep"/u, "preview must deploy only to the approved Worker name");
assert.match(previewConfig, /"ESKOMI_WORKERS_PREVIEW_NO_INDEX":\s*"true"/u, "preview must opt into global noindex");
assert.match(previewConfig, /"CONTENT_DATA_SOURCE":\s*"wordpress"/u, "preview must use the WordPress compatibility reader until the Workers-to-Supabase transport issue is fixed");
assert.match(previewConfig, /"WP_API_BASE_URL":\s*"https:\/\/mens-esthe-kuchikomi\.com\/wp-json"/u, "preview must read only the existing public WordPress API");
assert.match(previewConfig, /"NEXT_PUBLIC_WP_BASE_URL":\s*"https:\/\/mens-esthe-kuchikomi\.com"/u, "preview canonical links must retain the existing public hostname");
assert.doesNotMatch(previewConfig, /goeagrxjsjcbbatpotbu|SUPABASE_CONTENT|account_id|routes|secret/iu, "preview config must not carry Supabase bindings, account targeting, routes, or secrets");
assert.match(proxy, /ESKOMI_WORKERS_PREVIEW_NO_INDEX/u, "middleware must recognize the preview noindex flag");
assert.match(proxy, /X-Robots-Tag.*noindex, nofollow/su, "preview responses must carry an HTTP noindex header");
assert.equal(existsSync(join(projectDirectory, "public", "_headers")), false, "the normal production source must not ship preview noindex headers");

const prepared = spawnSync(process.execPath, [join(projectDirectory, "scripts", "build-cloudflare-dynamic-public-read.mjs"), "--prepare-only"], { cwd: projectDirectory, encoding: "utf8" });
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const root = `${prepared.stdout}\n${prepared.stderr}`.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu)?.[1]?.trim();
assert.ok(root, "prepared source root must be reported");
assert.equal(existsSync(join(root, "wrangler.preview.jsonc")), true, "derived source must include the noindex preview config");
assert.match(readFileSync(join(root, "public", "_headers"), "utf8"), /^\/\*\s*\n\s*X-Robots-Tag:\s*noindex, nofollow/mu, "only the derived preview source may carry static noindex headers");
console.log("Cloudflare noindex preview contract: PASS");
