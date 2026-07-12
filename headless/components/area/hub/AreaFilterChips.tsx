"use client";

import type { ShopListFilterId } from "@/lib/area-shop-list-controls";
import { SHOP_LIST_FILTER_OPTIONS } from "@/lib/area-shop-list-controls";

export function AreaFilterChips({
  activeFilters,
  onToggle,
  onClear,
  id
}: {
  activeFilters: ShopListFilterId[];
  onToggle: (id: ShopListFilterId) => void;
  onClear: () => void;
  id?: string;
}) {
  const hasFilters = activeFilters.length > 0;

  return (
    <div className="area-shop-list-controls__filters" id={id}>
      <div className="area-shop-list-controls__filters-head">
        <span className="area-shop-list-controls__label">条件で絞り込む</span>
        {hasFilters ? (
          <button type="button" className="area-shop-list-controls__clear" onClick={onClear}>
            絞り込みを解除
          </button>
        ) : null}
      </div>
      <div className="area-filter-chips" role="group" aria-label="店舗一覧の絞り込み">
        {SHOP_LIST_FILTER_OPTIONS.map((option) => {
          const active = activeFilters.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`area-filter-chips__chip${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
