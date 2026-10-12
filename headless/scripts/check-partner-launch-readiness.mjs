import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
for (const [name, width, height] of [["728x90", 728, 90], ["468x60", 468, 60], ["300x250", 300, 250]]) {
  const asset = `public/downloads/eskomi-link-banner-${name}.svg`;
  assert.equal(existsSync(join(root, asset)), true, `${asset} must exist`);
  const source = read(asset);
  assert.match(source, new RegExp(`width="${width}" height="${height}"`));
  assert.match(source, /Eskomi/);
}

console.log("partner launch readiness contract: PASS");
