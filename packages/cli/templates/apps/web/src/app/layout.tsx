import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ship Admin',
  description: 'Schema-first full-stack CMS',
  icons: { icon: '/ship-mark.jpg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
