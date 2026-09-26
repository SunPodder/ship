import Link from 'next/link';

/**
 * Admin dashboard — the landing view inside the shell.
 */
export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-base-content/70">
        Ship fast. Cache smart. Scale painlessly.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/media" className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Media</h2>
            <p className="text-sm text-base-content/70">
              Upload and manage images, files, and optimized WebP variants.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
