import type { ReactElement } from "react";
import type { AreaHubIconName } from "@/lib/area-hub-visual-config";

const ICONS: Record<AreaHubIconName, ReactElement> = {
  hero: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.8 5.7 21l2.3-7-6-4.6h7.6L12 2z" fill="currentColor" />
    </svg>
  ),
  ranking: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 4h10v3H7V4zm-2 7h14v3H5v-3zm3 7h8v3H8v-3z" fill="currentColor" />
    </svg>
  ),
  price: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  "late-night": (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21 14.5A7.5 7.5 0 019.5 3 7 7 0 0021 14.5z" fill="currentColor" />
    </svg>
  ),
  beginner: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7L12 3z" fill="currentColor" />
    </svg>
  ),
  station: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5.5z" fill="currentColor" />
    </svg>
  ),
  reviews: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4h16v12H7l-3 3V4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  guide: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 4h12v16H6V4zm2 2v12h8V6H8zm1 2h6v2H9V8zm0 4h6v2H9v-2z" fill="currentColor" />
    </svg>
  ),
  faq: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor" />
    </svg>
  ),
  official: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 3H6a2 2 0 00-2 2v14l8-3 8 3V5a2 2 0 00-2-2z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  "shop-list": (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" fill="currentColor" />
    </svg>
  ),
  market: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 18h18v2H3v-2zm2-8h3v6H5v-6zm5 0h3v6h-3v-6zm5 0h3v6h-3v-6zM4 8l2-4h12l2 4H4z" fill="currentColor" />
    </svg>
  )
};

export function AreaHubThemeIcon({
  name,
  className = ""
}: {
  name: AreaHubIconName;
  className?: string;
}) {
  return (
    <span className={`area-hub-theme-icon ${className}`.trim()} aria-hidden="true">
      {ICONS[name]}
    </span>
  );
}
