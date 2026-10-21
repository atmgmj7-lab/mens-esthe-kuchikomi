import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
if (!existsSync(join(root, ".next", "BUILD_ID"))) throw new Error("Run npm run build before the access health collection HTTP test.");
const listen = async (server) => { server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); if (!address || typeof address === "string") throw new Error("expected TCP listener"); return address.port; };
const close = async (server) => { server.close(); await once(server, "close"); };
const calls = [];
const rpc = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  calls.push({ path: request.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
  const state = calls.at(-1).body.p_passed_check_count === 4 ? "complete" : "partial";
  response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(state));
});
const rpcPort = await listen(rpc);
const portServer = http.createServer(); const nextPort = await listen(portServer); await close(portServer);
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(nextPort)], { cwd: root, env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${rpcPort}`, SUPABASE_SECRET_KEY: "fixture-secret-not-production", ESKOMI_ACCESS_COLLECTION_SECRET: "fixture-collection-secret" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; app.stdout.on("data", (chunk) => { log += chunk; }); app.stderr.on("data", (chunk) => { log += chunk; });
const call = async (body, secret = "fixture-collection-secret") => { for (let attempt = 0; attempt < 80; attempt += 1) { try { return await fetch(`http://127.0.0.1:${nextPort}/api/internal/access-collection/`, { method: "POST", headers: { "Content-Type": "application/json", "x-eskomi-access-collection-secret": secret }, body: JSON.stringify(body) }); } catch { await new Promise((resolve) => setTimeout(resolve, 100)); } } throw new Error(`Next collection route did not start: ${log}`); };
const checks = { context_issuance: true, event_ingest: true, report_read: true, retention_prune: true };
try {
  assert.equal((await call({ observedOn: "2026-10-17", collector: "fixture_health", checks })).status, 200);
  assert.deepEqual(calls, [{ path: "/rest/v1/rpc/record_partner_shop_access_collection_manifest_v11", body: { p_observed_on: "2026-10-17", p_collector_label: "fixture_health", p_required_check_count: 4, p_passed_check_count: 4, p_manifest_hash: createHash("sha256").update(JSON.stringify({ observedOn: "2026-10-17", collector: "fixture_health", checks })).digest("hex") } }]);
  assert.deepEqual(await (await call({ observedOn: "2026-10-17", collector: "fixture_health", checks: { ...checks, report_read: false } })).json(), { state: "partial" });
  assert.equal(calls.at(-1).body.p_passed_check_count, 3);
  assert.equal((await call({ observedOn: "2026-10-17", collector: "fixture_health", checks }, "wrong-secret")).status, 401);
  assert.equal((await call({ observedOn: "2026-10-17", collector: "fixture_health", checks: { context_issuance: true } })).status, 400);
  assert.equal(calls.length, 2, "rejected requests must not reach the service RPC");
} finally { app.kill("SIGTERM"); await once(app, "exit"); await close(rpc); }

console.log("Eskomi v1.1 access health collection HTTP route: PASS");
