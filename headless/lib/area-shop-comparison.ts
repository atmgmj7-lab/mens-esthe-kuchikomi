import "server-only";

import { buildAreaAfterMidnightComparison } from "@/lib/area-after-midnight-comparison";
import { buildAreaShopCardViewModel } from "@/lib/area-shop-card-view-model";
import { buildAreaVerifiedLineComparison } from "@/lib/area-verified-line-comparison";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import {
  resolveVerifiedShopFactProvenance,
} from "@/lib/shop-information-coverage";
import type { AreaView, ShopFactProvenance, ShopView } from "@/lib/wp/types";

export type AreaShopComparisonFact = Readonly<{
  status: "verified" | "unverified";
  value: string;
  href?: string;
  rel?: string;
}>;

export type AreaShopComparisonItem = Readonly<{
  shopId: number;
  name: string;
  detailUrl: string;
  requiresPromotionDisclosure: boolean;
  relation: Readonly<{ areaName: string; label: "主な掲載エリア" | "関連掲載エリア" }>;
  hours: AreaShopComparisonFact;
  afterMidnight: AreaShopComparisonFact;
  line: AreaShopComparisonFact;
  official: AreaShopComparisonFact;
  access: AreaShopComparisonFact;
  information: AreaShopComparisonFact;
  reviewedAt: string | null;
}>;

const UNVERIFIED: AreaShopComparisonFact = Object.freeze({ status: "unverified", value: "未確認" });

export function isAreaShopComparisonTarget(area: Pick<AreaView, "id" | "slug">): boolean {
  return (area.id === 13 && area.slug === "shinosaka")
    || (area.id === 17 && area.slug === "sakai");
}

function verified(value: string, href?: string, rel?: string): AreaShopComparisonFact {
  return Object.freeze({
    status: "verified",
    value,
    ...(href ? { href } : {}),
    ...(rel ? { rel } : {}),
  });
}

function verifiedInfoValue(
  evidence: ShopFactProvenance | null,
  value: string | undefined,
  href?: string,
  rel?: string,
): AreaShopComparisonFact {
  return evidence && value ? verified(value, href, rel) : UNVERIFIED;
}

export function buildAreaShopComparisonItems(
  area: Pick<AreaView, "id" | "slug" | "name">,
  shops: readonly ShopView[],
): AreaShopComparisonItem[] {
  if (!isAreaShopComparisonTarget(area)) return [];
  const afterMidnightIds = new Set(
    buildAreaAfterMidnightComparison(area, shops).map((shop) => shop.shopId),
  );
  const lineById = new Map(
    buildAreaVerifiedLineComparison(area, shops).map((shop) => [shop.shopId, shop] as const),
  );

  return shops.map((shop) => {
    const model = buildShopDetailViewModel(shop, area.name);
    const provenance = shop.acf.shop_fact_provenance;
    const hoursEvidence = resolveVerifiedShopFactProvenance("hours", model, provenance);
    const accessEvidence = resolveVerifiedShopFactProvenance("access", model, provenance);
    const officialEvidence = resolveVerifiedShopFactProvenance("official", model, provenance);
    const card = buildAreaShopCardViewModel(shop, area, { showRank: false });
    const line = lineById.get(shop.id);
    const hours = model.infoRows.find((row) => row.key === "hours")?.value;
    const access = model.infoRows.find((row) => row.key === "station")?.value
      || model.infoRows.find((row) => row.key === "address")?.value;
    const official = model.actions.find((action) => action.kind === "official");
    const officialCardAction = card.actions.find((action) => action.kind === "official");
    const isPrimary = shop.primaryArea?.id === area.id && shop.primaryArea.slug === area.slug;
    const strictEvidence = [
      hours && hoursEvidence ? hoursEvidence : null,
      access && accessEvidence ? accessEvidence : null,
      official && officialEvidence ? officialEvidence : null,
      line,
    ]
      .filter((evidence): evidence is NonNullable<typeof evidence> => Boolean(evidence));
    const latestReviewedAt = strictEvidence
      .map((evidence) => evidence.reviewedAt)
      .sort((first, second) => Date.parse(second) - Date.parse(first))[0] ?? null;

    return Object.freeze({
      shopId: shop.id,
      name: model.title,
      detailUrl: card.title.href,
      requiresPromotionDisclosure: shop.ranking.promotion.requiresDisclosure,
      relation: Object.freeze({
        areaName: area.name,
        label: isPrimary ? "主な掲載エリア" : "関連掲載エリア",
      }),
      hours: verifiedInfoValue(hoursEvidence, hours),
      afterMidnight: afterMidnightIds.has(shop.id) ? verified("確認済み") : UNVERIFIED,
      line: line ? verified("対応確認", line.lineUrl, line.outboundRel) : UNVERIFIED,
      official: verifiedInfoValue(
        officialEvidence,
        official ? "公式サイトあり" : undefined,
        official?.href,
        officialCardAction?.rel,
      ),
      access: verifiedInfoValue(accessEvidence, access),
      information: strictEvidence.length > 0
        ? verified(`${strictEvidence.length}/4項目確認`)
        : UNVERIFIED,
      reviewedAt: latestReviewedAt?.slice(0, 10) ?? null,
    });
  });
}
