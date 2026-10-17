import { NextRequest, NextResponse } from "next/server";

import { partnerTherapistNoStore, partnerTherapistRequestContext, partnerTherapistUuid } from "@/lib/partner/therapist-tools-server";

const failure = (message: string, status: 400 | 401 | 403 | 409 | 503) =>
  NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });

function unavailableStatus(status: string) {
  return status === "unavailable" ? 503 : status === "unauthenticated" ? 401 : 403;
}
function payload(body: Record<string, unknown>) {
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const photoAssetId = body.photoAssetId;
  const permissionPolicyVersion = typeof body.permissionPolicyVersion === "string" ? body.permissionPolicyVersion.trim() : "";
  if (!displayName || displayName.length > 40 || !partnerTherapistUuid(photoAssetId)
    || !permissionPolicyVersion || permissionPolicyVersion.length > 120 || body.permissionConfirmed !== true) return null;
  return { displayName, photoAssetId, permissionPolicyVersion };
}

export async function GET(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("この店舗の担当者情報を確認できません。", unavailableStatus(c.status));
  const response = await fetch(`${c.base}/rest/v1/rpc/list_partner_therapist_assignments`, {
    method: "POST", headers: c.headers, body: JSON.stringify({ p_workspace_id: c.workspaceId }), cache: "no-store",
  });
  const therapists = response.ok ? await response.json() : null;
  return Array.isArray(therapists)
    ? NextResponse.json({ ok: true, therapists }, { headers: partnerTherapistNoStore })
    : failure("担当者情報を取得できませんでした。", 503);
}

export async function POST(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("この店舗の担当者を登録できません。", unavailableStatus(c.status));
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("登録内容を確認してください。", 400); }
  const entry = payload(body); if (!entry) return failure("公開名、写真、権利確認を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/create_partner_therapist_assignment`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_display_name: entry.displayName, p_photo_asset_id: entry.photoAssetId, p_permission_policy_version: entry.permissionPolicyVersion, p_permission_confirmed: true }), cache: "no-store",
  });
  const rows = response.ok ? await response.json() as unknown[] : null;
  return Array.isArray(rows) && rows.length === 1
    ? NextResponse.json({ ok: true, therapist: rows[0] }, { headers: partnerTherapistNoStore })
    : failure("担当者を登録できませんでした。", response.status === 409 ? 409 : 403);
}

export async function PATCH(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("この店舗の担当者を更新できません。", unavailableStatus(c.status));
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("更新内容を確認してください。", 400); }
  const entry = payload(body); const assignmentId = body.assignmentId; const revision = body.revision;
  if (!entry || !partnerTherapistUuid(assignmentId) || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return failure("更新内容を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/update_partner_therapist_assignment`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_assignment_id: assignmentId, p_expected_revision: revision, p_display_name: entry.displayName, p_photo_asset_id: entry.photoAssetId, p_permission_policy_version: entry.permissionPolicyVersion, p_permission_confirmed: true }), cache: "no-store",
  });
  const rows = response.ok ? await response.json() as unknown[] : null;
  return Array.isArray(rows) && rows.length === 1
    ? NextResponse.json({ ok: true, therapist: rows[0] }, { headers: partnerTherapistNoStore })
    : failure("担当者を更新できませんでした。再読み込みして確認してください。", response.status === 409 ? 409 : 403);
}

export async function DELETE(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request);
  if (c.status !== "allowed") return failure("この店舗の担当者を退店にできません。", unavailableStatus(c.status));
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return failure("対象を確認してください。", 400); }
  const assignmentId = body.assignmentId; const revision = body.revision;
  if (!partnerTherapistUuid(assignmentId) || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) return failure("対象を確認してください。", 400);
  const response = await fetch(`${c.base}/rest/v1/rpc/end_partner_therapist_assignment`, {
    method: "POST", headers: c.headers,
    body: JSON.stringify({ p_workspace_id: c.workspaceId, p_assignment_id: assignmentId, p_expected_revision: revision }), cache: "no-store",
  });
  const rows = response.ok ? await response.json() as unknown[] : null;
  return Array.isArray(rows) && rows.length === 1
    ? NextResponse.json({ ok: true, therapist: rows[0] }, { headers: partnerTherapistNoStore })
    : failure("担当者を退店にできませんでした。再読み込みして確認してください。", response.status === 409 ? 409 : 403);
}
