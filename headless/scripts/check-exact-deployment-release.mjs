#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createExactCurlEnvironment } from "./lib/exact-curl-environment.mjs";

import {
  buildExactAreaCurlOptions,
  CRITICAL_AREA_RELEASE_FIXTURES,
  exactDeploymentAreaPath,
  parseDirectHttpResponseHeaders,
  validateExactDeploymentUrl,
  validateExactDeploymentRelease,
} from "./lib/exact-deployment-release-contract.mjs";

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`unknown argument: ${argument}`);
    const name = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for --${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

function sanitize(value) {
  let result = String(value ?? "");
  for (const secret of [process.env.VERCEL_TOKEN]) {
    if (secret) result = result.split(secret).join("***");
  }
  return result;
}

function runVercel(arguments_, label) {
  // Centralize isolation so every authenticated curl path gets a fresh config.
  const isolated = arguments_[0] === "curl" ? createExactCurlEnvironment() : null;
  let result;
  try {
    result = spawnSync("vercel", arguments_, {
      encoding: "utf8",
      env: isolated?.env ?? process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
  } finally {
    isolated?.cleanup();
  }
  if (result.error) throw new Error(`${label} failed: ${sanitize(result.error.message)}`);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}: ${sanitize(result.stderr).trim()}`);
  }
  return result.stdout;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} did not return valid JSON`);
  }
}

function readFixtureJson(directory, name) {
  return parseJson(readFileSync(path.join(directory, name), "utf8"), `${name} fixture`);
}

function collectAreaResponse(exactDeploymentUrl, slug, temporaryDirectory) {
  const headerPath = path.join(temporaryDirectory, `${slug}.headers`);
  const bodyPath = path.join(temporaryDirectory, `${slug}.html`);
  const output = runVercel([
    "curl",
    exactDeploymentAreaPath(slug),
    "--deployment",
    exactDeploymentUrl,
    "--",
    ...buildExactAreaCurlOptions(headerPath, bodyPath),
  ], `${slug} authenticated request`);
  const statusMatch = output.trim().match(/(\d{3})$/u);
  if (!statusMatch) throw new Error(`${slug} authenticated request did not report an HTTP status`);
  const status = Number(statusMatch[1]);
  return {
    status,
    headers: parseDirectHttpResponseHeaders(readFileSync(headerPath, "utf8"), status, slug),
    html: readFileSync(bodyPath, "utf8"),
  };
}

function collectLiveEvidence({ exactDeploymentUrl, deploymentId, expectedSha }) {
  const validatedExactDeploymentUrl = validateExactDeploymentUrl(exactDeploymentUrl);
  for (const { slug } of CRITICAL_AREA_RELEASE_FIXTURES) exactDeploymentAreaPath(slug);
  if (!process.env.VERCEL_TOKEN) {
    throw new Error("VERCEL_TOKEN is required for protected exact deployment QA");
  }
  const inspect = parseJson(
    runVercel(["inspect", validatedExactDeploymentUrl, "--format=json"], "Vercel inspect"),
    "Vercel inspect",
  );
  const deployment = parseJson(
    runVercel(["api", `/v13/deployments/${deploymentId}`, "--raw"], "Vercel deployment API"),
    "Vercel deployment API",
  );
  if (!deployment.aliases && Array.isArray(deployment.alias)) {
    deployment.aliases = deployment.alias;
  }
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "eskomi-exact-release-"));
  try {
    const areas = Object.fromEntries(CRITICAL_AREA_RELEASE_FIXTURES.map(({ slug }) => [
      slug,
      collectAreaResponse(validatedExactDeploymentUrl, slug, temporaryDirectory),
    ]));
    return {
      exactDeploymentUrl: validatedExactDeploymentUrl,
      deploymentId,
      expectedSha,
      inspect,
      deployment,
      areas,
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function collectFixtureEvidence({ exactDeploymentUrl, deploymentId, expectedSha, fixtureDirectory }) {
  return {
    exactDeploymentUrl,
    deploymentId,
    expectedSha,
    inspect: readFixtureJson(fixtureDirectory, "inspect.json"),
    deployment: readFixtureJson(fixtureDirectory, "deployment.json"),
    areas: Object.fromEntries(CRITICAL_AREA_RELEASE_FIXTURES.map(({ slug }) => [
      slug,
      readFixtureJson(fixtureDirectory, `${slug}.json`),
    ])),
  };
}

try {
  const arguments_ = parseArguments(process.argv.slice(2));
  const exactDeploymentUrl = arguments_.url ?? "";
  const deploymentId = arguments_.id ?? "";
  const expectedSha = arguments_["expected-sha"] ?? "";
  if (!exactDeploymentUrl) throw new Error("exact deployment URL is required");
  if (!deploymentId) throw new Error("deployment ID is required");
  if (!expectedSha) throw new Error("expected Git SHA is required");
  const validatedExactDeploymentUrl = validateExactDeploymentUrl(exactDeploymentUrl);

  const evidence = arguments_["fixture-dir"]
    ? collectFixtureEvidence({
      exactDeploymentUrl: validatedExactDeploymentUrl,
      deploymentId,
      expectedSha,
      fixtureDirectory: path.resolve(arguments_["fixture-dir"]),
    })
    : collectLiveEvidence({ exactDeploymentUrl: validatedExactDeploymentUrl, deploymentId, expectedSha });
  console.log(JSON.stringify(validateExactDeploymentRelease(evidence), null, 2));
} catch (error) {
  console.error(`Exact deployment release QA failed: ${sanitize(error instanceof Error ? error.message : error)}`);
  process.exitCode = 1;
}
