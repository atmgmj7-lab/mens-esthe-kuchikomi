#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

import {
  CRITICAL_AREA_RELEASE_FIXTURES,
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
  const result = spawnSync("vercel", arguments_, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
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

function parseFinalHeaders(source) {
  const blocks = source
    .split(/\r?\n\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^HTTP\//u.test(value));
  const finalBlock = blocks.at(-1) ?? "";
  const headers = {};
  for (const line of finalBlock.split(/\r?\n/u).slice(1)) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return headers;
}

function collectAreaResponse(exactDeploymentUrl, slug, temporaryDirectory) {
  const headerPath = path.join(temporaryDirectory, `${slug}.headers`);
  const bodyPath = path.join(temporaryDirectory, `${slug}.html`);
  const output = runVercel([
    "curl",
    `/area/${slug}/`,
    "--deployment",
    exactDeploymentUrl,
    "--",
    "--silent",
    "--show-error",
    "--location",
    "--max-redirs",
    "5",
    "--connect-timeout",
    "15",
    "--max-time",
    "60",
    "--dump-header",
    headerPath,
    "--output",
    bodyPath,
    "--write-out",
    "%{http_code}",
  ], `${slug} authenticated request`);
  const statusMatch = output.trim().match(/(\d{3})$/u);
  if (!statusMatch) throw new Error(`${slug} authenticated request did not report an HTTP status`);
  return {
    status: Number(statusMatch[1]),
    headers: parseFinalHeaders(readFileSync(headerPath, "utf8")),
    html: readFileSync(bodyPath, "utf8"),
  };
}

function collectLiveEvidence({ exactDeploymentUrl, deploymentId, expectedSha }) {
  if (!process.env.VERCEL_TOKEN) {
    throw new Error("VERCEL_TOKEN is required for protected exact deployment QA");
  }
  const inspect = parseJson(
    runVercel(["inspect", exactDeploymentUrl, "--format=json"], "Vercel inspect"),
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
      collectAreaResponse(exactDeploymentUrl, slug, temporaryDirectory),
    ]));
    return { exactDeploymentUrl, deploymentId, expectedSha, inspect, deployment, areas };
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

  const evidence = arguments_["fixture-dir"]
    ? collectFixtureEvidence({
      exactDeploymentUrl,
      deploymentId,
      expectedSha,
      fixtureDirectory: path.resolve(arguments_["fixture-dir"]),
    })
    : collectLiveEvidence({ exactDeploymentUrl, deploymentId, expectedSha });
  console.log(JSON.stringify(validateExactDeploymentRelease(evidence), null, 2));
} catch (error) {
  console.error(`Exact deployment release QA failed: ${sanitize(error instanceof Error ? error.message : error)}`);
  process.exitCode = 1;
}
