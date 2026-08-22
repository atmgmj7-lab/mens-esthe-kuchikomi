export const analyticsSourceStates = [
  "ok",
  "partial",
  "no_data",
  "not_configured",
  "auth_error",
  "api_error",
  "invalid_response",
  "timeout",
] as const;

export type AnalyticsSourceState = (typeof analyticsSourceStates)[number];
export type AnalyticsSuccessState = "ok" | "partial";
export type AnalyticsFailureState = Exclude<AnalyticsSourceState, AnalyticsSuccessState>;

export type AnalyticsWarning = {
  code: string;
  message: string;
};

export type AnalyticsSourceResult<T> =
  | { state: AnalyticsSuccessState; data: T; collectedAt: string; warnings: AnalyticsWarning[] }
  | { state: AnalyticsFailureState; data: null; collectedAt: string; warnings: AnalyticsWarning[] };

type ResultOptions = {
  collectedAt?: string;
  warnings?: AnalyticsWarning[];
};

export function isAnalyticsSourceState(value: unknown): value is AnalyticsSourceState {
  return typeof value === "string" && analyticsSourceStates.includes(value as AnalyticsSourceState);
}

export function analyticsSuccess<T>(
  data: T,
  options: ResultOptions & { state?: AnalyticsSuccessState } = {}
): AnalyticsSourceResult<T> {
  return {
    state: options.state ?? "ok",
    data,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    warnings: options.warnings ?? [],
  };
}

export function analyticsFailure<T = never>(
  state: AnalyticsFailureState,
  options: ResultOptions = {}
): AnalyticsSourceResult<T> {
  return {
    state,
    data: null,
    collectedAt: options.collectedAt ?? new Date().toISOString(),
    warnings: options.warnings ?? [],
  };
}
