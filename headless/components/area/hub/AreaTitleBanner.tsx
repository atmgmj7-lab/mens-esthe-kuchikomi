import type { AreaTitleBannerConfig } from "@/lib/area-title-banner-config";

function renderTitleLines(title: string) {
  const lines = title.split("\n");
  return lines.map((line, index) => (
    <span key={`${index}-${line}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

export function AreaTitleBanner({
  areaSlug,
  config
}: {
  areaSlug: string;
  config: AreaTitleBannerConfig;
}) {
  return (
    <section
      className={`area-title-banner area-title-banner--${areaSlug}`}
      aria-label={config.lead}
    >
      <picture className="area-title-banner__media">
        <source media="(max-width: 767px)" srcSet={config.spImage} />
        <img
          src={config.pcImage}
          alt=""
          className="area-title-banner__image"
          loading="eager"
          decoding="async"
        />
      </picture>

      <div className="area-title-banner__overlay" aria-hidden="true" />

      <div className="area-title-banner__content">
        <span className="area-title-banner__eyebrow">{config.eyebrow}</span>
        <p className="area-title-banner__title">{renderTitleLines(config.title)}</p>
        <p className="area-title-banner__lead">{config.lead}</p>
      </div>
    </section>
  );
}
