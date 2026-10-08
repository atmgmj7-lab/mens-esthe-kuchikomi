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
    <p className={styles.eyebrow}>{currentSnapshot.source === "supabase" ? "Supabase verification source" : "WordPress public source"}</p>
    <h2 id="operator-shop-form-heading">公開情報を確認・修正候補にする</h2>
    <p className={styles.note}>{currentSnapshot.source === "supabase" ? "検証用Supabaseの保存済み情報を読み込みました。既存の限定Writerと同じ10項目だけを扱います。タイトル・エリア・公開状態・taxonomy・新規作成は対象外で、保存できるようには表示しません。" : "現在のWordPress公開情報を読み込みました。既存の限定Writerが対応する10項目だけを確認できます。タイトル・エリア・公開状態・taxonomy・新規作成は今回の対象外で、保存できるようには表示しません。"}</p>
    <p className={styles.note}>WP ID {currentSnapshot.wpShopId} / slug {currentSnapshot.slug}{currentSnapshot.source === "supabase" ? ` / revision ${currentSnapshot.revision ?? 0}` : ""}。{currentSnapshot.source === "supabase" ? "この検証モードの保存先は非公開Supabaseのみで、WordPressと公開サイトは更新しません。" : "この画面の確認操作は、WordPress・Supabase・公開サイトへ書き込みません。"}</p>
    <form className={styles.form} onSubmit={submit} noValidate>
      {OPERATOR_WRITER_FIELDS.map((field) => {
        const value = currentSnapshot.values[field];
        const available = value !== null;
        return <label key={field}>{OPERATOR_WRITER_FIELD_LABELS[field]}
          <input key={`${field}-${currentSnapshot.revision ?? 0}-${value ?? "missing"}`} name={field} type={field.endsWith("url") || field === "shop_line" ? "url" : "text"} inputMode={field === "basic_price" || field === "price_90" ? "numeric" : undefined} defaultValue={value ?? ""} disabled={!available} aria-describedby={!available ? `${field}-unavailable` : undefined} />
          {!available ? <small id={`${field}-unavailable`}>公開REST値で正確に読めないため、この項目は編集対象外です。</small> : null}
        </label>;
      })}
      <button type="submit">変更候補を確認する（dry-run・書込みなし）</button>
    </form>
    {result ? <div className={styles.formMessage} role="status">
      <p>{result.message}</p>
      {result.state === "ready" ? <>
        <dl className={styles.diffList}>{result.changes.map((change) => <div key={change.field}><dt>{OPERATOR_WRITER_FIELD_LABELS[change.field]}</dt><dd><s>{change.before ?? "未設定"}</s><span aria-hidden="true"> → </span><strong>{change.after}</strong></dd></div>)}</dl>
        <label className={styles.confirmation}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />差分と保存先を確認しました。</label>
        {confirmed ? <div className={styles.saveGate}>
          <p>{currentSnapshot.source === "supabase" ? "保存は非公開検証用Supabaseに限定し、revisionの再照合で競合を止めます。WordPressと公開サイトへの書込みは行いません。" : "保存には、対応項目ごとの確認済み公式根拠・canonical・監査情報と、最新snapshotの再照合が必要です。ブラウザ入力から根拠を作成することはありません。"}</p>
          <button type="button" onClick={requestSaveApproval}>{currentSnapshot.source === "supabase" ? "Supabaseへ保存して再読込" : "保存前の承認条件を確認する"}</button>
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
    setMessage("message" in intent ? intent.message : "可逆の掲載対象外 intent を検証しました。履歴を保持するWordPress Writerと個別Production承認が必要なため、ここからは書き込みません。");
  }
  return <section id="listing-exclusion" className={styles.exclusion} aria-labelledby="listing-exclusion-heading">
    <h2 id="listing-exclusion-heading">掲載対象外にする</h2>
    <p>通常の削除ではありません。公開一覧・エリア一覧・サイトマップへの将来反映は、履歴を保持した可逆契約で扱います。</p>
    <form className={styles.form} onSubmit={submit}>
      <label>理由<select name="reason" required defaultValue=""><option value="" disabled>理由を選択</option>{LISTING_EXCLUSION_REASONS.map((reason) => <option key={reason} value={reason}>{exclusionLabels[reason]}</option>)}</select></label>
      <button type="submit">対象外化を検証する（書込みなし）</button>
    </form>
    {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
  </section>;
}
