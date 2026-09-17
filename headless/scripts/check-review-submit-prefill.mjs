import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSourceLoader } from "./lib/shop-detail-source-loader.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const load = createSourceLoader();

assert.ok(
  existsSync(resolve(root, "lib/review-submit-prefill.ts")),
  "review submit prefill resolver must exist",
);
const prefill = load(resolve(root, "lib/review-submit-prefill.ts"));
assert.equal(typeof prefill.resolveReviewSubmitPrefill, "function");

const shops = [
  { id: 712, slug: "spalot-mrs", title: "SPALOT.Mrs", publicationStatus: "publish" },
  { id: 768, slug: "mrs-rank-up", title: "Mrs.Rank UP", publicationStatus: "publish" },
  { id: 900, slug: "draft-shop", title: "Draft", publicationStatus: "draft" },
];
assert.equal(prefill.resolveReviewSubmitPrefill("spalot-mrs", shops)?.id, 712, "valid Shop Detail prefill");
assert.equal(prefill.resolveReviewSubmitPrefill("mrs-rank-up", shops)?.id, 768, "valid Area/Featured/Comparison prefill");
assert.equal(prefill.resolveReviewSubmitPrefill(undefined, shops), null, "direct route uses normal form");
assert.equal(prefill.resolveReviewSubmitPrefill(["spalot-mrs"], shops), null, "array query fails safe");
assert.equal(prefill.resolveReviewSubmitPrefill("missing-shop", shops), null, "missing shop fails safe");
assert.equal(prefill.resolveReviewSubmitPrefill("draft-shop", shops), null, "draft shop fails safe");
assert.equal(prefill.resolveReviewSubmitPrefill("SPALOT.Mrs", shops), null, "shop name is not an identifier");
assert.equal(prefill.resolveReviewSubmitPrefill("spalot-mrs/other", shops), null, "invalid identifier fails safe");

const route = read("app/reviews/submit/page.tsx");
const form = read("components/reviews/ReviewSubmitForm.tsx");
const naturalCard = read("components/common/AreaShopCard.tsx");
const featuredCard = read("components/area/hub/AreaEditorialFeaturedShopCard.tsx");
const comparison = read("components/area/comparison/AreaShopComparisonExperience.tsx");

assert.match(route, /resolveReviewSubmitPrefill/, "submit route must use exact public-shop resolver");
assert.match(route, /path:\s*"\/reviews\/submit\/"/, "canonical remains query-free");
assert.doesNotMatch(route, /指定された店舗が見つかりません/, "invalid query must return the normal form");
assert.match(form, /投稿先店舗：<strong>\{shopTitle\}<\/strong>/, "prefilled shop is visible");
assert.doesNotMatch(form, /defaultValue=\{?[1-5]\}?/, "rating must not be auto-filled");
assert.doesNotMatch(form, /defaultValue=.*reviewBody/, "review body must not be auto-filled");
assert.match(naturalCard, /data-review-prefill="natural"/, "natural Area card review entry");
assert.match(featuredCard, /data-review-prefill="featured"/, "featured review entry");
assert.match(comparison, /data-review-prefill="comparison"/, "comparison review entry");

console.log(JSON.stringify({ pass: true, resolverCases: 8, entryPoints: 4 }));
