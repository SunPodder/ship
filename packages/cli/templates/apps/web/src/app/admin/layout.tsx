import { ShipAdminShell } from '@ship/ui';
import { adminNav } from '@/lib/admin-nav';
import { AuthGate } from '@/components/AuthGate';
import { SignOutButton } from '@/components/SignOutButton';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShipAdminShell
      title="Ship"
      logo="/ship-mark.jpg"
      nav={adminNav}
      actions={<SignOutButton />}
    >
      <AuthGate>{children}</AuthGate>
    </ShipAdminShell>
  );
}
