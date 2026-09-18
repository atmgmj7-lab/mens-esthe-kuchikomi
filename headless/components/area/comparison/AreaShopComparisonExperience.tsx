"use client";

import Link from "next/link";
import { PromotionDisclosureBadge } from "@/components/common/PromotionDisclosureBadge";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  canOpenAreaShopComparison,
  reduceAreaShopComparison,
} from "@/lib/area-shop-comparison-state";
import type {
  AreaShopComparisonFact,
  AreaShopComparisonItem,
} from "@/lib/area-shop-comparison";
import { visibleComparisonFieldKeys } from "@/lib/area-shop-comparison-facts";
import styles from "./AreaShopComparisonExperience.module.css";

type ComparisonContextValue = Readonly<{
  itemById: ReadonlyMap<number, AreaShopComparisonItem>;
  selectedIds: readonly number[];
  limitReached: boolean;
  toggle: (shopId: number) => void;
}>;

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

export function AreaShopComparisonToggle({
  shopId,
  location,
  className = "",
}: {
  shopId: number;
  location: "featured" | "natural";
  className?: string;
}) {
  const context = useContext(ComparisonContext);
  if (!context?.itemById.has(shopId)) return null;
  const selected = context.selectedIds.includes(shopId);
  return (
    <button
      type="button"
      className={`${styles.toggle} ${selected ? styles.toggleSelected : ""} ${className}`.trim()}
      aria-pressed={selected}
      onClick={() => context.toggle(shopId)}
      data-area-comparison-control="true"
      data-area-comparison-shop={shopId}
      data-area-comparison-location={location}
    >
      {selected ? "比較中 ✓" : "比較に追加"}
    </button>
  );
}

function FactValue({ fact }: { fact: AreaShopComparisonFact }) {
  const content = fact.status === "confirmed" && fact.href ? (
    <a href={fact.href} target="_blank" rel={fact.rel ?? "noreferrer"}>{fact.value}</a>
  ) : fact.value;
  return (
    <span className={fact.status === "confirmed" ? styles.verified : styles.unverified}>
      {content}
    </span>
  );
}

const COMPARISON_FIELDS = [
  ["hours", "営業時間"],
  ["afterMidnight", "24時以降営業"],
  ["line", "LINE予約"],
  ["official", "公式サイト"],
  ["access", "アクセス"],
  ["information", "情報確認状況"],
] as const;

const DEFERRED_COMPARISON_FIELDS = [
  ["price", "料金"],
  ["webBooking", "Web予約"],
] as const;

function ComparisonDialog({
  areaName,
  selectedItems,
  open,
  onClose,
  dialogRef,
}: {
  areaName: string;
  selectedItems: readonly AreaShopComparisonItem[];
  open: boolean;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const comparisonColumns = {
    "--comparison-columns": selectedItems.length,
  } as CSSProperties;
  const fieldLabels = new Map([...COMPARISON_FIELDS, ...DEFERRED_COMPARISON_FIELDS]);
  const visibleFieldKeys = visibleComparisonFieldKeys(
    selectedItems,
    COMPARISON_FIELDS.map(([key]) => key),
    DEFERRED_COMPARISON_FIELDS.map(([key]) => key),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [dialogRef, open]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="area-shop-comparison-title"
      data-area-comparison-dialog="true"
      data-area-comparison-scroll-lock={open ? "true" : "false"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.dialogHeader}>
        <div>
          <p className={styles.eyebrow}>SHOP COMPARISON</p>
          <h2 id="area-shop-comparison-title">{areaName}の店舗を比較</h2>
          <p>公式確認できた情報だけを並べています。未確認項目は推測で補いません。</p>
        </div>
        <button ref={closeButtonRef} type="button" className={styles.close} onClick={onClose}>
          閉じる
        </button>
      </div>

      <div className={styles.shopHeadings} style={comparisonColumns}>
        {selectedItems.map((item) => (
          <article key={item.shopId} className={styles.shopHeading}>
            <p>{item.relation.areaName}・{item.relation.label}</p>
            <h3>{item.name}</h3>
            {item.requiresPromotionDisclosure ? <PromotionDisclosureBadge /> : null}
            <div className={styles.headingActions}>
              <Link href={item.detailUrl} data-area-comparison-detail={item.shopId} onClick={onClose}>
                店舗詳細を見る<span aria-hidden="true"> →</span>
              </Link>
              <Link href={item.reviewSubmitUrl} data-review-prefill="comparison" onClick={onClose}>
                口コミを書く
              </Link>
            </div>
          </article>
        ))}
      </div>

      <dl className={styles.fields}>
        {visibleFieldKeys.map((key) => (
          <div
            key={key}
            className={styles.field}
            data-area-comparison-field={key}
            style={comparisonColumns}
          >
            <dt>{fieldLabels.get(key)}</dt>
            {selectedItems.map((item) => (
              <dd key={item.shopId}>
                <span className={styles.mobileShopName}>{item.name}</span>
                <FactValue fact={item[key]} />
                {key === "information" && item.reviewedAt ? (
                  <small>最終確認 <time dateTime={item.reviewedAt}>{item.reviewedAt}</time></small>
                ) : null}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </dialog>
  );
}

export function AreaShopComparisonProvider({
  areaName,
  items,
  children,
}: {
  areaName: string;
  items: readonly AreaShopComparisonItem[];
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(reduceAreaShopComparison, {
    selectedIds: [],
    limitReached: false,
  });
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const itemById = useMemo(() => new Map(items.map((item) => [item.shopId, item])), [items]);
  const selectedItems = state.selectedIds.flatMap((id) => {
    const item = itemById.get(id);
    return item ? [item] : [];
  });
  const canOpen = canOpenAreaShopComparison(state.selectedIds);

  if (items.length === 0) return children;

  const closeComparison = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    setOpen(false);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  return (
    <ComparisonContext.Provider value={{
      itemById,
      selectedIds: state.selectedIds,
      limitReached: state.limitReached,
      toggle: (shopId) => dispatch({ type: "toggle", shopId }),
    }}>
      <noscript><style>{`[data-area-comparison-control="true"],[data-area-comparison-launcher="true"],[data-area-comparison-dialog="true"]{display:none!important}`}</style></noscript>
      {children}
      <aside
        className={styles.launcher}
        hidden={state.selectedIds.length === 0}
        data-area-comparison-launcher="true"
        data-active={state.selectedIds.length > 0 ? "true" : "false"}
        aria-label="選択中の比較店舗"
      >
        <div className={styles.launcherSummary}>
          <strong>{state.selectedIds.length}店舗を選択中</strong>
          <button type="button" onClick={() => dispatch({ type: "clear" })}>すべて解除</button>
        </div>
        <ul className={styles.selectedList}>
          {selectedItems.map((item) => (
            <li key={item.shopId}>
              <span>{item.name}</span>
              <button
                type="button"
                aria-label={`${item.name}を比較から外す`}
                onClick={() => dispatch({ type: "remove", shopId: item.shopId })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.launcherAction}>
          <p role="status" aria-live="polite">
            {state.limitReached
              ? "比較は3店舗までです"
              : canOpen
                ? "確認済み情報を横並びで見られます"
                : "あと1店舗選ぶと比較できます"}
          </p>
          <button
            ref={openerRef}
            type="button"
            disabled={!canOpen}
            onClick={() => setOpen(true)}
            data-area-comparison-open="true"
          >
            {state.selectedIds.length}店舗を比較
          </button>
        </div>
      </aside>
      <ComparisonDialog
        areaName={areaName}
        selectedItems={selectedItems}
        open={open}
        onClose={closeComparison}
        dialogRef={dialogRef}
      />
    </ComparisonContext.Provider>
  );
}
