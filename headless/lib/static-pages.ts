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
      "Eskomi（エスコミ）へのお問い合わせページ。掲載希望・情報修正・ご意見などお気軽にご連絡ください。"
  },
  about: {
    title: "運営者情報",
    description:
      "関西メンズエステ情報サイト「Eskomi（エスコミ）」の運営方針・サイト概要・免責事項について。"
  },
  sitemap: {
    title: "サイトマップ",
    description: "Eskomi（エスコミ）の主要ページ一覧。エリア・店舗・コラムへの導線をまとめています。"
  },
  storelisting: {
    title: "掲載について",
    description:
      "Eskomi（エスコミ）への店舗掲載について。掲載のメリット・お問い合わせ方法をご案内します。"
  },
  "osaka-nihonbashi": {
    title: "日本橋メンズエステで失敗しない選び方｜料金相場・口コミの見方を解説",
    description:
      "大阪日本橋・近鉄日本橋周辺でメンズエステを選ぶときのポイントを解説。料金相場、口コミの見方、営業時間、深夜営業、初心者が注意すべき点を整理し、店舗一覧・ランキングページへの導線も掲載しています。"
  }
};

export function getStaticPageMeta(slug: StaticPageSlug): StaticPageMeta {
  return STATIC_PAGE_META[slug];
}

export function getStaticPageFallback(slug: StaticPageSlug): string {
  switch (slug) {
    case "contact":
      return `
        <p>Eskomi（エスコミ）へのお問い合わせは、下記よりご連絡ください。</p>
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
        <p>Eskomi（エスコミ）は、関西エリアのメンズエステ情報を厳選して掲載する店舗情報ポータルです。</p>
        <p>大阪・京都・神戸を中心に、エリア別の店舗一覧、料金、営業時間、投稿口コミを分けて整理し、来店前の比較検討をサポートします。</p>
        <h2>運営方針</h2>
        <ul>
          <li>公開情報をもとに、利用者が判断しやすい形で店舗情報を整理します。</li>
          <li>エリアごとの特徴や選び方など、SEOコンテンツを充実させています。</li>
          <li>掲載情報の修正・更新依頼には可能な限り対応します。</li>
        </ul>
      `;
    case "sitemap":
      return `
        <p>Eskomi（エスコミ）の主要ページへのリンク一覧です。</p>
        <ul class="hl-sitemap-links">
          <li><a href="/">トップページ</a></li>
          <li><a href="/shops/">店舗一覧</a></li>
          <li><a href="/column/">コラム一覧</a></li>
          <li><a href="/area/osaka/">大阪エリア</a></li>
          <li><a href="/area/nihonbashi/">日本橋エリア</a></li>
          <li><a href="/osaka-nihonbashi/">日本橋メンズエステ選び方ガイド</a></li>
          <li><a href="/storelisting/">掲載について</a></li>
          <li><a href="/contact/">お問い合わせ</a></li>
          <li><a href="/about/">運営者情報</a></li>
        </ul>
        <p>XMLサイトマップは <a href="/sitemap.xml">/sitemap.xml</a> からご確認いただけます。</p>
      `;
    case "storelisting":
      return `
        <p>Eskomi（エスコミ）では、関西エリアのメンズエステ店舗様から、掲載情報の登録・修正申請を受け付けています。</p>
        <p>公開情報や店舗の公式サイトなどで確認できる情報をもとに整理し、内容を運営が確認してから掲載します。申請内容がそのまま公開されることはありません。</p>
        <h2>掲載情報の方針</h2>
        <ul>
          <li>店舗名・料金・営業時間・アクセスなどを、確認できた情報に基づいて掲載します。</li>
          <li>登録・修正申請は公開前の確認資料として受け付けます。</li>
          <li>現在公開中の情報は、確認が終わるまで変更されません。</li>
        </ul>
        <h2>登録・修正を申請する</h2>
        <p>店舗詳細ページから進むと、対象店舗が事前入力された状態で確認できます。</p>
        <p class="hl-static-page-cta">
          <a href="#shop-owner-request" class="hl-static-page-btn">申請フォームへ進む</a>
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
