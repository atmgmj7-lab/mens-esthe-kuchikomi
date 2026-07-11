import { PROMOTION_DISCLOSURE_LABEL, PROMOTION_SECTION_NOTE } from "@/lib/promotion-disclosure";

export function PromotionDisclosureBadge({ className = "" }: { className?: string }) {
  return (
    <span className={["promotion-disclosure-badge", className].filter(Boolean).join(" ")} aria-label="PR広告">
      {PROMOTION_DISCLOSURE_LABEL}
    </span>
  );
}

export function PromotionDisclosureNote({ className = "" }: { className?: string }) {
  return <p className={["promotion-disclosure-note", className].filter(Boolean).join(" ")}>{PROMOTION_SECTION_NOTE}</p>;
}
