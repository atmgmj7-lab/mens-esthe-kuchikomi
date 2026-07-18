import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { secretsMatch } from "@/lib/server/secure-secret";

const defaultTag = "wp";
const safeResponseHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

type RevalidateResponseBody = {
  ok: boolean;
  message?: string;
  tag?: string;
};

function revalidateResponse(body: RevalidateResponseBody, status: number) {
  return NextResponse.json(body, {
    status,
    headers: safeResponseHeaders,
  });
}

function isSafeTag(tag: string) {
  return /^[a-zA-Z0-9:_-]{1,128}$/.test(tag);
}

async function readTag(request: NextRequest) {
  try {
    const body = (await request.json()) as { tag?: unknown };
    return typeof body.tag === "string" ? body.tag : defaultTag;
  } catch {
    return defaultTag;
  }
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET || "";
  if (!configuredSecret) {
    return revalidateResponse(
      { ok: false, message: "Revalidation is not configured" },
      503,
    );
  }

  const providedSecret = request.headers.get("x-revalidate-secret") || "";
  if (!providedSecret || !secretsMatch(configuredSecret, providedSecret)) {
    return revalidateResponse({ ok: false, message: "Invalid secret" }, 401);
  }

  const tag = await readTag(request);
  if (!isSafeTag(tag)) {
    return revalidateResponse({ ok: false, message: "Invalid tag" }, 400);
  }

  try {
    revalidateTag(tag, { expire: 0 });
  } catch {
    return revalidateResponse({ ok: false, message: "Revalidation failed" }, 500);
  }

  return revalidateResponse({ ok: true, tag }, 200);
}
