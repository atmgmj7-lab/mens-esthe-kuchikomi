export type DashboardDataSource =
  | "ga4"
  | "search-console"
  | "analytics-supabase"
  | "legacy-proxy";

export type DashboardUnavailableReason =
  | "not-configured"
  | "request-failed"
  | "invalid-response";

export type DashboardDataResult<T> =
  | {
      status: "live";
      data: T;
      source: DashboardDataSource;
      fetchedAt: string;
    }
  | {
      status: "unavailable";
      data: null;
      source: DashboardDataSource;
      reason: DashboardUnavailableReason;
    };

type ResolveDashboardDataOptions<T> = {
  source: DashboardDataSource;
  configured: boolean;
  request: () => Promise<unknown>;
  validate: (value: unknown) => value is T;
  now?: () => string;
};

export function unavailableDashboardData<T>(
  source: DashboardDataSource,
  reason: DashboardUnavailableReason
): DashboardDataResult<T> {
  return { status: "unavailable", data: null, source, reason };
}

export function parseDashboardNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function resolveDashboardData<T>({
  source,
  configured,
  request,
  validate,
  now = () => new Date().toISOString(),
}: ResolveDashboardDataOptions<T>): Promise<DashboardDataResult<T>> {
  if (!configured) {
    return unavailableDashboardData(source, "not-configured");
  }

  try {
    const data = await request();
    if (!validate(data)) {
      return unavailableDashboardData(source, "invalid-response");
    }
    return { status: "live", data, source, fetchedAt: now() };
  } catch {
    return unavailableDashboardData(source, "request-failed");
  }
}

export function dashboardUnavailableMessage(
  reason: DashboardUnavailableReason
): string {
  if (reason === "not-configured") return "接続設定がありません";
  if (reason === "invalid-response") return "取得結果を確認できません";
  return "データを取得できません";
}
