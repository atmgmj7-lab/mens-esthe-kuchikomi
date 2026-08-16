"use client";

import Link from "next/link";
import { useId, useState, type KeyboardEvent } from "react";
import type { HomeUpdateItem } from "@/lib/home-updates";
import styles from "./UpdatesHub.module.css";

type UpdateFilter = "all" | HomeUpdateItem["category"];

const FILTER_LABELS: Record<UpdateFilter, string> = {
  all: "すべて",
  review: "口コミ",
  column: "編集部コラム",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}

export function UpdatesHub({ items }: { items: readonly HomeUpdateItem[] }) {
  const [active, setActive] = useState<UpdateFilter>("all");
  const id = useId().replace(/:/gu, "");
  if (items.length === 0) return null;

  const categories = [...new Set(items.map((item) => item.category))];
  const filters: UpdateFilter[] = ["all", ...categories];
  const visibleItems = active === "all" ? items : items.filter((item) => item.category === active);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % filters.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + filters.length) % filters.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = filters.length - 1;
    else return;

    event.preventDefault();
    const next = filters[nextIndex];
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`} data-updates-hub="true">
      <div className="escomi-home-container-v2">
        <div className="escomi-home-section-head-v2 escomi-home-section-head-v2--split">
          <div>
            <p className="escomi-section-eyebrow">LATEST UPDATES</p>
            <h2 id={`${id}-heading`}>関西メンズエステの最新情報</h2>
            <p>承認済み口コミと公開済み編集部コラムを、更新日順にまとめています。</p>
          </div>
          <Link href="/column/">編集部コラムを見る</Link>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="最新情報の種類">
          {filters.map((filter, index) => (
            <button
              id={`${id}-tab-${filter}`}
              type="button"
              role="tab"
              aria-selected={active === filter}
              aria-controls={`${id}-panel`}
              tabIndex={active === filter ? 0 : -1}
              key={filter}
              onClick={() => setActive(filter)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {FILTER_LABELS[filter]}
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          className={styles.list}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${active}`}
          aria-live="polite"
        >
          {visibleItems.map((item) => (
            <article className={styles.item} key={item.id} data-update-id={item.id}>
              <div className={styles.meta}>
                <span>{item.categoryLabel}</span>
                <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
                {item.areaName ? <span>{item.areaName}</span> : null}
              </div>
              <div className={styles.body}>
                <h3><Link href={item.url}>{item.title}</Link></h3>
                {item.summary ? <p>{item.summary}</p> : null}
              </div>
              <span className={styles.source}>{item.sourceLabel}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
