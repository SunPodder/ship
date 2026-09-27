'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login, setToken } from '@/lib/auth';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Login page — email + password against the Ship API.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await login(email, password);
      setToken(token);
      router.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
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
          <h1 className="card-title justify-center">Sign in</h1>
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
              <span className="label-text font-medium">Password</span>
              <input
                className="input input-bordered"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
