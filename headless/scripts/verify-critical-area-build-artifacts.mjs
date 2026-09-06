#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const CRITICAL_AREA_SLUGS = ["shinosaka", "sakai"];
const SERVER_ONLY_ORIGIN_MARKERS = [
  "sv16727.xserver.jp",
  "WP_ORIGIN_TLS_SERVERNAME",
  "85.131.213.108"
];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateNextPrerenderManifest(manifest) {
  for (const slug of CRITICAL_AREA_SLUGS) {
    const route = manifest?.routes?.[`/area/${slug}`];
    invariant(route, `Next prerender manifest is missing /area/${slug}`);
    invariant(route.initialStatus !== 404, `/area/${slug} was generated as not-found`);
    invariant(route.srcRoute === `/area/${slug}`, `/area/${slug} must use its explicit route`);
    invariant(route.renderingMode === "PARTIALLY_STATIC", `/area/${slug} must remain PPR`);
    invariant(route.experimentalPPR === true, `/area/${slug} must retain PPR metadata`);
    invariant(route.initialRevalidateSeconds === 60, `/area/${slug} must retain minute freshness`);
    invariant(Number.isSafeInteger(route.htmlSize) && route.htmlSize > 0, `/area/${slug} HTML is empty`);
  }
}

export function validateVercelPrerenderConfig(slug, config) {
  invariant(config?.type === "Prerender", `/area/${slug} must be a Vercel prerender`);
  invariant(config.expiration === 60, `/area/${slug} must retain minute freshness`);
  invariant(config.hasPostponed === true, `/area/${slug} must retain its PPR postponed state`);
  invariant(config.isDynamicRoute === false, `/area/${slug} must be an explicit route`);
  invariant(Number.isSafeInteger(config.htmlSize) && config.htmlSize > 0, `/area/${slug} HTML is empty`);
  invariant(
    String(config.initialHeaders?.["x-next-cache-tags"] || "").includes(`area:${slug}`),
    `/area/${slug} is missing its WordPress Area cache tag`
  );
  invariant(config.chain?.outputPath === `area/${slug}`, `/area/${slug} output chain is incorrect`);
}

export function validateClientAssets(assets) {
  for (const asset of assets) {
    for (const marker of SERVER_ONLY_ORIGIN_MARKERS) {
      invariant(
        !asset.source.includes(marker),
        `${asset.path} contains server-only WordPress origin configuration`
      );
    }
  }
}

function collectJavaScriptAssets(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return { path, source: readFileSync(path, "utf8") };
    });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function verifyBuildArtifacts({ requireVercelOutput = false } = {}) {
  const nextManifestPath = join(root, ".next/prerender-manifest.json");
  invariant(existsSync(nextManifestPath), "Next prerender manifest is missing; run the build first");
  validateNextPrerenderManifest(readJson(nextManifestPath));
  validateClientAssets(collectJavaScriptAssets(join(root, ".next/static")));

  if (requireVercelOutput) {
    for (const slug of CRITICAL_AREA_SLUGS) {
      const configPath = join(
        root,
        `.vercel/output/functions/area/${slug}.prerender-config.json`
      );
      invariant(existsSync(configPath), `Vercel output is missing /area/${slug} prerender config`);
      validateVercelPrerenderConfig(slug, readJson(configPath));
    }
  }
}

async function main() {
  const requireVercelOutput = process.argv.includes("--vercel");
  verifyBuildArtifacts({ requireVercelOutput });
  console.log(
    `critical Area build artifacts: PASS (${requireVercelOutput ? "Next + Vercel" : "Next"})`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
