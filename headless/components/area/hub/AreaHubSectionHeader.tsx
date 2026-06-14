import { AreaHubThemeIcon } from "@/components/area/hub/AreaHubThemeIcon";
import {
  getAreaHubThemeVisual,
  type AreaHubThemeKey
} from "@/lib/area-hub-visual-config";

export function AreaHubSectionHeader({
  theme,
  areaSlug,
  ja,
  en,
  hideIcon = false
}: {
  theme: AreaHubThemeKey;
  areaSlug: string;
  ja: string;
  en?: string;
  hideIcon?: boolean;
}) {
  const visual = getAreaHubThemeVisual(areaSlug, theme);
  const enLabel = en ?? visual.enLabel;

  return (
    <header className="area-hub-section-header">
      <div className="area-hub-section-header__row">
        {hideIcon ? null : (
          <AreaHubThemeIcon name={visual.icon} className="area-hub-section-header__icon" />
        )}
        <div className="area-hub-section-header__text">
          <span className="area-hub-section-header__en">{enLabel}</span>
          <h2 className="area-hub-section-header__ja">{ja}</h2>
        </div>
      </div>
      <span className="area-hub-section-header__line" aria-hidden="true" />
    </header>
  );
}
