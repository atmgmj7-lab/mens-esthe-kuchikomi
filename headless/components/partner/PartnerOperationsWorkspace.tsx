"use client";

import { useState } from "react";
import { EskomiBannerV2Slot } from "@/components/EskomiBannerV2Slot";
import { PartnerReviewBenefitOperations } from "@/components/partner/PartnerReviewBenefitOperations";

/** Keep promotional guidance out of the active operations input surface. */
export function PartnerOperationsWorkspace() {
  const [editing, setEditing] = useState(false);
  if (editing) return <><p><button type="button" onClick={() => setEditing(false)}>運用案内へ戻る</button></p><PartnerReviewBenefitOperations /></>;
  return <section className="hl-partner-home__section" aria-labelledby="partner-operations-guide-heading"><p className="hl-partner-home__eyebrow">OPERATIONS GUIDE</p><h2 id="partner-operations-guide-heading">特典と返信の運用</h2><p>特典は条件と運営確認がそろうまで発行されません。返信も確認後に公開されます。</p><EskomiBannerV2Slot id="B03" /><EskomiBannerV2Slot id="B05" /><button type="button" className="hl-contact-submit" onClick={() => setEditing(true)}>運用を始める</button></section>;
}
