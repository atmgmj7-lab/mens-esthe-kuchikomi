import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
if (!existsSync(join(root, ".next", "BUILD_ID"))) throw new Error("Run npm run build before the widget HTTP test.");

const handles = {
  low: "11111111-1111-4111-8111-111111111111",
  empty: "22222222-2222-4222-8222-222222222222",
  error: "33333333-3333-4333-8333-333333333333",
};
const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected TCP listener");
  return address.port;
};
const close = async (server) => { server.close(); await once(server, "close"); };
const fixtureRow = (input) => ({ shop_name: "Widget fixture shop", canonical_path: "/shops/widget-fixture/", public_version: 1, data_as_of: "2026-10-18T00:00:00.000Z", ...input });
const api = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (request.url !== "/rpc/get_public_review_widget_v11") { response.writeHead(404); response.end(); return; }
  if (body.p_handle === handles.error) { response.writeHead(503); response.end(); return; }
  const rows = body.p_handle === handles.low
    ? [fixtureRow({ review_count: 2, average_rating: 4.9, review_body: "少数評価のfixture口コミ", review_rating: 5, published_at: "2026-10-17T00:00:00.000Z", reply_body: null, reply_published_at: null })]
    : [fixtureRow({ review_count: 0, average_rating: null })];
  response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify(rows));
});
const apiPort = await listen(api);
const portServer = http.createServer(); const nextPort = await listen(portServer); await close(portServer);
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(nextPort)], {
  cwd: root,
  env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${apiPort}`, SUPABASE_SECRET_KEY: "fixture-secret-not-production", ESKOMI_E2E_RAW_POSTGREST: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = ""; app.stdout.on("data", (chunk) => { log += chunk; }); app.stderr.on("data", (chunk) => { log += chunk; });
const page = async (handle) => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(`http://127.0.0.1:${nextPort}/partner/widget/${handle}/`); return { response, body: await response.text() }; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error(`Next widget server did not start: ${log}`);
};
try {
  const low = await page(handles.low);
  assert.equal(low.response.status, 200, low.body);
  assert.match(low.body, /有効な評価 2件/, "two ratings must render count-only, not an average");
  assert.doesNotMatch(low.body, /評価 4\.9 \/ 5/, "two ratings must not render an average");
  const empty = await page(handles.empty);
  assert.equal(empty.response.status, 200, empty.body);
  assert.match(empty.body, /公開済みの口コミはまだありません。/);
  const unavailable = await page(handles.error);
  assert.equal(unavailable.response.status, 200, "the partial-prerender shell is delivered before its unavailable segment resolves");
  assert.match(unavailable.body, /NEXT_HTTP_ERROR_FALLBACK;404/, "an unavailable widget backend must resolve to Next's 404 fallback rather than a widget response");
  assert.doesNotMatch(unavailable.body, /Widget fixture shopのEskomi口コミ/);
} finally {
  app.kill("SIGTERM");
  await once(app, "exit");
  await close(api);
}

console.log("Eskomi v1.1 widget SSR empty, low-rating, and unavailable HTTP: PASS");
