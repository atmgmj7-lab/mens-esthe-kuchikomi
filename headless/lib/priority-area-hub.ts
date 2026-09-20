import { isPriorityAreaPrecisionTarget } from "@/lib/priority-area-precision";
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

export async function loadPriorityAreaApprovedReviews(
  area: Pick<AreaView, "id" | "slug" | "name">,
  read: AreaReviewReader = publicReviewAdapter.getGlobalReviews,
): Promise<PublicGlobalReviewResult | null> {
  if (!isPriorityAreaPrecisionTarget(area)) return null;
  return read(1, 6, area.slug);
}
