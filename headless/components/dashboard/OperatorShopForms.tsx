"use client";

import { useState, type FormEvent } from "react";
import {
  LISTING_EXCLUSION_REASONS,
  createListingExclusionIntent,
  type ListingExclusionReason,
} from "@/lib/dashboard/operator-shop-write-contract";
import {
  OPERATOR_WRITER_FIELDS,
  OPERATOR_WRITER_FIELD_LABELS,
  createOperatorShopFactDryRun,
  type OperatorShopFactSnapshot,
  type OperatorWriterField,
} from "@/lib/dashboard/operator-shop-fact-dry-run";
import styles from "./OperatorShops.module.css";

const exclusionLabels: Record<ListingExclusionReason, string> = {
  out_of_scope_industry: "対象業種ではない",
  closed_confirmed: "閉店確認",
  duplicate: "重複掲載",
  identity_mismatch: "店舗同一性の不一致",
  other: "その他",
};

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function valuesFrom(form: HTMLFormElement): Record<OperatorWriterField, string> {
  const formData = new FormData(form);
  return Object.fromEntries(OPERATOR_WRITER_FIELDS.map((field) => [field, text(formData.get(field))])) as Record<OperatorWriterField, string>;
}

export function OperatorShopFactEditForm({ snapshot }: { snapshot: OperatorShopFactSnapshot }) {
  const [currentSnapshot, setCurrentSnapshot] = useState(snapshot);
  const [result, setResult] = useState<ReturnType<typeof createOperatorShopFactDryRun> | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmed(false);
    setSaveMessage("");
    setResult(createOperatorShopFactDryRun(currentSnapshot, valuesFrom(event.currentTarget)));
  }
  async function requestSaveApproval() {
    if (!result || result.state !== "ready" || !confirmed) return;
    setSaveMessage("保存可否を確認しています…");
    try {
      const updates = Object.fromEntries(result.changes.map((change) => [change.field, change.after]));
      const response = await fetch(`/api/dashboard/shops/${currentSnapshot.wpShopId}/official-facts/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-ESKOMI-CSRF": "official-facts-write" },
        body: JSON.stringify({ updates, expectedRevision: currentSnapshot.revision }),
      });
      const payload = await response.json() as { message?: string; snapshot?: OperatorShopFactSnapshot };
      const returnedSnapshot = payload.snapshot?.source === "supabase" && Number.isSafeInteger(payload.snapshot.revision)
        ? payload.snapshot
        : null;
      if (returnedSnapshot && (response.ok || response.status === 409)) {
        setCurrentSnapshot(returnedSnapshot);
        setResult(null);
        setConfirmed(false);
      }
      setSaveMessage(payload.message || "保存可否を確認できませんでした。");
    } catch {
      setSaveMessage("保存可否を確認できませんでした。");
    }
  }
  return <section className={styles.formPanel} aria-labelledby="operator-shop-form-heading">
    <p className={styles.eyebrow}>掲載内容の確認</p>
    <h2 id="operator-shop-form-heading">公開情報を確認・修正候補にする</h2>
    <p className={styles.note}>{currentSnapshot.source === "supabase" ? "公開前の確認用データを読み込みました。確認できるのは既存の10項目です。店舗名・エリア・掲載の公開状態・分類・新規店舗の追加は、この画面では扱いません。" : "現在の掲載内容を読み込みました。確認できるのは既存の10項目です。店舗名・エリア・掲載の公開状態・分類・新規店舗の追加は、この画面では扱いません。"}</p>
    <p className={styles.note}>{currentSnapshot.source === "supabase" ? "この画面で保存した内容は、公開前の確認用データだけに反映されます。公開ページの内容は変わりません。" : "この画面では内容を確認するだけで、保存や公開ページの変更はできません。"}</p>
    <form className={styles.form} onSubmit={submit} noValidate>
      {OPERATOR_WRITER_FIELDS.map((field) => {
        const value = currentSnapshot.values[field];
        const available = value !== null;
        return <label key={field}>{OPERATOR_WRITER_FIELD_LABELS[field]}
          <input key={`${field}-${currentSnapshot.revision ?? 0}-${value ?? "missing"}`} name={field} type={field.endsWith("url") || field === "shop_line" ? "url" : "text"} inputMode={field === "basic_price" || field === "price_90" ? "numeric" : undefined} defaultValue={value ?? ""} disabled={!available} aria-describedby={!available ? `${field}-unavailable` : undefined} />
          {!available ? <small id={`${field}-unavailable`}>公開情報を正確に確認できないため、この項目は変更できません。</small> : null}
        </label>;
      })}
      <button type="submit">変更内容を確認する（保存しない）</button>
    </form>
    {result ? <div className={styles.formMessage} role="status">
      <p>{result.message}</p>
      {result.state === "ready" ? <>
        <dl className={styles.diffList}>{result.changes.map((change) => <div key={change.field}><dt>{OPERATOR_WRITER_FIELD_LABELS[change.field]}</dt><dd><s>{change.before ?? "未設定"}</s><span aria-hidden="true"> → </span><strong>{change.after}</strong></dd></div>)}</dl>
        <label className={styles.confirmation}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />変更内容と、公開ページが変わらないことを確認しました。</label>
        {confirmed ? <div className={styles.saveGate}>
          <p>{currentSnapshot.source === "supabase" ? "保存すると、公開前の確認用データだけが更新されます。公開中の掲載内容は変わりません。" : "この画面から保存はできません。公開内容の変更には、確認済みの公式情報と別の承認手続きが必要です。画面に入力した内容から公開内容の根拠を作成することはありません。"}</p>
          <button type="button" onClick={requestSaveApproval}>{currentSnapshot.source === "supabase" ? "確認用の内容を保存して、表示を確かめる" : "保存できない理由を確認する"}</button>
          {saveMessage ? <p role="status">{saveMessage}</p> : null}
        </div> : null}
      </> : null}
    </div> : null}
    {saveMessage && !result ? <p className={styles.formMessage} role="status">{saveMessage}</p> : null}
  </section>;
}

export function OperatorListingExclusionForm({ wpShopId }: { wpShopId: number }) {
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("reason");
    const intent = createListingExclusionIntent(wpShopId, value as ListingExclusionReason);
    setMessage("message" in intent ? intent.message : "内容を確認しました。この画面から掲載を非表示にはしません。実際の変更には、理由を残す別の承認手続きが必要です。");
  }
  return <section id="listing-exclusion" className={styles.exclusion} aria-labelledby="listing-exclusion-heading">
    <h2 id="listing-exclusion-heading">掲載対象外にする</h2>
    <p>この画面では、掲載を非表示にする候補を確認するだけです。まだ公開一覧や店舗ページは変わりません。</p>
    <form className={styles.form} onSubmit={submit}>
      <label>理由<select name="reason" required defaultValue=""><option value="" disabled>理由を選択</option>{LISTING_EXCLUSION_REASONS.map((reason) => <option key={reason} value={reason}>{exclusionLabels[reason]}</option>)}</select></label>
      <button type="submit">内容を確認する（掲載は変わりません）</button>
    </form>
    {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
  </section>;
}
