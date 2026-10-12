import { REVIEW_TAGS, type ReviewTag } from "@/lib/reviews/low-friction-review";

export type AutomaticReviewDraftInput = Readonly<{
  ratingPrice?: number;
  ratingService?: number;
  ratingCleanliness?: number;
  tags: readonly string[];
}>;

const KNOWN_TAGS = new Set<string>(REVIEW_TAGS);

const TAG_SENTENCES: Readonly<Record<ReviewTag, string>> = {
  staff_polite: "接客が丁寧だと感じました。",
  clean: "店内は清潔だと感じました。",
  booking_smooth: "予約はスムーズでした。",
  price_clear: "料金は分かりやすかったです。",
  beginner_friendly: "初めてでも利用しやすいと感じました。",
  want_revisit: "また利用したいと思いました。",
  wait_concern: "待ち時間が気になりました。",
  price_unclear: "料金は分かりにくいと感じました。",
  guidance_unclear: "案内が分かりにくいと感じました。",
};

function ratingSentence(label: string, value: number | undefined): string | null {
  if (!Number.isInteger(value) || value! < 1 || value! > 5) return null;
  if (value! >= 4) return `${label}は良いと感じました。`;
  if (value === 3) return `${label}は普通と感じました。`;
  return `${label}は気になる点がありました。`;
}

/**
 * Builds a review draft exclusively from the visitor's selected answers.
 * It deliberately ignores the overall score, visit period, and free text so
 * the draft cannot infer a visit detail, a recommendation, or a revisit wish.
 */
export function createAutomaticReviewDraft(input: AutomaticReviewDraftInput): string | null {
  const sentences = [
    ratingSentence("料金について", input.ratingPrice),
    ratingSentence("接客について", input.ratingService),
    ratingSentence("清潔感", input.ratingCleanliness),
    ...input.tags
      .filter((tag): tag is ReviewTag => KNOWN_TAGS.has(tag))
      .map((tag) => TAG_SENTENCES[tag]),
  ].filter((sentence): sentence is string => Boolean(sentence));

  return sentences.length > 0 ? sentences.join("\n") : null;
}
