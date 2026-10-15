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

assert.match(listing, /const banners = \[/, "listing guide needs the approved banner choices");
assert.match(listing, /HTMLをコピー/, "listing guide needs copyable official-banner HTML");
assert.match(listing, /画像をダウンロード/, "listing guide needs free official-banner downloads");
assert.match(listing, /action: "create"|\/api\/listing-applications\//, "listing guide needs the controlled listing-application submission route");
assert.match(listing, /この申請で店舗の所有権や編集権限が付与されることはありません/, "listing application must not grant ownership");
assert.match(listing, /公開前に運営が確認します/, "listing application must explain the approval gate");
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
