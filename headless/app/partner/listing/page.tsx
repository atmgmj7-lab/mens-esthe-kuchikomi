import type { Metadata } from "next";
import { PartnerListingEditor } from "@/components/partner/PartnerListingEditor";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "掲載情報を編集", description: "招待済み店舗担当者向けの掲載情報編集", path: "/partner/listing/", robots: { index: false, follow: false } });
export const instant = false;
export default function PartnerListingPage() { return <PartnerListingEditor />; }
