export type DashboardDataSource = "legacy-proxy" | "supabase";

const LEGACY_GA_PROXY = "/wp-content/themes/swell_child/dashboard/api/ga-proxy.php";
const LEGACY_SC_PROXY = "/wp-content/themes/swell_child/dashboard/api/search-console-proxy.php";

export const dashboardConfig = {
  dataSource: getDataSource(),
  enableLegacyProxyFallback: getBoolean(
    process.env.NEXT_PUBLIC_DASHBOARD_ENABLE_LEGACY_PROXY_FALLBACK,
    false
  ),
  gaProxyUrl: resolveApiUrl(process.env.NEXT_PUBLIC_GA_PROXY_URL, LEGACY_GA_PROXY),
  searchConsoleProxyUrl: resolveApiUrl(process.env.NEXT_PUBLIC_SEARCH_CONSOLE_PROXY_URL, LEGACY_SC_PROXY),
  wpAdminBaseUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_WP_ADMIN_BASE_URL || "https://mens-esthe-kuchikomi.com"
  ),
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "",
    tables: {
      gaDaily: process.env.NEXT_PUBLIC_SUPABASE_GA_DAILY_TABLE || "dashboard_ga_daily",
      gaTotals: process.env.NEXT_PUBLIC_SUPABASE_GA_TOTALS_TABLE || "dashboard_ga_totals",
      gaPages: process.env.NEXT_PUBLIC_SUPABASE_GA_PAGES_TABLE || "dashboard_ga_pages",
      gaCreatives: process.env.NEXT_PUBLIC_SUPABASE_GA_CREATIVES_TABLE || "dashboard_ga_creatives",
      gaCta: process.env.NEXT_PUBLIC_SUPABASE_GA_CTA_TABLE || "dashboard_ga_cta",
      scKeywords: process.env.NEXT_PUBLIC_SUPABASE_SC_KEYWORDS_TABLE || "dashboard_sc_keywords",
      scPages: process.env.NEXT_PUBLIC_SUPABASE_SC_PAGES_TABLE || "dashboard_sc_pages",
      scAreas: process.env.NEXT_PUBLIC_SUPABASE_SC_AREAS_TABLE || "dashboard_sc_areas",
    },
  },
  supabaseEnabled: false,
};

dashboardConfig.supabaseEnabled =
  dashboardConfig.dataSource === "supabase" &&
  dashboardConfig.supabase.url !== "" &&
  dashboardConfig.supabase.anonKey !== "";

function getDataSource(): DashboardDataSource {
  const source = (process.env.NEXT_PUBLIC_DASHBOARD_DATA_SOURCE || "supabase").toLowerCase();
  return source === "legacy-proxy" ? "legacy-proxy" : "supabase";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on", "y"].includes(normalized);
}

function resolveApiUrl(value: string | undefined, fallback: string): string {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return `/${raw}`;
}
