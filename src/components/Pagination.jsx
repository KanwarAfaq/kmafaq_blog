import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function pageWindow(page, totalPages) {
  const values = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...values].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
}

export default function Pagination({ page, totalPages, makeHref, isUrdu = false }) {
  if (totalPages <= 1) return null;
  const pages = pageWindow(page, totalPages);

  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-2" aria-label="Blog pagination">
      <Link
        to={makeHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${page === 1 ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-200 bg-white text-ink hover:border-primary hover:text-primary'}`}
      >
        <ChevronLeft className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} aria-hidden="true" />
        <span className="hidden sm:inline">{isUrdu ? 'پچھلا' : 'Previous'}</span>
      </Link>

      {pages.map((value, index) => {
        const previous = pages[index - 1];
        return (
          <span key={value} className="contents">
            {previous && value - previous > 1 ? <span className="px-1 text-gray-400">…</span> : null}
            <Link
              to={makeHref(value)}
              aria-current={value === page ? 'page' : undefined}
              className={`grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-black transition ${value === page ? 'bg-primary text-white shadow-sm' : 'border border-gray-200 bg-white text-ink hover:border-primary hover:text-primary'}`}
            >
              {value}
            </Link>
          </span>
        );
      })}

      <Link
        to={makeHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${page === totalPages ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-200 bg-white text-ink hover:border-primary hover:text-primary'}`}
      >
        <span className="hidden sm:inline">{isUrdu ? 'اگلا' : 'Next'}</span>
        <ChevronRight className={`h-4 w-4 ${isUrdu ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Link>
    </nav>
  );
}
