import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const guide = read("app/partner/guide/page.tsx");
const listing = read("components/StoreListingGuide.tsx");
const popPage = read("app/partner/growth/pop/page.tsx");
const popImage = read("app/partner/growth/pop/preview.svg/route.ts");
const growthCenter = read("app/partner/growth/page.tsx");

for (const href of ["/contact/#contact-form-heading", "/shops/", "/partner/login/"]) {
  assert.match(listing, new RegExp(`href="${href.replace(/[/.]/g, "\\$&")}"`), `listing guide needs ${href}`);
}
assert.match(listing, /相互リンクは任意です。掲載順位や審査結果には影響しません。/);
assert.match(listing, /正式な相互リンク用バナー画像の受領・確認後/);
assert.match(listing, /配布できる画像はまだありません/);
assert.match(listing, /const reciprocalLinkTargetUrl = "https:\/\/mens-esthe-kuchikomi\.com\/"/);
assert.match(listing, /const reciprocalBanners: ReadonlyArray/);
assert.doesNotMatch(listing, /eskomi-link-banner-728x90/, "unreviewed legacy banner files must not be offered as reciprocal-link downloads");
assert.match(listing, /rel="noopener noreferrer"/);
assert.doesNotMatch(listing, /<script/i, "copyable HTML must not inject script");
assert.match(guide, /店舗担当者/);
assert.match(guide, /お客様/);
assert.match(guide, /Eskomi運営/);
assert.match(guide, /審査と公開を分けて判断/);
assert.match(guide, /口コミの評価指定、特典・報酬による依頼、良い口コミだけを求める案内は行いません/);
assert.match(growthCenter, /href="\/partner\/growth\/pop\/"/);
assert.match(popPage, /authorizePartnerReviewGrowthSession/);
assert.match(popPage, /asset\.key === "qr"/);
assert.match(popPage, /実QR入りのPOPは表示・ダウンロードしません/);
assert.match(popImage, /authorizePartnerReviewGrowthSession/);
assert.match(popImage, /qr\?\.status !== "available"/);
assert.match(popImage, /Cache-Control": "private, no-store"/);
assert.doesNotMatch(popPage, /fetch\(/, "POP generation must not request the tracking redirect");
assert.doesNotMatch(popImage, /fetch\(/, "POP preview must not request the tracking redirect");
console.log("partner launch readiness contract: PASS");
