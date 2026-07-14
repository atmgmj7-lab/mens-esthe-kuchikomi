import {
  auditWordPressMigrationSource,
  normalizeWordPressApiBase
} from "./lib/wp-migration-audit.mjs";

const apiBase = normalizeWordPressApiBase(
  process.env.WP_API_BASE_URL || "https://mens-esthe-kuchikomi.com/wp-json/wp/v2"
);

async function fetchPage(path, page) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${apiBase}${path}${separator}page=${page}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    throw new Error(`WordPress API failed: ${response.status} ${path}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error(`WordPress API returned a non-array payload: ${path}`);
  }
  return {
    data,
    totalPages: Math.max(1, Number(response.headers.get("x-wp-totalpages")) || 1)
  };
}

async function fetchAll(path) {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await fetchPage(path, page);
    rows.push(...result.data);
    totalPages = result.totalPages;
    page += 1;
  } while (page <= totalPages);
  return rows;
}

async function reviewsStatus() {
  try {
    const response = await fetch(`${apiBase}/reviews?per_page=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) return "available";
    if (response.status === 404) return "unavailable";
    return `http-${response.status}`;
  } catch {
    return "request-failed";
  }
}

const [shops, areas, reviewsEndpointStatus] = await Promise.all([
  fetchAll("/shop?per_page=100&_embed=1"),
  fetchAll("/area?per_page=100&hide_empty=false"),
  reviewsStatus()
]);

const report = auditWordPressMigrationSource({ shops, areas, reviewsEndpointStatus });
console.log(JSON.stringify({ auditedAt: new Date().toISOString(), apiBase, ...report }, null, 2));
