import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(join(root, file), "utf8");

const stripHtml = (value) =>
  typeof value === "string"
    ? value
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : "";

const seoSource = read("lib/seo.ts");
const seoCompiled = ts.transpileModule(seoSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const seoModule = { exports: {} };

vm.runInNewContext(
  seoCompiled,
  {
    module: seoModule,
    exports: seoModule.exports,
    console,
    require: (id) => {
      if (id === "@/lib/wp/client") return { stripHtml };
      if (id === "@/lib/shop-contact") return { resolveShopAreaTerm: () => null };
      if (id === "@/lib/price-normalization") {
        return {
          resolveShopPrimaryPrice: () => ({ status: "unknown", amount: null }),
          shouldOutputPriceSchema: () => false,
          formatPriceForDisplay: () => null
        };
      }
      throw new Error(`Unsupported test require: ${id}`);
    }
  },
  { filename: "seo.cjs" }
);

const { canonicalUrl, pageMetadata } = seoModule.exports;
const noindexRobots = { index: false, follow: false };

const reviewMetadata = pageMetadata({
  title: "口コミを投稿する",
  description: "口コミ投稿ページ",
  path: "/reviews/submit/",
  robots: noindexRobots
});
assert.equal(
  reviewMetadata.alternates.canonical,
  canonicalUrl("/reviews/submit/"),
  "口コミ投稿ページは自己canonicalを返す必要があります"
);
assert.deepEqual(
  reviewMetadata.robots,
  noindexRobots,
  "pageMetadata は noindex robots 指定を保持する必要があります"
);

const dashboardPage = read("app/dashboard/page.tsx");
assert.ok(dashboardPage.includes("pageMetadata({"), "/dashboard/ は pageMetadata で metadata を定義する必要があります");
assert.ok(dashboardPage.includes('path: "/dashboard/"'), "/dashboard/ は自己canonicalを指定する必要があります");
assert.ok(dashboardPage.includes("index: false"), "/dashboard/ は noindex にする必要があります");
assert.ok(dashboardPage.includes("follow: false"), "/dashboard/ は nofollow にする必要があります");

const analyticsLayoutPath = join(root, "app/dashboard/analytics/layout.tsx");
assert.ok(existsSync(analyticsLayoutPath), "/dashboard/analytics/ は client page とは別に metadata 用 layout が必要です");
const analyticsLayout = read("app/dashboard/analytics/layout.tsx");
assert.ok(analyticsLayout.includes("pageMetadata({"), "/dashboard/analytics/ は pageMetadata で metadata を定義する必要があります");
assert.ok(
  analyticsLayout.includes('path: "/dashboard/analytics/"'),
  "/dashboard/analytics/ は自己canonicalを指定する必要があります"
);
assert.ok(analyticsLayout.includes("index: false"), "/dashboard/analytics/ は noindex にする必要があります");
assert.ok(analyticsLayout.includes("follow: false"), "/dashboard/analytics/ は nofollow にする必要があります");

const reviewSubmitPage = read("app/reviews/submit/page.tsx");
assert.ok(reviewSubmitPage.includes("pageMetadata({"), "/reviews/submit/ は pageMetadata で metadata を定義する必要があります");
assert.ok(
  reviewSubmitPage.includes('path: "/reviews/submit/"'),
  "/reviews/submit/ は query を含まない自己canonicalを指定する必要があります"
);
assert.ok(reviewSubmitPage.includes("index: false"), "/reviews/submit/ は noindex にする必要があります");
assert.ok(reviewSubmitPage.includes("follow: false"), "/reviews/submit/ は nofollow にする必要があります");

const middleware = read("middleware.ts");
assert.ok(
  middleware.includes('"X-Robots-Tag": "noindex, nofollow"'),
  "Basic認証の401応答にも X-Robots-Tag を付ける必要があります"
);

const pkg = read("package.json");
assert.ok(pkg.includes("test:q06-seo-metadata"), "Q-06検査は npm test に接続する必要があります");

console.log("Q-06 SEO metadata checks passed");
