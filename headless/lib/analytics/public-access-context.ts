import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PUBLIC_ACCESS_CONTEXT_COOKIE = "eskomi_public_access_context_v1";
const contextSecret = () => process.env.ESKOMI_ACCESS_CONTEXT_SECRET?.trim() || null;

export type PublicAccessEventKind = "shop_view" | "official_line_click";
type ContextPayload = { v: 1; shopSlug: string; eventKind: PublicAccessEventKind; sessionHash: string; observedOn: string; exp: number };

export function isPublicAccessEventKind(value: unknown): value is PublicAccessEventKind {
  return value === "shop_view" || value === "official_line_click";
}

export function isPublicAccessShopSlug(value: unknown): value is string {
  return typeof value === "string" && /^[^/\s\\\u0000-\u001f]+$/u.test(value);
}

export function publicAccessContextSession(value: string | undefined) {
  return value && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : randomBytes(32).toString("hex");
}

function tokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function expirationFor(date: string) {
  return Math.floor(new Date(`${date}T14:00:00.000Z`).getTime() / 1000); // 23:00 JST, never crosses the recorded day.
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issuePublicAccessContext(input: { shopSlug: string; eventKind: PublicAccessEventKind; session: string; now?: Date }) {
  const secret = contextSecret();
  if (!secret) return null;
  const observedOn = tokyoDate(input.now);
  const payload: ContextPayload = {
    v: 1, shopSlug: input.shopSlug, eventKind: input.eventKind,
    sessionHash: createHash("sha256").update(input.session).digest("hex"), observedOn, exp: expirationFor(observedOn),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyPublicAccessContext(input: { context: unknown; shopSlug: string; eventKind: PublicAccessEventKind; session: string; now?: Date }) {
  const secret = contextSecret();
  if (!secret || typeof input.context !== "string") return null;
  const [encoded, suppliedSignature, ...rest] = input.context.split(".");
  if (!encoded || !suppliedSignature || rest.length) return null;
  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  let payload: ContextPayload;
  try { payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ContextPayload; } catch { return null; }
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (payload.v !== 1 || payload.shopSlug !== input.shopSlug || payload.eventKind !== input.eventKind || payload.observedOn !== tokyoDate(input.now)
    || payload.exp < nowSeconds || payload.sessionHash !== createHash("sha256").update(input.session).digest("hex")) return null;
  return {
    accessContextHash: createHash("sha256").update(input.context).digest("hex"),
    sessionScopeHash: createHash("sha256").update(`${payload.sessionHash}\u001f${payload.shopSlug}\u001f${payload.observedOn}`).digest("hex"),
  };
}
