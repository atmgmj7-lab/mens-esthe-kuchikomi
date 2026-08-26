import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const headlessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const nextBin = join(headlessRoot, "node_modules/next/dist/bin/next");
const preload = join(headlessRoot, "tests/analytics/fixtures/snapshot-cache-production-preload.cjs");
const zero = { total: 0, oauth: 0, ga4: 0, gsc: 0, web: 0, wordpress: 0 };
const syntheticEmail = ["synthetic-service", "example.invalid"].join("@");

async function freePort() {
  const server = createServer();
  await new Promise((resolveReady, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return port;
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.next`;
  await writeFile(temporary, JSON.stringify(value), "utf8");
  await rename(temporary, path);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function waitFor(predicate, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await predicate();
      if (last) return last;
    } catch { /* retry while the production server starts or refreshes */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out waiting for production cache evidence${last ? `: ${JSON.stringify(last)}` : ""}`);
}

function sourceStates(snapshot) {
  return Object.fromEntries(Object.entries(snapshot.sources).map(([name, value]) => [name, value.state]));
}

function sanitizedLog(value) {
  return value
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/gu, "[REDACTED_PRIVATE_KEY]")
    .replaceAll("synthetic-access-token", "[REDACTED_TOKEN]")
    .replaceAll(syntheticEmail, "[REDACTED_EMAIL]")
    .replace(/authorization\s*[:=]\s*[^\s,}]+/giu, "authorization=[REDACTED]");
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "eskomi-analytics-cache-e2e-"));
const controlPath = join(temporaryRoot, "control.json");
const counterPath = join(temporaryRoot, "counters.json");
const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKey = keyPair.privateKey.export({ type: "pkcs8", format: "pem" });
const syntheticCredential = JSON.stringify({
  type: "service_account",
  project_id: "synthetic-project",
  private_key_id: "synthetic-key-id",
  private_key: privateKey,
  client_email: syntheticEmail,
  client_id: "1234567890",
  token_uri: "https://oauth2.googleapis.com/token",
});
const user = "synthetic-dashboard-user";
const password = "synthetic-dashboard-password";
const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
let output = "";
let child;

try {
  await readFile(join(headlessRoot, ".next/BUILD_ID"), "utf8");
  await writeJsonAtomic(controlPath, { forceStale: false, failGa4: false, clockOffsetMs: 0 });
  await writeJsonAtomic(counterPath, zero);
  child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: headlessRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NODE_OPTIONS: `--require=${preload}`,
      ANALYTICS_CACHE_E2E_CONTROL_FILE: controlPath,
      ANALYTICS_CACHE_E2E_COUNTER_FILE: counterPath,
      DASHBOARD_BASIC_AUTH_USER: user,
      DASHBOARD_BASIC_AUTH_PASSWORD: password,
      GOOGLE_SERVICE_ACCOUNT_JSON: syntheticCredential,
      GOOGLE_APPLICATION_CREDENTIALS: "",
      GA4_PROPERTY_ID: "123",
      WP_API_BASE_URL: "https://wp.test/wp-json",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => { output = `${output}${chunk}`.slice(-100_000); });
  }
  await waitFor(async () => {
    const response = await fetch(`${origin}/api/dashboard/analytics/current?period=7`);
    return response.status === 401;
  });
  assert.deepEqual(await readJson(counterPath), zero, "unauthorized request reached the collector");

  const invalid = await fetch(`${origin}/api/dashboard/analytics/current?period=14`, { headers: { authorization } });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await readJson(counterPath), zero, "invalid query reached the collector");

  const startedCold = performance.now();
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => fetch(
    `${origin}/api/dashboard/analytics/current?period=7`, { headers: { authorization } }
  )));
  const cold7Ms = Number((performance.now() - startedCold).toFixed(3));
  const sevenBodies = await Promise.all(concurrent.map(async (response) => {
    if (response.status !== 200) {
      const body = await response.text();
      const observedCounters = await readJson(counterPath);
      throw new Error(`Production cache request failed: status=${response.status}; body=${body}; counters=${JSON.stringify(observedCounters)}; log=${sanitizedLog(output).slice(-4_000)}`);
    }
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    return response.json();
  }));
  for (const value of sevenBodies) assert.deepEqual(value, sevenBodies[0]);
  assert.deepEqual(sourceStates(sevenBodies[0]), { ga4: "ok", gsc: "ok", web: "ok", content: "no_data" });
  assert.equal(sevenBodies[0].period.days, 7);
  const cold7Counters = await readJson(counterPath);
  assert.deepEqual(cold7Counters, { total: 32, oauth: 2, ga4: 10, gsc: 13, web: 6, wordpress: 1 });

  const startedWarm = performance.now();
  const warm7Response = await fetch(`${origin}/api/dashboard/analytics/current?period=7`, { headers: { authorization } });
  const warm7Ms = Number((performance.now() - startedWarm).toFixed(3));
  assert.equal(warm7Response.status, 200);
  assert.deepEqual(await warm7Response.json(), sevenBodies[0]);
  assert.deepEqual(await readJson(counterPath), cold7Counters);

  const cold28Response = await fetch(`${origin}/api/dashboard/analytics/current?period=28`, { headers: { authorization } });
  assert.equal(cold28Response.status, 200);
  const cold28 = await cold28Response.json();
  assert.equal(cold28.period.days, 28);
  const cold28Counters = await readJson(counterPath);
  assert.deepEqual(cold28Counters, { total: 64, oauth: 4, ga4: 20, gsc: 26, web: 12, wordpress: 2 });
  const warm28Response = await fetch(`${origin}/api/dashboard/analytics/current?period=28`, { headers: { authorization } });
  assert.equal(warm28Response.status, 200);
  assert.deepEqual(await warm28Response.json(), cold28);
  assert.deepEqual(await readJson(counterPath), cold28Counters);

  const views = ["overview", "seo", "pages", "site-health", "content-health"];
  for (const view of views) {
    const response = await fetch(`${origin}/dashboard/analytics/?period=7&view=${view}`, { headers: { authorization } });
    assert.equal(response.status, 200);
    await response.text();
  }
  assert.deepEqual(await readJson(counterPath), cold28Counters, "five warm views recollected sources");

  await writeJsonAtomic(controlPath, { forceStale: true, failGa4: true, clockOffsetMs: 901_000 });
  const staleResponse = await fetch(`${origin}/api/dashboard/analytics/current?period=7`, { headers: { authorization } });
  assert.equal(staleResponse.status, 200);
  const stale = await staleResponse.json();
  assert.equal(stale.generatedAt, sevenBodies[0].generatedAt);
  assert.ok(stale.warnings.some((warning) => warning.code === "analytics_snapshot_cache_stale"));
  const failedRefreshCounters = await waitFor(async () => {
    const value = await readJson(counterPath);
    return value.total >= cold28Counters.total + 32 ? value : null;
  });
  const expectedFailedRefreshCounters = { total: 96, oauth: 6, ga4: 30, gsc: 39, web: 18, wordpress: 3 };
  if (JSON.stringify(failedRefreshCounters) !== JSON.stringify(expectedFailedRefreshCounters)) {
    throw new Error(`Unexpected failed refresh counters: actual=${JSON.stringify(failedRefreshCounters)}; log=${sanitizedLog(output).slice(-8_000)}`);
  }
  assert.match(output, /analytics-non-cacheable:7:[a-f0-9-]{36}/u);

  await writeJsonAtomic(controlPath, { forceStale: false, failGa4: false, clockOffsetMs: 0 });
  const preservedResponse = await fetch(`${origin}/api/dashboard/analytics/current?period=7`, { headers: { authorization } });
  assert.equal(preservedResponse.status, 200);
  assert.deepEqual(await preservedResponse.json(), sevenBodies[0], "failed refresh replaced the good cache entry");
  assert.deepEqual(await readJson(counterPath), failedRefreshCounters);

  assert.equal(output.includes(String(privateKey).slice(0, 32)), false);
  assert.equal(output.includes("synthetic-access-token"), false);
  assert.equal(output.includes(syntheticEmail), false);
  console.log("production_snapshot_cache_e2e", JSON.stringify({
    unauthorizedCollectorCalls: 0,
    concurrentSevenDayRequests: 10,
    concurrentSevenDayCollectors: 1,
    cold7Ms,
    warm7Ms,
    warmSevenDaySourceDelta: 0,
    coldTwentyEightDayCollectors: 1,
    warmTwentyEightDaySourceDelta: 0,
    fiveViewSourceDelta: 0,
    failedRefreshPreservedGood: true,
    responseCacheControl: "private, no-store",
    secretExposure: 0,
  }));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
    child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 5_000))]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
