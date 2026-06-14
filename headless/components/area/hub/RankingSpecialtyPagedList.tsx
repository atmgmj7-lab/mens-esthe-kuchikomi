"use client";

import { useState } from "react";
import { RankingSpecialtyCards } from "@/components/area/hub/RankingSpecialtyCards";
import type { AreaView, ShopView } from "@/lib/wp/types";

type Variant = "late-night" | "beginner" | "station";

export function RankingSpecialtyPagedList({
  shops,
  targetArea,
  variant,
  pageSize = 5,
  ariaLabel
}: {
  shops: ShopView[];
  targetArea: Pick<AreaView, "slug" | "name">;
  variant: Variant;
  pageSize?: number;
  ariaLabel: string;
}) {
  const totalPages = Math.max(1, Math.ceil(shops.length / pageSize));
  const [page, setPage] = useState(0);
  const slice = shops.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="ranking-slice-pager">
      <RankingSpecialtyCards shops={slice} targetArea={targetArea} variant={variant} />
      {shops.length > pageSize ? (
        <nav className="ranking-slice-pager__nav" aria-label={ariaLabel}>
          <button
            type="button"
            className="ranking-slice-pager__btn"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            前の{pageSize}件
          </button>
          <span className="ranking-slice-pager__status">
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="ranking-slice-pager__btn"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            次の{pageSize}件
          </button>
        </nav>
      ) : null}
    </div>
  );
}
