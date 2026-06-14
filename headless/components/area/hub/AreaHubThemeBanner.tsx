import { ThemeBanner } from "@/components/area/hub/ThemeBanner";
import {
  mapHubThemeToBannerKey,
  resolveThemeBannerCharacter,
  type AreaHubThemeKey
} from "@/lib/area-hub-banner-config";

/** ハブセクション用：theme map からバナーを生成（ranking / lateNight / reviews 等に横展開） */
export function AreaHubThemeBanner({
  hubTheme,
  areaSlug,
  message,
  imageSrc,
  imageAlt = "",
  as = "div",
  id,
  className = ""
}: {
  hubTheme: AreaHubThemeKey;
  areaSlug: string;
  message: string;
  imageSrc?: string | null;
  imageAlt?: string;
  as?: "header" | "div";
  id?: string;
  className?: string;
}) {
  const themeKey = mapHubThemeToBannerKey(hubTheme);
  if (!themeKey) return null;

  const resolvedImage = imageSrc ?? resolveThemeBannerCharacter(areaSlug, themeKey);

  return (
    <ThemeBanner
      themeKey={themeKey}
      message={message}
      imageSrc={resolvedImage}
      imageAlt={imageAlt}
      as={as}
      id={id}
      className={className}
    />
  );
}
