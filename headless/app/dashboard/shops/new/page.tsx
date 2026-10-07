import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: "店舗を追加", description: "Operator向け店舗追加の入力契約", path: "/dashboard/shops/new/", robots: { index: false, follow: false } });

export default function DashboardNewShopPage() {
  return <section aria-labelledby="operator-shop-new-heading">
    <p>WordPress public source</p>
    <h2 id="operator-shop-new-heading">店舗を追加</h2>
    <p>新規店舗作成は、現在の限定WordPress Writerの対応範囲外です。公開状態・taxonomy・canonical URLを含む承認済みの作成契約ができるまで、この画面から作成・保存はできません。</p>
  </section>;
}
