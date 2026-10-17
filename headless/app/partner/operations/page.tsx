import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PartnerReviewBenefitOperations } from "@/components/partner/PartnerReviewBenefitOperations";
import { EskomiBannerV2Slot } from "@/components/EskomiBannerV2Slot";
import { PARTNER_SESSION_COOKIE, authorizePartnerTherapistSession } from "@/lib/partner/partner-session";
export default async function PartnerOperationsPage() { await connection(); const token=(await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null; if ((await authorizePartnerTherapistSession({ accessToken: token })).status!=="allowed") redirect("/partner/login/"); return <main id="main_content" className="l-mainContent l-article hl-partner-home"><div className="l-mainContent__inner hl-page-inner hl-partner-home__inner"><header className="hl-partner-home__context"><p className="hl-partner-home__eyebrow">ESKOMI PARTNER</p><h1>口コミと特典の運用</h1></header><EskomiBannerV2Slot id="B03" /><PartnerReviewBenefitOperations /><EskomiBannerV2Slot id="B05" /></div></main>; }
