import http from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function requestBody(request) {
  if (["GET", "HEAD"].includes(request.method ?? "GET")) return Promise.resolve(undefined);
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolveBody(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function validRoutes(routes) {
  if (!routes || typeof routes !== "object" || Array.isArray(routes)) throw new Error("internal proxy routes must be an object");
  const entries = Object.entries(routes).filter(([prefix, base]) => {
    if (typeof prefix !== "string" || !prefix.startsWith("/") || typeof base !== "string") return false;
    try { return new URL(base).protocol === "http:"; } catch { return false; }
  });
  if (entries.length !== Object.keys(routes).length) throw new Error("internal proxy routes must use absolute HTTP origins");
  return entries.sort(([left], [right]) => right.length - left.length);
}

export function createInternalPrefixProxy(routes) {
  const routeEntries = validRoutes(routes);
  const metricsPath = process.env.ESKOMI_INTERNAL_PROXY_METRICS === "1"
    ? "/_eskomi-fixture/postgrest-metrics"
    : null;
  const metrics = new Map();
  const snapshotMetrics = () => ({
    requests: [...metrics.entries()]
      .map(([key, value]) => ({
        method: value.method,
        path: value.path,
        count: value.count,
        totalMs: value.totalMs,
        minMs: value.minMs,
        maxMs: value.maxMs,
      }))
      .sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`)),
  });
  const recordMetric = (request, startedAt) => {
    if (!request.url?.startsWith("/rest/v1")) return;
    const method = request.method ?? "GET";
    const path = new URL(request.url, "http://fixture.invalid").pathname;
    const elapsedMs = Math.max(0, Math.round((performance.now() - startedAt) * 1000) / 1000);
    const key = `${method} ${path}`;
    const current = metrics.get(key) ?? { method, path, count: 0, totalMs: 0, minMs: elapsedMs, maxMs: elapsedMs };
    current.count += 1;
    current.totalMs = Math.round((current.totalMs + elapsedMs) * 1000) / 1000;
    current.minMs = Math.min(current.minMs, elapsedMs);
    current.maxMs = Math.max(current.maxMs, elapsedMs);
    metrics.set(key, current);
  };
  return http.createServer(async (request, response) => {
    const requestUrl = request.url ?? "/";
    if (metricsPath && requestUrl === metricsPath) {
      if (request.method === "POST") metrics.clear();
      else if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(JSON.stringify(snapshotMetrics()));
      return;
    }
    const hit = routeEntries.find(([prefix]) => requestUrl.startsWith(prefix));
    if (!hit) { response.writeHead(404); response.end(); return; }
    const [prefix, base] = hit;
    const startedAt = performance.now();
    try {
      const headers = { ...request.headers };
      delete headers.host;
      const upstream = await fetch(`${base}${requestUrl.slice(prefix.length)}`, {
        method: request.method,
        headers,
        body: await requestBody(request),
        redirect: "manual",
      });
      response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
      response.end(Buffer.from(await upstream.arrayBuffer()));
      recordMetric(request, startedAt);
    } catch {
      recordMetric(request, startedAt);
      response.writeHead(502); response.end();
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const routes = JSON.parse(process.env.ESKOMI_INTERNAL_PROXY_ROUTES ?? "{}");
  const port = Number(process.env.ESKOMI_INTERNAL_PROXY_PORT ?? "8000");
  const host = process.env.ESKOMI_INTERNAL_PROXY_HOST ?? "0.0.0.0";
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("invalid internal proxy port");
  createInternalPrefixProxy(routes).listen(port, host);
}
