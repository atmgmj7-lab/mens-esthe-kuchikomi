"use client";

import { useState } from "react";

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to a user-gesture fallback for browsers without Clipboard API access.
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  return copied;
}

export function PartnerCopyButton({ label, value }: Readonly<{ label: string; value: string }>) {
  const [message, setMessage] = useState("");

  async function copy() {
    setMessage((await copyText(value)) ? `${label}をコピーしました。` : `${label}をコピーできませんでした。`);
  }

  return <span className="hl-partner-copy">
    <button type="button" onClick={copy}>{label}をコピー</button>
    <span role="status" aria-live="polite">{message}</span>
  </span>;
}
