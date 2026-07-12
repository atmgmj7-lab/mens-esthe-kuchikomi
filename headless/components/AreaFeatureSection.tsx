import { AreaFeatureSlider } from "@/components/AreaFeatureSlider";
import { SectionTitle } from "@/components/SectionTitle";
import { AREA_FEATURES, type AreaFeatureItem } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";

export function AreaFeatureSection({
  areas = [],
  features = AREA_FEATURES.map((feature) => ({ ...feature }))
}: {
  areas?: AreaView[];
  features?: AreaFeatureItem[];
}) {
  const visibleFeatures = features.length > 0 ? features : AREA_FEATURES.map((feature) => ({ ...feature }));

  return (
    <section className="l-section p-areaFeature escomi-final-feature-section hl-fade-in">
      <div className="l-container mep-container">
        <div className="p-areaFeature__header">
          <SectionTitle en="OSAKA FEATURED AREAS" jp="大阪の特集エリア" center />
          <p className="escomi-final-feature-section__lead">
            大阪で探されやすい主要エリアを、店舗数・料金・口コミの確認導線とあわせてまとめています。
          </p>
        </div>
        <AreaFeatureSlider areas={areas} features={visibleFeatures} />
      </div>
    </section>
  );
}
