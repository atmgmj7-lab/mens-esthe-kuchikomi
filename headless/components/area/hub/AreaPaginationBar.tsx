"use client";

import Link from "next/link";

type Props = {
  currentPage?: number;
  totalPages?: number;
  basePath: string;
  scrollTargetId?: string;
};

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}?page=${page}`;
}

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage > 2) pages.add(currentPage - 2);
  if (currentPage < totalPages - 1) pages.add(currentPage + 2);

  return [...pages].sort((a, b) => a - b);
}

export function AreaPaginationBar({
  currentPage = 1,
  totalPages = 1,
  basePath,
  scrollTargetId = "shop-list"
}: Props) {
  if (totalPages <= 1) return null;

  const pages = buildPageNumbers(currentPage, totalPages);

  const scrollToList = () => {
    requestAnimationFrame(() => {
      const target = document.getElementById(scrollTargetId);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <nav className="area-pagination-bar" aria-label="店舗一覧のページ送り">
      <p className="area-pagination-bar__status">
        <span className="area-pagination-bar__current">{currentPage}</span>
        <span className="area-pagination-bar__sep">/</span>
        <span>{totalPages}</span>
        <span className="area-pagination-bar__label">ページ</span>
      </p>

      <div className="area-pagination-bar__links">
        {currentPage > 1 ? (
          <Link
            href={pageHref(basePath, currentPage - 1)}
            className="area-pagination-bar__pill area-pagination-bar__pill--nav"
            onClick={scrollToList}
            rel="prev"
          >
            前へ
          </Link>
        ) : null}

        {pages.map((page, index) => {
          const prev = pages[index - 1];
          const showGap = index > 0 && prev != null && page - prev > 1;

          return (
            <span key={page} className="area-pagination-bar__page-wrap">
              {showGap ? (
                <span className="area-pagination-bar__gap" aria-hidden="true">
                  …
                </span>
              ) : null}
              {page === currentPage ? (
                <span className="area-pagination-bar__pill area-pagination-bar__pill--active" aria-current="page">
                  {page}
                </span>
              ) : (
                <Link
                  href={pageHref(basePath, page)}
                  className="area-pagination-bar__pill"
                  onClick={scrollToList}
                >
                  {page}
                </Link>
              )}
            </span>
          );
        })}

        {currentPage < totalPages ? (
          <Link
            href={pageHref(basePath, currentPage + 1)}
            className="area-pagination-bar__pill area-pagination-bar__pill--nav"
            onClick={scrollToList}
            rel="next"
          >
            次へ
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
