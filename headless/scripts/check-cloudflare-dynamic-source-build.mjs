import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, "..");
const generatorPath = resolve(projectDirectory, "scripts/build-cloudflare-dynamic-public-read.mjs");
const packagePath = join(projectDirectory, "package.json");
const gitignorePath = join(projectDirectory, ".gitignore");

assert.equal(
  existsSync(generatorPath),
  true,
  "Cloudflare dynamic public-read build must use a versioned physical-source generator",
);

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
assert.equal(
  packageJson.scripts?.["workers:dynamic-build"],
  "node scripts/build-cloudflare-dynamic-public-read.mjs",
  "dynamic Workers build must use the physical derived source generator",
);
assert.equal(
  packageJson.scripts?.["test:cloudflare-dynamic-public-read"],
  "node scripts/check-cloudflare-dynamic-source-build.mjs",
  "derived-source safety contract must be runnable through npm",
);
assert.match(
  readFileSync(gitignorePath, "utf8"),
  /^\.eskomi-cloudflare-dynamic-builds\/$/mu,
  "each derived Cloudflare source tree must be ignored",
);

const prepared = spawnSync(process.execPath, [generatorPath, "--prepare-only"], {
  cwd: projectDirectory,
  encoding: "utf8",
});
assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
const output = `${prepared.stdout}\n${prepared.stderr}`;
const match = output.match(/^ESKOMI_DYNAMIC_WORKERS_BUILD_ROOT=(.+)$/mu);
assert.ok(match, "generator must report its unique derived source root");
const derivedRoot = match[1].trim();
assert.equal(existsSync(join(derivedRoot, "dynamic-source-manifest.json")), true, "derived source must carry an auditable manifest");
assert.equal(existsSync(join(derivedRoot, ".env")), false, "derived source must not copy .env");
assert.equal(existsSync(join(derivedRoot, ".env.local")), false, "derived source must not copy .env.local");
assert.equal(existsSync(join(derivedRoot, ".dev.vars")), false, "derived source must not copy .dev.vars");
assert.equal(existsSync(join(derivedRoot, ".npmrc")), false, "derived source must not copy .npmrc");
assert.equal(lstatSync(join(derivedRoot, "node_modules")).isSymbolicLink(), true, "derived source must link to the canonical read-only dependencies");
assert.equal(existsSync(join(derivedRoot, "node_modules", "next", "package.json")), true, "derived source must resolve the canonical Next dependency");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /cacheComponents:\s*false/u, "derived config must disable Cache Components");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /output:\s*"standalone"/u, "derived config must emit OpenNext's required standalone trace tree");
assert.match(readFileSync(join(derivedRoot, "next.config.ts"), "utf8"), /outputFileTracingRoot:\s*resolve\(process\.cwd\(\)\)/u, "derived config must root its standalone trace package at the generated app");
assert.equal(JSON.parse(readFileSync(join(derivedRoot, "package.json"), "utf8")).scripts?.build, "next build --webpack", "derived build must use Webpack because Turbopack rejects the read-only dependency link");

const originalHome = readFileSync(join(projectDirectory, "app/page.tsx"), "utf8");
const derivedHome = readFileSync(join(derivedRoot, "app/page.tsx"), "utf8");
assert.match(originalHome, /"use cache";/u, "canonical source must retain its Cache Components directive");
assert.doesNotMatch(derivedHome, /"use cache";|\bcacheLife\(|\bcacheTag\(/u, "derived public reader must remove Cache Components calls");
assert.doesNotMatch(derivedHome, /export const instant\s*=/u, "derived public route must not retain Cache Components-only instant config");

for (const staticAreaRoute of ["app/area/sakai/page.tsx", "app/area/shinosaka/page.tsx", "app/partner/onboarding/page.tsx"]) {
  assert.match(
    readFileSync(join(derivedRoot, staticAreaRoute), "utf8"),
    /export default/u,
    `${staticAreaRoute} must remain a generated route module`,
  );
  assert.doesNotMatch(readFileSync(join(derivedRoot, staticAreaRoute), "utf8"), /export const instant\s*=/u, `${staticAreaRoute} must remove Cache Components-only instant config`);
}

for (const relativePath of ["lib/analytics/snapshot-cache.ts", "lib/wp/shops.ts"]) {
  assert.doesNotMatch(readFileSync(join(derivedRoot, relativePath), "utf8"), /"use cache(?:: [^"]+)?";|\bcacheLife\(|\bcacheTag\(/u, `${relativePath} must not retain a Cache Components directive in conventional dynamic mode`);
}

for (const mutationRoute of [
  "app/api/revalidate/route.ts",
  "app/api/dashboard/managed-shops/route.ts",
  "app/api/dashboard/shops/[id]/official-facts/route.ts",
  "app/api/dashboard/reviews/moderation/route.ts",
]) {
  const source = readFileSync(join(derivedRoot, mutationRoute), "utf8");
  assert.match(source, /@\/lib\/cloudflare-dynamic-public-cache/u, `${mutationRoute} must use the Worker-only no-op invalidation adapter`);
}

console.log("Eskomi Cloudflare dynamic public-read source contract: PASS");
