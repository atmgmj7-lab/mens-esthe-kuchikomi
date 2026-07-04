import { dashboardConfig } from "@/lib/dashboard-config";

type SupabaseRow = Record<string, unknown>;

export function isSupabaseReady(): boolean {
  return dashboardConfig.supabaseEnabled;
}

export async function fetchSupabaseTable<T>(tableName: string): Promise<T[]> {
  if (!dashboardConfig.supabaseEnabled) {
    throw new Error("Supabase is not configured");
  }

  const base = dashboardConfig.supabase.url.replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/${encodeURIComponent(tableName)}?select=*`, {
    headers: {
      apikey: dashboardConfig.supabase.anonKey,
      Authorization: `Bearer ${dashboardConfig.supabase.anonKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status}`);
  }

  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error("Unexpected Supabase payload");
  }

  return rows as T[];
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function pickDate(row: SupabaseRow): string {
  return (
    toStringValue(row.date) ||
    toStringValue(row.day) ||
    toStringValue(row.report_date)
  );
}
