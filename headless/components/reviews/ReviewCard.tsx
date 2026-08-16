import Link from "next/link";
import type { ApprovedGlobalReview } from "@/lib/wp/types";
import styles from "./ReviewsHub.module.css";

function reviewExcerpt(body: string, maxLength = 180): string {
  const normalized = body.replace(/\s+/gu, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function formatDate(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export function ReviewCard({ review, compact = false }: {
  review: ApprovedGlobalReview;
  compact?: boolean;
}) {
  const areas = [...new Map(review.areas.map((area) => [area.slug, area])).values()];
  const date = formatDate(review.submittedAt);

  return (
    <article className={`${styles.reviewCard}${compact ? ` ${styles.reviewCardCompact}` : ""}`} data-review-card="approved-user">
      <header className={styles.reviewCardHeader}>
        <span className={styles.provenance}>承認済みユーザー口コミ</span>
        {date ? <time dateTime={review.submittedAt ?? undefined}>{date}</time> : null}
      </header>
      {review.ratings.total !== null ? (
        <p className={styles.rating} aria-label={`総合評価 ${review.ratings.total}／5`}>
          <span aria-hidden="true">★</span> {review.ratings.total}.0
        </p>
      ) : null}
      <p className={styles.reviewBody}>{reviewExcerpt(review.body)}</p>
      <footer className={styles.reviewRelations}>
        <Link href={`/shops/${review.shop.slug}/`}>{review.shop.name}の店舗情報を見る</Link>
        {areas.map((area) => (
          <Link href={`/area/${area.slug}/`} key={area.slug}>{area.name}のメンズエステを探す</Link>
        ))}
      </footer>
    </article>
  );
}
