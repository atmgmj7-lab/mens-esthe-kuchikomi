"use client";

import { useMemo, useState, type FormEvent } from "react";

type ShopOption = { id: number; slug: string; title: string };
type Result = { state: string; initialized: boolean; nextAction: string };

export function DashboardPartnerWorkspace({ shops }: { shops: ShopOption[] }) {
  const [query, setQuery] = useState("");
  const [shopSlug, setShopSlug] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ja-JP");
    return needle ? shops.filter((shop) => `${shop.title} ${shop.slug}`.toLocaleLowerCase("ja-JP").includes(needle)).slice(0, 80) : shops.slice(0, 80);
  }, [query, shops]);

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
      {result ? (
        <div className="hl-partner-status" role="status">
          <p>現在状態: <strong>{result.state}</strong></p>
          <p>{result.initialized ? "新しいworkspaceを初期化しました。" : "既存workspaceを確認しました。"}</p>
          <p>次アクション: {result.nextAction}</p>
        </div>
      ) : null}
    </section>
  );
}
