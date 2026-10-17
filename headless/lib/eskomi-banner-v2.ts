export type EskomiBannerV2 = Readonly<{
  id: "B01" | "B02" | "B03" | "B04" | "B05" | "B06" | "B07" | "B08" | "B09" | "B10";
  title: string;
  body: string;
  cta: string;
  href: string | null;
  imageSrc: string | null;
  assetStatus: "pending_destination_validation" | "ready";
}>;

/**
 * Every approved source image is stored locally. A banner renders only after
 * its destination is an existing, usable route; this avoids promising a
 * feature that has not been delivered yet.
 */
export const ESKOMI_BANNER_V2: Readonly<Record<EskomiBannerV2["id"], EskomiBannerV2>> = {
  B01: { id: "B01", title: "お店を無料掲載しませんか", body: "掲載条件と利用できる機能を、確認できる範囲でご案内します。", cta: "無料掲載の特典を見る", href: "/storelisting/", imageSrc: "/images/eskomi-banners/B01-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B02: { id: "B02", title: "お礼の一通で口コミをお願い", body: "専用リンク入りの案内文をコピーして、普段のLINE・メールでお送りできます。", cta: "案内文の作り方を見る", href: "/partner/guide/", imageSrc: "/images/eskomi-banners/B02-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B03: { id: "B03", title: "次回予約で使える特典コード", body: "特典内容・提供条件が確認できるまで、発行を案内しません。", cta: "クーポンの仕組みを見る", href: null, imageSrc: "/images/eskomi-banners/B03-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B04: { id: "B04", title: "お店のホームページに口コミを表示", body: "承認公開された自店の口コミだけを、更新・取り下げに追従して表示します。", cta: "ホームページでの表示を見る", href: "/partner/guide/", imageSrc: "/images/eskomi-banners/B04-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B05: { id: "B05", title: "口コミにお店から返信", body: "返信は運営確認後に、元の口コミと一緒に公開されます。", cta: "返信の表示を見る", href: null, imageSrc: "/images/eskomi-banners/B05-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B06: { id: "B06", title: "担当セラピストの感想も、一度に", body: "店舗と担当への感想は同じ入口で受け付けますが、評価は別に扱います。", cta: "担当別の口コミの集め方を見る", href: null, imageSrc: "/images/eskomi-banners/B06-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B07: { id: "B07", title: "閲覧とLINEクリックを確認", body: "閲覧・クリックの時点や欠測を区別し、予約・来店数とは表示しません。", cta: "アクセス報告の内容を見る", href: null, imageSrc: "/images/eskomi-banners/B07-eskomi-functional-v2.png", assetStatus: "pending_destination_validation" },
  B08: {
    id: "B08",
    title: "料金と口コミを比べて選ぶ",
    body: "関西の地域からお店の情報を比較し、確認できる公式連絡先を見つけられます。",
    cta: "エリアからお店を探す",
    href: "/shops/",
    imageSrc: "/images/eskomi-banners/B08-eskomi-functional-v2.png",
    assetStatus: "ready",
  },
  B09: {
    id: "B09",
    title: "感想や情報の訂正を送る",
    body: "利用した感想は口コミへ、掲載情報の違いは運営への非公開訂正として受け付けます。",
    cta: "口コミ・情報訂正の入口へ",
    href: "#contribute",
    imageSrc: "/images/eskomi-banners/B09-eskomi-functional-v2.png",
    assetStatus: "ready",
  },
  B10: {
    id: "B10",
    title: "関西でお店を探す人に、広告でご案内",
    body: "広告掲載の相談先・料金・表示場所は、提供条件を確認してから案内します。",
    cta: "広告掲載について相談",
    href: null,
    imageSrc: "/images/eskomi-banners/B10-eskomi-functional-v2.png",
    assetStatus: "pending_destination_validation",
  },
};
