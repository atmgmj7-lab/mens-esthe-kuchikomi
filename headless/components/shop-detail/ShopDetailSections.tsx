import Link from "next/link";
import type { ReactNode } from "react";
import { formatPriceForDisplay } from "@/lib/price-normalization";
import type { ShopDetailViewModel } from "@/lib/shop-detail-view-model";
import type { ShopReviewViewModel } from "@/lib/shop-review-view-model";
import { normalizePublicShopSlug } from "@/lib/shop-slug";
import type { ApprovedShopReviewResult } from "@/lib/wp/types";
import styles from "./ShopDetail.module.css";
import { ShopReviewDashboard } from "./ShopReviewDashboard";

type ShopDetailSectionsProps = {
  model: ShopDetailViewModel;
  reviewResult: ApprovedShopReviewResult;
  reviewModel: ShopReviewViewModel;
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

export function ShopDetailSections({
  model,
  reviewResult,
  reviewModel,
  reviewSubmitUrl,
  rel
}: ShopDetailSectionsProps) {
  const hasDescription = Boolean(
    model.catchText ||
      model.introductionText ||
      model.recommendText ||
      model.summaryText
  );
  const shopSlug = normalizePublicShopSlug(model.slug);
  const reviewPage = reviewResult.status === "available" ? reviewResult.page : null;
  const reviews = reviewPage?.reviews ?? [];

  return (
    <div className={styles.sections}>
      {hasDescription ? (
        <section id="overview" className={styles.section}>
          <SectionHeading en="ABOUT">この店舗について</SectionHeading>
          {model.catchText ? <p className={styles.catch}>{model.catchText}</p> : null}
          {model.introductionText ? <p className={styles.richText}>{model.introductionText}</p> : null}
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

      {model.prices.length > 0 ? (
        <section id="prices" className={styles.section}>
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

      {model.infoRows.length > 0 ? (
        <section id="hours-access" className={styles.section}>
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

      {model.featureNames.length > 0 ? (
        <section id="features" className={styles.section}>
          <SectionHeading en="FEATURES">特徴・設備</SectionHeading>
          <ul className={styles.features}>
            {model.featureNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section id="reviews" className={styles.section}>
        <SectionHeading en="USER REVIEWS">ユーザー口コミ</SectionHeading>
        <div className={styles.reviews}>
          <ShopReviewDashboard model={reviewModel} />
        </div>
        <p className={styles.sourceNote}>
          掲載情報コメント、店舗紹介文、出自を確認できない文章は口コミとして表示しません。
        </p>
        {reviewPage && reviewPage.total > reviews.length ? (
          <Link href={`/shops/${shopSlug}/reviews/`} className={styles.textLink}>
            承認済み口コミをすべて見る（{reviewPage.total}件）
          </Link>
        ) : null}
        <Link href={reviewSubmitUrl} className={styles.textLink}>
          この店舗の口コミを投稿する
        </Link>
      </section>
    </div>
  );
}
