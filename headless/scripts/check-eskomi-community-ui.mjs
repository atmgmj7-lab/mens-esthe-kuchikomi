import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const [exchange, correction, edit, api, migration] = await Promise.all([
  read("components/community/EskomiCommunityExchange.tsx"), read("components/community/EskomiCorrectionRequest.tsx"), read("components/reviews/EskomiReviewEditForm.tsx"), read("app/api/community/v11/route.ts"), read("../supabase/migrations/20261017152000_eskomi_community_ui_safety_and_review_projection.sql")
]);
assert.match(exchange, /setPhase\("confirm"\)/, "community form must have a review step");
assert.match(exchange, /setPhase\("input"\)/, "community form must allow returning without losing the draft");
assert.match(exchange, /sessionStorage/, "lost-response retries must retain the original receipt and idempotency key in the tab");
assert.match(exchange, /参考になった/, "community reactions require clear labels");
assert.match(exchange, /受付控え/, "community withdrawal receipt must be disclosed without a URL");
assert.match(correction, /手動で反映/, "corrections must not imply automatic public publication");
assert.match(edit, /担当セラピストの評価/, "review edit must retain an editable therapist rating");
assert.match(edit, /defaultValue=\{review\.therapist_rating/, "unchanged therapist rating must be submitted unchanged");
assert.match(edit, /review\.state === "rejected"/, "rejected reviews must use the appeal flow, not ordinary editing");
assert.match(api, /p_payload_hash/, "community API must use payload-bound replay RPCs");
assert.match(migration, /community_target_is_public_v11/, "public community reads must re-check target visibility");
assert.match(migration, /assessment_snapshot->>'shopRating'/, "public review ratings must use active revision snapshots");
assert.match(migration, /v_state not in \('submitted','approved'\)/, "ordinary edits must not resurrect rejected or withdrawn reviews");
console.log("Eskomi community UI and review-edit safety contract: PASS");
