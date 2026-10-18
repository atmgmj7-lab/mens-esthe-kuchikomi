import assert from "node:assert/strict";

const baseUrl = process.env.ESKOMI_PUBLIC_HTTP_BASE_URL ?? "http://127.0.0.1:57000";
const canonicalOrigin = "https://mens-esthe-kuchikomi.com";
const privateReviewMarker = "PRIVATE_REVIEW_MUST_NOT_BE_PUBLIC";
const pages = [
  ["/", "Eskomi"],
  ["/area/fixture-area/", "Fixture area"],
  ["/shops/fixture-partner-store/", "Fixture corrected"],
  ["/reviews/", "口コミ"],
];

for (const [path, expectedBody] of pages) {
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  const html = await response.text();
  assert.equal(response.status, 200, `${path} must return public HTTP 200`);
  assert.match(html, /<title>[^<]+<\/title>/u, `${path} must return a title`);
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${canonicalOrigin}${path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}"`, "u"), `${path} must return its canonical URL`);
  assert.match(html, new RegExp(expectedBody, "u"), `${path} must render representative public body content`);
  assert.doesNotMatch(html, new RegExp(privateReviewMarker, "u"), `${path} must not expose the fixture's non-public review`);
}

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
