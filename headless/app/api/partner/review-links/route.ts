import { NextRequest, NextResponse } from "next/server";

import { partnerTherapistNoStore, partnerTherapistRequestContext, partnerTherapistUuid } from "@/lib/partner/therapist-tools-server";

const failure = (message: string, status: 400 | 401 | 403 | 503) =>
  NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });

export async function POST(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("口コミリンクを発行できません。", c.status === "unavailable" ? 503 : c.status === "unauthenticated" ? 401 : 403);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("リンクの対象を確認してください。", 400); }
  const assignmentId = body.therapistAssignmentId;
  const channel = body.channel;
  if ((assignmentId !== null && !partnerTherapistUuid(assignmentId)) || (channel !== "line" && channel !== "email")) return failure("リンクの対象を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/create_partner_review_entry_link`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_therapist_assignment_id: assignmentId, p_channel: channel }), cache: "no-store",
  });
  const rows = response.ok ? await response.json() as Array<{ public_handle?: unknown; therapist_display_name?: unknown }> : null;
  const link = Array.isArray(rows) && rows.length === 1 && typeof rows[0]?.public_handle === "string"
    ? { reviewUrl: `https://mens-esthe-kuchikomi.com/r/${rows[0].public_handle}/`, therapistDisplayName: typeof rows[0].therapist_display_name === "string" ? rows[0].therapist_display_name : null }
    : null;
  return link ? NextResponse.json({ ok: true, link }, { headers: partnerTherapistNoStore }) : failure("口コミリンクを発行できませんでした。", 403);
}
