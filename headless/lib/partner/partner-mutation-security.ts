import "server-only";

import type { NextRequest } from "next/server";

export const PARTNER_MUTATION_CSRF = "partner-mutation-v1";

export function validPartnerMutation(request: NextRequest, json = true): boolean {
  if (json && request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return false;
  if (request.headers.get("x-eskomi-csrf") !== PARTNER_MUTATION_CSRF) return false;
  const origin = request.headers.get("origin"); const host = request.headers.get("host");
  if (!origin || !host || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
