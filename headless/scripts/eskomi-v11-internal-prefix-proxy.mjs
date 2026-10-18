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
  return http.createServer(async (request, response) => {
    const requestUrl = request.url ?? "/";
    const hit = routeEntries.find(([prefix]) => requestUrl.startsWith(prefix));
    if (!hit) { response.writeHead(404); response.end(); return; }
    const [prefix, base] = hit;
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
    } catch {
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
