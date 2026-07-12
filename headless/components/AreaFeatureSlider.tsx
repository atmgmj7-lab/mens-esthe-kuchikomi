"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AreaFeatureItem } from "@/lib/design-constants";
import type { AreaView } from "@/lib/wp/types";

function areaCount(areas: AreaView[], slug: string): number | null {
  return areas.find((area) => area.slug === slug)?.count ?? null;
}

function cardStep(track: HTMLDivElement): number {
  const card = track.querySelector<HTMLElement>(".escomi-final-feature-card");
  if (!card) return track.clientWidth;
  const style = window.getComputedStyle(track);
  const gap = Number.parseFloat(style.columnGap || style.gap || "0") || 0;
  return card.offsetWidth + gap;
}

function loopIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

function scrollLeftForIndex(track: HTMLDivElement, index: number): number {
  const step = Math.max(1, cardStep(track));
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  return Math.min(maxScroll, step * index);
}

function currentSlideIndex(track: HTMLDivElement, total: number): number {
  const step = Math.max(1, cardStep(track));
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  if (track.scrollLeft >= maxScroll - 8) return Math.max(0, total - 1);
  return Math.min(Math.max(0, total - 1), Math.max(0, Math.round(track.scrollLeft / step)));
}

export function AreaFeatureSlider({
  areas,
  features
}: {
  areas: AreaView[];
  features: AreaFeatureItem[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const programmaticTargetRef = useRef<number | null>(null);
  const programmaticTimerRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleFeatures = useMemo(
    () => features.filter((feature) => feature.slug && feature.title),
    [features]
  );

  const updateState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const programmaticTarget = programmaticTargetRef.current;
    if (programmaticTarget !== null) {
      const targetLeft = scrollLeftForIndex(track, programmaticTarget);
      if (Math.abs(track.scrollLeft - targetLeft) > 6) {
        setActiveIndex(programmaticTarget);
        return;
      }
      programmaticTargetRef.current = null;
    }

    setActiveIndex(currentSlideIndex(track, visibleFeatures.length));
  }, [visibleFeatures.length]);

  const markProgrammaticTarget = useCallback((targetIndex: number) => {
    programmaticTargetRef.current = targetIndex;
    if (programmaticTimerRef.current !== null) {
      window.clearTimeout(programmaticTimerRef.current);
    }
    programmaticTimerRef.current = window.setTimeout(() => {
      programmaticTargetRef.current = null;
      updateState();
    }, 700);
  }, [updateState]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    updateState();
    track.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);

    return () => {
      track.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
    };
  }, [updateState]);

  const scrollByDirection = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    const total = visibleFeatures.length;
    if (!track || total <= 1) return;

    const currentIndex = loopIndex(activeIndex, total);
    const targetIndex = loopIndex(currentIndex + direction, total);
    const wraps = (direction === -1 && currentIndex === 0) || (direction === 1 && currentIndex === total - 1);

    markProgrammaticTarget(targetIndex);
    track.scrollTo({
      left: scrollLeftForIndex(track, targetIndex),
      behavior: wraps ? "auto" : "smooth"
    });
    setActiveIndex(targetIndex);
  }, [activeIndex, markProgrammaticTarget, visibleFeatures.length]);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    const targetIndex = loopIndex(index, visibleFeatures.length);
    if (!track || visibleFeatures.length <= 0) return;
    markProgrammaticTarget(targetIndex);
    track.scrollTo({ left: scrollLeftForIndex(track, targetIndex), behavior: "smooth" });
    setActiveIndex(targetIndex);
  }, [markProgrammaticTarget, visibleFeatures.length]);

  const hasMultipleFeatures = visibleFeatures.length > 1;

  return (
    <div className="escomi-final-feature-slider">
      <div className="escomi-final-feature-slider__controls" aria-label="大阪の特集エリアスライダー操作">
        <button
          type="button"
          className="escomi-final-feature-slider__arrow"
          onClick={() => scrollByDirection(-1)}
          disabled={!hasMultipleFeatures}
          aria-label="前のエリアを見る"
        >
          ‹
        </button>
        <button
          type="button"
          className="escomi-final-feature-slider__arrow"
          onClick={() => scrollByDirection(1)}
          disabled={!hasMultipleFeatures}
          aria-label="次のエリアを見る"
        >
          ›
        </button>
      </div>

      <div
        ref={trackRef}
        className="p-areaFeature__list escomi-final-feature-grid"
        aria-label="大阪の特集エリア"
        role="list"
      >
        {visibleFeatures.map((feature) => {
          const count = areaCount(areas, feature.slug);
          const cardStyle = feature.image
            ? ({ ["--area-feature-image" as string]: `url("${feature.image}")` } as CSSProperties)
            : undefined;

          return (
            <article
              className="p-areaFeature__item escomi-final-feature-card hl-card-hover"
              key={feature.slug}
              role="listitem"
              style={cardStyle}
            >
              <Link className="escomi-final-feature-card__media" href={feature.href} aria-label={`${feature.title}を見る`}>
                {feature.image ? (
                  <img
                    src={feature.image}
                    alt={feature.imageAlt}
                    width={720}
                    height={405}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="escomi-final-feature-card__mediaFallback">{feature.subtitle}</span>
                )}
              </Link>

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
                  <Link className="escomi-final-feature-card__cta" href={feature.href}>
                    {feature.btnText}
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="escomi-final-feature-slider__dots" aria-label="大阪の特集エリアスライド位置">
        {visibleFeatures.map((feature, index) => (
          <button
            type="button"
            key={feature.slug}
            className={index === activeIndex ? "is-active" : ""}
            onClick={() => scrollToIndex(index)}
            aria-label={`${feature.subtitle}へ移動`}
            aria-current={index === activeIndex ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
