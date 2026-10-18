"use client";

import { useState } from "react";
import { EskomiBannerV2Slot } from "@/components/EskomiBannerV2Slot";
import { PartnerTherapistTools } from "@/components/partner/PartnerTherapistTools";

/** Keep the B06 guidance separate from the form that records a person's rights. */
export function PartnerTherapistsWorkspace() {
  const [editing, setEditing] = useState(false);
  if (editing) return <><p><button type="button" onClick={() => setEditing(false)}>担当者管理の案内へ戻る</button></p><PartnerTherapistTools /></>;
  return <section className="hl-partner-home__section" aria-labelledby="partner-therapists-guide-heading"><p className="hl-partner-home__eyebrow">THERAPIST GUIDE</p><h2 id="partner-therapists-guide-heading">担当別の口コミを案内する</h2><p>店舗と担当者の感想は別に扱い、人物の広告枠や出勤表には使いません。</p><EskomiBannerV2Slot id="B06" /><button type="button" className="hl-contact-submit" onClick={() => setEditing(true)}>担当者を管理する</button></section>;
}
