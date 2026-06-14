"use client";

import { useState } from "react";

export function ThemeBannerCharacter({
  src,
  alt,
  eager = false
}: {
  src: string;
  alt: string;
  eager?: boolean;
}) {
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  return (
    <div className="theme-banner__character" aria-hidden={alt ? undefined : true}>
      <div className="theme-banner__character-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="theme-banner__character-img"
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setHidden(true)}
        />
      </div>
    </div>
  );
}
