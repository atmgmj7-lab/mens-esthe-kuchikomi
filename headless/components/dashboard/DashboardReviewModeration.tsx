"use client";

import { useState, type FormEvent } from "react";

type QueueReview = {
  reviewId: string;
  shop: { wpShopId: number; slug: string; name: string };
  body: string;
  submittedAt: string;
  rating: number | null;
  ratingPrice: number | null;
  ratingService: number | null;
  ratingCleanliness: number | null;
  visitPeriod: string | null;
  revisitIntent: string | null;
  moderationStatus: "pending" | "approved" | "rejected" | "spam";
  publicationStatus: "draft" | "published" | "archived";
  isPublic: boolean;
  nickname: string;
};

type DetailReview = QueueReview & {
  reviewedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  email: string | null;
  sourceUrl: string;
};

type AuditEvent = {
  eventId: number;
  eventType: "approved" | "rejected" | "spam" | "published";
  fromState: string;
  toState: string;
  actorLabel: string;
  reason: string;
  createdAt: string;
};

type DetailState = { review: DetailReview; audit: AuditEvent[] } | null;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

export function DashboardReviewModeration({
  reviews,
  sourceStatus,
}: {
  reviews: QueueReview[];
  sourceStatus: "ok" | "no_data" | "error";
}) {
  const [detail, setDetail] = useState<DetailState>(null);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function loadDetail(reviewId: string) {
    setLoadingId(reviewId);
    setMessage("");
    try {
      const response = await fetch(`/api/dashboard/reviews/moderation/?reviewId=${encodeURIComponent(reviewId)}`, {
        cache: "no-store",
      });
      const payload = await response.json() as {
        ok?: boolean;
        message?: string;
        review?: DetailReview;
        audit?: AuditEvent[];
      };
      if (!response.ok || !payload.ok || !payload.review || !Array.isArray(payload.audit)) {
        throw new Error(payload.message || "口コミ詳細を取得できませんでした。");
      }
      setDetail({ review: payload.review, audit: payload.audit });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "口コミ詳細を取得できませんでした。");
    } finally {
      setLoadingId(null);
    }
  }

  async function decide(event: FormEvent<HTMLFormElement>, reviewId: string) {
    event.preventDefault();
    if (submittingId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const action = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const reason = data.get("reason");
    if (!action || typeof reason !== "string" || !reason.trim()) {
      setMessage("非公開の判断理由を入力してください。");
      return;
    }
    setSubmittingId(reviewId);
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/reviews/moderation/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ESKOMI-CSRF": "review-moderation",
        },
        body: JSON.stringify({ reviewId, action, reason }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "判断を保存できませんでした。");
      setMessage(action === "published" ? "口コミを公開しました。" : "審査結果を保存しました。");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "判断を保存できませんでした。");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <section className="hl-partner-review-list" aria-labelledby="native-review-moderation-heading">
      <h2 id="native-review-moderation-heading">保留中の口コミ</h2>
      <p>口コミ本文・評価は変更せず、審査と公開を別々に判断します。理由は非公開の監査履歴へ保存されます。</p>
      {message ? <p role="status">{message}</p> : null}
      {sourceStatus === "error" ? <p role="alert">口コミ審査一覧を取得できませんでした。</p> : null}
      {sourceStatus !== "error" && reviews.length === 0 ? <p>保留中の口コミはありません。</p> : null}
      {reviews.map((review) => (
        <article className="hl-partner-review-card" key={review.reviewId}>
          <h3>{review.shop.name}</h3>
          <p>投稿者: {review.nickname}</p>
          <p>投稿日: {formatDate(review.submittedAt)}</p>
          <p>総合評価: {review.rating ?? "未回答"}</p>
          <p>{review.body}</p>
          <p>審査: {review.moderationStatus} / 公開: {review.publicationStatus}</p>
          <button type="button" onClick={() => loadDetail(review.reviewId)} disabled={loadingId === review.reviewId}>
            {loadingId === review.reviewId ? "読込中…" : "詳細を確認"}
          </button>
          <form className="hl-partner-form" onSubmit={(event) => decide(event, review.reviewId)}>
            <label htmlFor={`native-review-reason-${review.reviewId}`}>非公開の判断理由</label>
            <textarea id={`native-review-reason-${review.reviewId}`} name="reason" maxLength={1000} required />
            <div className="hl-partner-review-actions">
              {review.moderationStatus === "pending" ? <>
                <button type="submit" name="action" value="approved" disabled={submittingId === review.reviewId}>承認</button>
                <button type="submit" name="action" value="rejected" className="hl-partner-review-reject" disabled={submittingId === review.reviewId}>却下</button>
                <button type="submit" name="action" value="spam" className="hl-partner-review-reject" disabled={submittingId === review.reviewId}>スパム</button>
              </> : null}
              {review.moderationStatus === "approved" && review.publicationStatus === "draft" ? (
                <button type="submit" name="action" value="published" disabled={submittingId === review.reviewId}>公開</button>
              ) : null}
            </div>
          </form>
        </article>
      ))}

      {detail ? (
        <section className="hl-partner-status" aria-labelledby="native-review-detail-heading">
          <h3 id="native-review-detail-heading">口コミ詳細</h3>
          <p>店舗: {detail.review.shop.name}（WP {detail.review.shop.wpShopId}）</p>
          <p>投稿者: {detail.review.nickname}</p>
          <p>メール: {detail.review.email || "未入力"}</p>
          <p>利用時期: {detail.review.visitPeriod || "未入力"}</p>
          <p>再訪意向: {detail.review.revisitIntent || "未入力"}</p>
          <p>評価: 総合 {detail.review.rating ?? "—"} / 料金 {detail.review.ratingPrice ?? "—"} / 接客 {detail.review.ratingService ?? "—"} / 清潔感 {detail.review.ratingCleanliness ?? "—"}</p>
          <p>本文: {detail.review.body}</p>
          <h4>監査履歴</h4>
          {detail.audit.length === 0 ? <p>監査履歴はまだありません。</p> : (
            <ol>{detail.audit.map((event) => (
              <li key={event.eventId}>{formatDate(event.createdAt)}: {event.fromState} → {event.toState}（{event.reason}）</li>
            ))}</ol>
          )}
        </section>
      ) : null}
    </section>
  );
}
