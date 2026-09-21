export const REVIEW_TAGS = [
  "staff_polite",
  "clean",
  "booking_smooth",
  "price_clear",
  "beginner_friendly",
  "want_revisit",
  "wait_concern",
  "price_unclear",
  "guidance_unclear",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

export type ReviewConfirmation =
  | Readonly<{ status: "ready"; body: string; tags: readonly ReviewTag[] }>
  | Readonly<{ status: "needs_note" }>
  | Readonly<{ status: "invalid"; reason: "rating" | "tags" }>;

const TAG_SET = new Set<string>(REVIEW_TAGS);

export function prepareReviewConfirmation(input: Readonly<{
  ratingTotal: number;
  tags: readonly string[];
  note: string;
}>): ReviewConfirmation {
  if (!Number.isInteger(input.ratingTotal) || input.ratingTotal < 1 || input.ratingTotal > 5) {
    return { status: "invalid", reason: "rating" };
  }
  if (input.tags.length > 6 || input.tags.some((tag) => !TAG_SET.has(tag)) || new Set(input.tags).size !== input.tags.length) {
    return { status: "invalid", reason: "tags" };
  }
  const body = input.note.trim();
  if (body.length < 30) return { status: "needs_note" };
  return { status: "ready", body, tags: input.tags as ReviewTag[] };
}
