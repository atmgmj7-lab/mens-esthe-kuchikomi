import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
if (!existsSync(join(root, ".next", "BUILD_ID"))) throw new Error("Run npm run build before the access collection HTTP test.");
const listen = async (server) => { server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); if (!address || typeof address === "string") throw new Error("expected TCP listener"); return address.port; };
const close = async (server) => { server.close(); await once(server, "close"); };
const calls = [];
const rpc = http.createServer(async (request, response) => { const chunks = []; for await (const chunk of request) chunks.push(chunk); calls.push({ path: request.url, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); response.writeHead(200, { "content-type": "application/json" }); response.end("0"); });
const rpcPort = await listen(rpc);
const portServer = http.createServer(); const nextPort = await listen(portServer); await close(portServer);
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(nextPort)], { cwd: root, env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${rpcPort}`, SUPABASE_SECRET_KEY: "fixture-secret-not-production", ESKOMI_ACCESS_CONTEXT_SECRET: "fixture-context-secret", ESKOMI_ACCESS_OBSERVATION_SECRET: "fixture-observation-secret" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; app.stdout.on("data", (chunk) => { log += chunk; }); app.stderr.on("data", (chunk) => { log += chunk; });
const call = async (body) => { for (let attempt = 0; attempt < 80; attempt += 1) { try { return await fetch(`http://127.0.0.1:${nextPort}/api/internal/access-observation/`, { method: "POST", headers: { "Content-Type": "application/json", "x-eskomi-access-observation-secret": "fixture-observation-secret" }, body: JSON.stringify(body) }); } catch { await new Promise((resolve) => setTimeout(resolve, 100)); } } throw new Error(`Next collector route did not start: ${log}`); };
try {
  assert.equal((await call({ observedOn: "2026-10-17", state: "partial" })).status, 204);
  assert.deepEqual(calls, [{ path: "/rest/v1/rpc/finalize_partner_shop_access_collection_day_v11", body: { p_observed_on: "2026-10-17", p_collection_state: "partial" } }]);
  assert.equal((await call({ observedOn: "2026-10-17", state: "complete" })).status, 400, "a caller-supplied complete state must be rejected");
  assert.equal(calls.length, 1, "rejected complete requests must not reach the finalizer");
} finally { app.kill("SIGTERM"); await once(app, "exit"); await close(rpc); }

console.log("Eskomi v1.1 partial access collection HTTP route: PASS");
