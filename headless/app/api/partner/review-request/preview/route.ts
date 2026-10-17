import { NextRequest, NextResponse } from "next/server";

import { partnerTherapistNoStore, partnerTherapistRequestContext, partnerTherapistUuid } from "@/lib/partner/therapist-tools-server";
import { validPartnerMutation } from "@/lib/partner/partner-mutation-security";

const failure = (message: string, status: 400 | 401 | 403 | 503) =>
  NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });

export async function POST(request: NextRequest) {
  if (!validPartnerMutation(request)) return failure("送信元を確認してください。", 403);
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("案内文を作成できません。", c.status === "unavailable" ? 503 : c.status === "unauthenticated" ? 401 : 403);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("案内文の条件を確認してください。", 400); }
  const assignmentId = body.therapistAssignmentId;
  const channel = body.channel;
  const greeting = body.greetingVariant;
  if ((assignmentId !== null && !partnerTherapistUuid(assignmentId)) || (channel !== "line" && channel !== "email") || (greeting !== "today" && greeting !== "recent")) return failure("案内文の条件を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/preview_partner_review_request`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId, p_therapist_assignment_id: assignmentId, p_channel: channel, p_greeting_variant: greeting }), cache: "no-store",
  });
  const rows = response.ok ? await response.json() as unknown[] : null;
  return Array.isArray(rows) && rows.length === 1
    ? NextResponse.json({ ok: true, preview: rows[0] }, { headers: partnerTherapistNoStore })
    : failure("案内文を作成できませんでした。", 403);
}
