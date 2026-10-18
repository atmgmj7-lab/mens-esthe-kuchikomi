import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import { runPartialAccessCollection } from "./run-eskomi-v11-access-collection.mjs";

const received = [];
const server = http.createServer(async (request, response) => {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  received.push({ method: request.method, path: request.url, secret: request.headers["x-eskomi-access-observation-secret"], body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
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
  assert.equal(received.some((request) => request.body.state === "complete"), false, "the minimal collector must never certify a day as complete");
} finally {
  server.close(); await once(server, "close");
}

console.log("Eskomi v1.1 partial access collection runner: PASS");
