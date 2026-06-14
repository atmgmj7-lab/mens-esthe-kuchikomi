"use client";

import { useEffect, useMemo, useState } from "react";
import { ShopCardLuxury } from "@/components/area/hub/ShopCardLuxury";
import { AreaFilterChips } from "@/components/area/hub/AreaFilterChips";
import { AreaSortTabs } from "@/components/area/hub/AreaSortTabs";
import {
  prepareAreaShopListView,
  SHOP_LIST_FILTER_OPTIONS,
  type ShopListFilterId,
  type ShopListSortId
} from "@/lib/area-shop-list-controls";
import type { AreaView, ShopView } from "@/lib/wp/types";

const MOBILE_PAGE_SIZE = { initial: 7, loadMore: 7 };
const DESKTOP_PAGE_SIZE = { initial: 10, loadMore: 10 };
const VALID_FILTER_IDS = new Set(SHOP_LIST_FILTER_OPTIONS.map((option) => option.id));

function parseShopListFilterFromUrl(): ShopListFilterId | null {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("filter");
  if (!param || !VALID_FILTER_IDS.has(param as ShopListFilterId)) return null;
  return param as ShopListFilterId;
}

function useShopListPageSize() {
  const [sizes, setSizes] = useState(MOBILE_PAGE_SIZE);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setSizes(media.matches ? DESKTOP_PAGE_SIZE : MOBILE_PAGE_SIZE);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return sizes;
}

export function AreaShopList({
  shops,
  targetArea,
  legacyPage = 1
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  legacyPage?: number;
}) {
  const pageSize = useShopListPageSize();
  const [activeFilters, setActiveFilters] = useState<ShopListFilterId[]>([]);
  const [activeSort, setActiveSort] = useState<ShopListSortId>("recommended");
  const [visibleCount, setVisibleCount] = useState(pageSize.initial);

  const orderedShops = useMemo(
    () => prepareAreaShopListView(shops, activeFilters, activeSort, targetArea),
    [shops, activeFilters, activeSort, targetArea]
  );

  useEffect(() => {
    setVisibleCount(pageSize.initial);
  }, [activeFilters, activeSort, pageSize.initial]);

  useEffect(() => {
    if (legacyPage <= 1) return;
    requestAnimationFrame(() => {
      document.getElementById("shop-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [legacyPage]);

  useEffect(() => {
    const syncFilterFromUrl = () => {
      const filter = parseShopListFilterFromUrl();
      if (!filter) return;
      setActiveFilters([filter]);
      if (window.location.hash === "#shop-list" || window.location.hash === "") {
        requestAnimationFrame(() => {
          document.getElementById("shop-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };

    syncFilterFromUrl();
    window.addEventListener("popstate", syncFilterFromUrl);
    return () => window.removeEventListener("popstate", syncFilterFromUrl);
  }, []);

  const visibleShops = orderedShops.slice(0, visibleCount);
  const hasMore = visibleCount < orderedShops.length;
  const totalCount = shops.length;
  const filteredCount = orderedShops.length;
  const hasFilters = activeFilters.length > 0;

  const statusText = hasFilters
    ? `該当${filteredCount}件（全${totalCount}件中）${Math.min(visibleCount, filteredCount)}件表示中`
    : `全${totalCount}件中 ${Math.min(visibleCount, filteredCount)}件表示中`;

  const toggleFilter = (id: ShopListFilterId) => {
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="area-shop-list-interactive">
      <AreaFilterChips
        activeFilters={activeFilters}
        onToggle={toggleFilter}
        onClear={() => setActiveFilters([])}
      />
      <AreaSortTabs activeSort={activeSort} onChange={setActiveSort} />

      <p className="area-shop-list-interactive__status" aria-live="polite">
        {statusText}
      </p>

      {filteredCount === 0 ? (
        <p className="area-hub-section__empty">条件に合う店舗がありません。絞り込みを解除して再度お試しください。</p>
      ) : (
        <>
          <div className="area-hub-shop-group__list">
            {orderedShops.map((shop) => {
              const visible = visibleShops.some((item) => item.id === shop.id);
              return (
                <div
                  key={shop.id}
                  className={`area-shop-list-interactive__item${visible ? "" : " is-collapsed"}`}
                  hidden={!visible}
                >
                  <ShopCardLuxury shop={shop} targetArea={targetArea} />
                </div>
              );
            })}
          </div>

          {hasMore ? (
            <div className="area-shop-list-interactive__more">
              <button
                type="button"
                className="area-hub-btn area-hub-btn--outline area-shop-list-interactive__more-btn"
                onClick={() => setVisibleCount((count) => count + pageSize.loadMore)}
              >
                もっと見る（あと{Math.max(0, filteredCount - visibleCount)}件）
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
