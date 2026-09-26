/**
 * ShipAdminShell — the admin chrome: a fixed left sidebar with the Ship logo
 * and model nav, plus a top navbar and a main content area. Purely
 * presentational; the generated admin layout passes `nav` items and renders
 * pages as children.
 */
import type { ReactNode } from 'react';

export interface AdminNavItem {
  label: string;
  href: string;
}

export interface ShipAdminShellProps {
  title?: string;
  /** Public path to the logo mark. */
  logo?: string;
  nav?: AdminNavItem[];
  children: ReactNode;
  /** Optional controls rendered at the navbar's right edge (e.g. user menu / logout). */
  actions?: ReactNode;
}

export function ShipAdminShell({
  title = 'Ship',
  logo,
  nav = [],
  children,
  actions,
}: ShipAdminShellProps) {
  return (
    <div className="flex min-h-screen bg-base-100 text-base-content">
      <aside className="w-64 shrink-0 bg-base-200 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-base-300">
          {logo ? (
            <img src={logo} alt={title} className="h-9 w-9 object-contain" />
          ) : null}
          <span className="text-lg font-bold tracking-tight">{title}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="menu w-full gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="navbar bg-base-100 border-b border-base-300">
          <div className="navbar-start px-6">
            <span className="text-sm text-base-content/70">
              Ship fast. Cache smart. Scale painlessly.
            </span>
          </div>
          {actions ? <div className="navbar-end px-6">{actions}</div> : null}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
