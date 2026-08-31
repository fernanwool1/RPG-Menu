import type { Metadata, Viewport } from 'next';

import { AppShell } from '@/components/layout/AppShell';
import { CloudBoundary } from '@/components/layout/CloudBoundary';

import './globals.css';

export const metadata: Metadata = {
  title: 'Menu',
  description:
    'A personal productivity system laid out like a single-player RPG menu: quests, skills, abilities, inventory and a character sheet.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report anything other than zero on
  // notched devices; the shell pads itself with those insets.
  viewportFit: 'cover',
  themeColor: '#03050a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
         * Fonts are linked rather than bundled with next/font so that a build
         * never depends on network access. Both stacks fall back to a system
         * serif / sans, so the layout holds if the fonts do not arrive.
         */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- that rule
            targets the Pages Router's _document; in the App Router a <link> in
            the root layout is applied to every route, which is what we want. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <CloudBoundary><AppShell>{children}</AppShell></CloudBoundary>
      </body>
    </html>
  );
}
