import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relative) => readFileSync(join(root, relative), "utf8");
const repository = read("lib/supabase/partner-workspace.ts");
const migration = read("../supabase/migrations/20261017163000_eskomi_canonical_partner_registration_review.sql");
const fixture = read("../supabase/tests/verify_eskomi_canonical_partner_home_listing.sql");

assert.match(repository, /list_partner_registration_reviews_v11/);
assert.match(repository, /review_partner_registration_v11/);
assert.match(repository, /identityKind: "canonical"/);
assert.match(repository, /appShopId: row\.app_shop_id/);
assert.doesNotMatch(repository.slice(repository.indexOf("function parseReview"), repository.indexOf("export const partnerReviewGrowthRepository")), /typeof row\.wp_shop_id !== "number"/);
assert.match(migration, /app_shop_id uuid/);
assert.match(migration, /identity_kind text/);
assert.match(migration, /managed\.publication_state='published'/);
assert.match(fixture, /canonical registration is absent or malformed in the operator review queue/);
assert.match(fixture, /api\.review_partner_registration_v11/);
assert.match(fixture, /approved canonical registration could not use the Partner growth path/);
console.log("canonical partner registration review contract: PASS");
