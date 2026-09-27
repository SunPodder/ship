/**
 * ShipTable — a generic, controlled, full-bleed data table. Rendering stays
 * presentational: sorting and row-selection state live in the parent. Emits an
 * empty-state row when `data` is empty, sort chevrons on sortable columns, and
 * an optional leading checkbox column for bulk selection.
 */

import type { ReactNode } from 'react';

export interface Column<T> {
  field?: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey?: (row: T) => string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string, order: 'asc' | 'desc') => void;
  /** Rendered inside the single empty-state cell when `data` is empty. */
  empty?: ReactNode;
  /** Show a leading checkbox column for bulk selection. */
  selectable?: boolean;
  /** Row keys currently selected (requires `rowKey`). */
  selectedKeys?: ReadonlySet<string>;
  onSelectRow?: (key: string) => void;
  onSelectAll?: () => void;
}

function cellValue<T>(row: T, column: Column<T>): string {
  const field = column.field as string;
  const value = (row as Record<string, unknown>)[field];
  return value == null ? '' : String(value);
}

function SortIcon({ sorted, order }: { sorted: boolean; order?: 'asc' | 'desc' }) {
  return (
    <span className="flex flex-col text-[9px] leading-none">
      <span className={sorted && order === 'asc' ? 'text-primary' : 'text-base-content/30'}>
        ▲
      </span>
      <span className={sorted && order === 'desc' ? 'text-primary' : 'text-base-content/30'}>
        ▼
      </span>
    </span>
  );
}

export function ShipTable<T>({
  columns,
  data,
  rowKey,
  sortField,
  sortOrder,
  onSort,
  empty,
  selectable,
  selectedKeys,
  onSelectRow,
  onSelectAll,
}: TableProps<T>) {
  const nextOrder = (field: string): 'asc' | 'desc' =>
    sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';

  const keyFor = (row: T, index: number): string =>
    rowKey ? rowKey(row) : String(index);

  const allSelected =
    selectable === true &&
    data.length > 0 &&
    selectedKeys != null &&
    data.every((row, index) => selectedKeys.has(keyFor(row, index)));

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra">
        <thead>
          <tr>
            {selectable ? (
              <th className="w-10">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={allSelected}
                  onChange={onSelectAll}
                  aria-label="Select all"
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const field = column.field ?? '';
              const sorted = sortField === field;
              return (
                <th key={column.label}>
                  {column.sortable && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 font-medium"
                      onClick={() => onSort(field, nextOrder(field))}
                    >
                      {column.label}
                      <SortIcon sorted={sorted} order={sortOrder} />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center">
                {empty ?? 'No records'}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const key = keyFor(row, index);
              const checked = selectedKeys?.has(key) ?? false;
              return (
                <tr key={key}>
                  {selectable ? (
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={checked}
                        onChange={() => onSelectRow?.(key)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.label}>
                      {column.render ? column.render(row) : cellValue(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
