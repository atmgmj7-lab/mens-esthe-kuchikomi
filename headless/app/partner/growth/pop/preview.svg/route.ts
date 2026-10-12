import { cookies } from "next/headers";
import { connection } from "next/server";
import QRCode from "qrcode";

import { resolvePartnerReviewGrowthCenter } from "@/lib/partner/partner-review-growth-kit";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

export async function GET() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerReviewGrowthSession({ accessToken });
  if (dashboard.status !== "allowed") return new Response("Not found", { status: 404 });
  const center = resolvePartnerReviewGrowthCenter(dashboard.identity, dashboard.metrics);
  if (center.status !== "allowed") return new Response("Not found", { status: 404 });
  const qr = center.assets.find((asset) => asset.key === "qr");
  if (qr?.status !== "available") return new Response("Not found", { status: 404 });

  const qrDataUrl = await QRCode.toDataURL(qr.value, { errorCorrectionLevel: "M", margin: 1, width: 720 });
  const shopName = escapeXml(center.context.shopName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1680" viewBox="0 0 1200 1680" role="img" aria-labelledby="title description">
  <title id="title">${shopName}のEskomi口コミPOP</title><desc id="description">実際に利用したお客様へ任意の感想投稿を依頼するQRコード付きPOP</desc>
  <rect width="1200" height="1680" fill="#fffdf8"/><rect x="54" y="54" width="1092" height="1572" rx="24" fill="#ffffff" stroke="#d4af37" stroke-width="3"/>
  <text x="600" y="184" fill="#8b6f2f" font-family="Georgia, serif" font-size="30" font-weight="700" text-anchor="middle" letter-spacing="7">ESKOMI REVIEW</text>
  <text x="600" y="280" fill="#143d4d" font-family="serif" font-size="52" font-weight="700" text-anchor="middle">ご利用後のご感想を</text><text x="600" y="348" fill="#143d4d" font-family="serif" font-size="52" font-weight="700" text-anchor="middle">お聞かせください</text>
  <text x="600" y="430" fill="#1a2830" font-family="sans-serif" font-size="34" text-anchor="middle">${shopName}</text>
  <text x="600" y="508" fill="#4e5b62" font-family="sans-serif" font-size="28" text-anchor="middle">実際にご利用いただいたご感想を、よろしければお聞かせください。</text><text x="600" y="552" fill="#4e5b62" font-family="sans-serif" font-size="28" text-anchor="middle">回答は任意です。</text>
  <rect x="270" y="620" width="660" height="660" rx="16" fill="#fff" stroke="#e3dfd6" stroke-width="2"/><image href="${qrDataUrl}" x="300" y="650" width="600" height="600"/>
  <text x="600" y="1350" fill="#143d4d" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle">スマートフォンのカメラで読み取ると、口コミ投稿ページが開きます。</text>
  <text x="600" y="1440" fill="#5b6470" font-family="sans-serif" font-size="24" text-anchor="middle">投稿内容は運営が確認し、審査と公開を分けて判断します。</text><text x="600" y="1480" fill="#5b6470" font-family="sans-serif" font-size="24" text-anchor="middle">評価や内容を指定する依頼、特典・報酬による依頼は行いません。</text>
  <text x="600" y="1560" fill="#8b6f2f" font-family="Georgia, serif" font-size="28" font-weight="700" text-anchor="middle">Eskomi（エスコミ）</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": "attachment; filename=eskomi-review-pop-preview.svg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
