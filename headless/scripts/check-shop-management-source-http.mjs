import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const slug = "mrs-rank-up%ef%bc%88%e3%83%9f%e3%82%bb%e3%82%b9%e3%83%a9%e3%83%b3%e3%82%af%e3%82%a2%e3%83%83%e3%83%97%ef%bc%89";
let publicationStatus = "publish";

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

function json(response, value, status = 200, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(value));
}

function stop(child) {
  if (child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise((resolve) => child.once("exit", resolve));
}

const wpPort = await freePort();
const supabasePort = await freePort();
const certDir = mkdtempSync(join(tmpdir(), "eskomi-source-http-"));
const cert = join(certDir, "cert.pem");
const key = join(certDir, "key.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1", "-days", "1"], { stdio: "ignore" });

function shop() {
  return {
    id: 768, type: "shop", status: publicationStatus, slug,
    link: `https://mens-esthe-kuchikomi.com/shops/${slug}/`,
    title: { rendered: "Mrs.Rank UP（隔離fixture）" }, content: { rendered: "" }, excerpt: { rendered: "" }, area: [],
    acf: { official_url: "https://fixture.invalid/", basic_price: 12000, shop_hours: "10:00", shop_address: "fixture", shop_tel: "0", shop_line: "https://line.fixture.invalid/", shop_booking: "Web", shop_holiday: "不定休", price_90: "15000", shop_booking_url: "https://reserve.fixture.invalid/" },
    _embedded: { "wp:term": [[], [], []] },
  };
}

const wp = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
  const url = new URL(request.url ?? "/", `https://127.0.0.1:${wpPort}`);
  if (url.pathname === "/wp-json/wp/v2/shop/768") return json(response, shop());
  if (url.pathname === "/wp-json/wp/v2/shop") return json(response, [shop()], 200, { "X-WP-Total": "1", "X-WP-TotalPages": "1" });
  if (url.pathname === "/wp-json/wp/v2/area" || url.pathname === "/wp-json/wp/v2/posts") return json(response, [], 200, { "X-WP-Total": "0", "X-WP-TotalPages": "0" });
  return json(response, { message: "not found" }, 404);
});
await new Promise((resolve) => wp.listen(wpPort, "127.0.0.1", resolve));

const supabase = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${supabasePort}`);
  if (url.pathname === "/rest/v1/rpc/get_partner_shop_fact_snapshot") return json(response, []);
  return json(response, []);
});
await new Promise((resolve) => supabase.listen(supabasePort, "127.0.0.1", resolve));

async function expectStatus(name, status) {
  const appPort = await freePort();
  const baseUrl = `http://localhost:${appPort}`;
  const next = spawn("npm", ["run", "dev", "--", "--hostname", "localhost", "--port", String(appPort)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0", SHOP_MANAGEMENT_SOURCE: "supabase",
      WP_API_BASE_URL: `https://127.0.0.1:${wpPort}/wp-json`,
      SUPABASE_URL: `http://127.0.0.1:${supabasePort}`, SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key",
    },
  });
  let log = "";
  next.stdout.on("data", (chunk) => { log = `${log}${chunk}`.slice(-2_000); });
  next.stderr.on("data", (chunk) => { log = `${log}${chunk}`.slice(-2_000); });
  try {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      if (next.exitCode !== null) throw new Error(`${name}: Next exited\n${log}`);
      try { if ((await fetch(`${baseUrl}/`)).ok) break; } catch { /* wait */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const response = await fetch(`${baseUrl}/shops/${slug}/`);
    assert.equal(response.status, status, `${name}: expected HTTP ${status}, received ${response.status}\n${log}`);
    assert.notEqual(response.status, 200, `${name}: a source problem must not become a streaming 200 page`);
  } finally {
    await stop(next);
  }
}

try {
  publicationStatus = "publish";
  await expectStatus("snapshot missing", 500);
  publicationStatus = "draft";
  await expectStatus("WordPress non-public", 404);
  console.log("shop management source HTTP statuses: PASS");
} finally {
  await new Promise((resolve) => supabase.close(resolve));
  await new Promise((resolve) => wp.close(resolve));
}
