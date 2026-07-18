import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shopDetailSource = readFileSync("components/ShopDetail.tsx", "utf8");
const heroSource = readFileSync(
  "components/shop-detail/ShopDetailHero.tsx",
  "utf8"
);
const reviewDashboardSource = readFileSync(
  "components/shop-detail/ShopReviewDashboard.tsx",
  "utf8"
);
const moduleRegistrySource = readFileSync("lib/shop-detail-modules.ts", "utf8");
const cssSource = readFileSync(
  "components/shop-detail/ShopDetail.module.css",
  "utf8"
);

const failures = [];

function check(label, assertion) {
  try {
    assertion();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

check("profile grid marker", () => {
  assert.ok(shopDetailSource.includes('data-shop-profile-grid="true"'));
});
check("obsolete visual aside", () => {
  assert.ok(!shopDetailSource.includes("visualAside"));
});
check("fixed CTA placement", () => {
  assert.equal((shopDetailSource.match(/<ShopDetailActions/g) ?? []).length, 1);
});
check("hero CTA placement", () => {
  assert.ok(heroSource.includes("<ShopDetailActions"));
});
check("desktop profile layout", () => {
  assert.match(
    cssSource,
    /\.detailGrid\s*\{[^}]*grid-template-areas:[\s\S]*"visual hero"[\s\S]*"content content"/
  );
});
check("desktop title scale", () => {
  assert.match(cssSource, /\.title\s*\{[\s\S]*--shop-title-size:\s*34px/);
});
check("mobile CTA handoff", () => {
  assert.match(
    cssSource,
    /@media \(max-width:\s*760px\)[\s\S]*\.hero \.actions\s*\{\s*display:\s*none/
  );
});
check("server-rendered review dashboard", () => {
  assert.ok(!reviewDashboardSource.includes('"use client"'));
  assert.ok(reviewDashboardSource.includes("<svg"));
  assert.ok(reviewDashboardSource.includes("model.latest"));
});
check("review text measure", () => {
  assert.match(cssSource, /\.reviews\s*\{[^}]*max-width:\s*960px/);
});
check("single article width", () => {
  assert.match(cssSource, /\.shell\s*\{[^}]*max-width:\s*1200px/);
});
check("registry owns module order", () => {
  assert.ok(shopDetailSource.includes("getVisibleShopDetailModules"));
  for (const id of ["reviews", "shop-information", "prices", "features", "map-access", "basic-information", "nearby"]) {
    assert.ok(moduleRegistrySource.includes(`id: "${id}"`));
  }
});

assert.equal(
  failures.length,
  0,
  `shop detail density contract failed:\n- ${failures.join("\n- ")}`
);

console.log("shop detail density contract: PASS");
