#!/usr/bin/env node

/**
 * Headless 本番切替前の簡易 SEO / URL チェック CLI
 * Usage: node scripts/seo-cutover-check.mjs https://example.com
 *    or: npm run seo:cutover-check -- https://example.com
 */

const PATHS = [
  "/",
  "/shops/",
  "/column/",
  "/contact/",
  "/storelisting/",
  "/about/",
  "/sitemap/",
  "/osaka-nihonbashi/",
  "/area/osaka/",
  "/area/nihonbashi/"
];

const REDIRECT_CHECKS = [
  { path: "/listing/", expectStatus: [301, 308], expectLocationIncludes: "/storelisting" },
  { path: "/wp-sitemap.xml", expectStatus: [301, 308], expectLocationIncludes: "/sitemap.xml" },
  { path: "/sitemap_index.xml", expectStatus: [301, 308], expectLocationIncludes: "/sitemap.xml" }
];

const CANONICAL_CHECK_PATHS = [
  "/",
  "/shops/",
  "/column/",
  "/contact/",
  "/storelisting/",
  "/about/",
  "/osaka-nihonbashi/",
  "/area/osaka/",
  "/area/nihonbashi/"
];

const GA4_ID = "G-6XFMW5XKBW";
const SITEMAP_MIN_URLS = 300;
const SITEMAP_SHOP_SAMPLE_MAX = 5;

function usage() {
  console.error("Usage: node scripts/seo-cutover-check.mjs <base-url>");
  console.error("Example: npm run seo:cutover-check -- http://localhost:3000");
  process.exit(1);
}

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

async function fetchStatus(url, options = {}) {
  const res = await fetch(url, { redirect: "manual", ...options });
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    body: options.readBody ? await res.text() : ""
  };
}

function countSitemapUrls(xml) {
  return (xml.match(/<loc>/g) || []).length;
}

function extractShopUrlsFromSitemap(xml, base, max = SITEMAP_SHOP_SAMPLE_MAX) {
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const loc = match[1].trim();
    if (loc.includes("/shops/") && !loc.endsWith("/shops/")) {
      urls.push(loc);
      if (urls.length >= max) break;
    }
  }
  if (urls.length === 0) {
    return urls;
  }
  try {
    const origin = new URL(base).origin;
    return urls.map((u) => {
      try {
        return new URL(u).href;
      } catch {
        return `${origin}${u.startsWith("/") ? u : `/${u}`}`;
      }
    });
  } catch {
    return urls;
  }
}

function hasCanonical(html) {
  return /rel=["']canonical["']/i.test(html) || /<link[^>]+canonical/i.test(html);
}

function hasNoindex(html) {
  return /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function hasGa4(html) {
  return html.includes(GA4_ID) || html.includes("googletagmanager.com/gtag/js");
}

function extractScriptUrls(html, base) {
  const urls = new Set();
  const re = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      urls.add(new URL(match[1], base).href);
    } catch {
      urls.add(`${base}${match[1]}`);
    }
    if (urls.size >= 12) break;
  }
  return [...urls];
}

async function detectGa4(html, base) {
  if (hasGa4(html)) {
    return { ok: true, detail: `${GA4_ID} または gtag/js を HTML 内で検出` };
  }

  const scriptUrls = extractScriptUrls(html, base);
  for (const scriptUrl of scriptUrls) {
    try {
      const res = await fetch(scriptUrl);
      if (!res.ok) continue;
      const js = await res.text();
      if (hasGa4(js)) {
        return { ok: true, detail: "クライアント JS チャンク内で GA4 を検出" };
      }
    } catch {
      // try next chunk
    }
  }

  return { ok: false, detail: "GA4 タグが見つかりません（HTML と JS チャンクを確認）" };
}

function printRow(label, status, detail = "") {
  const icon = status === "OK" ? "✓" : status === "WARN" ? "!" : "✗";
  const line = detail ? `${label}: ${detail}` : label;
  console.log(`  ${icon} ${line}`);
}

async function checkRedirect(base, check, failures) {
  const url = `${base}${check.path}`;
  try {
    const { status, location } = await fetchStatus(url);
    const statusOk = check.expectStatus.includes(status);
    const locOk = location.includes(check.expectLocationIncludes);
    if (statusOk && locOk) {
      printRow(check.path, "OK", `${status} → ${location}`);
    } else {
      printRow(check.path, "FAIL", `${status} location=${location || "(none)"}`);
      failures += 1;
    }
  } catch (err) {
    printRow(check.path, "FAIL", err instanceof Error ? err.message : "fetch error");
    failures += 1;
  }
  return failures;
}

async function main() {
  const baseArg = process.argv[2];
  if (!baseArg) usage();

  const base = normalizeBase(baseArg);
  if (!base) {
    console.error("無効なベース URL:", baseArg);
    process.exit(1);
  }

  console.log(`\nEscomi Headless – SEO 切替チェック`);
  console.log(`対象: ${base}\n`);

  let failures = 0;
  let warnings = 0;
  let sitemapBody = "";

  console.log("── 主要ページ HTTP ステータス ──");
  for (const path of PATHS) {
    const url = `${base}${path}`;
    try {
      const { status } = await fetchStatus(url);
      if (status === 200) {
        printRow(path, "OK", String(status));
      } else if (status >= 300 && status < 400) {
        printRow(path, "WARN", `${status}（リダイレクト）`);
        warnings += 1;
      } else {
        printRow(path, "FAIL", String(status));
        failures += 1;
      }
    } catch (err) {
      printRow(path, "FAIL", err instanceof Error ? err.message : "fetch error");
      failures += 1;
    }
  }

  console.log("\n── リダイレクト確認 ──");
  for (const check of REDIRECT_CHECKS) {
    failures = await checkRedirect(base, check, failures);
  }

  console.log("\n── robots.txt / sitemap.xml ──");
  try {
    const robots = await fetchStatus(`${base}/robots.txt`, { readBody: true });
    if (robots.status === 200) {
      const hasSitemap = robots.body.includes("Sitemap:");
      printRow("/robots.txt", hasSitemap ? "OK" : "WARN", `${robots.status}${hasSitemap ? "" : "（Sitemap: 行なし）"}`);
      if (!hasSitemap) warnings += 1;
    } else {
      printRow("/robots.txt", "FAIL", String(robots.status));
      failures += 1;
    }
  } catch (err) {
    printRow("/robots.txt", "FAIL", err instanceof Error ? err.message : "fetch error");
    failures += 1;
  }

  try {
    const sitemap = await fetchStatus(`${base}/sitemap.xml`, { readBody: true });
    if (sitemap.status === 200) {
      sitemapBody = sitemap.body;
      const count = countSitemapUrls(sitemapBody);
      printRow("/sitemap.xml", "OK", `${sitemap.status} – ${count} URLs`);
      if (count < SITEMAP_MIN_URLS) {
        printRow("sitemap 件数", "WARN", `${count}件（目安 ${SITEMAP_MIN_URLS} 件以上）`);
        warnings += 1;
      } else {
        printRow("sitemap 件数", "OK", `${count}件（${SITEMAP_MIN_URLS}件以上）`);
      }
    } else {
      printRow("/sitemap.xml", "FAIL", String(sitemap.status));
      failures += 1;
    }
  } catch (err) {
    printRow("/sitemap.xml", "FAIL", err instanceof Error ? err.message : "fetch error");
    failures += 1;
  }

  console.log("\n── canonical / noindex（主要ページ HTML）──");
  for (const path of CANONICAL_CHECK_PATHS) {
    const url = `${base}${path}`;
    try {
      const { status, body } = await fetchStatus(url, { readBody: true });
      if (status !== 200) {
        printRow(path, "FAIL", `HTML取得不可 (${status})`);
        failures += 1;
        continue;
      }
      const canonicalOk = hasCanonical(body);
      const noindexFound = hasNoindex(body);
      if (canonicalOk && !noindexFound) {
        printRow(path, "OK", "canonical あり / noindex なし");
      } else {
        if (!canonicalOk) {
          printRow(path, "FAIL", "canonical なし");
          failures += 1;
        }
        if (noindexFound) {
          printRow(path, "FAIL", "noindex が含まれています");
          failures += 1;
        }
      }
    } catch (err) {
      printRow(path, "FAIL", err instanceof Error ? err.message : "fetch error");
      failures += 1;
    }
  }

  console.log("\n── GA4（トップページ HTML）──");
  try {
    const { status, body } = await fetchStatus(`${base}/`, { readBody: true });
    if (status !== 200) {
      printRow("トップページ GA4", "FAIL", `HTML取得不可 (${status})`);
      failures += 1;
    } else {
      const ga = await detectGa4(body, base);
      if (ga.ok) {
        printRow("トップページ GA4", "OK", ga.detail);
      } else {
        printRow("トップページ GA4", "FAIL", ga.detail);
        failures += 1;
      }
    }
  } catch (err) {
    printRow("トップページ GA4", "FAIL", err instanceof Error ? err.message : "fetch error");
    failures += 1;
  }

  console.log("\n── sitemap 内店舗 URL サンプル（最大5件）──");
  if (sitemapBody) {
    const shopUrls = extractShopUrlsFromSitemap(sitemapBody, base);
    if (shopUrls.length === 0) {
      printRow("店舗 URL サンプル", "WARN", "sitemap から /shops/ URL を抽出できませんでした");
      warnings += 1;
    } else {
      for (const shopUrl of shopUrls) {
        try {
          const { status } = await fetchStatus(shopUrl);
          if (status === 200) {
            printRow(shopUrl.replace(base, "") || shopUrl, "OK", "200");
          } else {
            printRow(shopUrl.replace(base, "") || shopUrl, "FAIL", String(status));
            failures += 1;
          }
        } catch (err) {
          printRow(shopUrl, "FAIL", err instanceof Error ? err.message : "fetch error");
          failures += 1;
        }
      }
    }
  } else {
    printRow("店舗 URL サンプル", "WARN", "sitemap.xml を先に取得できなかったためスキップ");
    warnings += 1;
  }

  console.log("\n── 404 サンプル ──");
  const fakePath = "/this-page-should-not-exist-404-test/";
  try {
    const { status } = await fetchStatus(`${base}${fakePath}`);
    if (status === 404) {
      printRow(fakePath, "OK", "404");
    } else {
      printRow(fakePath, "WARN", `${status}（404 であることが望ましい）`);
      warnings += 1;
    }
  } catch (err) {
    printRow(fakePath, "FAIL", err instanceof Error ? err.message : "fetch error");
    failures += 1;
  }

  console.log("\n── 結果 ──");
  if (failures === 0 && warnings === 0) {
    console.log("  すべて合格です。切替チェックリストの手動項目も確認してください。");
  } else if (failures === 0) {
    console.log(`  警告のみ: ${warnings} 件（exit 0）。pm/HEADLESS-CUTOVER-CHECKLIST.md も参照してください。`);
  } else {
    console.log(`  失敗: ${failures} / 警告: ${warnings}`);
    console.log("  詳細は pm/HEADLESS-CUTOVER-CHECKLIST.md を参照してください。");
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
