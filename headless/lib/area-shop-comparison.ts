import "server-only";

import { buildAreaAfterMidnightComparison } from "@/lib/area-after-midnight-comparison";
import { buildAreaShopCardViewModel } from "@/lib/area-shop-card-view-model";
import { buildAreaVerifiedLineComparison } from "@/lib/area-verified-line-comparison";
import { buildShopDetailViewModel } from "@/lib/shop-detail-view-model";
import {
  resolveVerifiedShopFactProvenance,
} from "@/lib/shop-information-coverage";
import type { AreaView, ShopFactProvenance, ShopView } from "@/lib/wp/types";
import { buildReviewSubmitUrl } from "@/lib/review-links";
import {
  confirmedComparisonFact,
  unavailableComparisonFact,
  unknownComparisonFact,
  type AreaShopComparisonFact,
} from "@/lib/area-shop-comparison-facts";

export type { AreaShopComparisonFact } from "@/lib/area-shop-comparison-facts";

export type AreaShopComparisonItem = Readonly<{
  shopId: number;
  name: string;
  detailUrl: string;
  reviewSubmitUrl: string;
  requiresPromotionDisclosure: boolean;
  relation: Readonly<{ areaName: string; label: "主な掲載エリア" | "関連掲載エリア" }>;
  hours: AreaShopComparisonFact;
  afterMidnight: AreaShopComparisonFact;
  line: AreaShopComparisonFact;
  official: AreaShopComparisonFact;
  access: AreaShopComparisonFact;
  information: AreaShopComparisonFact;
  price: AreaShopComparisonFact;
  webBooking: AreaShopComparisonFact;
  reviewedAt: string | null;
}>;

const UNKNOWN = unknownComparisonFact("公開情報または確認済み根拠が不足");
const DEFERRED_UNAVAILABLE = unavailableComparisonFact("比較用の確認済みデータ未連携");

export function isAreaShopComparisonTarget(area: Pick<AreaView, "id" | "slug">): boolean {
  return (area.id === 13 && area.slug === "shinosaka")
    || (area.id === 17 && area.slug === "sakai");
}

function confirmedInfoValue(
  evidence: ShopFactProvenance | null,
  value: string | undefined,
  href?: string,
  rel?: string,
): AreaShopComparisonFact {
  return evidence && value ? confirmedComparisonFact(value, {
    sourceUrl: evidence.sourceUrl,
    observedAt: evidence.observedAt,
    reviewedAt: evidence.reviewedAt,
    publishedValueHash: evidence.publishedValueHash,
    ...(href ? { href } : {}),
    ...(rel ? { rel } : {}),
  }) : UNKNOWN;
}

export function buildAreaShopComparisonItems(
  area: Pick<AreaView, "id" | "slug" | "name">,
  shops: readonly ShopView[],
): AreaShopComparisonItem[] {
  if (!isAreaShopComparisonTarget(area)) return [];
  const afterMidnightById = new Map(
    buildAreaAfterMidnightComparison(area, shops).map((shop) => [shop.shopId, shop] as const),
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
    const afterMidnight = afterMidnightById.get(shop.id);
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
      reviewSubmitUrl: buildReviewSubmitUrl(shop.slug),
      requiresPromotionDisclosure: shop.ranking.promotion.requiresDisclosure,
      relation: Object.freeze({
        areaName: area.name,
        label: isPrimary ? "主な掲載エリア" : "関連掲載エリア",
      }),
      hours: confirmedInfoValue(hoursEvidence, hours),
      afterMidnight: afterMidnight ? confirmedComparisonFact("確認済み", {
        sourceUrl: afterMidnight.sourceUrl,
        reviewedAt: afterMidnight.reviewedAt,
      }) : UNKNOWN,
      line: line ? confirmedComparisonFact("対応確認", {
        href: line.lineUrl,
        rel: line.outboundRel,
        sourceUrl: line.sourceUrl,
        reviewedAt: line.reviewedAt,
      }) : UNKNOWN,
      official: confirmedInfoValue(
        officialEvidence,
        official ? "公式サイトあり" : undefined,
        official?.href,
        officialCardAction?.rel,
      ),
      access: confirmedInfoValue(accessEvidence, access),
      information: strictEvidence.length > 0
        ? confirmedComparisonFact(`${strictEvidence.length}/4項目確認`)
        : UNKNOWN,
      price: DEFERRED_UNAVAILABLE,
      webBooking: DEFERRED_UNAVAILABLE,
      reviewedAt: latestReviewedAt?.slice(0, 10) ?? null,
    });
  });
}
