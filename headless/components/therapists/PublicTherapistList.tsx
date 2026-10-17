import Link from "next/link";

import type { PublicTherapistSummary } from "@/lib/public-therapist";

export function PublicTherapistList({ therapists }: { therapists: readonly PublicTherapistSummary[] }) {
  if (therapists.length === 0) return null;
  return <section id="therapists" aria-labelledby="therapists-heading">
    <h2 id="therapists-heading">担当セラピスト</h2>
    <p>公開名と使用許諾済みの写真を掲載しています。評価は任意で、店舗の口コミとは別に扱います。</p>
    <ul>
      {therapists.map((therapist) => <li key={therapist.assignmentId}>
        <Link href={`/therapists/${therapist.assignmentId}/`}>
          <img src={`/api/therapists/${therapist.assignmentId}/photo/`} alt="" width={72} height={72} loading="lazy" />
          <span>{therapist.displayName}のプロフィール</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
