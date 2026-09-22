"use client";

import { useState, type FormEvent } from "react";
import {
  LISTING_EXCLUSION_REASONS,
  createListingExclusionIntent,
  createOperatorShopWriteIntent,
  type ListingExclusionReason,
  type OperatorShopDraft,
} from "@/lib/dashboard/operator-shop-write-contract";
import styles from "./OperatorShops.module.css";

type FormMode = "create" | "update";

type Props = Readonly<{
  mode: FormMode;
  wpShopId?: number;
  initialValue?: Partial<OperatorShopDraft>;
}>;

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

function draftFrom(form: HTMLFormElement): OperatorShopDraft {
  const formData = new FormData(form);
  return {
    title: text(formData.get("title")), area: text(formData.get("area")), officialUrl: text(formData.get("officialUrl")),
    address: text(formData.get("address")), businessHours: text(formData.get("businessHours")), phone: text(formData.get("phone")),
    lineUrl: text(formData.get("lineUrl")), bookingUrl: text(formData.get("bookingUrl")), basicPrice: text(formData.get("basicPrice")),
    publicationState: (text(formData.get("publicationState")) || "draft") as OperatorShopDraft["publicationState"],
  };
}

export function OperatorShopWriteForm({ mode, wpShopId, initialValue = {} }: Props) {
  const [message, setMessage] = useState("");
  const isUpdate = mode === "update";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = createOperatorShopWriteIntent(mode, draftFrom(event.currentTarget), wpShopId ?? null);
    setMessage("message" in intent ? intent.message : "入力を検証しました。WordPress Writerの項目対応と個別承認が必要なため、ここからは書き込みません。");
  }
  return <section className={styles.formPanel} aria-labelledby="operator-shop-form-heading">
    <p className={styles.eyebrow}>WordPress public source</p>
    <h2 id="operator-shop-form-heading">{isUpdate ? "公開情報を編集" : "店舗を追加"}</h2>
    <p className={styles.note}>このローカル候補では入力検証だけを行います。Supabaseへ店舗CMSを作らず、WordPress Writerの対応項目とProduction承認が揃うまで外部書込みは行いません。</p>
    <form className={styles.form} onSubmit={submit} noValidate>
      <label>店舗名<input name="title" required maxLength={120} defaultValue={initialValue.title ?? ""} /></label>
      <label>Area<input name="area" required maxLength={80} defaultValue={initialValue.area ?? ""} /></label>
      <label>公式URL<input name="officialUrl" type="url" defaultValue={initialValue.officialUrl ?? ""} /></label>
      <label>住所<input name="address" defaultValue={initialValue.address ?? ""} /></label>
      <label>営業時間<input name="businessHours" defaultValue={initialValue.businessHours ?? ""} /></label>
      <label>電話番号<input name="phone" inputMode="tel" defaultValue={initialValue.phone ?? ""} /></label>
      <label>LINE URL<input name="lineUrl" type="url" defaultValue={initialValue.lineUrl ?? ""} /></label>
      <label>予約URL<input name="bookingUrl" type="url" defaultValue={initialValue.bookingUrl ?? ""} /></label>
      <label>基本料金<input name="basicPrice" defaultValue={initialValue.basicPrice ?? ""} /></label>
      <label>公開状態<select name="publicationState" defaultValue={initialValue.publicationState ?? "draft"}><option value="draft">下書き</option><option value="publish">公開</option><option value="private">非公開</option></select></label>
      <button type="submit">入力を検証する（書込みなし）</button>
    </form>
    {message ? <p className={styles.formMessage} role="status">{message}</p> : null}
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
