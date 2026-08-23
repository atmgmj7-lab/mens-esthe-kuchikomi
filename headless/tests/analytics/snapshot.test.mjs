import assert from "node:assert/strict";
import { test } from "node:test";

import { registerServerOnly } from "./register-server-only.mjs";

registerServerOnly();

const { analyticsSuccess, analyticsFailure } = await import("../../lib/analytics/result.ts");
const { buildAnalyticsPeriod } = await import("../../lib/analytics/period.ts");
const { collectAnalyticsSnapshot } = await import("../../lib/analytics/snapshot.ts");

const now = new Date("2026-08-23T00:00:00.000Z");
const at = now.toISOString();
const ok = (data) => analyticsSuccess(data, { collectedAt: at });
const noData = () => analyticsFailure("no_data", { collectedAt: at, warnings: [{ code: "synthetic_no_data", message: "state=no_data; code=synthetic_no_data" }] });
const metric = (clicks, impressions, ctr, position) => ({ clicks, impressions, ctr, position });

function sourceData() {
  const pair = (current, previous) => ({ current: ok(current), previous: ok(previous) });
  return {
    ga4: ok({
      overview: pair({ sessions: 10, activeUsers: 0, engagedSessions: 5, engagementRate: 0.5, keyEvents: 0 }, { sessions: 0, activeUsers: 2, engagedSessions: 0, engagementRate: 0, keyEvents: 1 }),
      organicSearch: pair({ sessions: 4 }, { sessions: 0 }),
      landingPages: pair([
        { landingPage: "/area/sakai/?source=one", sessions: 4, activeUsers: 3, engagedSessions: 2, engagementRate: 0.5, keyEvents: 0 },
        { landingPage: "/area/sakai/?source=two", sessions: 6, activeUsers: 4, engagedSessions: 3, engagementRate: 0.5, keyEvents: 0 },
        { landingPage: "https://attacker.invalid/", sessions: 99, activeUsers: 99, engagedSessions: 99, engagementRate: 1, keyEvents: 99 },
      ], [{ landingPage: "/area/sakai/", sessions: 2, activeUsers: 1, engagedSessions: 1, engagementRate: 0.5, keyEvents: 0 }]),
      organicLandingPages: pair([{ landingPage: "/area/sakai/", sessions: 4, activeUsers: 3, engagedSessions: 2, engagementRate: 0.5, keyEvents: 0 }], [{ landingPage: "/area/sakai/", sessions: 0, activeUsers: 0, engagedSessions: 0, engagementRate: 0, keyEvents: 0 }]),
      devices: pair([], []),
    }),
    gsc: ok({
      latestFinalDate: "2026-08-22", period: buildAnalyticsPeriod(7, now),
      siteAggregate: pair(metric(0, 10, 0, 3), metric(2, 20, 0.1, 4)),
      queries: pair({ rows: [], rowCoverage: "NOT_RETURNED" }, { rows: [], rowCoverage: "NOT_RETURNED" }),
      pages: pair({ rows: [{ keys: ["https://mens-esthe-kuchikomi.com/area/sakai/?ref=x"], ...metric(3, 30, 0.1, 2) }], rowCoverage: "NOT_RETURNED" }, { rows: [], rowCoverage: "NOT_RETURNED" }),
      queryPages: pair({ rows: [
        { keys: ["堺東 メンズエステ", "https://mens-esthe-kuchikomi.com/area/sakai/"], ...metric(5, 50, 0.1, 8) },
      ], rowCoverage: "NOT_RETURNED" }, { rows: [
        { keys: ["堺東 メンズエステ", "https://mens-esthe-kuchikomi.com/area/sakai/"], ...metric(0, 20, 0, 12) },
      ], rowCoverage: "NOT_RETURNED" }),
      devices: pair({ rows: [], rowCoverage: "NOT_RETURNED" }, { rows: [], rowCoverage: "NOT_RETURNED" }),
      countries: pair({ rows: [], rowCoverage: "NOT_RETURNED" }, { rows: [], rowCoverage: "NOT_RETURNED" }),
    }),
    web: ok({ targets: ["/", "/area/sakai/", "/area/shinosaka/", "/area/nihonbashi/", "/area/sakaisujihonmachi/", "/area/umeda/"].map((path) => ({ path, url: `https://mens-esthe-kuchikomi.com${path}`, httpStatus: 200, checkedAt: at, state: "ok", data: { title: path, h1: path, canonical: `https://mens-esthe-kuchikomi.com${path}`, robots: "index,follow", indexable: true, indexabilityReason: "indexable" }, warnings: [] })) }),
    content: ok({ areas: [{ area: { id: 1, slug: "umeda", name: "梅田", parentId: 0, publishedShopCount: 0 }, publishedShops: 0, verifiedPriceCount: 0, verifiedHoursCount: 0, verifiedOfficialUrlCount: 0, verifiedAccessCount: 0, approvedReviewCount: 0, staleConfirmedDateShopCount: 0, missingRate: null }], staleAfterDays: 180 }),
  };
}

test("collectAnalyticsSnapshot constructs deterministic aggregate-only T6 model without coercing zero or null", async () => {
  const sources = sourceData();
  const snapshot = await collectAnalyticsSnapshot({
    days: 7, now,
    sources: {
      collectGa4: async () => sources.ga4,
      collectGsc: async () => sources.gsc,
      collectSiteHealth: async () => sources.web,
      getContentHealth: async () => sources.content,
    },
  });
  assert.equal(snapshot.schemaVersion, "1.0.0");
  assert.equal(snapshot.timezone, "Asia/Tokyo");
  assert.equal(snapshot.generatedAt, at);
  assert.deepEqual(snapshot.period.requested.current, { startDate: "2026-08-16", endDate: "2026-08-22" });
  assert.equal(snapshot.overview.current.sessions, 10);
  assert.equal(snapshot.overview.current.activeUsers, 0);
  assert.equal(snapshot.overview.deltas.sessions, 10);
  assert.equal(snapshot.overview.deltas.activeUsers, -2);
  assert.equal(snapshot.overview.current.gsc.clicks, 0);
  assert.deepEqual(snapshot.seo.focusAreas.map((row) => row.name), ["堺東", "新大阪", "大阪日本橋", "堺筋本町", "梅田"]);
  assert.equal(snapshot.seo.focusAreas[0].mainQuery, "堺東 メンズエステ");
  assert.equal(snapshot.seo.focusAreas[0].previous.clicks, 0);
  assert.equal(snapshot.seo.focusAreas[1].mainQuery, null);
  assert.equal(snapshot.seo.topCounts.top10, null);
  assert.equal(snapshot.pages[0].path, "/area/sakai/");
  assert.equal(snapshot.pages[0].current.sessions, 10);
  assert.equal(snapshot.pages[0].current.engagementRate, 0.5);
  assert.equal(snapshot.pages[0].current.gsc.clicks, 3);
  assert.equal(snapshot.pages.some((row) => row.path.includes("attacker")), false);
  assert.equal(JSON.stringify(snapshot).includes("approvedReviewCount"), true);
  assert.equal(JSON.stringify(snapshot).includes("shopSlug"), false);
});

test("collectAnalyticsSnapshot isolates an unexpected source exception and retains other source facts", async () => {
  const sources = sourceData();
  const snapshot = await collectAnalyticsSnapshot({
    days: 28, now,
    sources: {
      collectGa4: async () => sources.ga4,
      collectGsc: async () => { throw new Error("credential value must not leak"); },
      collectSiteHealth: async () => sources.web,
      getContentHealth: async () => noData(),
    },
  });
  assert.equal(snapshot.period.days, 28);
  assert.equal(snapshot.sources.gsc.state, "api_error");
  assert.equal(snapshot.sources.content.state, "no_data");
  assert.equal(snapshot.overview.current.sessions, 10);
  assert.equal(JSON.stringify(snapshot).includes("credential value"), false);
});

test("GSC normalized page collisions are omitted independently of upstream row order", async () => {
  for (const entries of [
    ["https://mens-esthe-kuchikomi.com/area/sakai/?a=1", "https://mens-esthe-kuchikomi.com/area/sakai/?b=2"],
    ["https://mens-esthe-kuchikomi.com/area/sakai/?b=2", "https://mens-esthe-kuchikomi.com/area/sakai/?a=1"],
  ]) {
    const sources = sourceData();
    sources.gsc.data.pages.current.data.rows = entries.map((url, index) => ({ keys: [url], ...metric(index + 1, 10, 0.1, index + 1) }));
    const result = await collectAnalyticsSnapshot({ days: 7, now, sources: {
      collectGa4: async () => sources.ga4, collectGsc: async () => sources.gsc,
      collectSiteHealth: async () => sources.web, getContentHealth: async () => sources.content,
    } });
    assert.equal(result.pages.find((page) => page.path === "/area/sakai/").current.gsc.clicks, null);
    assert.equal(result.warnings.some((warning) => warning.code === "snapshot_gsc_normalization_collision_omitted"), true);
  }
});
