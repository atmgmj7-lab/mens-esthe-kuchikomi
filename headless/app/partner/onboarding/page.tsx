import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { resolvePartnerGuidedOnboarding } from "@/lib/partner/partner-dashboard";
import { PARTNER_SESSION_COOKIE, authorizePartnerReviewGrowthSession } from "@/lib/partner/partner-session";
import { pageMetadata } from "@/lib/seo";

export const instant = false;
export const metadata: Metadata = pageMetadata({ title: "はじめ方 | パートナー", description: "Eskomi Partnerの初期案内", path: "/partner/onboarding/", robots: { index: false, follow: false } });

export default async function PartnerOnboardingPage() {
  await connection();
  const accessToken = (await cookies()).get(PARTNER_SESSION_COOKIE)?.value ?? null;
  const dashboard = await authorizePartnerReviewGrowthSession({ accessToken });
  if (dashboard.status !== "allowed") redirect("/partner/login/");
  const onboarding = resolvePartnerGuidedOnboarding(dashboard.identity, dashboard.growthKit);
  if (onboarding.status !== "allowed") redirect("/partner/login/");
  const intro = onboarding.kind === "first_run" ? "最初の口コミ導線を確認しましょう。" : onboarding.kind === "assets_unavailable" ? "一部の導線は準備中です。" : "基本の案内を確認できます。";
  return <main id="main_content" className="l-mainContent l-article hl-partner-home" data-partner-onboarding-root>
    <div className="l-mainContent__inner hl-page-inner hl-partner-home__inner">
      <header className="hl-partner-home__context"><p className="hl-partner-home__eyebrow">Getting started</p><h1>{onboarding.context.shopName}のはじめ方</h1><p>{intro}</p></header>
      <section className="hl-partner-home__section" aria-labelledby="onboarding-heading"><h2 id="onboarding-heading">最初に確認すること</h2><ol className="hl-partner-growth-center__funnel">{onboarding.steps.map((step) => <li key={step.key}><strong>{step.title}</strong><p>{step.description}</p><a className="hl-partner-home__text-link" href={step.href}>{step.status === "unavailable" ? "準備状況を確認" : "確認する"}</a></li>)}</ol></section>
      <section className="hl-partner-home__action" aria-labelledby="onboarding-policy-heading"><h2 id="onboarding-policy-heading">口コミのご案内について</h2><p>実際に利用したお客様へ率直なご感想をお願いしてください。評価の指定や特典による依頼は行いません。投稿は人による審査後に公開されます。</p><a className="hl-partner-home__primary-action" href="/partner/growth/">口コミ導線を確認する</a></section>
    </div>
  </main>;
}
