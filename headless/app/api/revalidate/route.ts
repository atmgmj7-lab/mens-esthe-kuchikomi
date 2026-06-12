import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const defaultTag = "wp";

function isSafeTag(tag: string) {
  return /^[a-zA-Z0-9:_-]{1,128}$/.test(tag);
}

async function readTag(request: NextRequest) {
  const searchTag = request.nextUrl.searchParams.get("tag");
  if (searchTag) return searchTag;

  try {
    const body = (await request.json()) as { tag?: unknown };
    return typeof body.tag === "string" ? body.tag : defaultTag;
  } catch {
    return defaultTag;
  }
}

async function handleRevalidate(request: NextRequest) {
  const configuredSecret = process.env.REVALIDATE_SECRET;
  const providedSecret = request.headers.get("x-revalidate-secret") || request.nextUrl.searchParams.get("secret");

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ ok: false, message: "Invalid secret" }, { status: 401 });
  }

  const tag = await readTag(request);
  if (!isSafeTag(tag)) {
    return NextResponse.json({ ok: false, message: "Invalid tag" }, { status: 400 });
  }

  revalidateTag(tag, "max");
  return NextResponse.json({ ok: true, tag });
}

export async function GET(request: NextRequest) {
  return handleRevalidate(request);
}

export async function POST(request: NextRequest) {
  return handleRevalidate(request);
}
