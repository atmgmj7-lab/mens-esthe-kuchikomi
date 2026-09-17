import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const experience = read("components/area/comparison/AreaShopComparisonExperience.tsx");
const comparisonCss = read("components/area/comparison/AreaShopComparisonExperience.module.css");
const globals = read("app/globals.css");
const natural = read("components/common/AreaShopCard.tsx");
const featured = read("components/area/hub/AreaEditorialFeaturedShopCard.tsx");

assert.match(experience, /data-area-comparison-scroll-lock/, "open dialog exposes scroll lock state");
assert.match(experience, /const root = document\.documentElement;[\s\S]+root\.style\.overflow = "hidden"/, "dialog locks root scrolling");
assert.match(experience, /const body = document\.body;[\s\S]+body\.style\.overflow = "hidden"/, "dialog locks body scrolling");
assert.match(experience, /requestAnimationFrame\(\(\) => openerRef\.current\?\.focus\(\)\)/, "close restores opener focus");
assert.match(experience, /onCancel=/, "Escape/cancel is handled");
assert.match(experience, /<noscript>/, "comparison controls have a no-JS fallback");
assert.match(globals, /data-area-comparison-launcher[^\n]+data-active="true"[^\n]+\.escomi-final-site-footer/, "active launcher gives the footer clearance");
assert.match(globals, /data-area-comparison-launcher[^\n]+data-active="true"[^\n]+\.hl-back-to-top/, "top control clears active launcher");
assert.match(comparisonCss, /min-height:\s*44px/, "comparison controls retain accessible target size");
assert.match(natural, /data-review-prefill="natural"/, "natural cards retain review action");
assert.match(featured, /data-review-prefill="featured"/, "featured cards retain review action");

console.log(JSON.stringify({ pass: true, uxContracts: 11 }));
