import Link from "next/link";
import { AREA_FEATURE } from "@/lib/design-constants";
import { SectionTitle } from "@/components/SectionTitle";

export function AreaFeatureSection() {
  return (
    <section className="l-section p-areaFeature hl-fade-in">
      <div className="l-container mep-container">
        <div className="p-areaFeature__header">
          <SectionTitle en="AREA FEATURE" jp="エリア特集" center />
        </div>
        <div className="p-areaFeature__list">
          <div className="p-areaFeature__item hl-card-hover">
            <div className="p-areaFeature__img">
              <Link href={`/area/${AREA_FEATURE.slug}/`} className="c-card__thumb">
                <img src={AREA_FEATURE.image} alt={AREA_FEATURE.title} />
              </Link>
            </div>
            <div className="p-areaFeature__body">
              <span className="p-areaFeature__sub">{AREA_FEATURE.subtitle}</span>
              <h3 className="p-areaFeature__title">{AREA_FEATURE.title}</h3>
              <p className="p-areaFeature__desc">{AREA_FEATURE.description}</p>
              <div className="p-areaFeature__btnWrap">
                <Link href={`/area/${AREA_FEATURE.slug}/`} className="p-areaFeature__richBtn">
                  <span className="richBtn-text">{AREA_FEATURE.btnText}</span>
                  <i className="icon-chevron-right" aria-hidden="true">
                    ›
                  </i>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
