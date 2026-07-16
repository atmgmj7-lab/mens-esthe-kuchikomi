import Link from "next/link";
import { buildShopOwnerRequestUrl } from "@/lib/shop-owner-request-links";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { ShopView } from "@/lib/wp/types";
import styles from "./ShopDetail.module.css";

export function ShopOwnerCta({
  shop
}: {
  shop: Pick<ShopView, "id" | "slug" | "title">;
}) {
  const shopSlug = normalizePublicShopSlug(shop.slug);
  const href = shopSlug
    ? buildShopOwnerRequestUrl({ ...shop, slug: shopSlug })
    : "/storelisting/#shop-owner-request";

  return (
    <section className={styles.ownerCta} aria-labelledby="shop-owner-heading">
      <div>
        <p className={styles.kicker}>FOR SHOP OWNER</p>
        <h2 id="shop-owner-heading" className={styles.ownerHeading}>
          このページを、公式情報で完成させませんか？
        </h2>
        <p>
          写真URL・料金・設備・店舗紹介・予約先を登録・修正できます。申請内容は公開前に確認し、承認された情報だけを反映します。申請だけで自動公開されることはありません。
        </p>
      </div>
      <Link
        href={href}
        data-shop-cta-kind="owner"
        data-shop-cta-position="owner-band"
        data-shop-slug={shopSlug}
      >
        掲載情報を登録・修正する
      </Link>
    </section>
  );
}
