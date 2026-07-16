import Link from "next/link";
import { ShopRankCell } from "@/components/common/ShopRankCell";
import {
  SHOP_FALLBACK_IMAGE_STYLE
} from "@/lib/design-constants";
import {
  buildAreaShopCardViewModel
} from "@/lib/area-shop-card-view-model";
import {
  groupShopsByRelation,
  primaryGroupTitle,
  secondaryGroupTitle
} from "@/lib/area-shop-utils";
import type { AreaView, ShopView } from "@/lib/wp/types";
import styles from "./AreaShopCard.module.css";

type AreaShopCardProps = {
  shop: ShopView;
  targetArea: Pick<AreaView, "slug" | "name">;
  rank?: number | null;
  showRank?: boolean;
};

export function AreaShopCard({
  shop,
  targetArea,
  rank = null,
  showRank = Boolean(rank)
}: AreaShopCardProps) {
  const model = buildAreaShopCardViewModel(shop, targetArea, {
    rank,
    showRank,
    summarySource: "wordpress-only",
    maxActions: 2
  });
  const cardClassName = [styles.card, model.rank ? "" : styles.cardNoRank]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName} data-area-shop-card="true">
      <div className={styles.rankSlot}>
        {model.rank ? <ShopRankCell rank={model.rank} className={styles.rank} /> : null}
      </div>

      <header className={styles.header}>
        <h3 className={styles.title}>
          <Link href={model.title.href} className={styles.titleLink}>
            {model.title.text}
          </Link>
        </h3>
        {model.tags.length > 0 ? (
          <ul className={styles.tags} aria-label={`${model.title.text}の公開情報タグ`}>
            {model.tags.map((tag) => (
              <li
                key={`${tag.kind}-${tag.label}`}
                className={tag.kind === "promotion" ? styles.promotionTag : styles.tag}
              >
                {tag.label}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <Link href={model.title.href} className={styles.media} aria-label={`${model.title.text}の詳細を見る`}>
        <img
          className={[styles.image, model.image.isFallback ? styles.imageFallback : ""]
            .filter(Boolean)
            .join(" ")}
          src={model.image.src}
          alt={model.image.alt}
          width={480}
          height={360}
          loading="lazy"
          decoding="async"
          style={model.image.isFallback ? SHOP_FALLBACK_IMAGE_STYLE : undefined}
        />
      </Link>

      <div className={styles.body}>
        {model.summary ? <p className={styles.summary}>{model.summary}</p> : null}
        {model.facts.length > 0 ? (
          <dl className={styles.facts}>
            {model.facts.map((fact) => (
              <div key={fact.key} className={styles.fact}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {model.quickLinks.length > 0 ? (
          <nav className={styles.quickLinks} aria-label={`${model.title.text}のページ内リンク`}>
            {model.quickLinks.map((link) => (
              <Link key={link.key} href={link.href} className={styles.quickLink}>
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <div className={styles.actions}>
        {model.actions.map((action) => (
          <a
            key={action.kind}
            href={action.href}
            className={action.primary ? styles.primaryAction : styles.secondaryAction}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? action.rel : undefined}
            data-shop-cta-kind={action.kind}
            data-shop-cta-position="listing"
            data-shop-slug={shop.slug}
          >
            {action.label}
          </a>
        ))}
      </div>
    </article>
  );
}

export function AreaShopList({
  shops,
  targetArea
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
}) {
  const { primary, secondary } = groupShopsByRelation(shops, targetArea);

  return (
    <div className="area-hub-shop-list">
      {primary.length > 0 ? (
        <div className="area-hub-shop-group">
          <h3 className="area-hub-shop-group__title">{primaryGroupTitle(targetArea)}</h3>
          <div className="area-hub-shop-group__list">
            {primary.map((shop) => (
              <AreaShopCard key={shop.id} shop={shop} targetArea={targetArea} />
            ))}
          </div>
        </div>
      ) : null}
      {secondary.length > 0 ? (
        <div className="area-hub-shop-group">
          <h3 className="area-hub-shop-group__title">{secondaryGroupTitle(targetArea)}</h3>
          <div className="area-hub-shop-group__list">
            {secondary.map((shop) => (
              <AreaShopCard key={shop.id} shop={shop} targetArea={targetArea} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
