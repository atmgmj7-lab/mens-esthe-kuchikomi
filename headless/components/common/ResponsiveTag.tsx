import type { ReactNode } from "react";

type ResponsiveTagTone = "neutral" | "gold" | "teal" | "muted" | "active";
type ResponsiveTagSize = "sm" | "md";

export function ResponsiveTag({
  as = "span",
  children,
  className = "",
  tone = "neutral",
  size = "sm"
}: {
  as?: "span" | "li";
  children: ReactNode;
  className?: string;
  tone?: ResponsiveTagTone;
  size?: ResponsiveTagSize;
}) {
  const tagClassName = [
    "escomi-tag",
    `escomi-tag--${tone}`,
    `escomi-tag--${size}`,
    className
  ].filter(Boolean).join(" ");

  if (as === "li") {
    return <li className={tagClassName}>{children}</li>;
  }

  return (
    <span className={tagClassName}>{children}</span>
  );
}

export function ResponsiveTagList({
  as = "div",
  children,
  className = "",
  ariaLabel
}: {
  as?: "div" | "ul";
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const tagListClassName = ["escomi-tag-list", className].filter(Boolean).join(" ");

  if (as === "ul") {
    return (
      <ul className={tagListClassName} aria-label={ariaLabel}>
        {children}
      </ul>
    );
  }

  return (
    <div className={tagListClassName} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
