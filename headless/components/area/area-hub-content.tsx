import Link from "next/link";
import { EsSectionTitle } from "@/components/SectionTitle";
import { AreaShopMiniCard } from "@/components/common/AreaShopMiniCard";
import { AreaShopTable } from "@/components/common/AreaShopTable";
import {
  type AreaHubContext,
  extractShopPriceYen,
  hasPublishedPrice,
  isBeginnerFriendlyShop,
  isLateNightShop,
  isStationNearShop,
  sortShopsForRanking
} from "@/lib/area-shop-utils";
import type { AreaView, ShopView } from "@/lib/wp/types";

export const REVIEW_POLICY =
  "当サイトでは、ユーザー投稿口コミ、編集部コメント、実地確認レビューを分けて掲載しています。ユーザー投稿口コミは、実際に利用した方から投稿された内容を運営側で確認したうえで掲載しています。編集部コメントは、公式サイト・公開情報・料金・営業時間・アクセス・予約導線などをもとに、比較しやすいよう整理したものです。実地確認レビューは、実際に問い合わせ・来店・利用などを行った店舗のみ掲載しています。";

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

export function buildFaqItems(ctx: AreaHubContext) {
  const areaRef = ctx.slug === "nihonbashi" ? "大阪日本橋" : ctx.name;

  return [
    {
      question: `${areaRef}のメンズエステはどこから探すのがおすすめですか？`,
      answer:
        ctx.slug === "nihonbashi"
          ? "日本橋・近鉄日本橋・なんば周辺の店舗を比較する場合は、日本橋エリアの店舗一覧ページのランキングと料金比較表から条件に合う店舗を絞り込むのがおすすめです。選び方のポイントは別ページのガイドも参考にしてください。"
          : `${ctx.name}エリアの店舗一覧ページから、営業時間・料金・口コミを比較しながら条件に合う店舗を絞り込むのがおすすめです。`
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
    {
      question: "初めてメンズエステを利用する場合の選び方は？",
      answer:
        "営業時間・料金・予約方法が分かりやすい店舗から比較し、公式サイトや店舗ページで最新情報を確認してから問い合わせることをおすすめします。「初心者向け」セクションも参考にしてください。"
    }
  ];
}

export function AreaFaqSection({ items }: { items: Array<{ question: string; answer: string }> }) {
  return (
    <section className="area-hub-section" id="faq">
      <EsSectionTitle en="FAQ" ja="よくある質問" large />
      <dl className="area-hub-faq">
        {items.map((item) => (
          <div key={item.question} className="area-hub-faq__item">
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AreaHubRankingSections({
  rankingShops,
  targetArea,
  hubContext
}: {
  rankingShops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  hubContext: AreaHubContext;
}) {
  const lateNightShops = rankingShops.filter(isLateNightShop);
  const beginnerShops = rankingShops.filter(isBeginnerFriendlyShop);
  const stationShops = rankingShops.filter((s) => isStationNearShop(s, targetArea));
  const pricedShops = rankingShops.filter(hasPublishedPrice);
  const prices = rankingShops.map(extractShopPriceYen).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const sortedRanking = sortShopsForRanking(rankingShops, targetArea);
  const topRanking = sortedRanking.slice(0, 10);

  const rankingTitle =
    targetArea.slug === "nihonbashi"
      ? "大阪日本橋メンズエステおすすめランキング"
      : `${hubContext.name}メンズエステおすすめランキング`;

  const priceTableTitle =
    targetArea.slug === "nihonbashi"
      ? "日本橋メンズエステ料金比較表"
      : `${hubContext.name}メンズエステ料金比較表`;

  return (
    <>
      <section className="area-hub-section" id="ranking">
        <EsSectionTitle en="RANKING" ja={rankingTitle} large />
        <p className="area-hub-section__intro">
          公開情報・営業時間・料金掲載状況・公式サイトの有無などをもとに、比較しやすい順で掲載しています。
          順位は編集部の表示用であり、利用者の満足度や口コミ評価を保証するものではありません。
        </p>
        <ul className="area-hub-criteria">
          {RANKING_CRITERIA.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="area-mini-card-list">
          {topRanking.map((shop, index) => (
            <AreaShopMiniCard
              key={shop.id}
              shop={shop}
              rank={index + 1}
              targetArea={targetArea}
            />
          ))}
        </div>
      </section>

      <section className="area-hub-section" id="price-table">
        <EsSectionTitle en="PRICE" ja={priceTableTitle} large />
        <p className="area-hub-section__intro">
          掲載店舗の料金目安を一覧で比較できます。未掲載の店舗は「要確認」と表示しています。
        </p>
        <AreaShopTable shops={pricedShops.length > 0 ? pricedShops : sortedRanking.slice(0, 15)} />
      </section>

      <section className="area-hub-section" id="late-night">
        <EsSectionTitle
          en="LATE NIGHT"
          ja={`深夜営業の${hubContext.name}メンズエステ`}
          large
        />
        {lateNightShops.length > 0 ? (
          <div className="area-mini-card-list">
            {lateNightShops.slice(0, 8).map((shop, index) => (
              <AreaShopMiniCard
                key={shop.id}
                shop={shop}
                rank={index + 1}
                targetArea={targetArea}
              />
            ))}
          </div>
        ) : (
          <p className="area-hub-section__empty">
            営業時間の掲載から深夜営業候補を抽出できませんでした。店舗一覧から営業時間をご確認ください。
          </p>
        )}
      </section>

      <section className="area-hub-section" id="beginner">
        <EsSectionTitle
          en="BEGINNER"
          ja={`初心者におすすめの${hubContext.name}メンズエステ`}
          large
        />
        <p className="area-hub-section__intro">
          営業時間・料金・公式サイト・予約導線・編集部コメントなど、初めての方が比較しやすい情報が揃っている店舗を掲載しています。
        </p>
        {beginnerShops.length > 0 ? (
          <div className="area-mini-card-list">
            {beginnerShops.slice(0, 8).map((shop, index) => (
              <AreaShopMiniCard
                key={shop.id}
                shop={shop}
                rank={index + 1}
                targetArea={targetArea}
              />
            ))}
          </div>
        ) : (
          <p className="area-hub-section__empty">該当店舗の抽出に十分な情報がありません。</p>
        )}
      </section>

      <section className="area-hub-section" id="station">
        <EsSectionTitle en="ACCESS" ja={`駅近の${hubContext.name}メンズエステ`} large />
        <p className="area-hub-section__intro">
          {targetArea.slug === "nihonbashi"
            ? "日本橋・近鉄日本橋・なんば・谷町九丁目徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。"
            : "駅名や徒歩表記が掲載情報に含まれる店舗を整理しています。"}
        </p>
        {stationShops.length > 0 ? (
          <div className="area-mini-card-list">
            {stationShops.slice(0, 8).map((shop, index) => (
              <AreaShopMiniCard
                key={shop.id}
                shop={shop}
                rank={index + 1}
                targetArea={targetArea}
              />
            ))}
          </div>
        ) : (
          <p className="area-hub-section__empty">駅近候補の店舗情報を確認中です。</p>
        )}
      </section>

      <section className="area-hub-section" id="official">
        <EsSectionTitle en="OFFICIAL" ja="公式サイト掲載ありの店舗" large />
        {rankingShops.filter((s) => s.officialUrl).length > 0 ? (
          <AreaShopTable shops={rankingShops.filter((s) => s.officialUrl).slice(0, 10)} />
        ) : (
          <p className="area-hub-section__empty">公式サイトURLが掲載されている店舗は準備中です。</p>
        )}
      </section>

      <section className="area-hub-section" id="price-guide">
        <EsSectionTitle en="MARKET" ja={`${hubContext.name}メンズエステの料金相場`} large />
        {minPrice && maxPrice ? (
          <p className="area-hub-section__intro">
            掲載店舗の料金目安はおおむね
            <strong>
              {minPrice.toLocaleString("ja-JP")}円〜{maxPrice.toLocaleString("ja-JP")}円
            </strong>
            の範囲です。コース・時間帯により異なるため、来店前に店舗ページで最新料金をご確認ください。
          </p>
        ) : (
          <p className="area-hub-section__intro">
            料金相場の集計には十分な掲載データがありません。各店舗ページまたは公式サイトで料金をご確認ください。
          </p>
        )}
      </section>

      {hubContext.guidePath ? (
        <section className="area-hub-section" id="how-to-choose">
          <EsSectionTitle en="GUIDE" ja={`${hubContext.name}で失敗しない選び方`} large />
          <div className="area-hub-guide-cards">
            <article className="area-hub-guide-card">
              <h3>① 営業時間と最終受付を先に確認</h3>
              <p>
                仕事帰りの利用を想定する場合、営業時間だけでなく最終受付の有無も店舗ページで確認してください。
              </p>
            </article>
            <article className="area-hub-guide-card">
              <h3>② 料金は「目安」として比較</h3>
              <p>
                コースやオプションで料金が変わるため、比較表の金額は参考値として扱い、予約前に公式情報で確定させてください。
              </p>
            </article>
            <article className="area-hub-guide-card">
              <h3>③ 予約導線が分かる店舗から検討</h3>
              <p>
                公式サイトや電話番号が掲載されている店舗は、初めての方でも問い合わせしやすい傾向があります。
              </p>
            </article>
            <article className="area-hub-guide-card">
              <h3>④ 口コミと編集部コメントを分けて見る</h3>
              <p>
                体験談（口コミ）と、公開情報を整理した編集部コメントは性質が異なります。両方を参考に判断してください。
              </p>
            </article>
          </div>
          <p className="area-hub-section__intro">
            より詳しい選び方は
            <Link href={hubContext.guidePath}>
              {hubContext.name}メンズエステで失敗しない選び方ガイド
            </Link>
            もご覧ください。
          </p>
        </section>
      ) : null}

      <AreaFaqSection items={buildFaqItems(hubContext)} />
    </>
  );
}
