import type { ReactNode } from "react";
import { ShopDetailModuleList } from "@/components/shop-detail/ShopDetailModuleList";
import type {
  ShopDetailModuleContext,
  VisibleShopDetailModule
} from "@/lib/shop-detail-modules";
import type { ApprovedShopReviewResult } from "@/lib/wp/types";

export function ShopDetailSections({
  context,
  modules,
  nearbyContent,
  rel,
  reviewResult,
  reviewSubmitUrl
}: {
  context: ShopDetailModuleContext;
  modules: readonly VisibleShopDetailModule[];
  nearbyContent: ReactNode;
  rel: string;
  reviewResult: ApprovedShopReviewResult;
  reviewSubmitUrl: string;
}) {
  return (
    <ShopDetailModuleList
      context={context}
      modules={modules}
      nearbyContent={nearbyContent}
      rel={rel}
      reviewResult={reviewResult}
      reviewSubmitUrl={reviewSubmitUrl}
    />
  );
}
