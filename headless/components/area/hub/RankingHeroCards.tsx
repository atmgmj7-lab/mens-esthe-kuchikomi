import { outboundRelForPromotion } from "@/lib/promotion-disclosure";
import Link from "next/link";
import { AreaHubThemeIcon } from "@/components/area/hub/AreaHubThemeIcon";
import { ShopImageThumb } from "@/components/area/hub/ShopImageThumb";
import { ShopInfoChips } from "@/components/area/hub/ShopInfoChips";
import { PriceLabel } from "@/components/common/PriceLabel";
import { canDisplayAreaShopRank } from "@/lib/area-shop-ranking";
import { canReceiveNaturalRankNumber } from "@/lib/shop-ranking";
import {
  resolveShopLastVerifiedLabel,
  shopFeatureTags,
  shopHoursText,
  shopReviewCountLabel
} from "@/lib/area-shop-utils";
import { truncateRankingReason } from "@/lib/shop-ranking";
import type { AreaView, ShopView } from "@/lib/wp/types";

function rankMedalClass(rank: number): string {
  const base = "ranking-card__rank";
  if (rank === 1) return `${base} ${base}--gold`;
  if (rank === 2) return `${base} ${base}--silver`;
  if (rank === 3) return `${base} ${base}--bronze`;
  return `${base} ${base}--navy`;
}

function cardClass(rank: number): string {
  const classes = ["ranking-card"];
  if (rank <= 3) classes.push("ranking-card--top", `ranking-card--rank-${rank}`);
  return classes.join(" ");
}

const HIDDEN_TAG_LABELS = new Set(["公式サイトあり", "料金掲載あり"]);

export function RankingHeroCards({
  shops,
  targetArea
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  return (
    <div className="ranking-list">
      {shops.filter((shop) => canReceiveNaturalRankNumber(shop) || canDisplayAreaShopRank(shop)).map((shop, index) => {
        const rank = index + 1;
        const tags = shopFeatureTags(shop, targetArea)
          .filter((tag) => !HIDDEN_TAG_LABELS.has(tag))
          .slice(0, 2);
        const rankingReason = truncateRankingReason(shop.ranking.rankingReason);

        return (
          <article key={shop.id} className={cardClass(rank)}>
            <div className="ranking-card__lead">
              <div className="ranking-card__image-wrap">
                <span className={rankMedalClass(rank)} aria-label={`${rank}位`}>
                  {rank}
                </span>
                <Link href={`/shops/${shop.slug}/`} className="ranking-card__image">
                  <ShopImageThumb
                    src={shop.imageUrl}
                    alt={shop.title}
                    size="card"
                    priority={rank <= 3}
                    className="ranking-card__thumb"
                  />
                </Link>
              </div>
            </div>

            <div className="ranking-card__body">
              <h3 className="ranking-card__title">
                <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
              </h3>

              {shop.ranking.isPr || shop.ranking.rankingLabel ? (
                <div className="ranking-card__badges">
                  {shop.ranking.rankingLabel ? (
                    <span className="ranking-card__label">{shop.ranking.rankingLabel}</span>
                  ) : null}
                </div>
              ) : null}

              {tags.length > 0 ? (
                <ShopInfoChips tags={tags} max={2} className="ranking-card__tags" />
              ) : null}

              {rankingReason ? (
                <p className="ranking-card__reason">{rankingReason}</p>
              ) : null}

              <dl className="ranking-card__facts">
                <div className="ranking-card__fact">
                  <dt>料金</dt>
                  <dd>
                    <PriceLabel shop={shop} />
                  </dd>
                </div>
                <div className="ranking-card__fact">
                  <dt>営業時間</dt>
                  <dd>{shopHoursText(shop)}</dd>
                </div>
                {shop.officialUrl ? (
                  <div className="ranking-card__fact ranking-card__fact--official">
                    <dt>公式</dt>
                    <dd>
                      <AreaHubThemeIcon name="official" className="ranking-card__fact-icon" />
                      公式サイトあり
                    </dd>
                  </div>
                ) : null}
                <div className="ranking-card__fact ranking-card__fact--muted">
                  <dt>口コミ</dt>
                  <dd>{shopReviewCountLabel(shop)}</dd>
                </div>
              </dl>

              <p className="ranking-card__verified">確認 {resolveShopLastVerifiedLabel(shop)}</p>
            </div>

            <div className="ranking-card__actions">
              <Link
                href={`/shops/${shop.slug}/`}
                className="area-hub-btn area-hub-btn--primary area-hub-btn--sm"
              >
                詳細
              </Link>
              {shop.officialUrl ? (
                <a
                  href={shop.officialUrl}
                  className="area-hub-btn area-hub-btn--outline area-hub-btn--sm"
                  target="_blank"
                  rel={outboundRelForPromotion(shop.ranking.promotion)}
                >
                  公式
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
