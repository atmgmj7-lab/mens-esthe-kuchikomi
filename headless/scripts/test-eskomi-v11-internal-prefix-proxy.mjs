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
