#!/usr/bin/env node

/**
 * Headless 切替前の URL パリティチェック（現行 WP vs 候補 Next）
 * Usage:
 *   node scripts/url-parity-check.mjs --current https://mens-esthe-kuchikomi.com --candidate http://localhost:3000
 *   npm run seo:url-parity -- --current <url> --candidate <url> [--sample-shops 20] [--output reports/parity.json]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const KEY_PATHS = [
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

const FIXED_PAGE_SLUGS = [
  "contact",
  "about",
  "sitemap",
  "storelisting",
  "osaka-nihonbashi"
];

const SITEMAP_CANDIDATES = ["/sitemap.xml", "/wp-sitemap.xml"];
const ACCEPTABLE_CANDIDATE_STATUSES = new Set([200, 301, 308]);

function usage() {
  console.error("Usage: node scripts/url-parity-check.mjs --current <url> --candidate <url>");
  console.error("Options:");
  console.error("  --sample-shops <n>  店舗 URL サンプル数（既定: 20）");
  console.error("  --output <path>     JSON レポート出力先");
  console.error("Example:");
  console.error(
    "  npm run seo:url-parity -- --current https://mens-esthe-kuchikomi.com --candidate http://localhost:3000"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    sampleShops: 20,
    output: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--current" && argv[i + 1]) {
      args.current = argv[++i];
    } else if (token === "--candidate" && argv[i + 1]) {
      args.candidate = argv[++i];
    } else if (token === "--sample-shops" && argv[i + 1]) {
      const n = Number.parseInt(argv[++i], 10);
      if (!Number.isFinite(n) || n < 0) {
        console.error("無効な --sample-shops 値です:", argv[i]);
        process.exit(1);
      }
      args.sampleShops = n;
    } else if (token === "--output" && argv[i + 1]) {
      args.output = argv[++i];
    } else if (token === "--help" || token === "-h") {
      usage();
    } else {
      console.error("不明な引数:", token);
      usage();
    }
  }

  if (!args.current || !args.candidate) {
    usage();
  }

  return args;
}

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  return decoded.endsWith("/") ? decoded : `${decoded}/`;
}

function pathnameFromUrl(urlString, baseOrigin) {
  try {
    const url = new URL(urlString, baseOrigin);
    return normalizePathname(url.pathname);
  } catch {
    return null;
  }
}

function isAreaPath(path) {
  return /^\/area\/[^/]+\/$/.test(path);
}

function isShopPath(path) {
  return /^\/shops\/[^/]+\/$/.test(path);
}

function isFixedPagePath(path) {
  const match = path.match(/^\/([^/]+)\/$/);
  if (!match) {
    return false;
  }
  return FIXED_PAGE_SLUGS.includes(match[1]);
}

function isXmlContent(contentType, body) {
  const type = (contentType || "").toLowerCase();
  if (type.includes("xml")) {
    return true;
  }
  const trimmed = body.trimStart();
  return trimmed.startsWith("<?xml") || trimmed.startsWith("<");
}

function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(xml);
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());
}

function isChildSitemapUrl(urlString) {
  try {
    const { pathname } = new URL(urlString);
    return /\.xml$/i.test(pathname);
  } catch {
    return /\.xml(\?|$)/i.test(urlString);
  }
}

async function fetchWithManualRedirect(url, readBody = false) {
  const res = await fetch(url, { redirect: "manual" });
  const contentType = res.headers.get("content-type") || "";
  const body = readBody ? await res.text() : "";
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    contentType,
    body
  };
}

async function resolveSitemapEntry(base) {
  for (const candidatePath of SITEMAP_CANDIDATES) {
    const entryUrl = `${base}${candidatePath}`;
    try {
      const first = await fetchWithManualRedirect(entryUrl, true);
      if (first.status === 200 && isXmlContent(first.contentType, first.body)) {
        return { entryUrl, body: first.body, hops: [] };
      }

      if ([301, 302, 307, 308].includes(first.status) && first.location) {
        const resolved = new URL(first.location, entryUrl).href;
        const second = await fetchWithManualRedirect(resolved, true);
        if (second.status === 200 && isXmlContent(second.contentType, second.body)) {
          return {
            entryUrl: resolved,
            body: second.body,
            hops: [{ from: entryUrl, status: first.status, location: first.location }]
          };
        }
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function fetchSitemapDocument(url, visited) {
  if (visited.has(url)) {
    return "";
  }
  visited.add(url);

  const res = await fetchWithManualRedirect(url, true);
  if (res.status !== 200 || !isXmlContent(res.contentType, res.body)) {
    return "";
  }
  return res.body;
}

async function collectSitemapPageUrls(entryUrl, entryBody, visited = new Set()) {
  const pagePaths = new Set();
  const queue = [{ url: entryUrl, body: entryBody }];

  while (queue.length > 0) {
    const item = queue.shift();
    const xml = item.body || (await fetchSitemapDocument(item.url, visited));
    if (!xml) {
      continue;
    }

    const locs = extractLocs(xml);
    if (isSitemapIndex(xml)) {
      for (const loc of locs) {
        if (isChildSitemapUrl(loc)) {
          queue.push({ url: loc, body: "" });
        }
      }
      continue;
    }

    for (const loc of locs) {
      if (isChildSitemapUrl(loc)) {
        queue.push({ url: loc, body: "" });
        continue;
      }
      const path = pathnameFromUrl(loc);
      if (path) {
        pagePaths.add(path);
      }
    }
  }

  return pagePaths;
}

async function loadSitemapPaths(base) {
  const entry = await resolveSitemapEntry(base);
  if (!entry) {
    return {
      entryUrl: null,
      paths: new Set(),
      error: "sitemap を取得できませんでした（/sitemap.xml と /wp-sitemap.xml を確認）"
    };
  }

  const paths = await collectSitemapPageUrls(entry.entryUrl, entry.body);
  return {
    entryUrl: entry.entryUrl,
    paths,
    error: null
  };
}

function buildCheckedPaths(currentSitemapPaths, sampleShops) {
  const checked = new Set(KEY_PATHS.map((path) => normalizePathname(path)));

  for (const path of currentSitemapPaths) {
    if (isAreaPath(path) || isFixedPagePath(path)) {
      checked.add(path);
    }
  }

  const shopPaths = [...currentSitemapPaths].filter(isShopPath).sort();
  const sampledShopPaths = shopPaths.slice(0, sampleShops);
  for (const path of sampledShopPaths) {
    checked.add(path);
  }

  return {
    checkedPaths: [...checked].sort(),
    shopPaths,
    sampledShopPaths,
    unsampledShopCount: Math.max(shopPaths.length - sampledShopPaths.length, 0)
  };
}

function hasCanonical(html) {
  return /rel=["']canonical["']/i.test(html) || /<link[^>]+canonical/i.test(html);
}

function hasNoindex(html) {
  return /name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function isHtmlPath(path) {
  return !/\.[a-z0-9]+$/i.test(path) || path.endsWith("/");
}

async function inspectUrl(base, path) {
  const url = `${base}${path === "/" ? "/" : path}`;
  const html = isHtmlPath(path);

  try {
    const res = await fetchWithManualRedirect(url, true);
    return {
      url,
      status: res.status,
      location: res.location,
      title: html ? extractTitle(res.body) : "",
      canonical: html ? hasCanonical(res.body) : null,
      noindex: html ? hasNoindex(res.body) : null,
      isHtml: html,
      error: null
    };
  } catch (err) {
    return {
      url,
      status: 0,
      location: "",
      title: "",
      canonical: null,
      noindex: null,
      isHtml: html,
      error: err instanceof Error ? err.message : "fetch error"
    };
  }
}

function printRow(label, status, detail = "") {
  const icon = status === "OK" ? "✓" : status === "WARN" ? "!" : "✗";
  const line = detail ? `${label}: ${detail}` : label;
  console.log(`  ${icon} ${line}`);
}

function evaluatePathCheck(path, current, candidate) {
  const issues = [];
  const warnings = [];

  if (current.error) {
    warnings.push(`現行取得エラー: ${current.error}`);
  }
  if (candidate.error) {
    issues.push(`候補取得エラー: ${candidate.error}`);
  }

  if (current.status === 200 && !ACCEPTABLE_CANDIDATE_STATUSES.has(candidate.status)) {
    issues.push(
      `現行 200 に対し候補が ${candidate.status}（200/301/308 以外）`
    );
  }

  if (candidate.status === 200 && candidate.isHtml) {
    if (!candidate.canonical) {
      issues.push("候補 200 だが canonical なし");
    }
    if (candidate.noindex) {
      issues.push("候補 200 だが noindex あり");
    }
  }

  if (
    current.status === 200 &&
    candidate.status === 200 &&
    current.isHtml &&
    candidate.isHtml &&
    current.title &&
    candidate.title &&
    current.title !== candidate.title
  ) {
    warnings.push(`タイトル不一致: 現行「${current.title}」/ 候補「${candidate.title}」`);
  }

  return { issues, warnings };
}

function evaluateSitemapParity(path, currentPaths, candidatePaths, issues) {
  if (!currentPaths.has(path)) {
    return;
  }
  if (!candidatePaths.has(path)) {
    issues.push("候補 sitemap に現行 sitemap で存在するパスがありません");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const currentBase = normalizeBase(args.current);
  const candidateBase = normalizeBase(args.candidate);

  if (!currentBase || !candidateBase) {
    console.error("無効なベース URL です。--current と --candidate を確認してください。");
    process.exit(1);
  }

  console.log("\nEscomi Headless – URL パリティチェック");
  console.log(`現行（WP）: ${currentBase}`);
  console.log(`候補（Next）: ${candidateBase}`);
  console.log(`店舗サンプル数: ${args.sampleShops}\n`);

  let failures = 0;
  let warnings = 0;

  console.log("── sitemap 取得 ──");
  const [currentSitemap, candidateSitemap] = await Promise.all([
    loadSitemapPaths(currentBase),
    loadSitemapPaths(candidateBase)
  ]);

  if (currentSitemap.error) {
    printRow("現行 sitemap", "WARN", currentSitemap.error);
    warnings += 1;
  } else {
    printRow("現行 sitemap", "OK", `${currentSitemap.entryUrl} – ${currentSitemap.paths.size} URLs`);
  }

  if (candidateSitemap.error) {
    printRow("候補 sitemap", "FAIL", candidateSitemap.error);
    failures += 1;
  } else {
    printRow("候補 sitemap", "OK", `${candidateSitemap.entryUrl} – ${candidateSitemap.paths.size} URLs`);
  }

  const { checkedPaths, shopPaths, sampledShopPaths, unsampledShopCount } = buildCheckedPaths(
    currentSitemap.paths,
    args.sampleShops
  );

  if (unsampledShopCount > 0) {
    printRow(
      "店舗サンプル",
      "WARN",
      `現行 sitemap の店舗 ${shopPaths.length} 件のうち ${sampledShopPaths.length} 件のみ検査（未サンプル ${unsampledShopCount} 件）`
    );
    warnings += 1;
  } else if (shopPaths.length > 0) {
    printRow("店舗サンプル", "OK", `${shopPaths.length} 件をすべて検査`);
  }

  console.log(`\n── URL 比較（${checkedPaths.length} 件）──`);

  const reportChecks = [];

  for (const path of checkedPaths) {
    const [current, candidate] = await Promise.all([
      inspectUrl(currentBase, path),
      inspectUrl(candidateBase, path)
    ]);

    const { issues, warnings: pathWarnings } = evaluatePathCheck(path, current, candidate);
    evaluateSitemapParity(path, currentSitemap.paths, candidateSitemap.paths, issues);

    const statusLabel =
      issues.length > 0 ? "FAIL" : pathWarnings.length > 0 ? "WARN" : "OK";

    const detail = [
      `現行 ${current.status}`,
      `候補 ${candidate.status}`,
      candidate.location ? `候補 Location ${candidate.location}` : null,
      current.title ? `現行 title「${current.title}」` : null,
      candidate.title ? `候補 title「${candidate.title}」` : null,
      candidate.canonical === false ? "候補 canonical なし" : null,
      candidate.noindex ? "候補 noindex あり" : null
    ]
      .filter(Boolean)
      .join(" / ");

    printRow(path, statusLabel, detail);

    for (const issue of issues) {
      printRow(`  ${path}`, "FAIL", issue);
      failures += 1;
    }
    for (const warn of pathWarnings) {
      printRow(`  ${path}`, "WARN", warn);
      warnings += 1;
    }

    reportChecks.push({
      path,
      current: {
        status: current.status,
        location: current.location,
        title: current.title,
        canonical: current.canonical,
        noindex: current.noindex,
        error: current.error
      },
      candidate: {
        status: candidate.status,
        location: candidate.location,
        title: candidate.title,
        canonical: candidate.canonical,
        noindex: candidate.noindex,
        error: candidate.error
      },
      issues,
      warnings: pathWarnings
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    current: currentBase,
    candidate: candidateBase,
    sampleShops: args.sampleShops,
    summary: {
      checkedCount: checkedPaths.length,
      failures,
      warnings,
      passed: failures === 0
    },
    sitemap: {
      current: {
        entryUrl: currentSitemap.entryUrl,
        urlCount: currentSitemap.paths.size,
        error: currentSitemap.error
      },
      candidate: {
        entryUrl: candidateSitemap.entryUrl,
        urlCount: candidateSitemap.paths.size,
        error: candidateSitemap.error
      }
    },
    sampling: {
      shopTotalInCurrentSitemap: shopPaths.length,
      shopSampled: sampledShopPaths.length,
      shopUnsampled: unsampledShopCount
    },
    checks: reportChecks
  };

  if (args.output) {
    const outputPath = resolve(process.cwd(), args.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\nJSON レポート: ${outputPath}`);
  }

  console.log("\n── 結果 ──");
  if (failures === 0 && warnings === 0) {
    console.log("  すべて合格です。続けて手動の目視比較（HEADLESS-CUTOVER-CHECKLIST.md §4）を行ってください。");
  } else if (failures === 0) {
    console.log(`  警告のみ: ${warnings} 件（exit 0）。手動目視比較も忘れずに実施してください。`);
  } else {
    console.log(`  失敗: ${failures} / 警告: ${warnings}`);
    console.log("  候補サイトを修正してから再実行してください。");
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
