import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const PUBLIC_ACCESS_CONTEXT_COOKIE = "eskomi_public_access_context_v1";
const contextSecret = () => process.env.ESKOMI_ACCESS_CONTEXT_SECRET?.trim() || null;
const SESSION_LIFETIME_SECONDS = 48 * 60 * 60;
const CONTEXT_LIFETIME_SECONDS = 30 * 60;

export type PublicAccessEventKind = "shop_view" | "official_line_click";
type ContextPayload = { v: 1; shopSlug: string; eventKind: PublicAccessEventKind; sessionHash: string; observedOn: string; exp: number };
type SessionPayload = { v: 1; id: string; exp: number };
export type PublicAccessContextSession = Readonly<{ cookieValue: string; sessionHash: string; isNew: boolean }>;

export function isPublicAccessEventKind(value: unknown): value is PublicAccessEventKind {
  return value === "shop_view" || value === "official_line_click";
}

export function isPublicAccessShopSlug(value: unknown): value is string {
  return typeof value === "string" && /^[^/\s\\\u0000-\u001f]+$/u.test(value);
}

function tokyoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signedPayload<T>(payload: T, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

function verifiedPayload<T>(value: string | undefined, secret: string): T | null {
  if (!value) return null;
  const [encoded, suppliedSignature, ...rest] = value.split(".");
  if (!encoded || !suppliedSignature || rest.length) return null;
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(signature(encoded, secret));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T; } catch { return null; }
}

function nextTokyoMidnight(now: Date) {
  const today = tokyoDate(now);
  const [year, month, day] = today.split("-").map(Number);
  // 15:00 UTC on the current Tokyo calendar day is the following JST midnight.
  return Date.UTC(year, month - 1, day, 15, 0, 0, 0);
}

export function publicAccessContextExpiresAt(now = new Date()) {
  const shortExpiry = now.getTime() + CONTEXT_LIFETIME_SECONDS * 1000;
  // A context never spills into another JST reporting day.  In particular,
  // 23:00 is an ordinary time; the only calendar boundary is midnight.
  return Math.floor(Math.min(shortExpiry, nextTokyoMidnight(now)) / 1000);
}

export function resolvePublicAccessContextSession(value: string | undefined, now = new Date()): PublicAccessContextSession | null {
  const secret = contextSecret();
  if (!secret) return null;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const existing = verifiedPayload<SessionPayload>(value, secret);
  if (existing?.v === 1 && /^[0-9a-f]{64}$/i.test(existing.id) && existing.exp > nowSeconds) {
    return { cookieValue: value!, sessionHash: createHash("sha256").update(existing.id).digest("hex"), isNew: false };
  }
  const payload: SessionPayload = { v: 1, id: randomBytes(32).toString("hex"), exp: nowSeconds + SESSION_LIFETIME_SECONDS };
  return { cookieValue: signedPayload(payload, secret), sessionHash: createHash("sha256").update(payload.id).digest("hex"), isNew: true };
}

export function publicAccessNetworkScopeHash(forwardedFor: string | null) {
  // Only Vercel sets and sanitizes x-forwarded-for for this application.  A
  // direct request must not be allowed to choose its own abuse scope.
  if (process.env.VERCEL !== "1") return null;
  const candidate = forwardedFor?.split(",", 1)[0]?.trim();
  const secret = contextSecret();
  if (!candidate || !secret || !isIP(candidate)) return null;
  return createHmac("sha256", secret).update(`public-access-network-v1\u001f${candidate}`).digest("hex");
}

export function issuePublicAccessContext(input: { shopSlug: string; eventKind: PublicAccessEventKind; sessionHash: string; now?: Date }) {
  const secret = contextSecret();
  if (!secret) return null;
  const now = input.now ?? new Date();
  const observedOn = tokyoDate(now);
  const payload: ContextPayload = {
    v: 1, shopSlug: input.shopSlug, eventKind: input.eventKind,
    sessionHash: input.sessionHash, observedOn, exp: publicAccessContextExpiresAt(now),
  };
  return signedPayload(payload, secret);
}

export function verifyPublicAccessContext(input: { context: unknown; shopSlug: string; eventKind: PublicAccessEventKind; now?: Date }) {
  const secret = contextSecret();
  if (!secret || typeof input.context !== "string") return null;
  const payload = verifiedPayload<ContextPayload>(input.context, secret);
  if (!payload) return null;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (payload.v !== 1 || payload.shopSlug !== input.shopSlug || payload.eventKind !== input.eventKind || payload.observedOn !== tokyoDate(input.now)
    || payload.exp <= nowSeconds || !/^[0-9a-f]{64}$/.test(payload.sessionHash)) return null;
  return {
    accessContextHash: createHash("sha256").update(input.context).digest("hex"),
    sessionScopeHash: createHash("sha256").update(`${payload.sessionHash}\u001f${payload.shopSlug}\u001f${payload.observedOn}`).digest("hex"),
  };
}
