'use client';

import { usePathname } from 'next/navigation';
import { ShipAdminShell, ShipToastProvider } from '@ship/ui';
import { adminNav } from '@/lib/admin-nav';
import { AuthGate } from '@/components/AuthGate';
import { SignOutButton } from '@/components/SignOutButton';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ShipToastProvider>
      <AuthGate>
        <ShipAdminShell
          title="Ship"
          logo="/ship-mark.jpg"
          nav={adminNav}
          activeHref={pathname}
          actions={
            <>
              <ThemeToggle />
              <SignOutButton />
            </>
          }
        >
          {children}
        </ShipAdminShell>
      </AuthGate>
    </ShipToastProvider>
  );
}
