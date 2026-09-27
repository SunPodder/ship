/**
 * ShipEmptyState — centered placeholder for empty collections or no-match
 * searches. Gives the user a clear "empty" signal plus a path forward.
 */

import type { ReactNode } from 'react';

export interface ShipEmptyStateProps {
  /** Optional icon (emoji or node). */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function ShipEmptyState({
  icon,
  title,
  description,
  action,
}: ShipEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon ? <div className="text-4xl mb-3">{icon}</div> : null}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-base-content/60">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
