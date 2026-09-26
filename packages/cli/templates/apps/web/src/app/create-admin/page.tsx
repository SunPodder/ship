'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasAdmin, registerFirstAdmin, setToken } from '@/lib/auth';

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
    return <main className="min-h-screen grid place-items-center bg-base-200">Loading…</main>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <img src="/ship-logo.webp" alt="Ship" className="h-12 object-contain mx-auto" />
          <h2 className="card-title justify-center">Create your first admin user</h2>
          <p className="text-sm text-base-content/70 text-center">
            Set up the admin account to get started.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <label className="form-control">
              <span className="label-text">Email</span>
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
              <span className="label-text">Password (min 8 characters)</span>
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
