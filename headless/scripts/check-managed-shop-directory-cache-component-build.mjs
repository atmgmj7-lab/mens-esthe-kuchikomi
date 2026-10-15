import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

async function reservePort() {
  const reservation = createNetServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForResponse(url) {
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("Next server did not become ready");
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || !request.url?.startsWith("/rest/v1/rpc/")) {
    response.writeHead(404).end();
    return;
  }
  if (request.url.endsWith("/get_partner_shop_fact_snapshot")) {
    response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify([{
      wp_shop_id: 768,
      shop_slug: "mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89",
      revision: 1,
      updated_at: "2026-10-15T00:00:00Z",
      facts: {
        official_url: null, basic_price: null, shop_hours: null, shop_address: null, shop_tel: null,
        shop_line: null, shop_booking: null, shop_holiday: null, price_90: null, shop_booking_url: null,
      },
    }]));
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" }).end("[]");
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");

try {
  const result = await new Promise((resolve, reject) => {
    const child = spawn("./node_modules/.bin/next", ["build"], {
      env: {
        ...process.env,
        SHOP_DIRECTORY_SOURCE: "supabase",
        SHOP_MANAGEMENT_SOURCE: "supabase",
        RANKUP_NATIVE_REVIEW_READ_SOURCE: "supabase",
        SUPABASE_URL: `http://127.0.0.1:${address.port}`,
        SUPABASE_SECRET_KEY: "fixture-service-secret",
      },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  assert.deepEqual(result, { code: 0, signal: null }, "successful managed-source RPC reads must remain inside cache boundaries during the production build");
  const port = await reservePort();
  const nextServer = spawn("./node_modules/.bin/next", ["start", "-p", String(port)], {
    env: {
      ...process.env,
      SHOP_DIRECTORY_SOURCE: "supabase",
      SHOP_MANAGEMENT_SOURCE: "supabase",
      RANKUP_NATIVE_REVIEW_READ_SOURCE: "supabase",
      SUPABASE_URL: `http://127.0.0.1:${address.port}`,
      SUPABASE_SECRET_KEY: "fixture-service-secret",
    },
    stdio: "ignore",
  });
  try {
    for (const [slug, expected] of [["shinosaka", 58], ["sakai", 25]]) {
      const response = await waitForResponse(`http://127.0.0.1:${port}/area/${slug}/`);
      const html = await response.text();
      assert.equal((html.match(/data-area-shop-card="true"/g) ?? []).length, expected, `${slug} must retain every WordPress taxonomy member when the managed directory source is enabled`);
    }
  } finally {
    nextServer.kill();
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

console.log("managed-shop directory Cache Components build: PASS");
