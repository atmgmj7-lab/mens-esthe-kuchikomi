import Link from "next/link";
import { LuxuryRichButton } from "@/components/common/LuxuryRichButton";
import { SectionTitle } from "@/components/SectionTitle";
import { AREA_FEATURES } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";

function areaCount(areas: AreaView[], slug: string): number | null {
  return areas.find((area) => area.slug === slug)?.count ?? null;
}

export function AreaFeatureSection({ areas = [] }: { areas?: AreaView[] }) {
  const features = AREA_FEATURES;

  return (
    <section className="l-section p-areaFeature escomi-final-feature-section hl-fade-in">
      <div className="l-container mep-container">
        <div className="p-areaFeature__header">
          <SectionTitle en="OSAKA FEATURED AREAS" jp="大阪の特集エリア" center />
          <p className="escomi-final-feature-section__lead">
            大阪で探されやすい主要エリアを、店舗数・料金・口コミの確認導線とあわせてまとめています。
          </p>
        </div>
        <div className="p-areaFeature__list escomi-final-feature-grid" aria-label="大阪の特集エリア">
          {features.map((feature) => {
            const featureHref = feature.href;
            const count = areaCount(areas, feature.slug);
            return (
              <article className="p-areaFeature__item escomi-final-feature-card hl-card-hover" key={feature.slug}>
                <div className="p-areaFeature__img escomi-final-feature-card__image">
                  <Link href={featureHref} className="c-card__thumb" aria-label={`${feature.title}を見る`}>
                    <img
                      src={feature.image}
                      alt={feature.imageAlt}
                      width={800}
                      height={450}
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                </div>
                <div className="p-areaFeature__body escomi-final-feature-card__body">
                  <span className="p-areaFeature__sub">{feature.subtitle}</span>
                  <h3 className="p-areaFeature__title">{feature.title}</h3>
                  <p className="p-areaFeature__desc">{feature.description}</p>
                  <dl className="escomi-final-feature-card__stats" aria-label={`${feature.title}の掲載状況`}>
                    <div>
                      <dt>掲載店舗</dt>
                      <dd>{count != null && count > 0 ? `${count}件` : "集計準備中"}</dd>
                    </div>
                    <div>
                      <dt>料金</dt>
                      <dd>各店舗詳細で確認</dd>
                    </div>
                    <div>
                      <dt>口コミ</dt>
                      <dd>承認制で掲載</dd>
                    </div>
                  </dl>
                  <div className="p-areaFeature__btnWrap">
                    <LuxuryRichButton href={featureHref}>{feature.btnText}</LuxuryRichButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
