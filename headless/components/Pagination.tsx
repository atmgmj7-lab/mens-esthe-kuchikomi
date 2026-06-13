import Link from "next/link";

type Props = {
  currentPage?: number;
  totalPages?: number;
  basePath: string;
};

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  return `${basePath}?page=${page}`;
}

export function Pagination({ currentPage = 1, totalPages = 1, basePath }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);

  return (
    <nav className="navigation pagination" aria-label="ページ送り">
      <div className="nav-links">
        {pages.map((page) =>
          page === currentPage ? (
            <span
              key={page}
              className="page-numbers current"
              aria-current="page"
            >
              {page}
            </span>
          ) : (
            <Link key={page} href={pageHref(basePath, page)} className="page-numbers">
              {page}
            </Link>
          )
        )}
        {currentPage < totalPages ? (
          <Link href={pageHref(basePath, currentPage + 1)} className="page-numbers next">
            次へ »
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
