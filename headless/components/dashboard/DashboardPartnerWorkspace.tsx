"use client";

import { useMemo, useState, type FormEvent } from "react";

type ShopOption = { id: number; slug: string; title: string };
type Result = { state: string; initialized: boolean; nextAction: string };
type CampaignChannel = "counter_qr" | "line_after_visit" | "shop_website" | "eskomi_shop_page";
type DashboardReview = {
  submissionId: string;
  status: "received" | "under_review" | "approved" | "rejected";
  createdAt: string;
  workspaceState: string;
  shop: { id: number; slug: string; title: string; canonicalUrl: string };
  campaigns: Array<{ id: string; channel: CampaignChannel; token: string; isActive: boolean; createdAt: string }>;
};

const CAMPAIGN_CHANNELS: Array<{ channel: CampaignChannel; label: string }> = [
  { channel: "counter_qr", label: "店頭QR" },
  { channel: "line_after_visit", label: "来店後LINE" },
  { channel: "shop_website", label: "店舗サイト" },
  { channel: "eskomi_shop_page", label: "エスコミ店舗ページ" },
];

export function DashboardPartnerWorkspace({ shops, reviews }: { shops: ShopOption[]; reviews: DashboardReview[] }) {
  const [query, setQuery] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja-JP");
    return needle ? shops.filter((shop) => `${shop.title} ${shop.slug}`.toLocaleLowerCase("ja-JP").includes(needle)).slice(0, 80) : shops.slice(0, 80);
  }, [query, shops]);
  const pendingReviews = reviews.filter((review) => review.status === "received" || review.status === "under_review");

  async function initialize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shopSlug || submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/partners/provision/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopSlug }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string; workspace?: Result };
      if (!response.ok || !payload.ok || !payload.workspace) throw new Error(payload.message || "初期化に失敗しました。");
      setResult(payload.workspace);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "初期化に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(event: FormEvent<HTMLFormElement>, submissionId: string) {
    event.preventDefault();
    if (reviewSubmitting) return;
    const formData = new FormData(event.currentTarget);
    const decision = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const reason = formData.get("reason");
    if ((decision !== "approved" && decision !== "rejected") || typeof reason !== "string" || !reason.trim()) {
      setReviewMessage("判断理由を入力してください。");
      return;
    }
    setReviewSubmitting(submissionId);
    setReviewMessage("");
    try {
      const response = await fetch("/api/dashboard/partners/review/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, decision, reason }),
      });
      const payload = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "判断を保存できませんでした。");
      setReviewMessage("判断を保存しました。最新のGrowth Kitを表示します。");
      window.location.reload();
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : "判断を保存できませんでした。");
    } finally {
      setReviewSubmitting(null);
    }
  }

  async function copyCampaignUrl(token: string) {
    const url = `${window.location.origin}/r/${token}/`;
    try {
      await navigator.clipboard.writeText(url);
      setReviewMessage("公開用リンクをコピーしました。");
    } catch {
      setReviewMessage("リンクをコピーできませんでした。QRを開いて確認してください。");
    }
  }

  return (
    <section className="hl-partner-panel" aria-labelledby="partner-workspace-heading">
      <h1 id="partner-workspace-heading">Free Official Partner</h1>
      <p>公開情報はWordPressを正本として維持します。ここでは非公開のPartner workspaceだけを初期化します。</p>
      <form onSubmit={initialize} className="hl-partner-form">
        <label htmlFor="partner-shop-search">既存店舗を検索</label>
        <input id="partner-shop-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="店舗名またはslug" />
        <label htmlFor="partner-shop-select">対象店舗</label>
        <select id="partner-shop-select" value={shopSlug} onChange={(event) => setShopSlug(event.target.value)} required>
          <option value="" disabled>店舗を選択してください</option>
          {filtered.map((shop) => <option value={shop.slug} key={shop.id}>{shop.title}</option>)}
        </select>
        <button type="submit" disabled={submitting}>{submitting ? "初期化中…" : "Partner workspaceを初期化"}</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
      {result ? <div className="hl-partner-status" role="status"><p>現在状態: <strong>{result.state}</strong></p><p>{result.initialized ? "新しいworkspaceを初期化しました。" : "既存workspaceを確認しました。"}</p><p>次アクション: {result.nextAction}</p></div> : null}

      <section className="hl-partner-review-list" aria-labelledby="partner-review-heading">
        <h2 id="partner-review-heading">申請の確認</h2>
        <p>連絡先情報はこの画面に表示しません。対象店舗と判断内容を確認して処理してください。</p>
        {reviewMessage ? <p role="status">{reviewMessage}</p> : null}
        {pendingReviews.length === 0 ? <p>確認待ちの申請はありません。</p> : pendingReviews.map((review) => (
          <article className="hl-partner-review-card" key={review.submissionId}>
            <h3>{review.shop.title}</h3>
            <p>状態: {review.status === "received" ? "確認待ち" : "確認中"}</p>
            <p>申請日時: {new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.createdAt))}</p>
            <form className="hl-partner-form" onSubmit={(event) => decide(event, review.submissionId)}>
              <label htmlFor={`partner-review-reason-${review.submissionId}`}>判断理由</label>
              <textarea id={`partner-review-reason-${review.submissionId}`} name="reason" required />
              <div className="hl-partner-review-actions">
                <button type="submit" name="decision" value="approved" disabled={reviewSubmitting === review.submissionId}>Free Official Partnerとして承認</button>
                <button type="submit" name="decision" value="rejected" className="hl-partner-review-reject" disabled={reviewSubmitting === review.submissionId}>却下</button>
              </div>
            </form>
          </article>
        ))}
      </section>

      {reviews.filter((review) => review.status === "approved" && (review.workspaceState === "free_official_partner" || review.workspaceState === "active_partner")).map((review) => {
        const activeCampaigns = CAMPAIGN_CHANNELS.map(({ channel, label }) => ({ label, campaign: review.campaigns.find((campaign) => campaign.channel === channel && campaign.isActive) }));
        if (!activeCampaigns.every(({ campaign }) => campaign)) return null;
        return <section className="hl-partner-growth-kit" aria-labelledby={`partner-kit-${review.submissionId}`} key={review.submissionId}>
          <h2 id={`partner-kit-${review.submissionId}`}>{review.shop.title} のGrowth Kit</h2>
          <p className="hl-partner-growth-kit__copy">率直な口コミにご協力ください</p>
          <p>承認済みの4チャネルです。公開用リンクとQRは運営用の操作画面からのみ取得できます。</p>
          <ul>{activeCampaigns.map(({ label, campaign }) => campaign ? <li key={campaign.id}><strong>{label}</strong><button type="button" onClick={() => copyCampaignUrl(campaign.token)}>公開用リンクをコピー</button><a href={`/api/dashboard/partners/qr/?token=${encodeURIComponent(campaign.token)}`} target="_blank" rel="noreferrer">QRを開く</a></li> : null)}</ul>
        </section>;
      })}
    </section>
  );
}
