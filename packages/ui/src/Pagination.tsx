/**
 * ShipPagination — controlled prev/next paging. Because the list API has no
 * count endpoint, "has next" is discovered by over-fetching one row, so the
 * parent passes an explicit `hasNext` flag instead of a page count.
 */

export interface PaginationProps {
  page: number;
  hasNext: boolean;
  onPage: (page: number) => void;
}

export function ShipPagination({ page, hasNext, onPage }: PaginationProps) {
  const prevDisabled = page <= 1;

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-base-content/60">Page {page}</span>
      <div className="join">
        <button
          type="button"
          className="btn btn-sm"
          disabled={prevDisabled}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!hasNext}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
