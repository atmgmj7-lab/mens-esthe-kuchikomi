import assert from "node:assert/strict";
import { test } from "node:test";

const period = await import("../lib/partner/access-report-period.ts");

test("partner access reports use Tokyo calendar dates across the UTC rollover", () => {
  const beforeTokyoMidnight = period.buildPartnerAccessReportPeriod(7, new Date("2026-10-17T14:59:00.000Z"));
  const afterTokyoMidnight = period.buildPartnerAccessReportPeriod(7, new Date("2026-10-17T15:01:00.000Z"));
  assert.deepEqual(beforeTokyoMidnight, { days: 7, timezone: "Asia/Tokyo", from: "2026-10-11", to: "2026-10-17", previousFrom: "2026-10-04", previousTo: "2026-10-10" });
  assert.deepEqual(afterTokyoMidnight, { days: 7, timezone: "Asia/Tokyo", from: "2026-10-12", to: "2026-10-18", previousFrom: "2026-10-05", previousTo: "2026-10-11" });
});

test("each selectable report period requests exactly two contiguous Tokyo periods", () => {
  for (const days of [7, 28, 90]) {
    const value = period.buildPartnerAccessReportPeriod(days, new Date("2026-10-17T00:30:00+09:00"));
    const span = (new Date(`${value.to}T00:00:00Z`).getTime() - new Date(`${value.previousFrom}T00:00:00Z`).getTime()) / 86_400_000 + 1;
    assert.equal(span, days * 2);
  }
  assert.throws(() => period.buildPartnerAccessReportPeriod(30, new Date()), /7, 28, or 90/);
});
