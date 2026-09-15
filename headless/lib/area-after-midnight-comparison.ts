import "server-only";

import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { resolveVerifiedShopFactProvenance } from "@/lib/shop-information-coverage";
import { selectAreaRelationShops } from "@/lib/priority-area-precision";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import type { VerifiedLineAreaShop } from "@/lib/area-verified-line-comparison";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type AfterMidnightAreaShop = Omit<VerifiedLineAreaShop, "lineUrl"> & Readonly<{ hours: string }>;

/** Explicit calendar-day end only; never infer rollover or availability from a clock time. */
export function isExplicitlyAfterMidnight(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.normalize("NFKC").trim();
  if (text === "24時間営業") return true;
  // A separate, fully specified reception range may follow the business hours.
  // Bare "最終受付" could qualify the main end time, so it is deliberately rejected.
  const match = text.match(/^(?:営業時間\s*)?(\d{1,2}):(\d{2})\s*[-~〜‐–—]\s*(翌日?\s*)?(\d{1,2}):(\d{2})(?:\s*\((?:受付時間|受付開始|最終受付)\s*(?:翌日?\s*)?\d{1,2}:\d{2}\s*[-~〜‐–—]\s*(?:最終受付\s*)?(?:翌日?\s*)?\d{1,2}:\d{2}(?:迄)?\))?$/u);
  if (!match) return false;
  const [, startHour, startMinute, nextDay, endHour, endMinute] = match;
  const start = Number(startHour);
  const end = Number(endHour);
  if (start > 23 || Number(startMinute) > 59 || Number(endMinute) > 59 || end > 47 || (nextDay && end > 23)) return false;
  return (end + (nextDay ? 24 : 0)) * 60 + Number(endMinute) > 24 * 60;
}

export function buildAreaAfterMidnightComparison(
  area: Pick<AreaView, "id" | "slug" | "name">,
  allShops: readonly ShopView[],
): AfterMidnightAreaShop[] {
  if (!((area.id === 13 && area.slug === "shinosaka") || (area.id === 17 && area.slug === "sakai"))) return [];
  const areaShops = selectAreaRelationShops(allShops, area);
  const qualified = areaShops.flatMap((shop): AfterMidnightAreaShop[] => {
    const model = buildShopDetailViewModel(shop, area.name);
    const hours = model.infoRows.find((row) => row.key === "hours")?.value;
    if (!hours || !isExplicitlyAfterMidnight(hours)) return [];
    const evidence = resolveVerifiedShopFactProvenance("hours", model, shop.acf.shop_fact_provenance);
    if (!evidence) return [];
    let slug: string;
    try {
      const decoded = decodeURIComponent(shop.slug);
      if (!decoded || decoded === "." || decoded === ".." || /[/?#\\\s\u0000-\u001f\u007f]/u.test(decoded)) return [];
      slug = encodeURIComponent(decoded);
    } catch { return []; }
    return [{
      shopId: shop.id, slug: shop.slug, name: model.title, hours,
      shopDetailUrl: `/shops/${slug}/`, sourceUrl: evidence.sourceUrl,
      reviewedAt: evidence.reviewedAt, isPr: shop.ranking.isPr,
      outboundRel: outboundRelForPromotion(shop.ranking.promotion),
    }];
  });
  return qualified.length >= 3 && qualified.length * 10 >= areaShops.length ? qualified : [];
}
