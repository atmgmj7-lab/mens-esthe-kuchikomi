import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const headlessRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(headlessRoot, "..");
const matrix = readFileSync(join(
  repositoryRoot,
  "docs",
  "partner-pilot",
  "2026-09-22-free-official-partner-pilot-01",
  "P1_RANK_DATA_API_EXPOSURE_MATRIX.md",
), "utf8");

const required = [
  "claim_shop_owner_request_rate_limit",
  "provision_partner_workspace",
  "register_partner_submission",
  "grant_partner_membership",
  "get_partner_auth_membership",
  "get_partner_workspace_identity",
  "list_partner_registration_reviews",
  "review_partner_registration",
  "open_partner_review_campaign",
  "record_partner_review_campaign_event",
  "get_partner_review_growth_metrics",
  "get_partner_review_widget",
  "claim_review_submission_rate_limit",
  "submit_review_with_tags",
  "list_review_moderation_queue",
  "moderate_review",
  "publish_review",
  "list_published_reviews",
  "get_published_review_metrics",
];

const requiredRows = [...matrix.matchAll(/^\| `api\.([a-z0-9_]+)` \| (SERVICE_ONLY_REQUIRED|SERVER_AUTH_REQUIRED|OPERATOR_ONLY) \|/gm)];
assert.equal(requiredRows.length, 19, "the P1 Rank Data API contract must list exactly 19 required wrappers");
assert.deepEqual(requiredRows.map((match) => match[1]), required, "the required wrapper set must stay exact and ordered");
assert.match(matrix, /private schema \| `NOT EXPOSED`/i);
assert.match(matrix, /anon \| `DENY`/i);
assert.match(matrix, /authenticated browser \| `DENY`/i);
assert.match(matrix, /`SUPABASE_SECRET_KEY` \| canonical modern server-only secret; client exposure `0`/i);
assert.match(matrix, /`SUPABASE_SERVICE_ROLE_KEY` \| temporary legacy server-only fallback; client exposure `0`/i);
assert.match(matrix, /`record_partner_review_campaign_submission` \| NOT_REQUIRED/i);
assert.match(matrix, /`record_partner_review_campaign_review` \| NOT_REQUIRED/i);
assert.match(matrix, /`submit_review` \| NOT_REQUIRED/i);
assert.match(matrix, /AI telemetry wrappers \| NOT_REQUIRED/i);

console.log("P1 Rank Data API exposure matrix: PASS");
