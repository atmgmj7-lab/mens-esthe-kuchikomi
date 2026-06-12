import type { Metadata } from "next";
import { ShopCard } from "@/components/ShopCard";
import { pageMetadata } from "@/lib/seo";
import { getLatestShops } from "@/lib/wp/shops";

export const metadata: Metadata = pageMetadata({
  title: "店舗一覧",
  description: "関西メンズエステの掲載店舗一覧です。",
  path: "/shops/"
});

export default async function ShopsPage() {
  const shops = await getLatestShops(24);

  return (
    <main id="main_content" className="l-main_content l-article">
      <h1 className="sec-title es-sec-title-large">店舗一覧</h1>
      <section className="wolfman-list-container">
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} compact />
        ))}
      </section>
    </main>
  );
}
