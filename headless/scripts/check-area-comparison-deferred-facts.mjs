import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSourceLoader } from "./lib/shop-detail-source-loader.mjs";

const root = resolve(import.meta.dirname, "..");
const modulePath = resolve(root, "lib/area-shop-comparison-facts.ts");
assert.ok(existsSync(modulePath), "shared comparison fact foundation must exist");

const facts = createSourceLoader()(modulePath);
assert.equal(typeof facts.confirmedComparisonFact, "function");
assert.equal(typeof facts.unknownComparisonFact, "function");
assert.equal(typeof facts.unavailableComparisonFact, "function");
assert.equal(typeof facts.visibleComparisonFieldKeys, "function");

const confirmed = facts.confirmedComparisonFact("10,000円", {
  sourceUrl: "https://example.com/menu",
  reviewedAt: "2026-09-18",
});
assert.deepEqual(
  { ...confirmed },
  { status: "confirmed", value: "10,000円", sourceUrl: "https://example.com/menu", reviewedAt: "2026-09-18" },
);
assert.deepEqual({ ...facts.unknownComparisonFact("public value missing") }, {
  status: "unknown", value: "未確認", reason: "public value missing",
});
assert.deepEqual({ ...facts.unavailableComparisonFact("not connected") }, {
  status: "unavailable", value: "未確認", reason: "not connected",
});

const baseKeys = ["hours", "afterMidnight", "line", "official", "access", "information"];
const deferredKeys = ["price", "webBooking"];
const unavailable = facts.unavailableComparisonFact("not connected");
const itemsWithoutDeferredFacts = [{
  hours: confirmed,
  afterMidnight: confirmed,
  line: confirmed,
  official: confirmed,
  access: confirmed,
  information: confirmed,
  price: unavailable,
  webBooking: unavailable,
}];
assert.deepEqual(
  Array.from(facts.visibleComparisonFieldKeys(itemsWithoutDeferredFacts, baseKeys, deferredKeys)),
  baseKeys,
  "all-unavailable deferred rows stay hidden",
);
const itemsWithFuturePrice = [
  ...itemsWithoutDeferredFacts,
  { ...itemsWithoutDeferredFacts[0], price: confirmed },
];
assert.deepEqual(
  Array.from(facts.visibleComparisonFieldKeys(itemsWithFuturePrice, baseKeys, deferredKeys)),
  [...baseKeys, "price"],
  "one future confirmed value makes the deferred row renderable",
);
assert.equal(JSON.stringify(unavailable).includes("0"), false, "missing price must not become zero");
assert.equal(JSON.stringify(unavailable).includes("false"), false, "missing Web booking must not become false");

console.log(JSON.stringify({ pass: true, statuses: 3, deferredCases: 2 }));
