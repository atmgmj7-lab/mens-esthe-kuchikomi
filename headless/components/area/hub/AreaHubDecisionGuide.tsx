import Link from "next/link";
import {
  aggregateReviewCountLabel,
  hasPublishedPrice,
  isLateNightShop,
  type AreaHubContext
} from "@/lib/area-shop-utils";
import {
  priorityAreaFragmentAvailable,
  type PriorityAreaCapabilities,
} from "@/lib/priority-area-precision";
import type { ShopView } from "@/lib/wp/types";

type DecisionCard = {
  key: "choice" | "price" | "late-night" | "reviews";
  number: string;
  title: string;
  value: string;
  description: string;
  href: "#shop-list" | "#price-table" | "#late-night" | "#reviews";
  cta: string;
};

export function AreaHubDecisionGuide({
  hubContext,
  shops,
  precisionMode = false,
  capabilities,
  approvedReviewCount,
}: {
  hubContext: AreaHubContext;
  shops: ShopView[];
  precisionMode?: boolean;
  capabilities?: PriorityAreaCapabilities;
  approvedReviewCount?: number | null;
}) {
  const guide = hubContext.decisionGuide;
  if (!guide) return null;

  const pricedCount = shops.filter(hasPublishedPrice).length;
  const lateNightCount = shops.filter(isLateNightShop).length;
  const reviewLabel = aggregateReviewCountLabel(shops);
  const approvedReviewLabel = approvedReviewCount && approvedReviewCount > 0
    ? `承認済み口コミ ${approvedReviewCount}件`
    : null;

  const cards: DecisionCard[] = [
    {
      key: "choice",
      number: "01",
      title: "選び方",
      value: guide.selectionTitle,
      description: `${hubContext.name}の利用駅、時間帯、予約先を先に決めて候補を絞ります。`,
      href: "#shop-list",
      cta: "店舗一覧を見る"
    },
    {
      key: "price",
      number: "02",
      title: "料金",
      value: pricedCount > 0 ? `料金掲載 ${pricedCount}店舗` : "料金情報を確認中",
      description:
        pricedCount > 0
          ? "確認できる掲載料金だけを比較し、最新料金は予約前に公式情報で確認します。"
          : "確認できる掲載料金がないため、各店舗ページと公式情報から確認してください。",
      href: "#price-table",
      cta: "料金を比べる"
    },
    {
      key: "late-night",
      number: "03",
      title: "深夜",
      value: lateNightCount > 0 ? `深夜候補 ${lateNightCount}店舗` : "営業時間から確認",
      description:
        lateNightCount > 0
          ? "掲載営業時間から確認できる候補です。最終受付は予約前に公式情報で確認します。"
          : "深夜営業を確認できる掲載情報がないため、各店舗の営業時間をご確認ください。",
      href: "#late-night",
      cta: "営業時間を見る"
    },
    {
      key: "reviews",
      number: "04",
      title: "口コミ",
      value: precisionMode ? approvedReviewLabel ?? "承認済み口コミを募集中" : reviewLabel,
      description:
        (precisionMode ? !approvedReviewLabel : reviewLabel === "口コミ募集中")
          ? "承認済みのユーザー口コミを募集中です。編集部コメントやPR情報は件数に含めません。"
          : "承認済みのユーザー口コミだけを集計し、編集部コメントやPR情報とは分けて掲載します。",
      href: "#reviews",
      cta: "口コミを見る"
    }
  ];
  const visibleCards = precisionMode && capabilities
    ? cards.filter((card) => (
        card.key === "reviews"
          ? Boolean(approvedReviewLabel)
          : priorityAreaFragmentAvailable(card.href, capabilities)
      ))
    : cards;

  return (
    <section
      id="area-decision-guide"
      className="area-decision-guide hl-section"
      aria-labelledby="area-decision-guide-title"
    >
      <header className="area-decision-guide__header">
        <p className="area-decision-guide__eyebrow">QUICK GUIDE</p>
        <h2 id="area-decision-guide-title">{hubContext.name}で選ぶ{visibleCards.length}つの要点</h2>
        <p className="area-decision-guide__intro">{guide.intro}</p>
      </header>

      <div className="area-decision-guide__grid">
        {visibleCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className={`area-decision-card area-decision-card--${card.key}`}
            aria-label={`${card.title}: ${card.value}。${card.cta}`}
          >
            <span className="area-decision-card__number" aria-hidden="true">{card.number}</span>
            <h3>{card.title}</h3>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
            <span className="area-decision-card__cta">{card.cta}<span aria-hidden="true"> →</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
