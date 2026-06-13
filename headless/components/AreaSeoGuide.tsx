import Link from "next/link";
import { buildAreaSeoModel } from "@/lib/area-seo";
import type { AreaView, ShopView } from "@/lib/wp/types";
import { EsSectionTitle } from "@/components/SectionTitle";

type Props = {
  area: AreaView;
  shops: ShopView[];
  parentArea?: AreaView | null;
};

export function AreaSeoGuide({ area, shops, parentArea }: Props) {
  const model = buildAreaSeoModel(area, shops, parentArea);

  return (
    <section className="hl-area-seo-guide hl-section hl-fade-in" aria-label={`${area.name}のメンズエステガイド`}>
      <EsSectionTitle en="AREA GUIDE" ja={`${area.name}でメンズエステを探すポイント`} large />

      <div className="hl-area-seo-guide__lead">
        {model.leadParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {area.slug === "osaka" ? (
          <p>
            日本橋周辺で探す場合は、
            <Link href="/osaka-nihonbashi/">大阪日本橋メンズエステおすすめランキング</Link>
            も参考にしてください。
          </p>
        ) : null}
      </div>

      <div className="hl-area-seo-guide__cards">
        {[model.accessCard, model.hoursCard, model.compareCard].map((card) => (
          <article key={card.title} className="hl-area-seo-guide__card">
            <h3 className="hl-area-seo-guide__card-title">{card.title}</h3>
            {card.lines.map((line) => (
              <p key={line} className="hl-area-seo-guide__card-text">
                {line}
              </p>
            ))}
          </article>
        ))}
      </div>

      {model.representativeShops.length > 0 ? (
        <div className="hl-area-seo-guide__links">
          <h3 className="hl-area-seo-guide__links-title">
            {model.areaName}の代表店舗
          </h3>
          <ul className="hl-area-seo-guide__links-list">
            {model.representativeShops.map((shop) => (
              <li key={shop.href}>
                <Link href={shop.href}>{shop.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
