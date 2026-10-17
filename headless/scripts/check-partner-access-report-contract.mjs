import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, panel, migration, integrityMigration, accessRoute, contextRoute, abuseMigration, analyticsComponent] = await Promise.all([
  readFile(new URL("../app/api/partner/access-report/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/partner/PartnerAccessReport.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../supabase/migrations/20261017172000_eskomi_public_delivery_upgrade_hardening.sql", import.meta.url), "utf8"),
  readFile(new URL("../../supabase/migrations/20261017173000_eskomi_access_measurement_integrity.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/analytics/shop-access/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/analytics/shop-access/context/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../../supabase/migrations/20261017174000_eskomi_access_context_abuse_and_report_integrity.sql", import.meta.url), "utf8"),
  readFile(new URL("../components/GoogleAnalytics.tsx", import.meta.url), "utf8"),
]);

assert.match(route, /buildPartnerAccessReportPeriod\(days\)/);
assert.match(route, /searchParams\.get\("days"\) \?\? "28"/);
assert.match(route, /p_from: period\.previousFrom, p_to: period\.to/);
assert.match(route, /p_from: period\.provisionalOn, p_to: period\.provisionalOn/);
assert.doesNotMatch(route, /toISOString\(\)\.slice\(0, 10\)/);
assert.match(panel, /option value=\{7\}/);
assert.match(panel, /option value=\{28\}/);
assert.match(panel, /option value=\{90\}/);
assert.match(panel, /比較不可/);
assert.match(panel, /本日・暫定/);
assert.match(panel, /取得済み/);
assert.match(migration, /p_to-p_from>179/);
assert.match(migration, /days\.observed_on::date/);
assert.match(migration, /partner_shop_access_dedupe_v11/);
assert.match(migration, /public_therapist_assignment_is_visible_v11/);
assert.match(migration, /assessment_snapshot->>'therapistRating'/);
assert.match(migration, /assignment\.active_until is null or assignment\.active_until > now\(\)/);
assert.match(integrityMigration, /finalize_partner_shop_access_collection_day_v11/);
assert.match(integrityMigration, /assert_partner_v11_read_membership/);
assert.match(integrityMigration, /session_scope_hash/);
assert.match(integrityMigration, /prune_partner_shop_access_short_lived_v11/);
assert.match(integrityMigration, /event\.created_at<=appeal\.created_at/);
assert.match(accessRoute, /p_access_context_hash/);
assert.match(accessRoute, /p_session_scope_hash/);
assert.doesNotMatch(accessRoute, /browserTag/);
assert.match(contextRoute, /httpOnly: true/);
assert.match(contextRoute, /reserve_public_shop_access_context_v11/);
assert.match(contextRoute, /p_network_scope_hash/);
assert.match(abuseMigration, /partner_shop_access_context_issue_limits_v11/);
assert.match(abuseMigration, /issued_count<8/);
assert.match(abuseMigration, /issued_count<20/);
assert.match(abuseMigration, /has_recorded_data/);
assert.match(analyticsComponent, /publicAccessContextQueue/);
console.log("Partner access report contract: PASS");
