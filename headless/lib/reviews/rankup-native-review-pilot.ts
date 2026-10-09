export const RANK_UP_WP_SHOP_ID = 768;

type Environment = Readonly<Record<string, string | undefined>>;

/** Keep the one-store pilot separate from the all-store review source switch. */
export function useRankUpNativeReviewPilot(environment: Environment): boolean {
  return environment.RANKUP_NATIVE_REVIEW_READ_SOURCE === "supabase";
}
