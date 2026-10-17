import { NextResponse } from "next/server";

// The interim v2 receipt path had a different idempotency and benefit
// contract. Public entry pages use the v1.1 context/session submit flow.
export async function POST() {
  return NextResponse.json({ ok: false, code: "REVIEW_ENTRY_MIGRATED" }, {
    status: 410,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
