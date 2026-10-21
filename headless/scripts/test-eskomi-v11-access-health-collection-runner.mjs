import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import { runAccessHealthCollection } from "./run-eskomi-v11-access-health-collection.mjs";

const received = [];
const redirectedRequests = [];
let redirectStatus;
const redirectTarget = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  redirectedRequests.push({ secret: request.headers["x-eskomi-access-collection-secret"], body: Buffer.concat(chunks).toString("utf8") });
  response.writeHead(200, { "content-type": "application/json" }); response.end('{"state":"complete"}');
});
redirectTarget.listen(0, "127.0.0.1"); await once(redirectTarget, "listening");
const redirectAddress = redirectTarget.address(); if (!redirectAddress || typeof redirectAddress === "string") throw new Error("expected redirect TCP listener");
const server = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  received.push({ method: request.method, path: request.url, secret: request.headers["x-eskomi-access-collection-secret"], body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
  if (redirectStatus) { response.writeHead(redirectStatus, { Location: `http://127.0.0.1:${redirectAddress.port}/different-origin` }); response.end(); return; }
  const complete = Object.values(received.at(-1).body.checks).every(Boolean);
  response.writeHead(complete ? 200 : 202, { "content-type": "application/json" }); response.end(JSON.stringify({ state: complete ? "complete" : "partial" }));
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const address = server.address(); if (!address || typeof address === "string") throw new Error("expected local TCP listener");
const checks = { context_issuance: true, event_ingest: true, report_read: true, retention_prune: true };
try {
  const environment = { ESKOMI_ACCESS_COLLECTION_URL: `http://127.0.0.1:${address.port}/api/internal/access-collection/`, ESKOMI_ACCESS_COLLECTION_SECRET: "fixture-collection-secret" };
  assert.equal(await runAccessHealthCollection({ observedOn: "2026-10-17", collector: "fixture_health", checks, environment, now: new Date("2026-10-18T00:00:00+09:00") }), "complete");
  assert.deepEqual(received[0], { method: "POST", path: "/api/internal/access-collection/", secret: "fixture-collection-secret", body: { observedOn: "2026-10-17", collector: "fixture_health", checks } });
  assert.equal(await runAccessHealthCollection({ observedOn: "2026-10-17", collector: "fixture_health", checks: { ...checks, report_read: false }, environment, now: new Date("2026-10-18T00:00:00+09:00") }), "partial");
  await assert.rejects(() => runAccessHealthCollection({ observedOn: "2026-10-18", collector: "fixture_health", checks, environment, now: new Date("2026-10-18T00:00:00+09:00") }), /past JST date/);
  await assert.rejects(() => runAccessHealthCollection({ observedOn: "2026-10-17", collector: "fixture_health", checks: { context_issuance: true }, environment, now: new Date("2026-10-18T00:00:00+09:00") }), /required boolean checks/);
  for (const status of [307, 308]) {
    redirectStatus = status;
    await assert.rejects(() => runAccessHealthCollection({ observedOn: "2026-10-17", collector: "fixture_health", checks, environment, now: new Date("2026-10-18T00:00:00+09:00") }), /fetch failed/);
    redirectStatus = undefined;
  }
  assert.deepEqual(redirectedRequests, [], "the collection secret must never reach a redirect target");
} finally {
  server.close(); await once(server, "close");
  redirectTarget.close(); await once(redirectTarget, "close");
}
console.log("Eskomi v1.1 access health collection runner: PASS");
