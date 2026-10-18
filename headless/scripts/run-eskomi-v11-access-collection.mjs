import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function jstDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validEndpoint(value) {
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    return (url.protocol === "https:" || localHttp) && url.pathname === "/api/internal/access-observation/" && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

export async function runPartialAccessCollection({ observedOn, environment = process.env, now = new Date(), fetchImpl = fetch }) {
  if (typeof observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(observedOn) || observedOn >= jstDate(now)) throw new Error("observedOn must be a past JST date");
  const endpoint = environment.ESKOMI_ACCESS_OBSERVATION_URL;
  const secret = environment.ESKOMI_ACCESS_OBSERVATION_SECRET;
  if (!validEndpoint(endpoint)) throw new Error("ESKOMI_ACCESS_OBSERVATION_URL must be an HTTPS internal observation endpoint");
  if (typeof secret !== "string" || !secret.trim()) throw new Error("ESKOMI_ACCESS_OBSERVATION_SECRET is required");
  // Never follow a redirect: this request bears the finalizer secret and the
  // configured endpoint is the sole origin authorized to receive it.
  const response = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-eskomi-access-observation-secret": secret }, body: JSON.stringify({ observedOn, state: "partial" }), cache: "no-store", redirect: "error" });
  if (response.status !== 204) throw new Error(`partial access collection failed with HTTP ${response.status}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const index = process.argv.indexOf("--observed-on");
  const observedOn = index >= 0 ? process.argv[index + 1] : undefined;
  if (process.argv.length !== 4 || index !== 2 || !observedOn) throw new Error("Usage: node scripts/run-eskomi-v11-access-collection.mjs --observed-on YYYY-MM-DD");
  await runPartialAccessCollection({ observedOn });
  console.log(`Eskomi v1.1 partial access collection recorded for ${observedOn}`);
}
