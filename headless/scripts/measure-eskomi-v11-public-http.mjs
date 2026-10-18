import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const baseUrl = process.env.ESKOMI_PUBLIC_HTTP_BASE_URL ?? "http://127.0.0.1:57000";
const metricsUrl = process.env.ESKOMI_POSTGREST_METRICS_URL ?? "http://127.0.0.1:8000/_eskomi-fixture/postgrest-metrics";
const outputPath = process.env.ESKOMI_PUBLIC_HTTP_METRICS_OUTPUT ?? ".eskomi-public-http-metrics.json";
const routes = ["/", "/area/fixture-area/", "/shops/fixture-partner-store/", "/reviews/"];

async function resetMetrics() {
  const response = await fetch(metricsUrl, { method: "POST" });
  assert.equal(response.status, 200, "PostgREST metrics reset must be available only in the local fixture");
}

async function readMetrics() {
  const response = await fetch(metricsUrl, { cache: "no-store" });
  assert.equal(response.status, 200, "PostgREST metrics snapshot must be available only in the local fixture");
  const value = await response.json();
  assert.ok(Array.isArray(value.requests), "metrics response must contain aggregated request records");
  return value.requests;
}

async function requestPage(path) {
  const startedAt = performance.now();
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  const body = await response.text();
  const elapsedMs = Math.round((performance.now() - startedAt) * 1000) / 1000;
  assert.equal(response.status, 200, `${path} must be public HTTP 200: ${body.slice(0, 160)}`);
  return elapsedMs;
}

async function measure(path, mode) {
  await resetMetrics();
  const latencies = mode === "parallel-3"
    ? await Promise.all([requestPage(path), requestPage(path), requestPage(path)])
    : [await requestPage(path)];
  return {
    mode,
    pageRequests: latencies.length,
    pageLatencyMs: latencies,
    postgrest: await readMetrics(),
  };
}

const measurements = [];
for (const path of routes) {
  measurements.push({ path, ...(await measure(path, "first")) });
  measurements.push({ path, ...(await measure(path, "repeat")) });
  measurements.push({ path, ...(await measure(path, "parallel-3")) });
}

const report = {
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  scope: "PostgREST HTTP calls only; this is not a SQL query count. Paths omit query strings and no request headers, bodies, credentials, or response data are recorded.",
  measurements,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Public HTTP/PostgREST fixture metrics written: ${outputPath}`);
