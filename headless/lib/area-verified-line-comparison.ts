import "server-only";

import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { resolveVerifiedShopFactProvenance } from "@/lib/shop-information-coverage";
import { selectAreaRelationShops } from "@/lib/priority-area-precision";
import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import type { AreaView, ShopView } from "@/lib/wp/types";

export type VerifiedLineAreaShop = Readonly<{
  shopId: number;
  slug: string;
  name: string;
  lineUrl: string;
  shopDetailUrl: string;
  sourceUrl: string;
  reviewedAt: string;
  isPr: boolean;
  outboundRel: string;
}>;

function isShopLineUrl(href: string): boolean {
  const url = new URL(href); // The current detail model has already validated HTTP(S).
  if (url.username || url.password || url.port) return false;
  if (url.hostname === "lin.ee") return /^\/[a-zA-Z0-9]+\/?$/.test(url.pathname);
  if (url.hostname !== "line.me") return false;
  // Only explicit account invitations; generic LINE pages and share links are not shop contacts.
  return /^\/ti\/p\/(?:@|%40)?[a-zA-Z0-9_.~-]+\/?$/i.test(url.pathname);
}

export function buildAreaVerifiedLineComparison(
  area: Pick<AreaView, "id" | "slug" | "name">,
  allShops: readonly ShopView[],
): VerifiedLineAreaShop[] {
  if (!((area.id === 13 && area.slug === "shinosaka") || (area.id === 17 && area.slug === "sakai"))) return [];
  return selectAreaRelationShops(allShops, area).flatMap((shop): VerifiedLineAreaShop[] => {
    const model = buildShopDetailViewModel(shop, area.name);
    const line = model.actions.find((action) => action.kind === "line");
    if (!line || !isShopLineUrl(line.href)) return [];
    const evidence = resolveVerifiedShopFactProvenance("booking", model, shop.acf.shop_fact_provenance);
    if (!evidence) return [];
    let slug: string;
    try {
      const decoded = decodeURIComponent(shop.slug);
      if (!decoded || decoded === "." || decoded === ".." || /[/?#\\\s\u0000-\u001f\u007f]/u.test(decoded)) return [];
      slug = encodeURIComponent(decoded);
    } catch { return []; }
    return [{
      shopId: shop.id,
      slug: shop.slug,
      name: model.title,
      lineUrl: line.href,
      shopDetailUrl: `/shops/${slug}/`,
      sourceUrl: evidence.sourceUrl,
      reviewedAt: evidence.reviewedAt,
      isPr: shop.ranking.isPr,
      outboundRel: outboundRelForPromotion(shop.ranking.promotion),
    }];
  });
}
