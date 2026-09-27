/**
 * ShipCard — a bordered panel with optional header, body, and footer slots.
 * The generated admin uses it for list toolbars, forms, and dashboards.
 */

import type { ReactNode } from 'react';

export interface ShipCardProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned controls in the header (buttons, badges). */
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ShipCard({
  title,
  description,
  actions,
  children,
  footer,
  className = '',
}: ShipCardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section
      className={`card bg-base-100 border border-base-300 shadow-sm ${className}`}
    >
      {hasHeader ? (
        <div className="card-body border-b border-base-300 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title ? <h2 className="card-title">{title}</h2> : null}
              {description ? (
                <p className="text-sm text-base-content/60">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-2">{actions}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="card-body">{children}</div>
      {footer ? (
        <div className="card-body border-t border-base-300 py-4">{footer}</div>
      ) : null}
    </section>
  );
}
