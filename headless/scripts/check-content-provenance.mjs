import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { shopDetailIntegrationEvidence } from "./check-final-design-preservation.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "lib/content-provenance.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, console }, { filename: "content-provenance.cjs" });

const { normalizeContentItem, normalizeContentItems } = module.exports;

const validUserReview = {
  sourcePostType: "reviews",
  source: "user",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "実際に利用したユーザー投稿本文です。",
  authorName: "投稿者A",
  rating: 5
};

function item(input) {
  return normalizeContentItem(input);
}

const approved = item(validUserReview);
assert.equal(approved.sourceType, "user-review");
assert.equal(approved.moderationStatus, "approved");
assert.equal(approved.publicationStatus, "published");
assert.equal(approved.canDisplayAsUserReview, true);
assert.equal(approved.canCountAsUserReview, true);
assert.equal(approved.canUseForAggregateRating, true);

const pending = item({ ...validUserReview, approvalStatus: "pending", status: "pending" });
assert.equal(pending.sourceType, "user-review");
assert.equal(pending.canDisplayAsUserReview, false);
assert.equal(pending.reason, "moderation-pending");

const rejected = item({ ...validUserReview, approvalStatus: "rejected", status: "publish" });
assert.equal(rejected.canCountAsUserReview, false);
assert.equal(rejected.reason, "moderation-rejected");

const editorial = item({
  sourceType: "editorial-comment",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "編集部が整理したコメントです。"
});
assert.equal(editorial.sourceType, "editorial-comment");
assert.equal(editorial.canDisplayAsUserReview, false);

const shopDescription = item({
  sourceField: "content",
  status: "publish",
  shopId: 101,
  body: "店舗紹介文です。"
});
assert.equal(shopDescription.sourceType, "shop-description");
assert.equal(shopDescription.canCountAsUserReview, false);

const shopProvided = item({
  sourceField: "shop_hours",
  status: "publish",
  shopId: 101,
  body: "12:00-翌5:00"
});
assert.equal(shopProvided.sourceType, "shop-provided");
assert.equal(shopProvided.canDisplayAsUserReview, false);

const aiGenerated = item({
  sourceField: "shop_ai_summary",
  status: "publish",
  shopId: 101,
  body: "AI生成経路の掲載情報コメントです。"
});
assert.equal(aiGenerated.sourceType, "ai-generated");
assert.equal(aiGenerated.canCountAsUserReview, false);

const promotion = item({
  sourceType: "promotion",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "PR文章です。"
});
assert.equal(promotion.sourceType, "promotion");
assert.equal(promotion.canDisplayAsUserReview, false);

const unknownAuthor = item({
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  body: "投稿者種別が不明な文章です。"
});
assert.equal(unknownAuthor.sourceType, "unknown");
assert.equal(unknownAuthor.canDisplayAsUserReview, false);

const unknownApproval = item({
  sourcePostType: "reviews",
  source: "user",
  status: "publish",
  shopId: 101,
  body: "承認状態が不明な文章です。"
});
assert.equal(unknownApproval.canDisplayAsUserReview, false);
assert.equal(unknownApproval.reason, "moderation-unknown");

const noShop = item({ ...validUserReview, shopId: "" });
assert.equal(noShop.canDisplayAsUserReview, false);
assert.equal(noShop.reason, "missing-shop-reference");

const noBody = item({ ...validUserReview, body: "" });
assert.equal(noBody.canDisplayAsUserReview, false);
assert.equal(noBody.reason, "missing-body");

const ratingOnly = item({
  sourcePostType: "reviews",
  source: "user",
  approvalStatus: "approved",
  status: "publish",
  shopId: 101,
  rating: 5
});
assert.equal(ratingOnly.canDisplayAsUserReview, false);

const mixed = normalizeContentItems(
  [
    validUserReview,
    { ...validUserReview, shopId: "101", body: "型だけ異なる同一店舗の口コミです。" },
    { ...validUserReview, shopId: 202, body: "別店舗に属する口コミです。" },
    { ...validUserReview, approvalStatus: "pending", status: "pending" },
    editorial,
    aiGenerated,
    promotion,
    unknownAuthor
  ],
  { sourcePostType: "reviews", sourceField: "user_reviews", shopId: 101 }
);
assert.equal(
  mixed.filter((entry) => entry.canDisplayAsUserReview).length,
  2,
  "only approved reviews whose normalized shopId matches the current shop may display"
);
assert.equal(
  mixed.some((entry) => entry.shopId === "202"),
  false,
  "a review belonging to a different shop must be removed at the provenance boundary"
);

const areaLatestSource = readFileSync(join(root, "components/area/AreaLatestReviews.tsx"), "utf8");
assert.ok(!areaLatestSource.includes("口コミ・編集部"), "AreaLatestReviews must not mix review/editorial label");
assert.ok(!areaLatestSource.includes("編集部レビュー"), "AreaLatestReviews must not show editorial review label");
assert.ok(areaLatestSource.includes("ユーザー口コミ"), "AreaLatestReviews should clearly label user reviews");

const shopDetailSource = [
  readFileSync(join(root, "components/ShopDetail.tsx"), "utf8"),
  readFileSync(join(root, "components/shop-detail/ShopDetailSections.tsx"), "utf8")
].join("\n");
assert.ok(!shopDetailSource.includes("Escomi編集部 Review"), "Shop detail must not label editorial text as Review");
assert.ok(shopDetailSource.includes("ユーザー口コミ"), "Shop detail must separate user reviews");

for (const [label, fixture] of [
  ["full shop detail", shopDetailIntegrationEvidence.full],
  ["sparse shop detail", shopDetailIntegrationEvidence.sparse]
]) {
  assert.strictEqual(
    fixture.captures.sectionsProps[0].reviewResult,
    fixture.reviewResult,
    `${label} must pass only the approved WordPress review result to ShopDetailSections`
  );
  assert.ok(
    fixture.html.includes('<section id="reviews"></section>'),
    `${label} must render the user-review section from the live composition`
  );
}
assert.ok(
  !shopDetailSource.includes("extractShopUserReviewItems"),
  "Shop detail must not treat ACF review arrays as the public review source"
);

const hubLinksSource = readFileSync(join(root, "components/common/ShopAreaHubLinks.tsx"), "utf8");
assert.ok(!hubLinksSource.includes("口コミ・編集部レビュー"), "Area hub link must not mix user reviews and editorial reviews");

const areaShopUtilsSource = readFileSync(join(root, "lib/area-shop-utils.ts"), "utf8");
assert.match(
  areaShopUtilsSource,
  /item\.canDisplayAsUserReview\s*&&\s*item\.shopId\s*===\s*String\(shop\.id\)/,
  "shop review extractor must enforce current-shop identity after normalization"
);

console.log("Content provenance check passed.");
