import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";

import { createInternalPrefixProxy } from "./eskomi-v11-internal-prefix-proxy.mjs";

const listen = async (server) => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected local TCP listener");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server) => {
  server.close();
  await once(server, "close");
};

let upstreamRequestUrl = null;
const upstream = http.createServer((request, response) => {
  upstreamRequestUrl = request.url;
  response.writeHead(302, { location: "http://localhost:57000/partner/auth/callback/#access_token=fixture-token" });
  response.end();
});
const upstreamBase = await listen(upstream);
const proxy = createInternalPrefixProxy({ "/verify": `${upstreamBase}/verify` });
const proxyBase = await listen(proxy);

try {
  const response = await fetch(`${proxyBase}/verify?token=fixture-token&type=magiclink`, { redirect: "manual" });
  assert.equal(response.status, 302, "the verification proxy must preserve GoTrue's redirect response");
  assert.equal(upstreamRequestUrl, "/verify?token=fixture-token&type=magiclink", "the verification proxy must preserve the /verify path and query");
  assert.equal(response.headers.get("location"), "http://localhost:57000/partner/auth/callback/#access_token=fixture-token");
} finally {
  await close(proxy);
  await close(upstream);
}

console.log("Eskomi v1.1 internal prefix proxy verification forwarding: PASS");

let restRequestUrl = null;
const restUpstream = http.createServer((request, response) => {
  restRequestUrl = request.url;
  response.writeHead(200, { "content-type": "application/json" });
  response.end("[]");
});
const restBase = await listen(restUpstream);
process.env.ESKOMI_INTERNAL_PROXY_METRICS = "1";
const measuredProxy = createInternalPrefixProxy({ "/rest/v1": restBase });
const measuredProxyBase = await listen(measuredProxy);
try {
  assert.equal((await fetch(`${measuredProxyBase}/_eskomi-fixture/postgrest-metrics`, { method: "POST" })).status, 200);
  assert.equal((await fetch(`${measuredProxyBase}/rest/v1/published_shops?select=id`, { headers: { authorization: "Bearer never-record-me" } })).status, 200);
  assert.equal(restRequestUrl, "/published_shops?select=id", "the application proxy must keep PostgREST query forwarding unchanged");
  const metrics = await (await fetch(`${measuredProxyBase}/_eskomi-fixture/postgrest-metrics`)).json();
  assert.deepEqual(metrics, { requests: [{ method: "GET", path: "/rest/v1/published_shops", count: 1, totalMs: metrics.requests[0].totalMs, minMs: metrics.requests[0].minMs, maxMs: metrics.requests[0].maxMs }] }, "metrics must retain only method, path, count, and timing aggregates");
  assert.equal(Object.keys(metrics.requests[0]).sort().join(","), "count,maxMs,method,minMs,path,totalMs", "metrics must never expose auth, query, body, response, or personal data");
} finally {
  await close(measuredProxy);
  await close(restUpstream);
  delete process.env.ESKOMI_INTERNAL_PROXY_METRICS;
}

console.log("Eskomi v1.1 internal prefix proxy PostgREST privacy-safe metrics: PASS");
