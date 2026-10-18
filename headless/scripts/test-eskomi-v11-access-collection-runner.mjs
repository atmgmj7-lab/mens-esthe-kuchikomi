import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import { runPartialAccessCollection } from "./run-eskomi-v11-access-collection.mjs";

const received = [];
const redirectedRequests = [];
let redirectStatus;
const redirectTarget = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  redirectedRequests.push({ method: request.method, path: request.url, secret: request.headers["x-eskomi-access-observation-secret"], body: Buffer.concat(chunks).toString("utf8") });
  response.writeHead(204); response.end();
});
redirectTarget.listen(0, "127.0.0.1"); await once(redirectTarget, "listening");
const redirectAddress = redirectTarget.address(); if (!redirectAddress || typeof redirectAddress === "string") throw new Error("expected redirect TCP listener");

const server = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  received.push({ method: request.method, path: request.url, secret: request.headers["x-eskomi-access-observation-secret"], body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
  if (redirectStatus) {
    response.writeHead(redirectStatus, { Location: `http://127.0.0.1:${redirectAddress.port}/different-origin` }); response.end();
    return;
  }
  response.writeHead(204); response.end();
});
server.listen(0, "127.0.0.1"); await once(server, "listening");
const address = server.address(); if (!address || typeof address === "string") throw new Error("expected local TCP listener");

try {
  const environment = { ESKOMI_ACCESS_OBSERVATION_URL: `http://127.0.0.1:${address.port}/api/internal/access-observation/`, ESKOMI_ACCESS_OBSERVATION_SECRET: "fixture-observation-secret" };
  await runPartialAccessCollection({ observedOn: "2026-10-17", environment, now: new Date("2026-10-18T00:00:00+09:00") });
  assert.deepEqual(received, [{ method: "POST", path: "/api/internal/access-observation/", secret: "fixture-observation-secret", body: { observedOn: "2026-10-17", state: "partial" } }]);
  await assert.rejects(() => runPartialAccessCollection({ observedOn: "2026-10-18", environment, now: new Date("2026-10-18T00:00:00+09:00") }), /past JST date/);
  await assert.rejects(() => runPartialAccessCollection({ observedOn: "2026-10-17", environment: {}, now: new Date("2026-10-18T00:00:00+09:00") }), /ESKOMI_ACCESS_OBSERVATION_URL/);
  for (const status of [307, 308]) {
    redirectStatus = status;
    await assert.rejects(() => runPartialAccessCollection({ observedOn: "2026-10-17", environment, now: new Date("2026-10-18T00:00:00+09:00") }), /fetch failed/);
    redirectStatus = undefined;
  }
  assert.deepEqual(redirectedRequests, [], "the finalizer secret must never reach a redirect target on another origin");
  assert.equal(received.some((request) => request.body.state === "complete"), false, "the partial finalizer helper must never certify a day as complete");
} finally {
  server.close(); await once(server, "close");
  redirectTarget.close(); await once(redirectTarget, "close");
}

console.log("Eskomi v1.1 partial access collection runner: PASS");
