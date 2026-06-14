import Link from "next/link";
import type { HomeHeroCta } from "@/lib/home-hero-config";

function renderTitleLines(title: string) {
  const lines = title.split("\n");
  return lines.map((line, index) => (
    <span key={`${index}-${line}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

export type ResponsiveHeroBannerProps = {
  className?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  pcImage: string;
  spImage: string;
  ctas?: HomeHeroCta[];
  shopCount?: number;
};

export function ResponsiveHeroBanner({
  className = "",
  eyebrow,
  title,
  lead,
  pcImage,
  spImage,
  ctas = [],
  shopCount
}: ResponsiveHeroBannerProps) {
  const rootClass = ["home-hero-banner", className].filter(Boolean).join(" ");

  return (
    <section className={rootClass} aria-label={lead || title}>
      <picture className="home-hero-banner__media">
        <source media="(max-width: 767px)" srcSet={spImage} />
        <img
          src={pcImage}
          alt=""
          className="home-hero-banner__image"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      <div className="home-hero-banner__overlay" aria-hidden="true" />

      <div className="home-hero-banner__content">
        <span className="home-hero-banner__eyebrow">{eyebrow}</span>
        <p className="home-hero-banner__title">{renderTitleLines(title)}</p>
        {lead ? <p className="home-hero-banner__lead">{lead}</p> : null}
        {typeof shopCount === "number" && shopCount > 0 ? (
          <p className="home-hero-banner__count">
            掲載店舗数 <strong>{shopCount.toLocaleString("ja-JP")}</strong> 店
          </p>
        ) : null}
        {ctas.length > 0 ? (
          <div className="home-hero-banner__actions">
            {ctas.map((cta) => (
              <Link
                key={cta.href + cta.label}
                href={cta.href}
                className={[
                  "home-hero-banner__button",
                  cta.variant === "primary"
                    ? "home-hero-banner__button--primary"
                    : "home-hero-banner__button--outline",
                  cta.mobileHidden ? "home-hero-banner__button--desktop-only" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {cta.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
