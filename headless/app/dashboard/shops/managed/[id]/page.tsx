import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ManagedShopEditorForm } from "@/components/dashboard/ManagedShopForms";
import { managedShopDirectoryRepository } from "@/lib/supabase/managed-shop-directory";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Web店舗管理", description: "Eskomi運営向け店舗編集", path: "/dashboard/shops/", robots: { index: false, follow: false } });
export const instant = false;

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function nullable(value: unknown): string | number | null { return typeof value === "string" || typeof value === "number" ? value : null; }
function uuidList(value: unknown): string[] { return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) : []; }

export default async function ManagedShopPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = (await params).id;
  const detail = await managedShopDirectoryRepository.getDetail(id);
  const current = record(detail?.current_revision); const shop = record(detail?.shop);
  if (!detail || !current || !shop || !Number.isSafeInteger(current.revision)) notFound();
  const initial = {
    shop_name: text(current.shop_name), area_slug: text(current.area_slug), area_name: text(current.area_name), official_url: nullable(current.official_url),
    introduction: nullable(current.introduction), address: nullable(current.address), business_hours: nullable(current.business_hours), phone: nullable(current.phone),
    line_url: nullable(current.line_url), booking_url: nullable(current.booking_url), basic_price: nullable(current.basic_price), price_90: nullable(current.price_90),
    banner_asset_id: nullable(current.banner_asset_id), gallery_asset_ids: uuidList(current.gallery_asset_ids),
  };
  const publicationState = shop.publication_state === "published" ? "published" : "unlisted";
  return <><p><a href="/dashboard/shops/">← 店舗一覧へ戻る</a></p><ManagedShopEditorForm managedShopId={id} revision={current.revision as number} initial={initial} publicationState={publicationState} currentState={text(current.state)} /></>;
}
