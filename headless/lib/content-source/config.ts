export type ContentDataSourceMode = "wordpress" | "shadow" | "supabase";
export type ContentReadSource = "wordpress" | "supabase";

export type ContentReadPlan = {
  mode: ContentDataSourceMode;
  primary: ContentReadSource;
  comparison: ContentReadSource | null;
  supabaseConfigured: boolean;
  cutoverApproved: boolean;
};

type ContentSourceEnv = Record<string, string | undefined>;

function normalizedMode(value: string | undefined): ContentDataSourceMode {
  const mode = (value || "wordpress").trim().toLowerCase();
  if (mode === "wordpress" || mode === "shadow" || mode === "supabase") {
    return mode;
  }
  throw new Error(`Unsupported CONTENT_DATA_SOURCE: ${value}`);
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function hasSupabaseContentConfig(env: ContentSourceEnv): boolean {
  return Boolean(
    env.SUPABASE_CONTENT_URL?.trim() && env.SUPABASE_CONTENT_PUBLISHABLE_KEY?.trim()
  );
}

function assertSupabaseConfigured(configured: boolean, mode: ContentDataSourceMode): void {
  if (!configured) {
    throw new Error(
      `${mode} mode requires SUPABASE_CONTENT_URL and SUPABASE_CONTENT_PUBLISHABLE_KEY`
    );
  }
}

export function resolveContentReadPlan(
  env: ContentSourceEnv = process.env
): ContentReadPlan {
  const mode = normalizedMode(env.CONTENT_DATA_SOURCE);
  const supabaseConfigured = hasSupabaseContentConfig(env);
  const cutoverApproved = isTrue(env.SUPABASE_CONTENT_CUTOVER_APPROVED);

  if (mode === "wordpress") {
    return {
      mode,
      primary: "wordpress",
      comparison: null,
      supabaseConfigured,
      cutoverApproved
    };
  }

  assertSupabaseConfigured(supabaseConfigured, mode);

  if (mode === "shadow") {
    return {
      mode,
      primary: "wordpress",
      comparison: "supabase",
      supabaseConfigured,
      cutoverApproved
    };
  }

  if (!cutoverApproved) {
    throw new Error("supabase mode requires SUPABASE_CONTENT_CUTOVER_APPROVED=true");
  }

  return {
    mode,
    primary: "supabase",
    comparison: "wordpress",
    supabaseConfigured,
    cutoverApproved
  };
}
