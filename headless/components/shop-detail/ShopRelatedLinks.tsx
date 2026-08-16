import Link from "next/link";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { ShopPrimaryAreaView } from "@/lib/wp/types";
import styles from "./ShopDetail.module.css";

export function ShopRelatedLinks({
  primaryArea,
  reviewSubmitUrl,
  shopSlug,
  shopTitle,
}: {
  primaryArea: ShopPrimaryAreaView | null;
  reviewSubmitUrl: string;
  shopSlug: string;
  shopTitle: string;
}) {
  const safeShopSlug = normalizePublicShopSlug(shopSlug);

  return (
    <nav className={styles.relatedLinks} aria-label={`${shopTitle}の関連ページ`}>
      {primaryArea ? (
        <Link href={`/area/${primaryArea.slug}/`}>
          {primaryArea.name}のメンズエステを探す
        </Link>
      ) : null}
      {safeShopSlug ? (
        <Link href={`/shops/${safeShopSlug}/reviews/`}>
          {shopTitle}の口コミ・体験を見る
        </Link>
      ) : null}
      <Link href="/reviews/">関西の口コミ・体験を探す</Link>
      <Link href={reviewSubmitUrl}>{shopTitle}の口コミを書く</Link>
    </nav>
  );
}
