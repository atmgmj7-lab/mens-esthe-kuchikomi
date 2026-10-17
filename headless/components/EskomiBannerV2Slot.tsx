import Link from "next/link";
import { ESKOMI_BANNER_V2, type EskomiBannerV2 } from "@/lib/eskomi-banner-v2";

/** Renders only a supplied and approved local image; pending banners remain absent. */
export function EskomiBannerV2Slot({ id }: { id: EskomiBannerV2["id"] }) {
  const banner = ESKOMI_BANNER_V2[id];
  if (banner.assetStatus !== "ready" || !banner.imageSrc || !banner.href) return null;
  return <aside className="hl-eskomi-banner-v2" aria-label={banner.title}>
    <img src={banner.imageSrc} alt="" />
    <div><h2>{banner.title}</h2><p>{banner.body}</p><Link href={banner.href}>{banner.cta}</Link></div>
  </aside>;
}
