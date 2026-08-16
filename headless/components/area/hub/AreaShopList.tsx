"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaFilterChips } from "@/components/area/hub/AreaFilterChips";
import { AreaSortTabs } from "@/components/area/hub/AreaSortTabs";
import { AreaShopCard } from "@/components/common/AreaShopCard";
import { type AreaShopRankingEntry } from "@/lib/area-shop-ranking";
import {
  hasPriorityStationWalk,
  resolvePriorityAreaCapabilities,
  type PriorityAreaCapabilities,
} from "@/lib/priority-area-precision";
import {
  getFilterRelaxationSuggestions,
  filterAreaShops,
  prepareAreaShopListView,
  resolveAreaShopListCardRank,
  SHOP_LIST_FILTER_OPTIONS,
  SHOP_LIST_SORT_OPTIONS,
  type ShopListFilterId,
  type ShopListSortId
} from "@/lib/area-shop-list-controls";
import type { AreaView, ShopView } from "@/lib/wp/types";

const MOBILE_PAGE_SIZE = { initial: 7, loadMore: 7 };
const DESKTOP_PAGE_SIZE = { initial: 10, loadMore: 10 };
const VALID_FILTER_IDS = new Set(SHOP_LIST_FILTER_OPTIONS.map((option) => option.id));
const VALID_SORT_IDS = new Set(SHOP_LIST_SORT_OPTIONS.map((option) => option.id));

function parseShopListFiltersFromUrl(validFilterIds = VALID_FILTER_IDS): ShopListFilterId[] {
  if (typeof window === "undefined") return [];
  const params = new URLSearchParams(window.location.search);
  const rawFilters = params.get("filters") ?? params.get("filter");
  if (!rawFilters) return [];
  const seen = new Set<ShopListFilterId>();
  return rawFilters
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ShopListFilterId => validFilterIds.has(value as ShopListFilterId))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function parseShopListSortFromUrl(validSortIds = VALID_SORT_IDS): ShopListSortId {
  if (typeof window === "undefined") return "recommended";
  const param = new URLSearchParams(window.location.search).get("sort");
  return validSortIds.has(param as ShopListSortId) ? param as ShopListSortId : "recommended";
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
  legacyPage = 1,
  rankingEntries = [],
  precisionMode = false,
  capabilities = resolvePriorityAreaCapabilities(shops, targetArea),
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  legacyPage?: number;
  rankingEntries?: AreaShopRankingEntry[];
  precisionMode?: boolean;
  capabilities?: PriorityAreaCapabilities;
}) {
  const pageSize = useShopListPageSize();
  const [activeFilters, setActiveFilters] = useState<ShopListFilterId[]>([]);
  const [activeSort, setActiveSort] = useState<ShopListSortId>("recommended");
  const [visibleCount, setVisibleCount] = useState(pageSize.initial);
  const [urlReady, setUrlReady] = useState(false);

  const filterOptions = useMemo(
    () => precisionMode
      ? SHOP_LIST_FILTER_OPTIONS.filter((option) => (
          (option.id !== "beginner" || capabilities.beginner) &&
          (option.id !== "station" || capabilities.station)
        ))
      : SHOP_LIST_FILTER_OPTIONS,
    [capabilities.beginner, capabilities.station, precisionMode],
  );
  const sortOptions = useMemo(
    () => (precisionMode && !capabilities.station
      ? SHOP_LIST_SORT_OPTIONS.filter((option) => option.id !== "station")
      : SHOP_LIST_SORT_OPTIONS
    ).map((option) => precisionMode && option.id === "recommended"
      ? { ...option, label: "掲載順" }
      : option),
    [capabilities.station, precisionMode],
  );
  const orderedShops = useMemo(() => {
    if (!precisionMode) {
      return prepareAreaShopListView(shops, activeFilters, activeSort, targetArea, rankingEntries);
    }
    const stationRequested = activeFilters.includes("station");
    const filtersWithoutStation = activeFilters.filter((filter) => filter !== "station");
    const filtered = filterAreaShops(shops, filtersWithoutStation, targetArea)
      .filter((shop) => !stationRequested || hasPriorityStationWalk(shop));
    if (activeSort === "recommended") return filtered;
    if (activeSort === "station") {
      return [...filtered].sort((left, right) => Number(hasPriorityStationWalk(right)) - Number(hasPriorityStationWalk(left)));
    }
    return prepareAreaShopListView(filtered, [], activeSort, targetArea, []);
  }, [shops, activeFilters, activeSort, targetArea, rankingEntries, precisionMode]);
  const relaxSuggestions = useMemo(
    () => getFilterRelaxationSuggestions(shops, activeFilters, targetArea),
    [shops, activeFilters, targetArea]
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
    const syncControlsFromUrl = () => {
      const filters = parseShopListFiltersFromUrl(new Set(filterOptions.map(({ id }) => id)));
      const sort = parseShopListSortFromUrl(new Set(sortOptions.map(({ id }) => id)));
      setActiveFilters(filters);
      setActiveSort(sort);
      setUrlReady(true);
      if (filters.length === 0 && sort === "recommended") return;
      if (window.location.hash === "#shop-list" || window.location.hash === "") {
        requestAnimationFrame(() => {
          document.getElementById("shop-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };

    syncControlsFromUrl();
    window.addEventListener("popstate", syncControlsFromUrl);
    return () => window.removeEventListener("popstate", syncControlsFromUrl);
  }, [filterOptions, sortOptions]);

  useEffect(() => {
    if (!urlReady || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (activeFilters.length > 0) {
      url.searchParams.set("filters", activeFilters.join(","));
      url.searchParams.delete("filter");
    } else {
      url.searchParams.delete("filters");
      url.searchParams.delete("filter");
    }
    if (activeSort === "recommended") {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", activeSort);
    }

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) {
      window.history.replaceState({}, "", next);
    }
  }, [activeFilters, activeSort, urlReady]);

  const visibleShops = orderedShops.slice(0, visibleCount);
  const hasMore = visibleCount < orderedShops.length;
  const totalCount = shops.length;
  const filteredCount = orderedShops.length;
  const hasFilters = activeFilters.length > 0;
  const activeSortLabel = sortOptions.find((option) => option.id === activeSort)?.label ?? "おすすめ順";
  const mobileControlState = hasFilters ? `${activeFilters.length}条件` : activeSortLabel;

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
      <div className="area-shop-list-controls area-shop-list-controls--desktop">
        <AreaFilterChips
          id="shop-list-filters"
          activeFilters={activeFilters}
          onToggle={toggleFilter}
          onClear={() => setActiveFilters([])}
          options={filterOptions}
        />
        <AreaSortTabs activeSort={activeSort} onChange={setActiveSort} options={sortOptions} />
      </div>

      <details className="area-shop-list-mobile-drawer">
        <summary>
          <span>絞り込み・並び替え</span>
          <strong>{mobileControlState}</strong>
        </summary>
        <div className="area-shop-list-mobile-drawer__body">
          <AreaFilterChips
            id="shop-list-filters-mobile"
            activeFilters={activeFilters}
            onToggle={toggleFilter}
            onClear={() => setActiveFilters([])}
            options={filterOptions}
          />
          <AreaSortTabs activeSort={activeSort} onChange={setActiveSort} options={sortOptions} />
        </div>
      </details>

      <p className="area-shop-list-interactive__status" aria-live="polite">
        {statusText}
      </p>

      {filteredCount === 0 ? (
        <section className="area-shop-list-zero-state" aria-live="polite">
          <h3>条件に合う店舗がありません</h3>
          <p>絞り込みを少しゆるめると、候補店舗を表示できます。</p>
          {relaxSuggestions.length > 0 ? (
            <div className="area-shop-list-zero-state__suggestions" aria-label="外す条件の候補">
              {relaxSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => setActiveFilters(suggestion.filters)}
                >
                  {suggestion.label}（{suggestion.count}件）
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="area-shop-list-zero-state__clear" onClick={() => setActiveFilters([])}>
            すべての条件を解除
          </button>
        </section>
      ) : (
        <>
          <div className="area-hub-shop-group__list">
            {orderedShops.map((shop) => {
              const visible = visibleShops.some((item) => item.id === shop.id);
              const rank = precisionMode
                ? null
                : resolveAreaShopListCardRank(shop, orderedShops, {
                    route: "hub",
                    sortId: activeSort,
                    page: legacyPage
                  });
              return (
                <div
                  key={shop.id}
                  className={`area-shop-list-interactive__item${visible ? "" : " is-collapsed"}`}
                  hidden={!visible}
                >
                  <AreaShopCard
                    shop={shop}
                    targetArea={targetArea}
                    rank={rank}
                    showRank={rank !== null}
                  />
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
