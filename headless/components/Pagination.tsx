type Props = {
  currentPage?: number;
  totalPages?: number;
};

export function Pagination({ currentPage = 1, totalPages = 1 }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1);

  return (
    <nav className="navigation pagination" aria-label="ページ送り">
      <div className="nav-links">
        {pages.map((page) => (
          <span
            key={page}
            className={`page-numbers ${page === currentPage ? "current" : ""}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </span>
        ))}
        {currentPage < totalPages ? (
          <span className="page-numbers next">次へ »</span>
        ) : null}
      </div>
    </nav>
  );
}
