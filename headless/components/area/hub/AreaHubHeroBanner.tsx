import { ThemeBanner } from "@/components/area/hub/ThemeBanner";
import { resolveAreaHeroBanner } from "@/lib/area-hub-banner-config";

/** @deprecated 直接 ThemeBanner + resolveAreaHeroBanner を使用 */
export function AreaHubHeroBanner({ areaSlug }: { areaSlug: string }) {
  const hero = resolveAreaHeroBanner(areaSlug);

  return (
    <ThemeBanner
      themeKey="areaHero"
      message={hero.message}
      imageSrc={hero.imageSrc}
      imageAlt={hero.imageAlt}
    />
  );
}
