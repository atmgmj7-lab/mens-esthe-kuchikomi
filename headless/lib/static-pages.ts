export const STATIC_PAGE_SLUGS = [
  "contact",
  "about",
  "sitemap",
  "storelisting",
  "osaka-nihonbashi"
] as const;

export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

export function isStaticPageSlug(slug: string): slug is StaticPageSlug {
  return (STATIC_PAGE_SLUGS as readonly string[]).includes(slug);
}

type StaticPageMeta = {
  title: string;
  description: string;
};

export const STATIC_PAGE_META: Record<StaticPageSlug, StaticPageMeta> = {
  contact: {
    title: "お問い合わせ",
    description:
      "Escomi（エスコミ）へのお問い合わせページ。掲載希望・情報修正・ご意見などお気軽にご連絡ください。"
  },
  about: {
    title: "運営者情報",
    description:
      "関西メンズエステ口コミナビ「Escomi（エスコミ）」の運営方針・サイト概要・免責事項について。"
  },
  sitemap: {
    title: "サイトマップ",
    description: "Escomi（エスコミ）の主要ページ一覧。エリア・店舗・コラムへの導線をまとめています。"
  },
  storelisting: {
    title: "掲載について",
    description:
      "Escomi（エスコミ）への店舗掲載について。掲載のメリット・お問い合わせ方法をご案内します。"
  },
  "osaka-nihonbashi": {
    title: "日本橋メンズエステ完全ガイド",
    description:
      "大阪・日本橋エリアのメンズエステ情報をまとめた完全ガイド。エリアの特徴と店舗探しのポイントを紹介。"
  }
};

export function getStaticPageMeta(slug: StaticPageSlug): StaticPageMeta {
  return STATIC_PAGE_META[slug];
}

export function getStaticPageFallback(slug: StaticPageSlug): string {
  switch (slug) {
    case "contact":
      return `
        <p>Escomi（エスコミ）へのお問い合わせは、下記よりご連絡ください。</p>
        <ul>
          <li>店舗掲載・情報更新のご相談</li>
          <li>掲載内容の修正依頼</li>
          <li>サイトに関するご意見・ご要望</li>
        </ul>
        <p class="hl-static-page-cta">
          <a href="/storelisting/" class="hl-static-page-btn">掲載についてはこちら</a>
        </p>
      `;
    case "about":
      return `
        <p>Escomi（エスコミ）は、関西エリアのメンズエステ情報を厳選して掲載する口コミ・店舗情報ポータルです。</p>
        <p>大阪・京都・神戸を中心に、エリア別の店舗一覧、料金、営業時間、口コミ情報をわかりやすく整理し、来店前の比較検討をサポートします。</p>
        <h2>運営方針</h2>
        <ul>
          <li>公開情報をもとに、利用者が判断しやすい形で店舗情報を整理します。</li>
          <li>エリアごとの特徴や選び方など、SEOコンテンツを充実させています。</li>
          <li>掲載情報の修正・更新依頼には可能な限り対応します。</li>
        </ul>
      `;
    case "sitemap":
      return `
        <p>Escomi（エスコミ）の主要ページへのリンク一覧です。</p>
        <ul class="hl-sitemap-links">
          <li><a href="/">トップページ</a></li>
          <li><a href="/shops/">店舗一覧</a></li>
          <li><a href="/column/">コラム一覧</a></li>
          <li><a href="/area/osaka/">大阪エリア</a></li>
          <li><a href="/area/nihonbashi/">日本橋エリア</a></li>
          <li><a href="/osaka-nihonbashi/">日本橋メンズエステ完全ガイド</a></li>
          <li><a href="/storelisting/">掲載について</a></li>
          <li><a href="/contact/">お問い合わせ</a></li>
          <li><a href="/about/">運営者情報</a></li>
        </ul>
        <p>XMLサイトマップは <a href="/sitemap.xml">/sitemap.xml</a> からご確認いただけます。</p>
      `;
    case "storelisting":
      return `
        <p>Escomi（エスコミ）では、関西エリアのメンズエステ店舗様の掲載を受け付けています。</p>
        <h2>掲載のメリット</h2>
        <ul>
          <li>エリア検索から店舗詳細ページへの導線</li>
          <li>料金・営業時間など基本情報の整理掲載</li>
          <li>関西エリアを中心としたSEOコンテンツとの連携</li>
        </ul>
        <h2>お問い合わせ</h2>
        <p>掲載希望・情報更新・掲載内容の修正は、お問い合わせページよりご連絡ください。</p>
        <p class="hl-static-page-cta">
          <a href="/contact/" class="hl-static-page-btn">お問い合わせはこちら</a>
        </p>
      `;
    case "osaka-nihonbashi":
      return `
        <p>大阪・日本橋エリアのメンズエステ情報は、エリアページでもご覧いただけます。</p>
        <p class="hl-static-page-cta">
          <a href="/area/nihonbashi/" class="hl-static-page-btn">日本橋エリアの店舗一覧へ</a>
        </p>
      `;
    default:
      return "<p>コンテンツを準備中です。</p>";
  }
}
