import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const checkNames = ["context_issuance", "event_ingest", "report_read", "retention_prune"];
function jstDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function validEndpoint(value) {
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    return (url.protocol === "https:" || localHttp) && url.pathname === "/api/internal/access-collection/" && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}
function validChecks(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === checkNames.length && checkNames.every((name) => typeof value[name] === "boolean");
}
export async function runAccessHealthCollection({ observedOn, collector, checks, environment = process.env, now = new Date(), fetchImpl = fetch }) {
  if (typeof observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || observedOn >= jstDate(now)) throw new Error("observedOn must be a past JST date");
  if (typeof collector !== "string" || !/^[a-z0-9][a-z0-9_-]{2,63}$/.test(collector) || !validChecks(checks)) throw new Error("collector and all required boolean checks are required");
  const endpoint = environment.ESKOMI_ACCESS_COLLECTION_URL;
  const secret = environment.ESKOMI_ACCESS_COLLECTION_SECRET;
  if (!validEndpoint(endpoint)) throw new Error("ESKOMI_ACCESS_COLLECTION_URL must be an HTTPS internal collection endpoint");
  if (typeof secret !== "string" || !secret.trim()) throw new Error("ESKOMI_ACCESS_COLLECTION_SECRET is required");
  const response = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-eskomi-access-collection-secret": secret }, body: JSON.stringify({ observedOn, collector, checks }), cache: "no-store", redirect: "error" });
  if (response.status !== 200 && response.status !== 202) throw new Error(`access health collection failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || (payload.state !== "complete" && payload.state !== "partial")) throw new Error("access health collection returned an invalid state");
  return payload.state;
}
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) throw new Error("Import runAccessHealthCollection from the independently scheduled collector; this transport does not invent probe results.");
