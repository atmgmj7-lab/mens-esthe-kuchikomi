import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AreaQuickLinks } from "@/components/AreaQuickLinks";
import { EmptyState } from "@/components/EmptyState";
import { RoutePageFallback } from "@/components/RoutePageFallback";
import { ShopCard } from "@/components/ShopCard";
import { ShopsSearchForm } from "@/components/ShopsSearchForm";
import { pageMetadata } from "@/lib/seo";
import { getAreas } from "@/lib/wp/areas";
import { filterShops, hasActiveShopFilters, type ShopFilterParams } from "@/lib/wp/shop-filter";
import { getAllShopsForListing } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "店舗一覧",
  description: "関西メンズエステの掲載店舗一覧です。キーワード・エリア・出勤状況で絞り込めます。",
  path: "/shops/"
});

type Props = {
  searchParams: Promise<ShopFilterParams>;
};

function describeFilters(params: ShopFilterParams, areas: { slug: string; name: string }[]) {
  const parts: string[] = [];
  if (params.q?.trim()) parts.push(`「${params.q.trim()}」`);
  if (params.area?.trim()) {
    const area = areas.find((item) => item.slug === params.area?.trim());
    parts.push(area ? `${area.name}エリア` : `エリア:${params.area}`);
  }
  if (params.available === "1") parts.push("出勤中");
  return parts.join(" · ");
}

export default function ShopsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<RoutePageFallback variant="shops-list" />}>
      <ShopsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ShopsPageContent({ searchParams }: Props) {
  const params = await searchParams;
  const [allShops, areas] = await Promise.all([getAllShopsForListing(500), getAreas()]);
  const filtered = filterShops(allShops, params);
  const active = hasActiveShopFilters(params);
  const filterLabel = describeFilters(params, areas);

  return (
    <main id="main_content" className="l-main_content l-article hl-shops-page">
      <div className="l-main_content__inner">
        <h1 className="sec-title es-sec-title-large">店舗一覧</h1>
        <p className="hl-shops-page__lead">
          関西エリアのメンズエステ店舗を、キーワード・エリア・出勤状況から探せます。
        </p>

        <ShopsSearchForm areas={areas} params={params} />

        <AreaQuickLinks areas={areas} current={params.area} className="u-mb-30" />

        <div className="hl-shops-result-bar">
          <p className="hl-shops-result-bar__count">
            <strong>{filtered.length}</strong>件
            {active && filterLabel ? <span className="hl-shops-result-bar__filters">（{filterLabel}）</span> : null}
          </p>
          {active ? (
            <Link href="/shops/" className="hl-shops-result-bar__clear">
              条件をクリア
            </Link>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="該当する店舗が見つかりませんでした"
            text={
              active
                ? "検索条件を変更するか、条件をクリアして再度お探しください。エリアページから探すこともできます。"
                : "掲載店舗の準備中です。しばらくしてから再度ご確認ください。"
            }
          />
        ) : (
          <section className="wolfman-list-container">
            {filtered.map((shop) => (
              <ShopCard key={shop.id} shop={shop} compact />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
