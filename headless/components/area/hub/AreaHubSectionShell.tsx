import type { ReactNode } from "react";
import {
  getAreaHubThemeVisual,
  type AreaHubThemeKey
} from "@/lib/area-hub-visual-config";

export function AreaHubSectionShell({
  theme,
  areaSlug,
  id,
  className = "",
  children,
  banner
}: {
  theme: AreaHubThemeKey;
  areaSlug: string;
  id?: string;
  className?: string;
  children: ReactNode;
  /** ThemeBanner 等をセクション上部に差し込む */
  banner?: ReactNode;
}) {
  const visual = getAreaHubThemeVisual(areaSlug, theme);

  return (
    <section
      id={id}
      className={`area-hub-section area-hub-theme ${visual.backgroundClass} ${className}`.trim()}
    >
      {banner ? <div className="area-hub-theme__banner-slot">{banner}</div> : null}
      <div className="area-hub-theme__inner">{children}</div>
    </section>
  );
}
