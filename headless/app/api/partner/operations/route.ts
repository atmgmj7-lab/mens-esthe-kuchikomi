import { NextRequest, NextResponse } from "next/server";

import { validPartnerMutation } from "@/lib/partner/partner-mutation-security";
import { partnerTherapistNoStore, partnerTherapistRequestContext, partnerTherapistUuid } from "@/lib/partner/therapist-tools-server";

const fail = (message: string, status: 400 | 401 | 403 | 409 | 503) => NextResponse.json({ ok: false, message }, { status, headers: partnerTherapistNoStore });
async function rpc(c: Awaited<ReturnType<typeof partnerTherapistRequestContext>> & { status: "allowed" }, name: string, body: Record<string, unknown>) {
  const response = await fetch(`${c.base}/rest/v1/rpc/${name}`, { method: "POST", headers: c.headers, body: JSON.stringify(body), cache: "no-store" });
  return response.ok ? await response.json() : null;
}
export async function GET(request: NextRequest) {
  const c = await partnerTherapistRequestContext(request); if (c.status !== "allowed") return fail("この店舗の運用情報を確認できません。", c.status === "unavailable" ? 503 : c.status === "unauthenticated" ? 401 : 403);
  const [benefits, reviews, widget] = await Promise.all([
    rpc(c, "list_partner_benefit_operations_v11", { p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId }),
    rpc(c, "list_partner_replyable_reviews_v11", { p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId }),
    rpc(c, "get_partner_review_widget_v11", { p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId }),
  ]);
  return Array.isArray(benefits) && Array.isArray(reviews) && Array.isArray(widget) && widget.length === 1 ? NextResponse.json({ ok: true, benefits, reviews, widget: widget[0] }, { headers: partnerTherapistNoStore }) : fail("運用情報を取得できませんでした。", 503);
}
export async function POST(request: NextRequest) {
  if (!validPartnerMutation(request)) return fail("送信元を確認してください。", 403);
  const c = await partnerTherapistRequestContext(request); if (c.status !== "allowed") return fail("この店舗の操作を実行できません。", c.status === "unavailable" ? 503 : c.status === "unauthenticated" ? 401 : 403);
  let input: Record<string, unknown>; try { input = await request.json(); } catch { return fail("入力内容を確認してください。", 400); }
  if (input.action === "reply" && partnerTherapistUuid(input.publicationId) && Number.isSafeInteger(input.expectedRevision) && typeof input.body === "string") {
    const rows = await rpc(c, "submit_partner_review_reply_v11", { p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId, p_publication_id: input.publicationId, p_expected_revision: input.expectedRevision, p_body: input.body });
    return Array.isArray(rows) && rows.length === 1 ? NextResponse.json({ ok: true, reply: rows[0] }, { headers: partnerTherapistNoStore }) : fail("返信申請を保存できませんでした。再読み込みして確認してください。", 409);
  }
  if (input.action === "benefit" && Number.isSafeInteger(input.expectedRevision) && typeof input.title === "string" && typeof input.kind === "string" && typeof input.terms === "string" && typeof input.issuer === "string" && typeof input.funder === "string" && typeof input.validFrom === "string") {
    const amount = input.amount === "" || input.amount === null ? null : Number(input.amount); const rate = input.rate === "" || input.rate === null ? null : Number(input.rate);
    const rows = await rpc(c, "save_partner_benefit_program_v11", { p_workspace_id: c.workspaceId, p_auth_user_id: c.authUserId, p_expected_revision: input.expectedRevision, p_title: input.title, p_benefit_kind: input.kind, p_amount_yen: Number.isInteger(amount) ? amount : null, p_rate: typeof rate === "number" && Number.isFinite(rate) ? rate : null, p_terms_text: input.terms, p_issuer_label: input.issuer, p_funding_party_label: input.funder, p_valid_from: input.validFrom, p_valid_until: typeof input.validUntil === "string" && input.validUntil ? input.validUntil : null, p_redeem_valid_days: Number.isInteger(input.redeemDays) ? input.redeemDays : null, p_combinable: input.combinable === true });
    return Array.isArray(rows) && rows.length === 1 ? NextResponse.json({ ok: true, benefit: rows[0] }, { headers: partnerTherapistNoStore }) : fail("特典条件を保存できませんでした。再読み込みして確認してください。", 409);
  }
  return fail("入力内容を確認してください。", 400);
}
