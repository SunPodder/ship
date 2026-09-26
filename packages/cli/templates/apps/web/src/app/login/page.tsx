'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login, setToken } from '@/lib/auth';

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
    <main className="min-h-screen flex items-center justify-center bg-base-200 p-6">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <img src="/ship-logo.webp" alt="Ship" className="h-12 object-contain mx-auto" />
          <h2 className="card-title justify-center">Sign in</h2>
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
              <span className="label-text">Password</span>
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
