import Link from "next/link";
import { DEFAULT_SHOP_IMAGE } from "@/lib/design-constants";
import {
  buildEditorCommentShort,
  formatShopPriceLabel,
  groupNihonbashiShops,
  resolveLastUpdatedLabel,
  resolveNihonbashiRelation,
  shopAreaLabel,
  shopFeatureTags,
  shopHoursText,
  shopNearestStation,
  shopReviewCountLabel
} from "@/lib/nihonbashi-shop-utils";
import type { ShopView } from "@/lib/wp/types";

export function NihonbashiHubCard({ shop }: { shop: ShopView }) {
  const image = shop.imageUrl || DEFAULT_SHOP_IMAGE;
  const tags = shopFeatureTags(shop);
  const contactSubject = encodeURIComponent(`口コミ投稿: ${shop.title}`);

  return (
    <article className="nb-hub-card hl-card-hover">
      <Link href={`/shops/${shop.slug}/`} className="nb-hub-card__img-link">
        <img
          src={image}
          alt={shop.title}
          width={320}
          height={213}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <div className="nb-hub-card__body">
        <h3 className="nb-hub-card__title">
          <Link href={`/shops/${shop.slug}/`}>{shop.title}</Link>
        </h3>

        <dl className="nb-hub-card__meta">
          <div>
            <dt>エリア</dt>
            <dd>{shopAreaLabel(shop)}</dd>
          </div>
          <div>
            <dt>日本橋との関係</dt>
            <dd>{resolveNihonbashiRelation(shop)}</dd>
          </div>
          <div>
            <dt>最寄駅・周辺</dt>
            <dd>{shopNearestStation(shop)}</dd>
          </div>
          <div>
            <dt>営業時間</dt>
            <dd>{shopHoursText(shop)}</dd>
          </div>
          <div>
            <dt>料金目安</dt>
            <dd>{formatShopPriceLabel(shop)}</dd>
          </div>
          <div>
            <dt>口コミ</dt>
            <dd>{shopReviewCountLabel(shop)}</dd>
          </div>
          <div>
            <dt>公式サイト</dt>
            <dd>{shop.officialUrl ? "あり" : "未掲載"}</dd>
          </div>
          <div>
            <dt>最終確認</dt>
            <dd>{resolveLastUpdatedLabel([shop])}</dd>
          </div>
        </dl>

        <div className="nb-hub-card__tags">
          {tags.map((tag) => (
            <span className="nb-hub-card__tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>

        <p className="nb-hub-card__editor">{buildEditorCommentShort(shop)}</p>

        <div className="nb-hub-card__actions">
          <Link href={`/shops/${shop.slug}/`} className="nb-btn nb-btn--primary">
            店舗詳細を見る
          </Link>
          <Link
            href={`/contact/?subject=${contactSubject}`}
            className="nb-btn nb-btn--outline"
          >
            口コミを投稿する
          </Link>
          {shop.officialUrl ? (
            <a
              href={shop.officialUrl}
              className="nb-btn nb-btn--outline"
              target="_blank"
              rel="noreferrer"
            >
              公式サイトを見る
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NihonbashiHubShopList({ shops }: { shops: ShopView[] }) {
  const { core, nearby } = groupNihonbashiShops(shops);

  return (
    <div className="nb-hub-shop-list">
      {core.length > 0 ? (
        <div className="nb-hub-shop-group">
          <h3 className="nb-hub-shop-group__title">日本橋ど真ん中・徒歩圏</h3>
          <div className="nb-hub-shop-group__list">
            {core.map((shop) => (
              <NihonbashiHubCard key={shop.id} shop={shop} />
            ))}
          </div>
        </div>
      ) : null}
      {nearby.length > 0 ? (
        <div className="nb-hub-shop-group">
          <h3 className="nb-hub-shop-group__title">近隣・関連エリア</h3>
          <div className="nb-hub-shop-group__list">
            {nearby.map((shop) => (
              <NihonbashiHubCard key={shop.id} shop={shop} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
