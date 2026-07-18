export type DashboardSourceMode = "legacy-proxy" | "supabase";

type ResultStatus = {
  status: "live" | "unavailable";
};

export type SupabaseStatus = {
  status: "live" | "unavailable" | "neutral";
  label: string;
  detail: string;
  liveCount: number;
  total: number;
};

export function resolveSupabaseStatus(
  mode: DashboardSourceMode,
  configured: boolean,
  results: ResultStatus[]
): SupabaseStatus {
  const total = results.length;
  const liveCount = results.filter((result) => result.status === "live").length;

  if (mode === "legacy-proxy") {
    return {
      status: "neutral",
      label: "未使用",
      detail: "現在の取得元はWordPress連携APIです",
      liveCount: 0,
      total,
    };
  }

  return {
    status: liveCount > 0 ? "live" : "unavailable",
    label: `${liveCount} / ${total} 取得`,
    detail: configured ? "接続設定あり" : "接続設定なし",
    liveCount,
    total,
  };
}
