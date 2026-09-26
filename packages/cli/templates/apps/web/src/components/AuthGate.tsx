'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, hasAdmin, me } from '@/lib/auth';

/**
 * Client-side auth gate for the admin area: redirects unauthenticated visitors
 * to the first-run admin creation (or login) before rendering children.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const token = getToken();
    if (!token) {
      hasAdmin()
        .then((exists) => {
          if (active) router.replace(exists ? '/login' : '/create-admin');
        })
        .catch(() => {
          if (active) router.replace('/login');
        });
      return;
    }
    me(token).then((user) => {
      if (!active) return;
      if (user) setReady(true);
      else router.replace('/login');
    });
    return () => {
      active = false;
    };
  }, [router, pathname]);

  if (!ready) {
    return <main className="min-h-screen grid place-items-center">Loading…</main>;
  }

  return <>{children}</>;
}
