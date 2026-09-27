/**
 * ShipAdminShell — the admin chrome: a fixed left sidebar with logo and grouped
 * model nav, plus a top navbar and a main content area. Purely presentational;
 * the generated admin layout passes `nav`, the current `activeHref`, and any
 * right-edge `actions` (theme toggle, sign-out).
 */

import type { ReactNode } from 'react';

export interface AdminNavItem {
  label: string;
  href: string;
  /** Optional icon (emoji or short glyph). Falls back to a letter monogram. */
  icon?: string;
  description?: string;
  /** Optional section heading; consecutive items with the same value group. */
  group?: string;
}

export interface ShipAdminShellProps {
  title?: string;
  logo?: string;
  nav?: AdminNavItem[];
  /** Current pathname; the matching nav item is highlighted. */
  activeHref?: string;
  children: ReactNode;
  actions?: ReactNode;
}

function isActive(item: AdminNavItem, activeHref?: string): boolean {
  if (!activeHref) return false;
  if (item.href === '/admin') return activeHref === '/admin';
  return activeHref === item.href || activeHref.startsWith(`${item.href}/`);
}

function monogram(label: string): string {
  const first = label.trim().charAt(0);
  return first ? first.toUpperCase() : '•';
}

export function ShipAdminShell({
  title = 'Ship',
  logo,
  nav = [],
  activeHref,
  children,
  actions,
}: ShipAdminShellProps) {
  const groups: Array<{ group?: string; items: AdminNavItem[] }> = [];
  for (const item of nav) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }

  const activeItem = nav.find((item) => isActive(item, activeHref));
  const breadcrumb =
    activeItem && activeItem.href !== '/admin'
      ? `${activeItem.group ?? 'Collections'} / ${activeItem.label}`
      : 'Dashboard';

  return (
    <div className="flex min-h-screen bg-base-200 text-base-content">
      <aside className="flex w-64 shrink-0 flex-col border-r border-base-300 bg-base-100">
        <div className="flex items-center gap-3 border-b border-base-300 px-5 py-5">
          {logo ? (
            <img src={logo} alt={title} className="h-9 w-9 rounded-lg object-contain" />
          ) : null}
          <span className="text-lg font-bold tracking-tight">{title}</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="mb-4">
              {group.group ? (
                <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-base-content/50">
                  {group.group}
                </div>
              ) : null}
              <ul className="menu w-full gap-1">
                {group.items.map((item) => {
                  const active = isActive(item, activeHref);
                  return (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className={
                          active ? 'bg-primary text-primary-content font-medium' : undefined
                        }
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-base-200 text-xs font-semibold text-base-content/70">
                          {item.icon ?? monogram(item.label)}
                        </span>
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="navbar min-h-16 border-b border-base-300 bg-base-100 px-6">
          <div className="navbar-start">
            <span className="text-sm font-medium text-base-content/70">
              {breadcrumb}
            </span>
          </div>
          {actions ? <div className="navbar-end gap-2">{actions}</div> : null}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
