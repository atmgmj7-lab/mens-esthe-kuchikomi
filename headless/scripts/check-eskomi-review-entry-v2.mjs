import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const route = read("app/api/reviews/entry-v2/submit/route.ts");
const form = read("components/reviews/EskomiReviewEntryForm.tsx");
const page = read("app/reviews/entry/[entryHandle]/page.tsx");
const repository = read("lib/supabase/eskomi-review-v2.ts");

assert.match(route, /sec-fetch-site.*same-origin/, "v2 submission must reject cross-site requests");
assert.match(route, /Idempotency-Key|idempotency-key/, "v2 submission must require an idempotency key");
assert.match(route, /resolveTrustedReviewClientIp/, "v2 submission must not persist a raw client IP");
assert.match(route, /eskomiReviewV2Repository\.submit/, "v2 submission must go through the server-only repository");
assert.doesNotMatch(route, /shopId|shop_id/, "browser payload must not select a trusted shop id");
assert.match(form, /入力内容の確認/, "form must include a confirmation step");
assert.match(form, /受付完了/, "form must include a receipt step");
assert.match(form, /idempotencyKeyRef/, "retry must preserve its idempotency key");
assert.match(page, /listPublications/, "entry page must render the reviewed public projection");
assert.match(repository, /list_public_review_publications/, "public projection must use the dedicated read adapter");

console.log("Eskomi review-entry v2 contract: PASS");
