import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { PartnerTherapistTools } from "@/components/partner/PartnerTherapistTools";
import { EskomiBannerV2Slot } from "@/components/EskomiBannerV2Slot";
import { PARTNER_SESSION_COOKIE, authorizePartnerTherapistSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "担当者管理 | パートナー", description: "Eskomi Partnerの担当者管理", path: "/partner/therapists/", robots: { index: false, follow: false } });
export const instant = false;

export default async function PartnerTherapistsPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const session = await authorizePartnerTherapistSession({ accessToken });
  if (session.status !== "allowed") redirect("/partner/login/");
  return <main id="main_content" className="l-mainContent l-article hl-partner-home"><div className="l-mainContent__inner hl-page-inner hl-partner-home__inner"><header className="hl-partner-home__context"><p className="hl-partner-home__eyebrow">ESKOMI PARTNER</p><h1>担当者を管理する</h1><p>この店舗に紐づく担当者だけを登録・編集できます。</p></header><EskomiBannerV2Slot id="B06" /><PartnerTherapistTools /></div></main>;
}
