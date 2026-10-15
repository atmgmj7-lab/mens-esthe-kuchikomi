import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const step1 = readFileSync(
  join(root, "../supabase/migrations/20261014182814_listing_application_step1.sql"),
  "utf8",
);

assert.match(
  step1,
  /values \('listing-application-private', 'listing-application-private', false,/,
  "the listing image bucket must be private",
);
assert.doesNotMatch(
  step1,
  /revoke\s+all\s+on\s+storage\.objects\s+from\s+anon\s*,\s*authenticated/i,
  "a listing migration must not revoke storage privileges for every bucket",
);

console.log("listing application migration storage boundary: PASS");
