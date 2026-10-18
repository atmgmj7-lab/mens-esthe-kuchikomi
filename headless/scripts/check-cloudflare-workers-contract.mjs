import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const packagePath = join(projectDirectory, "package.json");
const wranglerPath = join(projectDirectory, "wrangler.jsonc");
const openNextPath = join(projectDirectory, "open-next.config.ts");
const nextConfigPath = join(projectDirectory, "next.config.ts");
const contactRoutePath = join(projectDirectory, "app/api/contact/route.ts");
const devVarsExamplePath = join(projectDirectory, ".dev.vars.example");
const eslintConfigPath = join(projectDirectory, "eslint.config.mjs");
const dynamicBuildPath = join(projectDirectory, "scripts", "build-cloudflare-dynamic-public-read.mjs");
const dynamicBuildContractPath = join(projectDirectory, "scripts", "check-cloudflare-dynamic-source-build.mjs");

for (const path of [packagePath, wranglerPath, openNextPath, nextConfigPath, contactRoutePath, devVarsExamplePath, eslintConfigPath, dynamicBuildPath, dynamicBuildContractPath]) {
  assert.equal(existsSync(path), true, `required Workers preparation file is missing: ${path}`);
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
assert.equal(packageJson.dependencies?.["@opennextjs/cloudflare"], "1.20.9", "adapter must stay on the audited Next 16.3.8-compatible release");
assert.equal(packageJson.devDependencies?.wrangler, "4.151.1", "Wrangler must stay exact for local preview reproducibility");
assert.match(packageJson.scripts?.["workers:build"] ?? "", /^WP_API_BASE_URL=http:\/\/127\.0\.0\.1:9\/wp-json NEXT_PUBLIC_WP_BASE_URL=https:\/\/workers-fixture\.invalid opennextjs-cloudflare build$/u, "baseline Workers build must use only the offline WordPress fixture origin");
assert.equal(packageJson.scripts?.["workers:dynamic-build"], "node scripts/build-cloudflare-dynamic-public-read.mjs", "dynamic Workers build must use the versioned derived source generator");
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "workers:preview"), false, "a derived build root must be selected explicitly before any local preview");
assert.equal(Object.hasOwn(packageJson.scripts ?? {}, "workers:deploy"), false, "offline preparation must not provide a deployment script");

const wrangler = readFileSync(wranglerPath, "utf8");
assert.match(wrangler, /"main":\s*"\.open-next\/worker\.js"/u, "Wrangler must point to OpenNext output");
assert.match(wrangler, /"compatibility_date":\s*"2026-10-18"/u, "Wrangler must pin the reviewed compatibility date");
assert.match(wrangler, /"nodejs_compat"/u, "Workers Node compatibility must be explicit for the current server modules");
assert.match(wrangler, /"binding":\s*"ASSETS"/u, "OpenNext static assets binding must be configured");
for (const forbidden of ["account_id", "route", "routes", "zone_id", "kv_namespaces", "r2_buckets", "durable_objects", "vars", "secrets", "triggers", "crons"]) {
  assert.doesNotMatch(wrangler, new RegExp(`"${forbidden}"`, "u"), `offline config must not add ${forbidden}`);
}

const openNext = readFileSync(openNextPath, "utf8");
assert.match(openNext, /defineCloudflareConfig\(\)/u, "offline preparation must use adapter defaults without a shared cache binding");
assert.doesNotMatch(openNext, /incrementalCache|tagCache|queue|cachePurge/u, "cache backends require a separate production decision");

const nextConfig = readFileSync(nextConfigPath, "utf8");
assert.match(nextConfig, /cacheComponents:\s*true/u, "existing Cache Components must remain enabled");
assert.match(nextConfig, /private, no-store/u, "partner response no-store policy must remain intact");

const contactRoute = readFileSync(contactRoutePath, "utf8");
assert.match(contactRoute, /import nodemailer/u, "contact SMTP behavior must remain explicitly visible for Workers runtime validation");
assert.match(contactRoute, /CONTACT_FORM_DRY_RUN/u, "local Workers email proof must use the existing dry-run path");

const devVarsExample = readFileSync(devVarsExamplePath, "utf8");
assert.match(devVarsExample, /^CONTACT_FORM_DRY_RUN=true$/mu, "Workers preview must set contact email to dry-run");
assert.match(devVarsExample, /^WP_API_BASE_URL=http:\/\/127\.0\.0\.1:9\/wp-json$/mu, "Workers runtime fixture must not use the production WordPress API");
assert.match(devVarsExample, /^NEXT_PUBLIC_WP_BASE_URL=https:\/\/workers-fixture\.invalid$/mu, "Workers runtime fixture must not use the production public base");
assert.doesNotMatch(devVarsExample, /SECRET|PASSWORD|TOKEN|KEY|mens-esthe-kuchikomi\.com/u, "Workers fixture example must not contain a production secret or origin");

const eslintConfig = readFileSync(eslintConfigPath, "utf8");
assert.match(eslintConfig, /"\.open-next\/\*\*"/u, "OpenNext generated output must stay outside application linting");
assert.match(eslintConfig, /"\.wrangler\/\*\*"/u, "Wrangler generated output must stay outside application linting");
assert.match(eslintConfig, /"\.eskomi-cloudflare-dynamic-builds\/\*\*"/u, "retained derived dynamic-build output must stay outside application linting");

console.log("Eskomi Cloudflare Workers offline contract: PASS");
