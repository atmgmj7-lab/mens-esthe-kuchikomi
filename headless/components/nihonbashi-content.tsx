/** @deprecated @/components/area/area-hub-content を使用してください */
import { AreaShopMiniCard } from "@/components/common/AreaShopMiniCard";
import type { ShopView } from "@/lib/wp/types";

export {
  REVIEW_POLICY,
  RANKING_CRITERIA,
  buildFaqItems,
  AreaFaqSection as NihonbashiFaqSection,
  AreaHubRankingSections as NihonbashiRankingSections
} from "@/components/area/area-hub-content";

const NIHONBASHI_AREA = { slug: "nihonbashi", name: "日本橋" } as const;

/** @deprecated AreaShopMiniCard を使用 */
export function RankingCard({ shop, rank }: { shop: ShopView; rank: number }) {
  return <AreaShopMiniCard shop={shop} rank={rank} targetArea={NIHONBASHI_AREA} />;
}

export const FAQ_ITEMS = [
  {
    question: "大阪日本橋のメンズエステはどこから探すのがおすすめですか？",
    answer:
      "日本橋・近鉄日本橋・なんば周辺の店舗を比較する場合は、日本橋エリアの店舗一覧ページのランキングと料金比較表から条件に合う店舗を絞り込むのがおすすめです。選び方のポイントは別ページのガイドも参考にしてください。"
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
    answer:
      "当サイトでは、ユーザー投稿口コミ、編集部コメント、実地確認レビューを分けて掲載しています。"
  },
  {
    question: "初めてメンズエステを利用する場合の選び方は？",
    answer:
      "営業時間・料金・予約方法が分かりやすい店舗から比較し、公式サイトや店舗ページで最新情報を確認してから問い合わせることをおすすめします。"
  }
];
