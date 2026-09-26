/**
 * ShipPagination — controlled prev/next paging controls.
 */

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

export function ShipPagination({ page, pageCount, onPage }: PaginationProps) {
  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <div className="join">
      <button
        type="button"
        className="btn btn-sm"
        disabled={prevDisabled}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="btn btn-sm btn-disabled">{`Page ${page} of ${pageCount}`}</span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={nextDisabled}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
