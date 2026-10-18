import assert from "node:assert/strict";

const baseUrl = process.env.ESKOMI_PUBLIC_HTTP_BASE_URL ?? "http://127.0.0.1:57000";
const canonicalOrigin = "https://mens-esthe-kuchikomi.com";
const privateReviewMarker = "PRIVATE_REVIEW_MUST_NOT_BE_PUBLIC";
const publicReviewMarker = "PUBLIC_REVIEW_MUST_BE_VISIBLE";
const widgetPath = "/partner/widget/11111111-1111-4111-8111-111111111111/";
const pages = [
  ["/", "Eskomi"],
  ["/area/fixture-area/", "Fixture area"],
  ["/shops/fixture-partner-store/", "Fixture corrected"],
  ["/reviews/", "口コミ"],
];

const rendered = new Map();

for (const [path, expectedBody] of pages) {
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  const html = await response.text();
  assert.equal(response.status, 200, `${path} must return public HTTP 200`);
  assert.match(html, /<title>[^<]+<\/title>/u, `${path} must return a title`);
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${canonicalOrigin}${path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u"), `${path} must return its canonical URL`);
  assert.match(html, new RegExp(expectedBody, "u"), `${path} must render representative public body content`);
  assert.doesNotMatch(html, new RegExp(privateReviewMarker, "u"), `${path} must not expose the fixture's non-public review`);
  rendered.set(path, html);
}

for (const path of ["/reviews/", "/shops/fixture-partner-store/"]) {
  const html = rendered.get(path) ?? "";
  assert.match(html, new RegExp(publicReviewMarker, "u"), `${path} must render the fixture's approved Supabase public review`);
}

const widgetResponse = await fetch(new URL(widgetPath, baseUrl), { cache: "no-store" });
const widgetHtml = await widgetResponse.text();
assert.equal(widgetResponse.status, 200, "partner widget must return public HTTP 200 for the fixture handle");
assert.match(widgetHtml, new RegExp(publicReviewMarker, "u"), "partner widget must render the fixture's approved Supabase public review");
assert.doesNotMatch(widgetHtml, new RegExp(privateReviewMarker, "u"), "partner widget must not expose the fixture's non-public review");

const robots = await (await fetch(new URL("/robots.txt", baseUrl), { cache: "no-store" })).text();
assert.match(robots, /User-Agent: \*/u, "robots must include the crawler rule");
assert.match(robots, new RegExp(`Sitemap: ${canonicalOrigin}/sitemap\\.xml`, "u"), "robots must reference the canonical sitemap");

const sitemap = await (await fetch(new URL("/sitemap.xml", baseUrl), { cache: "no-store" })).text();
// The fixture's managed shop is supplied only by the local Supabase delivery
// path; sitemap currently reads the isolated WordPress fixture and therefore
// must not be used as a pre-unlisting inclusion assertion. The runner below
// verifies the required post-unlisting sitemap exclusion through actual HTTP.
assert.doesNotMatch(sitemap, new RegExp(privateReviewMarker, "u"), "sitemap must not expose non-public review content");

console.log("Eskomi public HTTP SEO and non-public-review exclusion: PASS");
