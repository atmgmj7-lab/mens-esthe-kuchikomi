import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { serializeJsonLd } from "@/lib/json-ld";
import { isPublicTherapistId, getPublicTherapistProfile } from "@/lib/public-therapist";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ assignmentId: string }> };
export const instant = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { assignmentId } = await params;
  const profile = await getPublicTherapistProfile(assignmentId);
  if (!profile) notFound();
  return pageMetadata({
    title: `${profile.displayName}のプロフィール｜${profile.shopName}`,
    description: `${profile.shopName}の${profile.displayName}の公開プロフィール。担当者への評価は任意で、店舗の体験コメントは店舗ページで確認できます。`,
    path: `/therapists/${profile.assignmentId}/`,
  });
}

export default async function TherapistProfilePage({ params }: Props) {
  await connection();
  const { assignmentId } = await params;
  if (!isPublicTherapistId(assignmentId)) notFound();
  const profile = await getPublicTherapistProfile(assignmentId);
  if (!profile) notFound();
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      worksFor: { "@type": "LocalBusiness", name: profile.shopName, url: profile.shopPath },
      image: `/api/therapists/${profile.assignmentId}/photo/`,
    },
  };
  return <main id="main_content" className="l-mainContent l-article">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(personSchema) }} />
    <article>
      <p><Link href={profile.shopPath}>{profile.shopName}</Link>の担当セラピスト</p>
      <h1>{profile.displayName}のプロフィール</h1>
      <img src={`/api/therapists/${profile.assignmentId}/photo/`} alt={`${profile.displayName}の写真`} width={480} height={480} />
      <p>担当者の評価は任意です。店舗での体験コメントは、担当者へ自動的に割り当てません。</p>
      <p><Link href={`${profile.shopPath}#reviews`}>この店舗での体験コメントを見る</Link></p>
      {profile.officialLineUrl ? <p><a href={profile.officialLineUrl} target="_blank" rel="noopener noreferrer">{profile.shopName}の公式LINEを開く</a></p> : null}
      <section aria-labelledby="therapist-reviews-heading"><h2 id="therapist-reviews-heading">担当者への承認済み評価</h2>
        {profile.reviews.length === 0 ? <p>公開中の担当者評価はまだありません。</p> : <ul>{profile.reviews.map((review) => <li key={review.reviewHandle}>{review.rating === null ? "総合評価は未回答" : `総合評価：${review.rating} / 5`}</li>)}</ul>}
      </section>
    </article>
  </main>;
}
