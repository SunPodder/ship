import Link from 'next/link';

/**
 * Landing page for a Ship-scaffolded project.
 */
export default function HomePage() {
  return (
    <main className="hero min-h-screen bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <img
            src="/ship-logo.webp"
            alt="Ship"
            className="mx-auto h-20 object-contain"
          />
          <p className="mt-4 text-base-content/70">Schema-first full-stack CMS.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/admin" className="btn btn-primary">
              Open admin
            </Link>
            <a href="/login" className="btn">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
