import { isPriorityAreaPrecisionTarget } from "@/lib/priority-area-precision";
import { getApprovedReviewsPage } from "@/lib/wp/reviews";
import type { ApprovedGlobalReviewResult, AreaView } from "@/lib/wp/types";

type AreaReviewReader = (
  page: number,
  perPage: number,
  primaryAreaSlug: string,
) => Promise<ApprovedGlobalReviewResult>;

export async function loadPriorityAreaApprovedReviews(
  area: Pick<AreaView, "id" | "slug" | "name">,
  read: AreaReviewReader = getApprovedReviewsPage,
): Promise<ApprovedGlobalReviewResult | null> {
  if (!isPriorityAreaPrecisionTarget(area)) return null;
  return read(1, 6, area.slug);
}
