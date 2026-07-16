#!/usr/bin/env node

/**
 * Headless 本番パフォーマンス簡易チェック CLI
 * Usage: node scripts/performance-check.mjs [base-url]
 *    or: npm run perf:check -- https://example.com
 */

const DEFAULT_BASE = "https://mens-esthe-kuchikomi.com";

const PAGE_PATHS = ["/", "/shops/", "/area/osaka/", "/area/nihonbashi/"];

const ASSET_CHECKS = [
  { label: "base.css", path: "/wp-content/themes/swell_child/css/base.css", expectStatus: 200 },
  {
    label: "WP shop JSON",
    path: "/wp-json/wp/v2/shop?per_page=1&_fields=id,slug,title",
    expectStatus: 200
  }
];

const MIN_TOP_HTML_BYTES = 20 * 1024;

function normalizeBase(url) {
  const trimmed = url.replace(/\/+$/, "");
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function formatMs(ms) {
  return `${ms.toFixed(0)}ms`;
}

function formatBytes(bytes) {
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

function printRow(label, status, detail = "") {
  const icon = status === "OK" ? "✓" : "✗";
  const line = detail ? `${label}: ${detail}` : label;
  console.log(`  ${icon} ${line}`);
}

async function measurePage(base, path) {
  const url = `${base}${path}`;
  const start = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const ttfb = performance.now() - start;
  const body = await res.text();
  const total = performance.now() - start;

  return {
    path,
    status: res.status,
    ttfb,
    total,
    bytes: Buffer.byteLength(body, "utf8")
  };
}

async function measureAsset(base, check) {
  const url = `${base}${check.path}`;
  const start = performance.now();
  const res = await fetch(url, { redirect: "follow" });
  const ttfb = performance.now() - start;
  await res.arrayBuffer();
  const total = performance.now() - start;
  const cacheControl = res.headers.get("cache-control") || "(none)";

  return {
    label: check.label,
    path: check.path,
    expectStatus: check.expectStatus,
    status: res.status,
    ttfb,
    total,
    cacheControl
  };
}

async function main() {
  const baseArg = process.argv[2] || DEFAULT_BASE;
  const base = normalizeBase(baseArg);

  if (!base) {
    console.error("無効なベース URL:", baseArg);
    process.exit(1);
  }

  console.log("\nEskomi Headless – パフォーマンス簡易チェック");
  console.log(`対象: ${base}\n`);

  let failures = 0;

  console.log("── ページ応答 ──");
  for (const path of PAGE_PATHS) {
    try {
      const result = await measurePage(base, path);
      const statusOk = result.status === 200;
      const detail = `${result.status} | TTFB ${formatMs(result.ttfb)} | total ${formatMs(result.total)} | ${formatBytes(result.bytes)}`;

      if (statusOk) {
        printRow(path, "OK", detail);
      } else {
        printRow(path, "FAIL", detail);
        failures += 1;
      }

      if (path === "/" && statusOk && result.bytes < MIN_TOP_HTML_BYTES) {
        printRow("トップ HTML サイズ", "FAIL", `${formatBytes(result.bytes)}（閾値 ${formatBytes(MIN_TOP_HTML_BYTES)} 以上）`);
        failures += 1;
      } else if (path === "/" && statusOk) {
        printRow("トップ HTML サイズ", "OK", formatBytes(result.bytes));
      }
    } catch (err) {
      printRow(path, "FAIL", err instanceof Error ? err.message : "fetch error");
      failures += 1;
    }
  }

  console.log("\n── 静的アセット / API ──");
  for (const check of ASSET_CHECKS) {
    try {
      const result = await measureAsset(base, check);
      const statusOk = result.status === check.expectStatus;
      const detail = `${result.status} | TTFB ${formatMs(result.ttfb)} | total ${formatMs(result.total)} | cache-control: ${result.cacheControl}`;

      if (statusOk) {
        printRow(check.path, "OK", detail);
      } else {
        printRow(check.path, "FAIL", detail);
        failures += 1;
      }
    } catch (err) {
      printRow(check.path, "FAIL", err instanceof Error ? err.message : "fetch error");
      failures += 1;
    }
  }

  console.log("\n── 結果 ──");
  if (failures === 0) {
    console.log("  すべて合格です。");
  } else {
    console.log(`  失敗: ${failures} 件`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
