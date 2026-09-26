/**
 * ShipTable — a generic, controlled data table. Rendering stays presentational:
 * sorting state and row selection live in the parent.
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
}

function cellValue<T>(row: T, column: Column<T>): string {
  const field = column.field as string;
  return String((row as Record<string, unknown>)[field]);
}

export function ShipTable<T>({
  columns,
  data,
  rowKey,
  sortField,
  sortOrder,
  onSort,
}: TableProps<T>) {
  const nextOrder = (field: string): 'asc' | 'desc' =>
    sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <table className="table table-zebra">
      <thead>
        <tr>
          {columns.map((column) => {
            const field = column.field ?? '';
            return (
              <th key={column.label}>
                {column.sortable && onSort ? (
                  <button
                    type="button"
                    className="font-medium"
                    onClick={() => onSort(field, nextOrder(field))}
                  >
                    {column.label}
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
        {data.map((row, index) => {
          const key = rowKey ? rowKey(row) : String(index);
          return (
            <tr key={key}>
              {columns.map((column) => (
                <td key={column.label}>
                  {column.render ? column.render(row) : cellValue(row, column)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
