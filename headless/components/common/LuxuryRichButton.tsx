import Link from "next/link";
import type { ReactNode } from "react";

type LuxuryRichButtonProps = {
  href: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function LuxuryRichButton({
  href,
  children,
  className = "",
  compact = false
}: LuxuryRichButtonProps) {
  return (
    <Link
      href={href}
      className={`mep-luxury-rich-btn${compact ? " mep-luxury-rich-btn--compact" : ""} ${className}`.trim()}
    >
      <span className="mep-luxury-rich-btn__text">{children}</span>
      <i className="mep-luxury-rich-btn__icon" aria-hidden="true">
        ›
      </i>
    </Link>
  );
}
