import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ship Admin',
  description: 'Schema-first full-stack CMS',
  icons: { icon: '/ship-mark.jpg' },
};

/** Apply the persisted theme before first paint to avoid a light flash. */
const themeInit = `(function(){try{var t=localStorage.getItem('ship_theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
