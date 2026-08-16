"use client";

import type { ShopListSortId } from "@/lib/area-shop-list-controls";
import { SHOP_LIST_SORT_OPTIONS } from "@/lib/area-shop-list-controls";

export function AreaSortTabs({
  activeSort,
  onChange,
  options = SHOP_LIST_SORT_OPTIONS,
}: {
  activeSort: ShopListSortId;
  onChange: (id: ShopListSortId) => void;
  options?: typeof SHOP_LIST_SORT_OPTIONS;
}) {
  return (
    <div className="area-shop-list-controls__sort">
      <span className="area-shop-list-controls__label">並び替え</span>
      <div className="area-sort-tabs" role="group" aria-label="店舗一覧の並び替え">
        {options.map((option) => {
          const active = activeSort === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`area-sort-tabs__tab${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
