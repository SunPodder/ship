'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasAdmin, registerFirstAdmin, setToken } from '@/lib/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * First-run bootstrap — creates the initial admin user, then redirects to the
 * admin panel (mirrors PayloadCMS's first-run flow).
 */
export default function CreateAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    hasAdmin()
      .then((exists) => {
        if (exists) router.replace('/login');
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await registerFirstAdmin(email, password);
      setToken(token);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create admin');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-base-200 p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-center gap-3">
            <img src="/ship-mark.jpg" alt="" className="h-10 w-10 rounded-lg object-contain" />
            <span className="text-2xl font-bold tracking-tight">Ship</span>
          </div>
          <h1 className="card-title justify-center">Create your first admin user</h1>
          <p className="text-center text-sm text-base-content/60">
            Set up the admin account to get started.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <label className="form-control">
              <span className="label-text font-medium">Email</span>
              <input
                className="input input-bordered"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text font-medium">Password (min 8 characters)</span>
              <input
                className="input input-bordered"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create admin'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
