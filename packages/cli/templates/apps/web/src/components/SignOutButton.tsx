'use client';

import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        clearToken();
        router.replace('/login');
      }}
    >
      Sign out
    </button>
  );
}
