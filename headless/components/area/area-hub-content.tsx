import Link from "next/link";
import type { ReactNode } from "react";
import { AreaHubFaqAccordion } from "@/components/area/hub/AreaHubFaqAccordion";
import { ThemeBanner } from "@/components/area/hub/ThemeBanner";
import {
  isLayeredBannerEnabled,
  isLayeredBannerSectionEnabled,
  resolveThemeBannerCharacter
} from "@/lib/area-hub-banner-config";
import { AreaHubThemeBanner } from "@/components/area/hub/AreaHubThemeBanner";
import { AreaHubSectionHeader } from "@/components/area/hub/AreaHubSectionHeader";
import { AreaHubSectionShell } from "@/components/area/hub/AreaHubSectionShell";
import { RankingComparisonTable } from "@/components/area/hub/RankingComparisonTable";
import { RankingHeroCards } from "@/components/area/hub/RankingHeroCards";
import { RankingSpecialtyPagedList } from "@/components/area/hub/RankingSpecialtyPagedList";
import { RankingTabs, type RankingTabItem } from "@/components/area/hub/RankingTabs";
import {
  orderShopsForAreaRanking,
  type AreaShopRankingEntry
} from "@/lib/area-shop-ranking";
import {
  type AreaHubContext,
  extractShopConfirmedPriceYen,
  hasPublishedPrice,
  isBeginnerFriendlyShop,
  isLateNightShop,
  isStationNearShop,
  sortShopsForRanking
} from "@/lib/area-shop-utils";
import {
  buildRankingIntro
} from "@/lib/shop-ranking";
import {
  hasPriorityStationWalk,
  resolvePriorityAreaCapabilities,
  type PriorityAreaCapabilities,
} from "@/lib/priority-area-precision";
import type { AreaView, ShopView } from "@/lib/wp/types";

export const REVIEW_POLICY =
  "当サイトでは、ユーザー投稿口コミと掲載情報コメントを分けて扱います。ユーザー口コミは、投稿経路、承認状態、公開状態、店舗との紐付けを確認できるものだけを掲載します。掲載情報コメントは、公式サイト・公開情報・料金・営業時間・アクセス・予約導線などをもとに比較しやすいよう整理したもので、口コミ件数や評価には含めません。";

export const REVIEW_POLICY_SHORT =
  "ユーザー口コミと掲載情報コメントを分けて掲載。投稿口コミは運営確認後に公開します。";

export const RANKING_CRITERIA = [
  "公開情報の充実度",
  "料金の分かりやすさ",
  "営業時間の掲載状況",
  "駅からの距離（エリア情報）",
  "予約導線",
  "公式サイト情報量",
  "編集部確認状況",
  "店舗情報の更新状況"
];

const GUIDE_POINTS = [
  {
    title: "営業時間を先に確認",
    body: "最終受付の有無も店舗ページでチェック。"
  },
  {
    title: "料金は目安として比較",
    body: "予約前に公式情報で確定させてください。"
  },
  {
    title: "予約導線が分かる店舗から",
    body: "公式サイト・電話掲載店舗は問い合わせしやすい傾向。"
  },
  {
    title: "口コミと掲載情報を分けて",
    body: "ユーザー投稿と掲載情報コメントは性質が異なります。"
  }
] as const;

export function buildFaqItems(
  ctx: AreaHubContext,
  { includeBeginner = true }: { includeBeginner?: boolean } = {},
) {
  const items = [
    {
      question: `${ctx.faqAreaRef}のメンズエステはどこから探すのがおすすめですか？`,
      answer: ctx.faqFirstAnswer
    },
    {
      question: "料金はどのくらいが相場ですか？",
      answer:
        "店舗やコースによって異なります。掲載店舗の料金目安は各店舗ページまたは公式サイトでご確認ください。料金が未掲載の店舗は「要確認」と表示しています。"
    },
    {
      question: "深夜営業の店舗はありますか？",
      answer:
        "営業時間の掲載内容から深夜営業の候補となる店舗を整理しています。最新の受付時間は必ず店舗ページまたは公式サイトでご確認ください。"
    },
    {
      question: "口コミはどのように掲載されていますか？",
      answer: REVIEW_POLICY
    },
  ];
  if (includeBeginner) items.push({
      question: "初めてメンズエステを利用する場合の選び方は？",
      answer:
        "営業時間・料金・予約方法が分かりやすい店舗から比較し、公式サイトや店舗ページで最新情報を確認してから問い合わせることをおすすめします。「初心者向け」セクションも参考にしてください。"
    });
  return items;
}

export function AreaFaqSection({
  items,
  areaSlug
}: {
  items: Array<{ question: string; answer: string }>;
  areaSlug: string;
}) {
  if (items.length === 0) return null;

  return (
    <AreaHubSectionShell theme="faq" areaSlug={areaSlug} id="faq">
      <AreaHubSectionHeader theme="faq" areaSlug={areaSlug} ja="よくある質問" />
      <p className="area-hub-section__intro area-hub-section__intro--compact area-hub-section__intro--muted">
        よくある疑問をタップして確認できます。
      </p>
      <AreaHubFaqAccordion items={items} />
    </AreaHubSectionShell>
  );
}

export function AreaHubLocalGuideSection({ hubContext }: { hubContext: AreaHubContext }) {
  const guide = hubContext.localGuide;
  if (!guide || guide.items.length === 0) return null;

  return (
    <AreaHubSectionShell theme="guide" areaSlug={hubContext.slug} id="local-guide">
      <AreaHubSectionHeader theme="guide" areaSlug={hubContext.slug} ja={guide.title} />
      <p className="area-hub-section__intro area-hub-section__intro--compact">
        {guide.lead}
      </p>
      <div className="area-hub-guide-cards area-hub-local-guide-cards">
        {guide.items.map((item, index) => (
          <article key={item.title} className="area-hub-guide-card area-hub-local-guide-card">
            <span className="area-hub-guide-card__num">{index + 1}</span>
            <div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              {item.href ? (
                <Link href={item.href} className="area-hub-local-guide-card__link">
                  {item.linkLabel ?? "詳しく見る"}
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </AreaHubSectionShell>
  );
}

function useRankingBuckets(
  rankingShops: ShopView[],
  targetArea: Pick<AreaView, "slug" | "name">,
  precisionMode = false,
) {
  const lateNightShops = rankingShops.filter(isLateNightShop);
  const beginnerShops = rankingShops.filter(isBeginnerFriendlyShop);
  const stationShops = rankingShops.filter((shop) => (
    precisionMode ? hasPriorityStationWalk(shop) : isStationNearShop(shop, targetArea)
  ));
  const pricedShops = rankingShops.filter(hasPublishedPrice);
  const prices = rankingShops.map(extractShopConfirmedPriceYen).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const sortedRanking = sortShopsForRanking(rankingShops, targetArea);

  return {
    lateNightShops,
    beginnerShops,
    stationShops,
    pricedShops,
    minPrice,
    maxPrice,
    sortedRanking
  };
}

/** ファーストビュー直下：おすすめランキング TOP5 */
export function AreaHubRankingTop({
  rankingShops,
  targetArea,
  hubContext,
  rankingEntries = [],
  precisionMode = false,
}: {
  rankingShops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  hubContext: AreaHubContext;
  rankingEntries?: AreaShopRankingEntry[];
  precisionMode?: boolean;
}) {
  if (precisionMode) return null;
  const topFive = orderShopsForAreaRanking(rankingShops, targetArea, rankingEntries).slice(0, 5);

  if (topFive.length === 0) return null;

  const rankingIntro = buildRankingIntro(hubContext);
  const rankingBannerEnabled = isLayeredBannerSectionEnabled("ranking");

  return (
    <AreaHubSectionShell
      theme="ranking"
      areaSlug={targetArea.slug}
      id="ranking"
      banner={
        rankingBannerEnabled ? (
          <AreaHubThemeBanner
            hubTheme="ranking"
            areaSlug={targetArea.slug}
            message={hubContext.rankingTitle}
          />
        ) : undefined
      }
    >
      {!rankingBannerEnabled ? (
        <>
          <AreaHubSectionHeader
            theme="ranking"
            areaSlug={targetArea.slug}
            ja={hubContext.rankingTitle}
            hideIcon
          />
          <p className="area-hub-section__intro area-hub-section__intro--compact area-hub-section__intro--ranking">
            {rankingIntro}
          </p>
        </>
      ) : null}
      <div className="area-hub-ranking-context" aria-label="ランキングの基準">
        <p>
          掲載店舗の情報量、料金の分かりやすさ、営業時間、予約導線、更新状況をもとに編集部で整理しています。
          PR枠や口コミ件数とは分けて表示します。
        </p>
      </div>
      <RankingHeroCards shops={topFive} targetArea={targetArea} />
      <p className="area-hub-section__footnote">
        <a href="#compare-tabs">条件別ランキング</a>
        でも比較できます。
      </p>
    </AreaHubSectionShell>
  );
}

const TAB_BANNER_THEME: Partial<
  Record<"price" | "late-night" | "beginner" | "station", "price" | "lateNight" | "beginner" | "station">
> = {
  price: "price",
  "late-night": "lateNight",
  beginner: "beginner",
  station: "station"
};

function CompareTabPanel({
  theme,
  areaSlug,
  ja,
  intro,
  children
}: {
  theme: "price" | "late-night" | "beginner" | "station";
  areaSlug: string;
  ja: string;
  intro?: string;
  children: ReactNode;
}) {
  const bannerTheme = TAB_BANNER_THEME[theme];
  const useLayeredBanner = bannerTheme ? isLayeredBannerEnabled(bannerTheme) : false;

  const banner =
    useLayeredBanner && bannerTheme ? (
      <ThemeBanner
        themeKey={bannerTheme}
        message={ja}
        imageSrc={resolveThemeBannerCharacter(areaSlug, bannerTheme)}
      />
    ) : undefined;

  return (
    <AreaHubSectionShell
      theme={theme}
      areaSlug={areaSlug}
      banner={banner}
      className="area-hub-theme--tab-panel"
    >
      {!useLayeredBanner ? (
        <>
          <AreaHubSectionHeader theme={theme} areaSlug={areaSlug} ja={ja} />
          {intro ? (
            <p className="area-hub-section__intro area-hub-section__intro--compact">{intro}</p>
          ) : null}
        </>
      ) : intro ? (
        <p className="area-hub-section__intro area-hub-section__intro--compact">{intro}</p>
      ) : null}
      {children}
    </AreaHubSectionShell>
  );
}

/** 条件別タブ（料金比較・深夜・初心者・駅名・徒歩案内） */
export function AreaHubCompareTabsSections({
  rankingShops,
  targetArea,
  hubContext,
  precisionMode = false,
  capabilities = resolvePriorityAreaCapabilities(rankingShops, targetArea),
}: {
  rankingShops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  hubContext: AreaHubContext;
  precisionMode?: boolean;
  capabilities?: PriorityAreaCapabilities;
}) {
  const { lateNightShops, beginnerShops, stationShops, pricedShops, sortedRanking } =
    useRankingBuckets(rankingShops, targetArea, precisionMode);

  const priceTableTitle = hubContext.priceTableTitle;
  const specialtyPageSize = 5;

  const tabs: RankingTabItem[] = [];
  if (!precisionMode || pricedShops.length > 0) tabs.push({
      id: "price-table",
      label: "料金比較",
      content: (
        <CompareTabPanel theme="price" areaSlug={targetArea.slug} ja={priceTableTitle} intro="掲載店舗の料金目安を一覧で比較できます。">
          <RankingComparisonTable shops={pricedShops.length > 0 ? pricedShops : sortedRanking.slice(0, 15)} />
        </CompareTabPanel>
      ),
  });
  if (!precisionMode || lateNightShops.length > 0) tabs.push({
      id: "late-night",
      label: "深夜営業",
      content: (
        <CompareTabPanel theme="late-night" areaSlug={targetArea.slug} ja={`深夜営業の${hubContext.name}メンズエステ`}>
          {lateNightShops.length > 0 ? (
            <RankingSpecialtyPagedList shops={lateNightShops} targetArea={targetArea} variant="late-night" pageSize={specialtyPageSize} ariaLabel="深夜営業店舗のページ送り" />
          ) : (
            <p className="area-hub-section__empty">深夜営業候補を抽出できませんでした。店舗一覧から営業時間をご確認ください。</p>
          )}
        </CompareTabPanel>
      ),
  });
  if (!precisionMode || (capabilities.beginner && beginnerShops.length > 0)) tabs.push({
    id: "beginner",
    label: "初心者向け",
    content: (
      <CompareTabPanel theme="beginner" areaSlug={targetArea.slug} ja={`初心者におすすめの${hubContext.name}メンズエステ`}>
        {beginnerShops.length > 0 ? (
          <RankingSpecialtyPagedList shops={beginnerShops} targetArea={targetArea} variant="beginner" pageSize={specialtyPageSize} ariaLabel="初心者向け店舗のページ送り" />
        ) : (
          <p className="area-hub-section__empty">該当店舗の抽出に十分な情報がありません。</p>
        )}
      </CompareTabPanel>
    ),
  });
  if (!precisionMode || (capabilities.station && stationShops.length > 0)) tabs.push({
    id: "station",
    label: "駅名・徒歩案内あり",
    content: (
      <CompareTabPanel theme="station" areaSlug={targetArea.slug} ja={`駅名・徒歩案内がある${hubContext.name}メンズエステ`} intro={precisionMode ? "WordPressの専用駅名項目と徒歩情報が明示されている店舗だけを掲載しています。" : "WordPressの駅名と徒歩分数が明示されている店舗だけを掲載しています。"}>
        {stationShops.length > 0 ? (
          <RankingSpecialtyPagedList shops={stationShops} targetArea={targetArea} variant="station" pageSize={specialtyPageSize} ariaLabel="駅名・徒歩案内がある店舗のページ送り" />
        ) : (
          <p className="area-hub-section__empty">駅名と徒歩分数を確認できる店舗はありません。</p>
        )}
      </CompareTabPanel>
    ),
  });

  if (tabs.length === 0) return null;

  return (
    <>
      <div id="compare-tabs">
        <RankingTabs tabs={tabs} />
      </div>
    </>
  );
}

/** 料金相場・選び方 */
export function AreaHubPriceAndGuideSections({
  rankingShops,
  hubContext,
  precisionMode = false,
}: {
  rankingShops: ShopView[];
  hubContext: AreaHubContext;
  precisionMode?: boolean;
}) {
  const prices = rankingShops.map(extractShopConfirmedPriceYen).filter((p): p is number => p !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  return (
    <>
      {!precisionMode || prices.length > 0 ? (
      <AreaHubSectionShell theme="market" areaSlug={hubContext.slug} id="price-guide">
        <AreaHubSectionHeader
          theme="market"
          areaSlug={hubContext.slug}
          ja={`${hubContext.name}メンズエステの料金相場`}
        />
        {minPrice && maxPrice ? (
          <div className="area-hub-market-highlight">
            <p className="area-hub-market-highlight__label">掲載店舗の料金目安</p>
            <p className="area-hub-market-highlight__value">
              {minPrice.toLocaleString("ja-JP")}
              <span>円〜</span>
              {maxPrice.toLocaleString("ja-JP")}
              <span>円</span>
            </p>
          </div>
        ) : (
          <p className="area-hub-section__intro area-hub-section__intro--compact">
            料金相場の集計には十分な掲載データがありません。各店舗ページでご確認ください。
          </p>
        )}
      </AreaHubSectionShell>
      ) : null}

      {hubContext.guidePath ? (
        <AreaHubSectionShell theme="guide" areaSlug={hubContext.slug} id="how-to-choose">
          <AreaHubSectionHeader
            theme="guide"
            areaSlug={hubContext.slug}
            ja={`${hubContext.name}で失敗しない選び方`}
          />
          <div className="area-hub-guide-cards area-hub-guide-cards--compact">
            {GUIDE_POINTS.map((point, index) => (
              <article key={point.title} className="area-hub-guide-card area-hub-guide-card--compact">
                <span className="area-hub-guide-card__num">{index + 1}</span>
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="area-hub-section__intro area-hub-section__intro--compact">
            詳しくは
            <Link href={hubContext.guidePath}>
              {hubContext.name}メンズエステで失敗しない選び方ガイド
            </Link>
            をご覧ください。
          </p>
        </AreaHubSectionShell>
      ) : null}
    </>
  );
}

/** 条件別タブ〜FAQ（後方互換） */
export function AreaHubCompareAndGuideSections({
  rankingShops,
  targetArea,
  hubContext
}: {
  rankingShops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  hubContext: AreaHubContext;
}) {
  return (
    <>
      <AreaHubCompareTabsSections
        rankingShops={rankingShops}
        targetArea={targetArea}
        hubContext={hubContext}
      />
      <AreaHubPriceAndGuideSections rankingShops={rankingShops} hubContext={hubContext} />
      <AreaFaqSection items={buildFaqItems(hubContext)} areaSlug={hubContext.slug} />
    </>
  );
}

/** @deprecated 分割後は AreaHubRankingTop + AreaHubCompareAndGuideSections を使用 */
export function AreaHubRankingSections({
  rankingShops,
  targetArea,
  hubContext
}: {
  rankingShops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  hubContext: AreaHubContext;
}) {
  return (
    <>
      <AreaHubRankingTop rankingShops={rankingShops} targetArea={targetArea} hubContext={hubContext} />
      <AreaHubCompareAndGuideSections
        rankingShops={rankingShops}
        targetArea={targetArea}
        hubContext={hubContext}
      />
    </>
  );
}
