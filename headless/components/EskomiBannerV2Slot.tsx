import Link from "next/link";
import { ESKOMI_BANNER_V2, type EskomiBannerV2 } from "@/lib/eskomi-banner-v2";

/** Renders only a source image whose destination is ready; pending banners remain absent. */
export function EskomiBannerV2Slot({ id, href }: { id: EskomiBannerV2["id"]; href?: string }) {
  const banner = ESKOMI_BANNER_V2[id];
  const resolvedHref = href ?? banner.href;
  if (banner.assetStatus !== "ready" || !banner.imageSrc || !resolvedHref) return null;
  return <aside className="hl-eskomi-banner-v2">
    <Link href={resolvedHref} aria-label={banner.title}>
      <img src={banner.imageSrc} alt="" />
    </Link>
  </aside>;
}
