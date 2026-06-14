import { LuxuryRichButton } from "@/components/common/LuxuryRichButton";
import type { HomeFeatureBannerConfig } from "@/lib/home-feature-banner-config";

export type HomeFeatureBannerProps = HomeFeatureBannerConfig;

export function HomeFeatureBanner({
  eyebrow,
  title,
  lead,
  ctaLabel,
  ctaHref,
  pcImage,
  spImage
}: HomeFeatureBannerProps) {
  return (
    <section className="home-feature-banner" aria-label={title}>
      <picture className="home-feature-banner__media">
        <source media="(max-width: 767px)" srcSet={spImage} />
        <img
          src={pcImage}
          alt=""
          className="home-feature-banner__image"
          loading="lazy"
          decoding="async"
        />
      </picture>

      <div className="home-feature-banner__overlay" aria-hidden="true" />

      <div className="home-feature-banner__content">
        <span className="home-feature-banner__eyebrow">{eyebrow}</span>
        <h2 className="home-feature-banner__title">{title}</h2>
        {lead ? <p className="home-feature-banner__lead">{lead}</p> : null}
        <LuxuryRichButton href={ctaHref} compact className="home-feature-banner__cta">
          {ctaLabel}
        </LuxuryRichButton>
      </div>
    </section>
  );
}
