import type { CSSProperties } from "react";
import { ThemeBannerCharacter } from "@/components/area/hub/ThemeBannerCharacter";
import {
  getThemeBannerStyle,
  type ThemeBannerKey
} from "@/lib/area-hub-banner-config";

export function ThemeBanner({
  themeKey,
  message,
  imageSrc,
  imageAlt = "",
  className = "",
  as = "div",
  id
}: {
  themeKey: ThemeBannerKey;
  message: string;
  imageSrc?: string | null;
  imageAlt?: string;
  className?: string;
  as?: "header" | "div";
  id?: string;
}) {
  const style = getThemeBannerStyle(themeKey);
  const Tag = as;
  const isAreaHero = themeKey === "areaHero";

  const bannerStyle = {
    ["--theme-banner-char-align" as string]:
      style.characterAlign === "left" ? "flex-start" : "flex-end"
  } as CSSProperties;

  return (
    <Tag
      id={id}
      className={`theme-banner ${style.cssClass} theme-banner--size-${style.size} theme-banner--intensity-${style.decorativeIntensity} ${isAreaHero ? "theme-banner--minimal" : ""} ${className}`.trim()}
      style={bannerStyle}
    >
      <div className="theme-banner__background" aria-hidden="true" />
      {!isAreaHero ? (
        <div className="theme-banner__decor" aria-hidden="true">
          <span className="theme-banner__corner theme-banner__corner--tl" />
          <span className="theme-banner__corner theme-banner__corner--br" />
          <span className="theme-banner__ribbon" />
          <span className="theme-banner__sparkle theme-banner__sparkle--a" />
          <span className="theme-banner__sparkle theme-banner__sparkle--b" />
          <span className="theme-banner__sparkle theme-banner__sparkle--c" />
        </div>
      ) : null}

      <div className="theme-banner__layout">
        <div className="theme-banner__content">
          <p className="theme-banner__message">{message}</p>
        </div>

        {imageSrc ? (
          <ThemeBannerCharacter
            src={imageSrc}
            alt={imageAlt}
            eager={isAreaHero}
          />
        ) : null}
      </div>
    </Tag>
  );
}
