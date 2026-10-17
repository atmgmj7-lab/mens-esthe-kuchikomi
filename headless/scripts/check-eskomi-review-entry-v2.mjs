import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const route = read("app/api/reviews/entry-v2/submit/route.ts");
const form = read("components/reviews/EskomiReviewEntryForm.tsx");
const page = read("app/reviews/entry/[entryHandle]/page.tsx");
const repository = read("lib/supabase/eskomi-review-v2.ts");
const v11Submit = read("app/api/reviews/v2/submit/route.ts");
const v11Context = read("app/api/reviews/v2/context/route.ts");

assert.match(route, /REVIEW_ENTRY_MIGRATED/, "old entry-v2 submission must be closed instead of bypassing the v1.1 session flow");
assert.doesNotMatch(route, /eskomiReviewV2Repository\.submit/, "old entry-v2 route must not write reviews");
assert.match(form, /入力内容の確認/, "form must include a confirmation step");
assert.match(form, /受付完了/, "form must include a receipt step");
assert.match(form, /idempotencyKeyRef/, "retry must preserve its idempotency key");
assert.match(page, /listPublications/, "entry page must render the reviewed public projection");
assert.match(repository, /list_public_review_experience_publications/, "public projection must use the v1.1 experience projection adapter");
assert.match(form, /\/api\/reviews\/v2\/context\//, "v1.1 form must obtain a bounded guest context before confirmation");
assert.match(form, /\/api\/reviews\/v2\/submit\//, "v1.1 form must submit through the separated v2 endpoint");
assert.match(v11Context, /httpOnly: true/, "guest context must be bound to an HttpOnly cookie");
assert.match(v11Submit, /idempotency-key/, "v1.1 submit must require a retry key");
assert.match(v11Submit, /receipt/, "v1.1 submit must return a private edit receipt only on initial acceptance");

console.log("Eskomi review-entry v2 contract: PASS");
