import Link from "next/link";
import type { ReactNode } from "react";
import { formatPriceForDisplay } from "@/lib/price-normalization";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import styles from "./ShopDetail.module.css";

type ReviewItem = {
  id?: string | number | null;
  body: string;
  authorName?: string | null;
  submittedAt?: string | null;
};

type ShopDetailSectionsProps = {
  model: ShopDetailViewModel;
  reviews: ReviewItem[];
  reviewSubmitUrl: string;
  rel: string;
};

function SectionHeading({ en, children }: { en: string; children: ReactNode }) {
  return (
    <div className={styles.sectionHeading}>
      <p className={styles.kicker}>{en}</p>
      <h2>{children}</h2>
    </div>
  );
}

function reviewAuthor(authorName: string | null | undefined): string {
  return authorName?.trim() || "匿名";
}

export function ShopDetailSections({
  model,
  reviews,
  reviewSubmitUrl,
  rel
}: ShopDetailSectionsProps) {
  const hasDescription = Boolean(
    model.catchText ||
      model.introductionHtml ||
      model.recommendText ||
      model.summaryText
  );
  const shopSlug = normalizePublicShopSlug(model.slug);

  return (
    <div className={styles.sections}>
      {model.prices.length > 0 ? (
        <section id="shop-price" className={styles.section}>
          <SectionHeading en="PRICE">料金プラン</SectionHeading>
          <table className={styles.table}>
            <tbody>
              {model.prices.map(({ key, label, price }) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{formatPriceForDisplay(price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {hasDescription ? (
        <section className={styles.section}>
          <SectionHeading en="ABOUT">この店舗について</SectionHeading>
          {model.catchText ? <p className={styles.catch}>{model.catchText}</p> : null}
          {model.introductionHtml ? (
            <div
              className={styles.richText}
              dangerouslySetInnerHTML={{ __html: model.introductionHtml }}
            />
          ) : null}
          {model.recommendText ? <p>{model.recommendText}</p> : null}
          {model.summaryText ? (
            <div className={styles.sourceSeparated}>
              <strong>掲載情報コメント</strong>
              <p>{model.summaryText}</p>
              <small>公開情報をもとに整理した文章で、ユーザー口コミではありません。</small>
            </div>
          ) : null}
        </section>
      ) : null}

      {model.featureNames.length > 0 ? (
        <section className={styles.section}>
          <SectionHeading en="FEATURES">特徴・設備</SectionHeading>
          <ul className={styles.features}>
            {model.featureNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.infoRows.length > 0 ? (
        <section id="shop-data" className={styles.section}>
          <SectionHeading en="ACCESS & INFO">アクセス・基本情報</SectionHeading>
          <table className={styles.infoTable}>
            <tbody>
              {model.infoRows.map((row) => {
                const isOfficialLink = row.key === "official" && Boolean(row.href);
                return (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>
                      {isOfficialLink ? (
                        <a
                          href={row.href}
                          target="_blank"
                          rel={rel}
                          data-shop-cta-kind="official"
                          data-shop-cta-position="info"
                          data-shop-slug={shopSlug}
                        >
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {model.verifiedAt ? (
            <p className={styles.sourceNote}>掲載情報の確認日 {model.verifiedAt}</p>
          ) : null}
        </section>
      ) : null}

      <section id="shop-reviews" className={styles.section}>
        <SectionHeading en="USER REVIEWS">ユーザー口コミ</SectionHeading>
        {reviews.length > 0 ? (
          <div className={styles.reviews}>
            {reviews.map((review, index) => (
              <article key={review.id ?? index}>
                <p>{review.body}</p>
                <small>
                  {reviewAuthor(review.authorName)}
                  {review.submittedAt ? ` / ${review.submittedAt}` : ""}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p>この店舗の承認済みユーザー口コミはまだありません。</p>
        )}
        <p className={styles.sourceNote}>
          掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。
        </p>
        <Link href={reviewSubmitUrl} className={styles.textLink}>
          この店舗の口コミを投稿する
        </Link>
      </section>
    </div>
  );
}
