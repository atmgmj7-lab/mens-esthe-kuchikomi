import { isPriorityAreaPrecisionTarget } from "@/lib/priority-area-precision";
import { cacheLife, cacheTag } from "next/cache";
import {
  publicReviewAdapter,
  type PublicGlobalReviewResult,
} from "@/lib/reviews/public-adapter";
import type { AreaView } from "@/lib/wp/types";

type AreaReviewReader = (
  page: number,
  perPage: number,
  primaryAreaSlug: string,
) => Promise<PublicGlobalReviewResult>;

async function readPriorityAreaApprovedReviews(
  area: Pick<AreaView, "id" | "slug" | "name">,
  read: AreaReviewReader,
): Promise<PublicGlobalReviewResult | null> {
  if (!isPriorityAreaPrecisionTarget(area)) return null;
  return read(1, 6, area.slug);
}

async function loadCachedPriorityAreaApprovedReviews(
  area: Pick<AreaView, "id" | "slug" | "name">,
): Promise<PublicGlobalReviewResult | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("reviews", "priority-area-reviews", `priority-area-reviews:${area.slug}`);
  return readPriorityAreaApprovedReviews(area, publicReviewAdapter.getGlobalReviews);
}

export async function loadPriorityAreaApprovedReviews(
  area: Pick<AreaView, "id" | "slug" | "name">,
  read?: AreaReviewReader,
): Promise<PublicGlobalReviewResult | null> {
  return read
    ? readPriorityAreaApprovedReviews(area, read)
    : loadCachedPriorityAreaApprovedReviews(area);
}
