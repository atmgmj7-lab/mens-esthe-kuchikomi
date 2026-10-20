import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const output = process.env.PUBLICATION_EXECUTION_PAGE_CAPTURE;
const wpBaseUrl = process.env.ESKOMI_WORDPRESS_PUBLIC_API ?? "https://mens-esthe-kuchikomi.com/wp-json/wp/v2";
const projectRef = process.env.ESKOMI_SUPABASE_PROJECT_REF ?? "goeagrxjsjcbbatpotbu";
const pageSpecs = Object.freeze([
  ["/about/", "about", 316], ["/contact/", "contact", 323], ["/sitemap/", "sitemap", 321],
  ["/storelisting/", "storelisting", 319], ["/osaka-nihonbashi/", "osaka-nihonbashi", 343]
]);

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function uuidFor(route) {
  const hex = sha256(`eskomi-publication-execution-v1:${route}`);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function staticPages() {
  const source = readFileSync(join(repoRoot, "headless", "lib", "static-pages.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  return module.exports;
}
function media357() {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "supabase", "imports", "wp-media-preservation", "20261019-wp-media-preservation-v1", "manifest-reconciled.json"), "utf8"));
  const item = manifest.objects?.find((entry) => entry.wp_media_id === 357);
  if (!item?.sha256 || !item?.source_url || !item?.proposed_target?.object_key) throw new Error("media 357 preservation manifest is incomplete");
  return {
    wpMediaId: 357,
    sourceUrl: item.source_url,
    sourceSha256: item.sha256,
    targetUrl: `https://${projectRef}.supabase.co/storage/v1/object/public/shop-images/${item.proposed_target.object_key}`,
    targetBucket: "shop-images",
    targetObjectKey: item.proposed_target.object_key,
    referencedByRoute: "/osaka-nihonbashi/",
    transferState: "not-uploaded-and-not-verified"
  };
}
async function getPage(id) {
  const response = await fetch(`${wpBaseUrl}/pages/${id}?context=view`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`WordPress page ${id} read failed: HTTP ${response.status}`);
  return response.json();
}
async function main() {
  if (!output) throw new Error("PUBLICATION_EXECUTION_PAGE_CAPTURE must name an ignored JSON output path");
  if (!output.includes("supabase/imports/publication-execution/") || existsSync(output)) throw new Error("capture output must be a new ignored publication-execution JSON file");
  const statics = staticPages();
  const fixedMedia = media357();
  const pages = [];
  for (const [routeKey, slug, sourceId] of pageSpecs) {
    const page = await getPage(sourceId);
    if (routeKey === "/osaka-nihonbashi/" && page.featured_media !== 357) throw new Error("Nihonbashi fixed page must retain WordPress featured media 357");
    const wordpressHtml = page?.content?.rendered ?? "";
    const bodyHtml = wordpressHtml.trim() || statics.getStaticPageFallback(slug);
    pages.push({
      contentId: uuidFor(routeKey), routeKey, title: statics.getStaticPageMeta(slug).title,
      bodyHtml: routeKey === "/osaka-nihonbashi/" ? bodyHtml.replaceAll(fixedMedia.sourceUrl, fixedMedia.targetUrl) : bodyHtml,
      bodyText: bodyHtml.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim(),
      source: "wordpress-readonly", sourceId, sourceModified: page.modified_gmt ? `${page.modified_gmt}Z` : page.modified,
      bodyOrigin: wordpressHtml.trim() ? "wordpress-rendered-readonly" : "application-fallback-for-empty-wordpress-body",
      wordpressFeaturedMediaId: page.featured_media || null,
      wordpressBodySha256: sha256(wordpressHtml)
    });
  }
  const advertise = "advertise";
  const advertiseHtml = statics.getStaticPageFallback(advertise);
  pages.push({
    contentId: uuidFor("/advertise/"), routeKey: "/advertise/", title: statics.getStaticPageMeta(advertise).title,
    bodyHtml: advertiseHtml, bodyText: advertiseHtml.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim(),
    source: "application-fallback", sourceId: null, sourceModified: null, bodyOrigin: "existing-application-static-fallback"
  });
  writeFileSync(output, `${JSON.stringify({ schema: 1, capturedAt: new Date().toISOString(), source: "readonly-public-wordpress-and-existing-application", pages, fixedPageMedia: fixedMedia }, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({ output, pages: pages.map(({ bodyHtml, bodyText, ...page }) => ({ ...page, bodyHtmlBytes: Buffer.byteLength(bodyHtml), bodyTextBytes: Buffer.byteLength(bodyText) })), fixedPageMedia: fixedMedia }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
