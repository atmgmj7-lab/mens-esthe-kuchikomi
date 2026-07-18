import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { secretsMatch } from "@/lib/server/secure-secret";

const defaultTag = "wp";

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
    return NextResponse.json(
      { ok: false, message: "Revalidation is not configured" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  const providedSecret = request.headers.get("x-revalidate-secret") || "";
  if (!providedSecret || !secretsMatch(configuredSecret, providedSecret)) {
    return NextResponse.json(
      { ok: false, message: "Invalid secret" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }

  const tag = await readTag(request);
  if (!isSafeTag(tag)) {
    return NextResponse.json({ ok: false, message: "Invalid tag" }, { status: 400 });
  }

  revalidateTag(tag, "max");
  return NextResponse.json(
    { ok: true, tag },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
